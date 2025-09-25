"""
GDPR and compliance utilities
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from pathlib import Path

from app.database import SessionLocal
from app.models.database import FileUpload, AuditLog, ProcessingJob, ExtractedData
from app.security.encryption import FileEncryption
from app.utils.logging import get_logger

logger = get_logger(__name__)


class ComplianceManager:
    """Manager for GDPR and compliance features"""

    def __init__(self):
        self.encryption = FileEncryption()

    async def handle_data_deletion_request(self, user_id: str) -> Dict[str, Any]:
        """
        Handle GDPR data deletion request for a user

        Args:
            user_id: ID of the user requesting data deletion

        Returns:
            Deletion summary
        """
        try:
            logger.info(f"Processing data deletion request for user: {user_id}")

            db = SessionLocal()
            try:
                deletion_summary = {
                    "user_id": user_id,
                    "deletion_date": datetime.utcnow().isoformat(),
                    "files_deleted": 0,
                    "jobs_deleted": 0,
                    "audit_logs_anonymized": 0,
                    "extracted_data_deleted": 0,
                    "errors": []
                }

                # 1. Delete user's files
                user_files = db.query(FileUpload).filter(
                    FileUpload.user_id == user_id,
                    FileUpload.deleted_at.is_(None)
                ).all()

                for file_record in user_files:
                    try:
                        # Securely delete physical file
                        file_path = Path(file_record.file_path)
                        if file_path.exists():
                            success, message = self.encryption.secure_delete_file(file_path)
                            if not success:
                                deletion_summary["errors"].append(
                                    f"Failed to securely delete file {file_record.id}: {message}"
                                )

                        # Mark as deleted in database
                        file_record.deleted_at = datetime.utcnow()
                        file_record.user_id = None  # Anonymize
                        deletion_summary["files_deleted"] += 1

                    except Exception as e:
                        deletion_summary["errors"].append(
                            f"Error deleting file {file_record.id}: {str(e)}"
                        )

                # 2. Delete or anonymize processing jobs
                user_jobs = db.query(ProcessingJob).filter(
                    ProcessingJob.user_id == user_id
                ).all()

                for job in user_jobs:
                    try:
                        # Clear result data that might contain personal info
                        job.result = None
                        job.error_details = None
                        job.user_id = None  # Anonymize
                        deletion_summary["jobs_deleted"] += 1
                    except Exception as e:
                        deletion_summary["errors"].append(
                            f"Error anonymizing job {job.id}: {str(e)}"
                        )

                # 3. Delete extracted data
                extracted_data_records = db.query(ExtractedData).filter(
                    ExtractedData.file_id.in_([f.id for f in user_files])
                ).all()

                for record in extracted_data_records:
                    try:
                        db.delete(record)
                        deletion_summary["extracted_data_deleted"] += 1
                    except Exception as e:
                        deletion_summary["errors"].append(
                            f"Error deleting extracted data {record.id}: {str(e)}"
                        )

                # 4. Anonymize audit logs (keep for compliance but remove personal data)
                user_audit_logs = db.query(AuditLog).filter(
                    AuditLog.user_id == user_id
                ).all()

                for log in user_audit_logs:
                    try:
                        log.user_id = "deleted_user"  # Anonymize
                        # Remove personal data from details
                        if log.details:
                            anonymized_details = self._anonymize_audit_details(log.details)
                            log.details = anonymized_details
                        deletion_summary["audit_logs_anonymized"] += 1
                    except Exception as e:
                        deletion_summary["errors"].append(
                            f"Error anonymizing audit log {log.id}: {str(e)}"
                        )

                # 5. Create final audit log for the deletion
                deletion_audit = AuditLog(
                    action="gdpr_data_deletion",
                    user_id="system",
                    details={
                        "subject_user_id": user_id,
                        "deletion_summary": deletion_summary,
                        "gdpr_request": True
                    }
                )
                db.add(deletion_audit)

                db.commit()

                logger.info(f"Data deletion completed for user {user_id}: {deletion_summary}")
                return deletion_summary

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error processing data deletion request for user {user_id}: {str(e)}")
            return {
                "user_id": user_id,
                "error": str(e),
                "deletion_date": datetime.utcnow().isoformat(),
                "success": False
            }

    async def generate_data_export(self, user_id: str) -> Dict[str, Any]:
        """
        Generate GDPR data export for a user

        Args:
            user_id: ID of the user requesting data export

        Returns:
            User's data summary
        """
        try:
            logger.info(f"Generating data export for user: {user_id}")

            db = SessionLocal()
            try:
                export_data = {
                    "user_id": user_id,
                    "export_date": datetime.utcnow().isoformat(),
                    "files": [],
                    "processing_jobs": [],
                    "audit_logs": [],
                    "extracted_data": []
                }

                # Get user's files
                user_files = db.query(FileUpload).filter(
                    FileUpload.user_id == user_id,
                    FileUpload.deleted_at.is_(None)
                ).all()

                for file_record in user_files:
                    export_data["files"].append({
                        "id": file_record.id,
                        "filename": file_record.filename,
                        "size": file_record.file_size,
                        "mime_type": file_record.mime_type,
                        "upload_date": file_record.created_at.isoformat(),
                        "processing_status": file_record.processing_status,
                        "form_type": file_record.form_type,
                        "confidence_score": file_record.confidence_score,
                        "expires_at": file_record.expires_at.isoformat() if file_record.expires_at else None
                    })

                # Get user's processing jobs
                user_jobs = db.query(ProcessingJob).filter(
                    ProcessingJob.user_id == user_id
                ).all()

                for job in user_jobs:
                    job_data = {
                        "id": job.id,
                        "status": job.status,
                        "created_at": job.created_at.isoformat(),
                        "started_at": job.started_at.isoformat() if job.started_at else None,
                        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                        "priority": job.priority,
                        "retry_count": job.retry_count
                    }

                    # Include non-sensitive result data
                    if job.result and job.status == "completed":
                        job_data["result_summary"] = {
                            "form_type": job.result.get("final_result", {}).get("form_type"),
                            "confidence": job.result.get("final_result", {}).get("confidence"),
                            "completeness": job.result.get("final_result", {}).get("completeness")
                        }

                    export_data["processing_jobs"].append(job_data)

                # Get relevant audit logs
                user_audit_logs = db.query(AuditLog).filter(
                    AuditLog.user_id == user_id
                ).order_by(AuditLog.created_at.desc()).limit(100).all()

                for log in user_audit_logs:
                    export_data["audit_logs"].append({
                        "id": log.id,
                        "action": log.action,
                        "timestamp": log.created_at.isoformat(),
                        "ip_address": log.ip_address,
                        "user_agent": log.user_agent,
                        "details": self._sanitize_export_details(log.details)
                    })

                # Get extracted data (anonymized)
                if user_files:
                    extracted_data_records = db.query(ExtractedData).filter(
                        ExtractedData.file_id.in_([f.id for f in user_files])
                    ).all()

                    for record in extracted_data_records:
                        export_data["extracted_data"].append({
                            "file_id": record.file_id,
                            "field_name": record.field_name,
                            "confidence": record.confidence,
                            "extraction_method": record.extraction_method,
                            "created_at": record.created_at.isoformat(),
                            # Note: actual field_value is excluded for privacy
                            "has_value": bool(record.field_value)
                        })

                logger.info(f"Data export generated for user {user_id}")
                return export_data

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error generating data export for user {user_id}: {str(e)}")
            return {
                "user_id": user_id,
                "error": str(e),
                "export_date": datetime.utcnow().isoformat(),
                "success": False
            }

    async def cleanup_expired_data(self) -> Dict[str, Any]:
        """
        Clean up expired data per retention policies

        Returns:
            Cleanup summary
        """
        try:
            logger.info("Starting expired data cleanup")

            db = SessionLocal()
            try:
                cleanup_summary = {
                    "cleanup_date": datetime.utcnow().isoformat(),
                    "files_cleaned": 0,
                    "audit_logs_cleaned": 0,
                    "jobs_cleaned": 0,
                    "errors": []
                }

                now = datetime.utcnow()

                # 1. Clean up expired files
                expired_files = db.query(FileUpload).filter(
                    FileUpload.expires_at < now,
                    FileUpload.deleted_at.is_(None)
                ).all()

                for file_record in expired_files:
                    try:
                        # Securely delete physical file
                        file_path = Path(file_record.file_path)
                        if file_path.exists():
                            success, message = self.encryption.secure_delete_file(file_path)
                            if not success:
                                cleanup_summary["errors"].append(
                                    f"Failed to securely delete expired file {file_record.id}: {message}"
                                )

                        # Mark as deleted
                        file_record.deleted_at = now
                        cleanup_summary["files_cleaned"] += 1

                    except Exception as e:
                        cleanup_summary["errors"].append(
                            f"Error cleaning expired file {file_record.id}: {str(e)}"
                        )

                # 2. Clean up old audit logs (keep 2 years)
                audit_retention_date = now - timedelta(days=730)  # 2 years
                old_audit_logs = db.query(AuditLog).filter(
                    AuditLog.created_at < audit_retention_date
                ).all()

                for log in old_audit_logs:
                    try:
                        db.delete(log)
                        cleanup_summary["audit_logs_cleaned"] += 1
                    except Exception as e:
                        cleanup_summary["errors"].append(
                            f"Error cleaning audit log {log.id}: {str(e)}"
                        )

                # 3. Clean up old completed jobs (keep 30 days)
                job_retention_date = now - timedelta(days=30)
                old_jobs = db.query(ProcessingJob).filter(
                    ProcessingJob.created_at < job_retention_date,
                    ProcessingJob.status == "completed"
                ).all()

                for job in old_jobs:
                    try:
                        db.delete(job)
                        cleanup_summary["jobs_cleaned"] += 1
                    except Exception as e:
                        cleanup_summary["errors"].append(
                            f"Error cleaning job {job.id}: {str(e)}"
                        )

                db.commit()

                logger.info(f"Expired data cleanup completed: {cleanup_summary}")
                return cleanup_summary

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error in expired data cleanup: {str(e)}")
            return {
                "cleanup_date": datetime.utcnow().isoformat(),
                "error": str(e),
                "success": False
            }

    def _anonymize_audit_details(self, details: dict) -> dict:
        """Remove personal information from audit log details"""
        if not details:
            return {}

        # Keys that might contain personal information
        sensitive_keys = [
            'ssn', 'social_security_number', 'sin', 'national_insurance_number',
            'name', 'first_name', 'last_name', 'address', 'email', 'phone',
            'bank_account', 'account_number', 'routing_number'
        ]

        anonymized = details.copy()
        for key in sensitive_keys:
            if key in anonymized:
                anonymized[key] = "[ANONYMIZED]"

        return anonymized

    def _sanitize_export_details(self, details: dict) -> dict:
        """Sanitize details for data export (remove sensitive data)"""
        if not details:
            return {}

        # Remove sensitive information but keep structure
        sensitive_keys = [
            'ssn', 'social_security_number', 'sin', 'national_insurance_number',
            'bank_account', 'account_number', 'routing_number', 'password'
        ]

        sanitized = details.copy()
        for key in sensitive_keys:
            if key in sanitized:
                sanitized[key] = "[REDACTED_FOR_EXPORT]"

        return sanitized

    async def get_compliance_status(self) -> Dict[str, Any]:
        """Get overall compliance status"""
        try:
            db = SessionLocal()
            try:
                now = datetime.utcnow()

                # Count files by status
                total_files = db.query(FileUpload).count()
                active_files = db.query(FileUpload).filter(
                    FileUpload.deleted_at.is_(None)
                ).count()
                expired_files = db.query(FileUpload).filter(
                    FileUpload.expires_at < now,
                    FileUpload.deleted_at.is_(None)
                ).count()

                # Audit log statistics
                total_audit_logs = db.query(AuditLog).count()
                recent_audit_logs = db.query(AuditLog).filter(
                    AuditLog.created_at >= now - timedelta(days=30)
                ).count()

                return {
                    "timestamp": now.isoformat(),
                    "encryption_status": self.encryption.get_encryption_status(),
                    "file_statistics": {
                        "total_files": total_files,
                        "active_files": active_files,
                        "expired_files_pending_cleanup": expired_files,
                        "deleted_files": total_files - active_files
                    },
                    "audit_statistics": {
                        "total_audit_logs": total_audit_logs,
                        "recent_audit_logs": recent_audit_logs
                    },
                    "compliance_features": {
                        "gdpr_data_deletion": True,
                        "gdpr_data_export": True,
                        "automatic_file_expiration": True,
                        "audit_logging": True,
                        "secure_file_deletion": True,
                        "data_encryption": self.encryption.get_encryption_status()["enabled"]
                    }
                }

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting compliance status: {str(e)}")
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "success": False
            }
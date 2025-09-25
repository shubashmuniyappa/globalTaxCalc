"""
Enhanced audit logging system
"""
import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import Request

from app.database import SessionLocal
from app.models.database import AuditLog
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AuditLogger:
    """Enhanced audit logging system for compliance"""

    def __init__(self):
        pass

    async def log_file_upload(
        self,
        user_id: Optional[str],
        file_id: int,
        filename: str,
        file_size: int,
        mime_type: str,
        request: Optional[Request] = None
    ) -> bool:
        """Log file upload event"""
        return await self._create_audit_log(
            action="file_upload",
            user_id=user_id,
            file_id=file_id,
            details={
                "filename": filename,
                "file_size": file_size,
                "mime_type": mime_type,
                "upload_method": "api"
            },
            request=request
        )

    async def log_file_access(
        self,
        user_id: Optional[str],
        file_id: int,
        access_type: str,
        request: Optional[Request] = None
    ) -> bool:
        """Log file access event"""
        return await self._create_audit_log(
            action="file_access",
            user_id=user_id,
            file_id=file_id,
            details={
                "access_type": access_type,
                "timestamp": datetime.utcnow().isoformat()
            },
            request=request
        )

    async def log_processing_start(
        self,
        user_id: Optional[str],
        file_id: int,
        job_id: int,
        task_id: str
    ) -> bool:
        """Log processing job start"""
        return await self._create_audit_log(
            action="processing_start",
            user_id=user_id,
            file_id=file_id,
            details={
                "job_id": job_id,
                "task_id": task_id,
                "start_time": datetime.utcnow().isoformat()
            }
        )

    async def log_processing_complete(
        self,
        user_id: Optional[str],
        file_id: int,
        job_id: int,
        form_type: str,
        confidence: float,
        processing_time: float
    ) -> bool:
        """Log processing job completion"""
        return await self._create_audit_log(
            action="processing_complete",
            user_id=user_id,
            file_id=file_id,
            details={
                "job_id": job_id,
                "form_type": form_type,
                "confidence": confidence,
                "processing_time_seconds": processing_time,
                "completion_time": datetime.utcnow().isoformat()
            }
        )

    async def log_processing_failure(
        self,
        user_id: Optional[str],
        file_id: int,
        job_id: int,
        error_message: str,
        error_type: str
    ) -> bool:
        """Log processing job failure"""
        return await self._create_audit_log(
            action="processing_failure",
            user_id=user_id,
            file_id=file_id,
            details={
                "job_id": job_id,
                "error_message": error_message,
                "error_type": error_type,
                "failure_time": datetime.utcnow().isoformat()
            }
        )

    async def log_data_export(
        self,
        user_id: Optional[str],
        export_type: str,
        data_types: list,
        request: Optional[Request] = None
    ) -> bool:
        """Log data export event"""
        return await self._create_audit_log(
            action="data_export",
            user_id=user_id,
            details={
                "export_type": export_type,
                "data_types": data_types,
                "export_time": datetime.utcnow().isoformat()
            },
            request=request
        )

    async def log_data_deletion(
        self,
        user_id: Optional[str],
        deletion_type: str,
        affected_records: Dict[str, int],
        request: Optional[Request] = None
    ) -> bool:
        """Log data deletion event"""
        return await self._create_audit_log(
            action="data_deletion",
            user_id=user_id,
            details={
                "deletion_type": deletion_type,
                "affected_records": affected_records,
                "deletion_time": datetime.utcnow().isoformat(),
                "gdpr_request": deletion_type == "gdpr_request"
            },
            request=request
        )

    async def log_file_deletion(
        self,
        user_id: Optional[str],
        file_id: int,
        deletion_reason: str,
        secure_deletion: bool = False
    ) -> bool:
        """Log file deletion event"""
        return await self._create_audit_log(
            action="file_deletion",
            user_id=user_id,
            file_id=file_id,
            details={
                "deletion_reason": deletion_reason,
                "secure_deletion": secure_deletion,
                "deletion_time": datetime.utcnow().isoformat()
            }
        )

    async def log_security_event(
        self,
        event_type: str,
        severity: str,
        description: str,
        user_id: Optional[str] = None,
        file_id: Optional[int] = None,
        request: Optional[Request] = None
    ) -> bool:
        """Log security-related event"""
        return await self._create_audit_log(
            action="security_event",
            user_id=user_id,
            file_id=file_id,
            details={
                "event_type": event_type,
                "severity": severity,
                "description": description,
                "event_time": datetime.utcnow().isoformat()
            },
            request=request
        )

    async def log_api_access(
        self,
        endpoint: str,
        method: str,
        user_id: Optional[str],
        status_code: int,
        request: Optional[Request] = None
    ) -> bool:
        """Log API access"""
        return await self._create_audit_log(
            action="api_access",
            user_id=user_id,
            details={
                "endpoint": endpoint,
                "method": method,
                "status_code": status_code,
                "access_time": datetime.utcnow().isoformat()
            },
            request=request
        )

    async def log_authentication_event(
        self,
        event_type: str,
        user_id: Optional[str],
        success: bool,
        request: Optional[Request] = None
    ) -> bool:
        """Log authentication event"""
        return await self._create_audit_log(
            action="authentication",
            user_id=user_id,
            details={
                "event_type": event_type,
                "success": success,
                "event_time": datetime.utcnow().isoformat()
            },
            request=request
        )

    async def log_configuration_change(
        self,
        user_id: Optional[str],
        change_type: str,
        old_value: Any,
        new_value: Any,
        request: Optional[Request] = None
    ) -> bool:
        """Log configuration change"""
        return await self._create_audit_log(
            action="configuration_change",
            user_id=user_id,
            details={
                "change_type": change_type,
                "old_value": str(old_value),
                "new_value": str(new_value),
                "change_time": datetime.utcnow().isoformat()
            },
            request=request
        )

    async def _create_audit_log(
        self,
        action: str,
        user_id: Optional[str] = None,
        file_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> bool:
        """Create audit log entry"""
        try:
            db = SessionLocal()
            try:
                # Extract request information
                ip_address = None
                user_agent = None

                if request:
                    # Get client IP (considering proxies)
                    ip_address = (
                        request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
                        request.headers.get("X-Real-IP") or
                        request.client.host if request.client else None
                    )
                    user_agent = request.headers.get("User-Agent")

                # Create audit log entry
                audit_entry = AuditLog(
                    action=action,
                    user_id=user_id,
                    file_id=file_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=details or {},
                    created_at=datetime.utcnow()
                )

                db.add(audit_entry)
                db.commit()

                return True

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error creating audit log: {str(e)}")
            return False

    async def search_audit_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        """Search audit logs with filters"""
        try:
            db = SessionLocal()
            try:
                query = db.query(AuditLog)

                if user_id:
                    query = query.filter(AuditLog.user_id == user_id)

                if action:
                    query = query.filter(AuditLog.action == action)

                if start_date:
                    query = query.filter(AuditLog.created_at >= start_date)

                if end_date:
                    query = query.filter(AuditLog.created_at <= end_date)

                results = query.order_by(
                    AuditLog.created_at.desc()
                ).limit(limit).all()

                return [
                    {
                        "id": log.id,
                        "action": log.action,
                        "user_id": log.user_id,
                        "file_id": log.file_id,
                        "ip_address": log.ip_address,
                        "user_agent": log.user_agent,
                        "details": log.details,
                        "created_at": log.created_at.isoformat()
                    }
                    for log in results
                ]

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error searching audit logs: {str(e)}")
            return []

    async def get_audit_summary(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get audit log summary statistics"""
        try:
            db = SessionLocal()
            try:
                query = db.query(AuditLog)

                if start_date:
                    query = query.filter(AuditLog.created_at >= start_date)

                if end_date:
                    query = query.filter(AuditLog.created_at <= end_date)

                # Get action counts
                action_counts = {}
                logs = query.all()

                for log in logs:
                    action_counts[log.action] = action_counts.get(log.action, 0) + 1

                # Get unique users
                unique_users = len(set(log.user_id for log in logs if log.user_id))

                # Get unique files
                unique_files = len(set(log.file_id for log in logs if log.file_id))

                return {
                    "total_events": len(logs),
                    "unique_users": unique_users,
                    "unique_files": unique_files,
                    "action_counts": action_counts,
                    "period": {
                        "start": start_date.isoformat() if start_date else None,
                        "end": end_date.isoformat() if end_date else None
                    }
                }

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting audit summary: {str(e)}")
            return {
                "error": str(e),
                "total_events": 0,
                "unique_users": 0,
                "unique_files": 0,
                "action_counts": {}
            }


# Global audit logger instance
audit_logger = AuditLogger()
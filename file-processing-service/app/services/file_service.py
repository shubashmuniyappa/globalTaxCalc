"""
File upload and management service
"""
import os
import uuid
import hashlib
import magic
import filetype
from pathlib import Path
from typing import Optional, List, Dict, Any, BinaryIO
from datetime import datetime, timedelta
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.database import FileUpload, ProcessingStatus, AuditLog
from app.services.security_service import SecurityService
from app.services.virus_scanner import VirusScannerService
from app.utils.logging import get_logger

logger = get_logger(__name__)


class FileService:
    """Service for handling file uploads and management"""

    def __init__(self):
        self.security_service = SecurityService()
        self.virus_scanner = VirusScannerService()
        self.upload_dir = settings.upload_directory
        self.temp_dir = settings.temp_directory
        self.max_file_size = settings.max_file_size
        self.allowed_extensions = settings.allowed_extensions

        # Ensure directories exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    async def upload_file(
        self,
        file: UploadFile,
        user_id: str,
        db: Session,
        request_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload and process a file

        Args:
            file: The uploaded file
            user_id: ID of the user uploading the file
            db: Database session
            request_info: Additional request information (IP, user agent, etc.)

        Returns:
            Dictionary containing file upload information
        """
        try:
            # Validate file
            validation_result = await self._validate_file(file)
            if not validation_result["valid"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"File validation failed: {validation_result['error']}"
                )

            # Generate unique filename
            file_id = str(uuid.uuid4())
            file_extension = self._get_file_extension(file.filename)
            safe_filename = f"{file_id}.{file_extension}"

            # Create file paths
            temp_path = self.temp_dir / safe_filename
            upload_path = self.upload_dir / safe_filename

            # Save file temporarily
            await self._save_file_to_disk(file, temp_path)

            # Get file information
            file_info = await self._get_file_info(temp_path, file.filename)

            # Virus scan
            if settings.clamav_enabled:
                scan_result = await self.virus_scanner.scan_file(temp_path)
                if scan_result["status"] != "clean":
                    # Delete infected file
                    temp_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File failed virus scan: {scan_result['details']}"
                    )
            else:
                scan_result = {"status": "skipped", "details": "Virus scanning disabled"}

            # Move to permanent location
            temp_path.rename(upload_path)

            # Encrypt file if enabled
            encrypted_path = None
            encryption_key_id = None
            if settings.encryption_key:
                encrypted_path = await self.security_service.encrypt_file(
                    upload_path,
                    settings.encryption_key
                )
                encryption_key_id = "default"

            # Calculate expiration time
            expires_at = datetime.utcnow() + timedelta(hours=settings.file_retention_hours)

            # Create database record
            file_upload = FileUpload(
                id=uuid.UUID(file_id),
                user_id=uuid.UUID(user_id),
                filename=safe_filename,
                original_filename=file.filename,
                file_size=file_info["size"],
                file_type=file_extension,
                mime_type=file_info["mime_type"],
                file_path=str(upload_path),
                encrypted_path=str(encrypted_path) if encrypted_path else None,
                status=ProcessingStatus.UPLOADED,
                virus_scan_result=scan_result["status"],
                virus_scan_details=scan_result.get("details"),
                is_encrypted=encrypted_path is not None,
                encryption_key_id=encryption_key_id,
                upload_ip=request_info.get("ip") if request_info else None,
                user_agent=request_info.get("user_agent") if request_info else None,
                country_code=request_info.get("country") if request_info else None,
                expires_at=expires_at
            )

            db.add(file_upload)
            db.commit()
            db.refresh(file_upload)

            # Log upload event
            await self._log_audit_event(
                db=db,
                event_type="upload",
                file_upload_id=file_upload.id,
                user_id=user_id,
                description=f"File uploaded: {file.filename}",
                request_info=request_info
            )

            logger.info(
                "File uploaded successfully",
                extra={
                    "file_id": str(file_upload.id),
                    "user_id": user_id,
                    "filename": file.filename,
                    "file_size": file_info["size"]
                }
            )

            return {
                "file_id": str(file_upload.id),
                "filename": file_upload.filename,
                "original_filename": file_upload.original_filename,
                "file_size": file_upload.file_size,
                "file_type": file_upload.file_type,
                "status": file_upload.status,
                "created_at": file_upload.created_at.isoformat(),
                "expires_at": file_upload.expires_at.isoformat()
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Internal server error during file upload"
            )

    async def get_file_info(
        self,
        file_id: str,
        user_id: str,
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """
        Get file information

        Args:
            file_id: ID of the file
            user_id: ID of the user requesting the file
            db: Database session

        Returns:
            File information dictionary or None if not found
        """
        try:
            file_upload = db.query(FileUpload).filter(
                FileUpload.id == uuid.UUID(file_id),
                FileUpload.user_id == uuid.UUID(user_id),
                FileUpload.deleted_at.is_(None)
            ).first()

            if not file_upload:
                return None

            return file_upload.to_dict()

        except Exception as e:
            logger.error(f"Error getting file info: {str(e)}", exc_info=True)
            return None

    async def delete_file(
        self,
        file_id: str,
        user_id: str,
        db: Session,
        request_info: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Delete a file and its associated data

        Args:
            file_id: ID of the file to delete
            user_id: ID of the user requesting deletion
            db: Database session
            request_info: Additional request information

        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            file_upload = db.query(FileUpload).filter(
                FileUpload.id == uuid.UUID(file_id),
                FileUpload.user_id == uuid.UUID(user_id),
                FileUpload.deleted_at.is_(None)
            ).first()

            if not file_upload:
                return False

            # Delete physical files
            await self._delete_physical_files(file_upload)

            # Mark as deleted in database
            file_upload.deleted_at = datetime.utcnow()
            file_upload.status = ProcessingStatus.DELETED
            db.commit()

            # Log deletion event
            await self._log_audit_event(
                db=db,
                event_type="delete",
                file_upload_id=file_upload.id,
                user_id=user_id,
                description=f"File deleted: {file_upload.original_filename}",
                request_info=request_info
            )

            logger.info(
                "File deleted successfully",
                extra={
                    "file_id": file_id,
                    "user_id": user_id,
                    "filename": file_upload.original_filename
                }
            )

            return True

        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}", exc_info=True)
            return False

    async def get_user_files(
        self,
        user_id: str,
        db: Session,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get files for a user

        Args:
            user_id: ID of the user
            db: Database session
            limit: Maximum number of files to return
            offset: Number of files to skip

        Returns:
            List of file information dictionaries
        """
        try:
            files = db.query(FileUpload).filter(
                FileUpload.user_id == uuid.UUID(user_id),
                FileUpload.deleted_at.is_(None)
            ).order_by(
                FileUpload.created_at.desc()
            ).limit(limit).offset(offset).all()

            return [file.to_dict() for file in files]

        except Exception as e:
            logger.error(f"Error getting user files: {str(e)}", exc_info=True)
            return []

    async def cleanup_expired_files(self, db: Session) -> int:
        """
        Clean up expired files

        Args:
            db: Database session

        Returns:
            Number of files cleaned up
        """
        try:
            expired_files = db.query(FileUpload).filter(
                FileUpload.expires_at < datetime.utcnow(),
                FileUpload.deleted_at.is_(None)
            ).all()

            cleanup_count = 0
            for file_upload in expired_files:
                # Delete physical files
                await self._delete_physical_files(file_upload)

                # Mark as deleted
                file_upload.deleted_at = datetime.utcnow()
                file_upload.status = ProcessingStatus.DELETED
                cleanup_count += 1

            db.commit()

            logger.info(f"Cleaned up {cleanup_count} expired files")
            return cleanup_count

        except Exception as e:
            logger.error(f"Error cleaning up expired files: {str(e)}", exc_info=True)
            return 0

    async def _validate_file(self, file: UploadFile) -> Dict[str, Any]:
        """Validate uploaded file"""
        try:
            # Check file size
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(0)  # Reset to beginning

            if file_size > self.max_file_size:
                return {
                    "valid": False,
                    "error": f"File size ({file_size} bytes) exceeds maximum allowed size ({self.max_file_size} bytes)"
                }

            # Check file extension
            file_extension = self._get_file_extension(file.filename)
            if file_extension not in self.allowed_extensions:
                return {
                    "valid": False,
                    "error": f"File type '{file_extension}' not allowed. Allowed types: {', '.join(self.allowed_extensions)}"
                }

            # Check MIME type
            file_content = await file.read(1024)  # Read first 1KB for MIME detection
            file.file.seek(0)  # Reset file position

            detected_type = filetype.guess(file_content)
            if detected_type:
                if detected_type.extension not in self.allowed_extensions:
                    return {
                        "valid": False,
                        "error": f"Detected file type '{detected_type.extension}' not allowed"
                    }

            return {"valid": True}

        except Exception as e:
            logger.error(f"Error validating file: {str(e)}", exc_info=True)
            return {"valid": False, "error": "File validation error"}

    def _get_file_extension(self, filename: str) -> str:
        """Get file extension from filename"""
        if not filename:
            return ""
        return Path(filename).suffix.lower().lstrip(".")

    async def _save_file_to_disk(self, file: UploadFile, path: Path):
        """Save uploaded file to disk"""
        try:
            with open(path, "wb") as f:
                content = await file.read()
                f.write(content)
        except Exception as e:
            logger.error(f"Error saving file to disk: {str(e)}", exc_info=True)
            raise

    async def _get_file_info(self, path: Path, original_filename: str) -> Dict[str, Any]:
        """Get file information"""
        try:
            stat = path.stat()

            # Detect MIME type
            mime_type = magic.from_file(str(path), mime=True)

            return {
                "size": stat.st_size,
                "mime_type": mime_type,
                "created": datetime.fromtimestamp(stat.st_ctime),
                "modified": datetime.fromtimestamp(stat.st_mtime)
            }

        except Exception as e:
            logger.error(f"Error getting file info: {str(e)}", exc_info=True)
            return {
                "size": 0,
                "mime_type": "application/octet-stream",
                "created": datetime.utcnow(),
                "modified": datetime.utcnow()
            }

    async def _delete_physical_files(self, file_upload: FileUpload):
        """Delete physical files from disk"""
        try:
            # Delete main file
            if file_upload.file_path:
                file_path = Path(file_upload.file_path)
                file_path.unlink(missing_ok=True)

            # Delete encrypted file
            if file_upload.encrypted_path:
                encrypted_path = Path(file_upload.encrypted_path)
                encrypted_path.unlink(missing_ok=True)

        except Exception as e:
            logger.error(f"Error deleting physical files: {str(e)}", exc_info=True)

    async def _log_audit_event(
        self,
        db: Session,
        event_type: str,
        file_upload_id: Optional[uuid.UUID],
        user_id: str,
        description: str,
        request_info: Optional[Dict[str, Any]] = None
    ):
        """Log audit event"""
        try:
            audit_log = AuditLog(
                file_upload_id=file_upload_id,
                user_id=uuid.UUID(user_id),
                event_type=event_type,
                event_description=description,
                event_details=request_info or {},
                ip_address=request_info.get("ip") if request_info else None,
                user_agent=request_info.get("user_agent") if request_info else None,
                request_id=request_info.get("request_id") if request_info else None,
                sensitive_data_accessed=event_type in ["upload", "process", "access"],
                gdpr_relevant=True
            )

            db.add(audit_log)
            db.commit()

        except Exception as e:
            logger.error(f"Error logging audit event: {str(e)}", exc_info=True)

    def get_file_path(self, file_upload: FileUpload) -> Path:
        """Get the actual file path for processing"""
        if file_upload.is_encrypted and file_upload.encrypted_path:
            return Path(file_upload.encrypted_path)
        return Path(file_upload.file_path)
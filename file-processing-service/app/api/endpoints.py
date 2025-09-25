"""
FastAPI endpoints for file processing service
"""
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.database import FileUpload, ProcessingJob
from app.services.file_service import FileService
from app.tasks.task_manager import TaskManager
from app.security.compliance import ComplianceManager
from app.security.audit import audit_logger
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="GlobalTaxCalc File Processing Service",
    description="Document processing service for tax forms with OCR, form recognition, and data extraction",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

if settings.trusted_hosts:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.trusted_hosts
    )

# Security
security = HTTPBearer(auto_error=False)

# Initialize services
file_service = FileService()
task_manager = TaskManager()
compliance_manager = ComplianceManager()


# Pydantic models for request/response
class FileUploadResponse(BaseModel):
    file_id: int
    filename: str
    file_size: int
    mime_type: str
    upload_date: datetime
    expires_at: Optional[datetime]
    processing_status: str
    message: str


class ProcessingJobResponse(BaseModel):
    job_id: int
    task_id: str
    file_id: int
    status: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    processing_time_seconds: Optional[float]
    priority: int
    retry_count: int


class ProcessingResultResponse(BaseModel):
    file_id: int
    filename: str
    form_type: str
    country: str
    confidence: float
    tax_year: Optional[int]
    extracted_data: Dict[str, Any]
    autofill_data: Dict[str, Any]
    completeness: float
    recommendations: List[str]


class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Dependency for user authentication (placeholder - implement based on your auth system)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[str]:
    """Get current user from authentication token"""
    if not credentials:
        return None

    # TODO: Implement actual token validation
    # For now, return a dummy user ID
    return "user_123"


# API Endpoints

@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: Optional[str] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a document for processing

    - **file**: Document file (PDF, JPG, PNG supported)
    - Returns file information and processing status
    """
    try:
        logger.info(f"File upload request: {file.filename}")

        # Upload file
        upload_result = await file_service.upload_file(file, user_id)

        if not upload_result["success"]:
            await audit_logger.log_security_event(
                event_type="file_upload_rejected",
                severity="medium",
                description=upload_result["error"],
                user_id=user_id,
                request=request
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=upload_result["error"]
            )

        file_record = upload_result["file_record"]

        # Log successful upload
        await audit_logger.log_file_upload(
            user_id=user_id,
            file_id=file_record.id,
            filename=file_record.filename,
            file_size=file_record.file_size,
            mime_type=file_record.mime_type,
            request=request
        )

        # Submit processing job in background
        background_tasks.add_task(
            submit_processing_job,
            file_record.id,
            user_id
        )

        return FileUploadResponse(
            file_id=file_record.id,
            filename=file_record.filename,
            file_size=file_record.file_size,
            mime_type=file_record.mime_type,
            upload_date=file_record.created_at,
            expires_at=file_record.expires_at,
            processing_status=file_record.processing_status,
            message="File uploaded successfully and queued for processing"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}", exc_info=True)
        await audit_logger.log_security_event(
            event_type="file_upload_error",
            severity="high",
            description=str(e),
            user_id=user_id,
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during file upload"
        )


async def submit_processing_job(file_id: int, user_id: Optional[str]):
    """Background task to submit processing job"""
    try:
        await task_manager.submit_processing_job(file_id, user_id)
    except Exception as e:
        logger.error(f"Error submitting processing job for file {file_id}: {str(e)}")


@app.get("/files/{file_id}/status", response_model=ProcessingJobResponse)
async def get_processing_status(
    file_id: int,
    user_id: Optional[str] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get processing status for a file

    - **file_id**: ID of the uploaded file
    - Returns current processing status and job information
    """
    try:
        # Get file record
        file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Check file ownership (if user_id is provided)
        if user_id and file_record.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Get processing job
        job = db.query(ProcessingJob).filter(ProcessingJob.file_id == file_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processing job not found"
            )

        # Get detailed job status
        job_status = await task_manager.get_job_status(job_id=job.id)

        return ProcessingJobResponse(
            job_id=job.id,
            task_id=job.celery_task_id,
            file_id=file_id,
            status=job_status["status"],
            created_at=job.created_at,
            started_at=datetime.fromisoformat(job_status["started_at"]) if job_status.get("started_at") else None,
            completed_at=datetime.fromisoformat(job_status["completed_at"]) if job_status.get("completed_at") else None,
            processing_time_seconds=job_status.get("processing_time_seconds"),
            priority=job.priority,
            retry_count=job.retry_count
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting processing status for file {file_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving processing status"
        )


@app.get("/files/{file_id}/results", response_model=ProcessingResultResponse)
async def get_processing_results(
    file_id: int,
    request: Request,
    user_id: Optional[str] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get processing results for a completed file

    - **file_id**: ID of the processed file
    - Returns extracted data and auto-fill information
    """
    try:
        # Get file record
        file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Check file ownership
        if user_id and file_record.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Check if processing is complete
        if file_record.processing_status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"File processing not complete. Current status: {file_record.processing_status}"
            )

        # Get processing job results
        job = db.query(ProcessingJob).filter(ProcessingJob.file_id == file_id).first()
        if not job or not job.result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processing results not found"
            )

        # Log file access
        await audit_logger.log_file_access(
            user_id=user_id,
            file_id=file_id,
            access_type="results_retrieval",
            request=request
        )

        final_result = job.result.get("final_result", {})

        return ProcessingResultResponse(
            file_id=file_id,
            filename=file_record.filename,
            form_type=final_result.get("form_type", "unknown"),
            country=final_result.get("country", "unknown"),
            confidence=final_result.get("confidence", 0.0),
            tax_year=final_result.get("tax_year"),
            extracted_data=final_result.get("extracted_data", {}),
            autofill_data=final_result.get("autofill_data", {}),
            completeness=final_result.get("completeness", 0.0),
            recommendations=final_result.get("recommendations", [])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting processing results for file {file_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving processing results"
        )


@app.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    request: Request,
    user_id: Optional[str] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a file and its associated data

    - **file_id**: ID of the file to delete
    - Returns deletion confirmation
    """
    try:
        # Get file record
        file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Check file ownership
        if user_id and file_record.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Delete file
        deletion_result = await file_service.delete_file(file_id)

        if not deletion_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=deletion_result["error"]
            )

        # Log file deletion
        await audit_logger.log_file_deletion(
            user_id=user_id,
            file_id=file_id,
            deletion_reason="user_request",
            secure_deletion=True
        )

        return {"message": "File deleted successfully", "file_id": file_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting file"
        )


@app.get("/files")
async def list_files(
    user_id: Optional[str] = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List user's files

    - **limit**: Maximum number of files to return (default: 50)
    - **offset**: Number of files to skip (default: 0)
    - **status_filter**: Filter by processing status (optional)
    - Returns list of user's files
    """
    try:
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        query = db.query(FileUpload).filter(
            FileUpload.user_id == user_id,
            FileUpload.deleted_at.is_(None)
        )

        if status_filter:
            query = query.filter(FileUpload.processing_status == status_filter)

        files = query.order_by(FileUpload.created_at.desc()).offset(offset).limit(limit).all()

        return {
            "files": [
                {
                    "file_id": f.id,
                    "filename": f.filename,
                    "file_size": f.file_size,
                    "mime_type": f.mime_type,
                    "upload_date": f.created_at.isoformat(),
                    "expires_at": f.expires_at.isoformat() if f.expires_at else None,
                    "processing_status": f.processing_status,
                    "form_type": f.form_type,
                    "confidence_score": f.confidence_score
                }
                for f in files
            ],
            "total": len(files),
            "limit": limit,
            "offset": offset
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving file list"
        )


@app.post("/files/{file_id}/reprocess")
async def reprocess_file(
    file_id: int,
    user_id: Optional[str] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reprocess a file

    - **file_id**: ID of the file to reprocess
    - Returns new job information
    """
    try:
        # Get file record
        file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Check file ownership
        if user_id and file_record.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Submit new processing job
        job_info = await task_manager.submit_processing_job(file_id, user_id)

        return {
            "message": "File reprocessing started",
            "file_id": file_id,
            "job_id": job_info["job_id"],
            "task_id": job_info["task_id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reprocessing file {file_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error starting file reprocessing"
        )


# GDPR Compliance Endpoints

@app.get("/gdpr/export")
async def export_user_data(
    request: Request,
    user_id: Optional[str] = Depends(get_current_user)
):
    """
    Export all user data (GDPR compliance)

    - Returns complete data export for the user
    """
    try:
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        # Generate data export
        export_data = await compliance_manager.generate_data_export(user_id)

        # Log data export
        await audit_logger.log_data_export(
            user_id=user_id,
            export_type="gdpr_export",
            data_types=["files", "processing_jobs", "audit_logs", "extracted_data"],
            request=request
        )

        return export_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting user data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating data export"
        )


@app.delete("/gdpr/delete-all")
async def delete_user_data(
    request: Request,
    user_id: Optional[str] = Depends(get_current_user)
):
    """
    Delete all user data (GDPR compliance)

    - Permanently deletes all user data
    """
    try:
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        # Process data deletion request
        deletion_result = await compliance_manager.handle_data_deletion_request(user_id)

        # Log data deletion
        await audit_logger.log_data_deletion(
            user_id=user_id,
            deletion_type="gdpr_request",
            affected_records={
                "files": deletion_result.get("files_deleted", 0),
                "jobs": deletion_result.get("jobs_deleted", 0),
                "audit_logs": deletion_result.get("audit_logs_anonymized", 0)
            },
            request=request
        )

        return deletion_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing data deletion request"
        )


# System Status Endpoints

@app.get("/health")
async def health_check():
    """
    System health check

    - Returns service health status
    """
    try:
        # Get compliance status
        compliance_status = await compliance_manager.get_compliance_status()

        # Get queue status
        queue_status = await task_manager.get_queue_status()

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "services": {
                "database": "healthy",
                "task_queue": "healthy" if queue_status.get("workers") else "degraded",
                "file_storage": "healthy"
            },
            "queue_stats": {
                "active_jobs": queue_status.get("total_active", 0),
                "queued_jobs": queue_status.get("total_reserved", 0),
                "workers": len(queue_status.get("workers", []))
            },
            "compliance": {
                "encryption_enabled": compliance_status.get("compliance_features", {}).get("data_encryption", False),
                "audit_logging": compliance_status.get("compliance_features", {}).get("audit_logging", False)
            }
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@app.get("/stats")
async def get_system_stats(
    user_id: Optional[str] = Depends(get_current_user)
):
    """
    Get system statistics (admin only)

    - Returns processing statistics and system metrics
    """
    try:
        # TODO: Add admin role check
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        # Get queue status
        queue_status = await task_manager.get_queue_status()

        # Get worker stats
        worker_stats = await task_manager.get_worker_stats()

        # Get compliance status
        compliance_status = await compliance_manager.get_compliance_status()

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "queue_status": queue_status,
            "worker_stats": worker_stats,
            "file_stats": compliance_status.get("file_statistics", {}),
            "audit_stats": compliance_status.get("audit_statistics", {})
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving system statistics"
        )


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            details=getattr(exc, "details", None)
        ).dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal server error",
            details="An unexpected error occurred"
        ).dict()
    )


# Startup/shutdown events
@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    logger.info("File Processing Service starting up")

    # Log startup
    await audit_logger.log_security_event(
        event_type="service_startup",
        severity="info",
        description="File Processing Service started"
    )


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks"""
    logger.info("File Processing Service shutting down")

    # Log shutdown
    await audit_logger.log_security_event(
        event_type="service_shutdown",
        severity="info",
        description="File Processing Service stopped"
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.api.endpoints:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else 4
    )
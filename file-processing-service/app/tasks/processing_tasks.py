"""
Celery tasks for document processing
"""
import asyncio
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional
from celery import Task
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models.database import FileUpload, ProcessingJob, ProcessingStatistics, AuditLog
from app.services.file_service import FileService
from app.services.ocr_service import OCRService
from app.services.form_recognition_service import FormRecognitionService
from app.services.data_extraction_service import DataExtractionService
from app.services.autofill_service import AutoFillService
from app.services.virus_scanner import VirusScannerService
from app.utils.logging import get_logger

logger = get_logger(__name__)


class CallbackTask(Task):
    """Custom Celery task class with callback support"""

    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds"""
        logger.info(f"Task {task_id} completed successfully")
        self._update_job_status(task_id, "completed", retval)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        logger.error(f"Task {task_id} failed: {str(exc)}")
        error_info = {
            "error": str(exc),
            "traceback": traceback.format_exc(),
            "args": args,
            "kwargs": kwargs
        }
        self._update_job_status(task_id, "failed", error_info)

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called when task is retried"""
        logger.warning(f"Task {task_id} retrying due to: {str(exc)}")
        retry_info = {
            "error": str(exc),
            "retry_count": self.request.retries,
            "max_retries": self.max_retries
        }
        self._update_job_status(task_id, "retrying", retry_info)

    def _update_job_status(self, task_id: str, status: str, result: Any):
        """Update job status in database"""
        try:
            db = SessionLocal()
            try:
                job = db.query(ProcessingJob).filter(
                    ProcessingJob.celery_task_id == task_id
                ).first()

                if job:
                    job.status = status
                    job.updated_at = datetime.utcnow()

                    if status == "completed":
                        job.completed_at = datetime.utcnow()
                        job.result = result
                    elif status == "failed":
                        job.error_message = result.get("error") if isinstance(result, dict) else str(result)
                        job.error_details = result
                    elif status == "retrying":
                        job.retry_count = result.get("retry_count", 0)

                    db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error updating job status: {str(e)}")


@celery_app.task(bind=True, base=CallbackTask, max_retries=3)
def process_document(self, file_id: int, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Process a document through the complete pipeline

    Args:
        file_id: ID of the uploaded file
        user_id: Optional user ID for tracking

    Returns:
        Processing results
    """
    try:
        logger.info(f"Starting document processing for file_id: {file_id}")

        # Get database session
        db = SessionLocal()

        try:
            # Get file record
            file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
            if not file_record:
                raise ValueError(f"File with ID {file_id} not found")

            # Update job status
            job = db.query(ProcessingJob).filter(
                ProcessingJob.celery_task_id == self.request.id
            ).first()

            if job:
                job.status = "processing"
                job.started_at = datetime.utcnow()
                db.commit()

            # Initialize services
            file_service = FileService()
            virus_scanner = VirusScannerService()
            ocr_service = OCRService()
            form_recognition = FormRecognitionService()
            data_extraction = DataExtractionService()
            autofill_service = AutoFillService()

            file_path = Path(file_record.file_path)
            results = {
                "file_id": file_id,
                "filename": file_record.filename,
                "processing_steps": {},
                "final_result": {}
            }

            # Step 1: Virus scanning
            logger.info("Starting virus scan")
            scan_result = await virus_scanner.scan_file(file_path)
            results["processing_steps"]["virus_scan"] = scan_result

            if scan_result.get("status") == "infected":
                # Mark file as infected and stop processing
                file_record.processing_status = "failed"
                file_record.error_message = "File infected with virus"
                db.commit()
                raise ValueError(f"File infected: {scan_result.get('details')}")

            # Step 2: OCR Processing
            logger.info("Starting OCR processing")
            ocr_result = await ocr_service.process_document(file_path)
            results["processing_steps"]["ocr"] = {
                "success": ocr_result["success"],
                "confidence": ocr_result.get("confidence", 0),
                "page_count": ocr_result.get("page_count", 0),
                "text_length": len(ocr_result.get("raw_text", ""))
            }

            if not ocr_result["success"]:
                raise ValueError(f"OCR processing failed: {ocr_result.get('error')}")

            raw_text = ocr_result["raw_text"]

            # Step 3: Form Recognition
            logger.info("Starting form recognition")
            form_result = await form_recognition.identify_form_type(
                raw_text,
                file_record.filename
            )
            results["processing_steps"]["form_recognition"] = form_result

            if form_result["form_type"] == "unknown":
                logger.warning("Could not identify form type")
                # Continue processing but with unknown form

            # Step 4: Data Extraction
            logger.info("Starting data extraction")
            extraction_result = await data_extraction.extract_form_data(
                raw_text,
                form_result["form_type"],
                form_result["country"]
            )
            results["processing_steps"]["data_extraction"] = {
                "success": extraction_result["success"],
                "fields_extracted": len(extraction_result.get("extracted_fields", {})),
                "confidence": extraction_result.get("overall_confidence", 0)
            }

            if not extraction_result["success"]:
                logger.warning(f"Data extraction issues: {extraction_result.get('error')}")
                # Continue with partial data

            # Step 5: Auto-fill Integration
            logger.info("Starting auto-fill integration")
            autofill_result = await autofill_service.prepare_autofill_data(
                extraction_result.get("extracted_fields", {}),
                form_result["form_type"],
                form_result["country"]
            )
            results["processing_steps"]["autofill"] = {
                "success": autofill_result["success"],
                "completeness": autofill_result.get("completeness", 0),
                "mapped_fields": len(autofill_result.get("mapped_fields", {}))
            }

            # Prepare final result
            results["final_result"] = {
                "form_type": form_result["form_type"],
                "country": form_result["country"],
                "tax_year": form_result.get("tax_year"),
                "confidence": form_result["confidence"],
                "extracted_data": extraction_result.get("extracted_fields", {}),
                "autofill_data": autofill_result.get("mapped_fields", {}),
                "completeness": autofill_result.get("completeness", 0),
                "recommendations": autofill_result.get("recommendations", [])
            }

            # Update file record
            file_record.processing_status = "completed"
            file_record.form_type = form_result["form_type"]
            file_record.confidence_score = form_result["confidence"]
            file_record.processed_at = datetime.utcnow()

            # Create audit log entry
            audit_log = AuditLog(
                file_id=file_id,
                action="document_processed",
                user_id=user_id,
                details={
                    "form_type": form_result["form_type"],
                    "confidence": form_result["confidence"],
                    "processing_time": (datetime.utcnow() - job.created_at).total_seconds() if job else None
                }
            )
            db.add(audit_log)

            db.commit()
            logger.info(f"Document processing completed for file_id: {file_id}")

            return results

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error processing document {file_id}: {str(e)}", exc_info=True)

        # Update database on error
        try:
            db = SessionLocal()
            try:
                file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
                if file_record:
                    file_record.processing_status = "failed"
                    file_record.error_message = str(e)
                    db.commit()
            finally:
                db.close()
        except Exception as db_error:
            logger.error(f"Error updating database on processing failure: {str(db_error)}")

        # Re-raise the exception to trigger Celery retry
        raise self.retry(exc=e, countdown=60)


@celery_app.task(bind=True, max_retries=1)
def cleanup_expired_files(self):
    """Clean up expired files and associated data"""
    try:
        logger.info("Starting cleanup of expired files")

        db = SessionLocal()
        try:
            file_service = FileService()

            # Get expired files
            expired_files = db.query(FileUpload).filter(
                FileUpload.expires_at < datetime.utcnow(),
                FileUpload.deleted_at.is_(None)
            ).all()

            cleanup_count = 0
            error_count = 0

            for file_record in expired_files:
                try:
                    # Delete file from storage
                    file_path = Path(file_record.file_path)
                    if file_path.exists():
                        file_path.unlink()

                    # Mark as deleted in database
                    file_record.deleted_at = datetime.utcnow()

                    # Create audit log
                    audit_log = AuditLog(
                        file_id=file_record.id,
                        action="file_expired_cleanup",
                        details={"reason": "automatic_cleanup", "expired_at": file_record.expires_at.isoformat()}
                    )
                    db.add(audit_log)

                    cleanup_count += 1

                except Exception as e:
                    logger.error(f"Error cleaning up file {file_record.id}: {str(e)}")
                    error_count += 1

            db.commit()

            result = {
                "cleaned_up": cleanup_count,
                "errors": error_count,
                "total_expired": len(expired_files)
            }

            logger.info(f"Cleanup completed: {result}")
            return result

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error in cleanup task: {str(e)}", exc_info=True)
        raise


@celery_app.task(bind=True, max_retries=1)
def generate_statistics(self):
    """Generate processing statistics"""
    try:
        logger.info("Generating processing statistics")

        db = SessionLocal()
        try:
            now = datetime.utcnow()

            # Calculate statistics for the last 24 hours
            start_time = now - timedelta(hours=24)

            # Get processing statistics
            total_files = db.query(FileUpload).filter(
                FileUpload.created_at >= start_time
            ).count()

            successful_files = db.query(FileUpload).filter(
                FileUpload.created_at >= start_time,
                FileUpload.processing_status == "completed"
            ).count()

            failed_files = db.query(FileUpload).filter(
                FileUpload.created_at >= start_time,
                FileUpload.processing_status == "failed"
            ).count()

            pending_files = db.query(FileUpload).filter(
                FileUpload.created_at >= start_time,
                FileUpload.processing_status.in_(["uploaded", "processing"])
            ).count()

            # Calculate average processing time
            completed_jobs = db.query(ProcessingJob).filter(
                ProcessingJob.created_at >= start_time,
                ProcessingJob.status == "completed",
                ProcessingJob.completed_at.isnot(None)
            ).all()

            avg_processing_time = 0
            if completed_jobs:
                total_time = sum([
                    (job.completed_at - job.created_at).total_seconds()
                    for job in completed_jobs
                ])
                avg_processing_time = total_time / len(completed_jobs)

            # Form type distribution
            form_types = db.execute("""
                SELECT form_type, COUNT(*) as count
                FROM file_uploads
                WHERE created_at >= :start_time AND form_type IS NOT NULL
                GROUP BY form_type
            """, {"start_time": start_time}).fetchall()

            form_distribution = {row[0]: row[1] for row in form_types}

            # Create statistics record
            stats = ProcessingStatistics(
                period_start=start_time,
                period_end=now,
                total_files_processed=total_files,
                successful_files=successful_files,
                failed_files=failed_files,
                average_processing_time=avg_processing_time,
                form_type_distribution=form_distribution
            )

            db.add(stats)
            db.commit()

            result = {
                "period": f"{start_time.isoformat()} to {now.isoformat()}",
                "total_files": total_files,
                "successful": successful_files,
                "failed": failed_files,
                "pending": pending_files,
                "success_rate": (successful_files / total_files * 100) if total_files > 0 else 0,
                "average_processing_time": avg_processing_time,
                "form_distribution": form_distribution
            }

            logger.info(f"Statistics generated: {result}")
            return result

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error generating statistics: {str(e)}", exc_info=True)
        raise


@celery_app.task(bind=True)
def health_check(self):
    """Perform system health check"""
    try:
        health_status = {
            "timestamp": datetime.utcnow().isoformat(),
            "services": {},
            "overall_status": "healthy"
        }

        # Check database connectivity
        try:
            db = SessionLocal()
            db.execute("SELECT 1")
            db.close()
            health_status["services"]["database"] = "healthy"
        except Exception as e:
            health_status["services"]["database"] = f"unhealthy: {str(e)}"
            health_status["overall_status"] = "unhealthy"

        # Check virus scanner
        try:
            scanner = VirusScannerService()
            if await scanner.ping():
                health_status["services"]["virus_scanner"] = "healthy"
            else:
                health_status["services"]["virus_scanner"] = "unhealthy: not responding"
                if scanner.enabled:
                    health_status["overall_status"] = "degraded"
        except Exception as e:
            health_status["services"]["virus_scanner"] = f"unhealthy: {str(e)}"
            if VirusScannerService().enabled:
                health_status["overall_status"] = "degraded"

        # Check Tesseract OCR
        try:
            ocr = OCRService()
            ocr_info = ocr.get_tesseract_info()
            if "error" not in ocr_info:
                health_status["services"]["tesseract"] = "healthy"
            else:
                health_status["services"]["tesseract"] = f"unhealthy: {ocr_info['error']}"
                health_status["overall_status"] = "unhealthy"
        except Exception as e:
            health_status["services"]["tesseract"] = f"unhealthy: {str(e)}"
            health_status["overall_status"] = "unhealthy"

        logger.info(f"Health check completed: {health_status['overall_status']}")
        return health_status

    except Exception as e:
        logger.error(f"Error in health check: {str(e)}", exc_info=True)
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": "unhealthy",
            "error": str(e)
        }


@celery_app.task(bind=True, max_retries=3)
def retry_failed_jobs(self):
    """Retry failed processing jobs"""
    try:
        logger.info("Retrying failed jobs")

        db = SessionLocal()
        try:
            # Get failed jobs that haven't been retried too many times
            failed_jobs = db.query(ProcessingJob).filter(
                ProcessingJob.status == "failed",
                ProcessingJob.retry_count < 3,
                ProcessingJob.created_at >= datetime.utcnow() - timedelta(hours=24)
            ).all()

            retried_count = 0

            for job in failed_jobs:
                try:
                    # Get the file record
                    file_record = db.query(FileUpload).filter(
                        FileUpload.id == job.file_id
                    ).first()

                    if file_record and Path(file_record.file_path).exists():
                        # Create new processing task
                        new_task = process_document.delay(job.file_id)

                        # Update job record
                        job.celery_task_id = new_task.id
                        job.status = "queued"
                        job.retry_count += 1
                        job.updated_at = datetime.utcnow()

                        retried_count += 1

                except Exception as e:
                    logger.error(f"Error retrying job {job.id}: {str(e)}")

            db.commit()

            result = {
                "retried_jobs": retried_count,
                "total_failed": len(failed_jobs)
            }

            logger.info(f"Job retry completed: {result}")
            return result

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error retrying failed jobs: {str(e)}", exc_info=True)
        raise


# Helper function to run async functions in Celery tasks
def run_async(coro):
    """Run async function in sync context"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(coro)


# Patch async calls in tasks
process_document = celery_app.task(bind=True, base=CallbackTask, max_retries=3)(
    lambda self, file_id, user_id=None: run_async(
        process_document.__wrapped__(self, file_id, user_id)
    )
)

health_check = celery_app.task(bind=True)(
    lambda self: run_async(health_check.__wrapped__(self))
)
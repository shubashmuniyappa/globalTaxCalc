"""
Task management utilities for Celery integration
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from app.tasks.celery_app import celery_app
from app.tasks.processing_tasks import process_document
from app.database import SessionLocal
from app.models.database import FileUpload, ProcessingJob
from app.utils.logging import get_logger

logger = get_logger(__name__)


class TaskManager:
    """Manager for handling Celery tasks and job tracking"""

    def __init__(self):
        self.celery = celery_app

    async def submit_processing_job(
        self,
        file_id: int,
        user_id: Optional[str] = None,
        priority: int = 5
    ) -> Dict[str, Any]:
        """
        Submit a document processing job

        Args:
            file_id: ID of the uploaded file
            user_id: Optional user ID for tracking
            priority: Job priority (1-10, lower = higher priority)

        Returns:
            Job information
        """
        try:
            db = SessionLocal()
            try:
                # Verify file exists
                file_record = db.query(FileUpload).filter(FileUpload.id == file_id).first()
                if not file_record:
                    raise ValueError(f"File with ID {file_id} not found")

                if file_record.processing_status not in ["uploaded", "failed"]:
                    raise ValueError(f"File already processed or in progress")

                # Submit Celery task
                task = process_document.apply_async(
                    args=[file_id, user_id],
                    priority=priority
                )

                # Create job record
                job = ProcessingJob(
                    file_id=file_id,
                    user_id=user_id,
                    celery_task_id=task.id,
                    status="queued",
                    priority=priority,
                    created_at=datetime.utcnow()
                )
                db.add(job)

                # Update file status
                file_record.processing_status = "queued"

                db.commit()

                logger.info(f"Submitted processing job for file {file_id}, task ID: {task.id}")

                return {
                    "job_id": job.id,
                    "task_id": task.id,
                    "status": "queued",
                    "file_id": file_id,
                    "priority": priority,
                    "created_at": job.created_at.isoformat()
                }

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error submitting processing job for file {file_id}: {str(e)}")
            raise

    async def get_job_status(self, job_id: Optional[int] = None, task_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get status of a processing job

        Args:
            job_id: Database job ID
            task_id: Celery task ID

        Returns:
            Job status information
        """
        try:
            db = SessionLocal()
            try:
                job = None

                if job_id:
                    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
                elif task_id:
                    job = db.query(ProcessingJob).filter(ProcessingJob.celery_task_id == task_id).first()

                if not job:
                    return {
                        "status": "not_found",
                        "error": "Job not found"
                    }

                # Get Celery task result
                celery_result = AsyncResult(job.celery_task_id, app=self.celery)

                # Sync job status with Celery if needed
                if job.status != celery_result.status.lower():
                    job.status = celery_result.status.lower()
                    job.updated_at = datetime.utcnow()
                    db.commit()

                result = {
                    "job_id": job.id,
                    "task_id": job.celery_task_id,
                    "file_id": job.file_id,
                    "status": job.status,
                    "created_at": job.created_at.isoformat(),
                    "updated_at": job.updated_at.isoformat() if job.updated_at else None,
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "priority": job.priority,
                    "retry_count": job.retry_count
                }

                # Add progress info if available
                if celery_result.state == 'PROGRESS':
                    result["progress"] = celery_result.info

                # Add result if completed
                if job.status == "completed" and job.result:
                    result["result"] = job.result

                # Add error info if failed
                if job.status == "failed":
                    result["error_message"] = job.error_message
                    result["error_details"] = job.error_details

                # Calculate processing time
                if job.started_at and job.completed_at:
                    processing_time = (job.completed_at - job.started_at).total_seconds()
                    result["processing_time_seconds"] = processing_time

                return result

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting job status: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }

    async def cancel_job(self, job_id: int) -> Dict[str, Any]:
        """
        Cancel a processing job

        Args:
            job_id: Database job ID

        Returns:
            Cancellation result
        """
        try:
            db = SessionLocal()
            try:
                job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
                if not job:
                    return {
                        "success": False,
                        "error": "Job not found"
                    }

                if job.status in ["completed", "failed", "cancelled"]:
                    return {
                        "success": False,
                        "error": f"Cannot cancel job in {job.status} state"
                    }

                # Cancel Celery task
                self.celery.control.revoke(job.celery_task_id, terminate=True)

                # Update job status
                job.status = "cancelled"
                job.updated_at = datetime.utcnow()

                # Update file status
                file_record = db.query(FileUpload).filter(FileUpload.id == job.file_id).first()
                if file_record:
                    file_record.processing_status = "cancelled"

                db.commit()

                logger.info(f"Cancelled job {job_id}, task {job.celery_task_id}")

                return {
                    "success": True,
                    "job_id": job_id,
                    "task_id": job.celery_task_id,
                    "status": "cancelled"
                }

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error cancelling job {job_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_queue_status(self) -> Dict[str, Any]:
        """Get status of Celery queues"""
        try:
            # Get queue stats
            inspect = self.celery.control.inspect()

            active_tasks = inspect.active()
            reserved_tasks = inspect.reserved()
            scheduled_tasks = inspect.scheduled()

            stats = {
                "queues": {},
                "workers": [],
                "total_active": 0,
                "total_reserved": 0,
                "total_scheduled": 0
            }

            if active_tasks:
                for worker, tasks in active_tasks.items():
                    stats["workers"].append(worker)
                    stats["total_active"] += len(tasks)

                    for task in tasks:
                        queue = task.get("delivery_info", {}).get("routing_key", "default")
                        if queue not in stats["queues"]:
                            stats["queues"][queue] = {"active": 0, "reserved": 0, "scheduled": 0}
                        stats["queues"][queue]["active"] += 1

            if reserved_tasks:
                for worker, tasks in reserved_tasks.items():
                    stats["total_reserved"] += len(tasks)

                    for task in tasks:
                        queue = task.get("delivery_info", {}).get("routing_key", "default")
                        if queue not in stats["queues"]:
                            stats["queues"][queue] = {"active": 0, "reserved": 0, "scheduled": 0}
                        stats["queues"][queue]["reserved"] += 1

            if scheduled_tasks:
                for worker, tasks in scheduled_tasks.items():
                    stats["total_scheduled"] += len(tasks)

            return stats

        except Exception as e:
            logger.error(f"Error getting queue status: {str(e)}")
            return {
                "error": str(e),
                "queues": {},
                "workers": [],
                "total_active": 0,
                "total_reserved": 0,
                "total_scheduled": 0
            }

    async def get_worker_stats(self) -> Dict[str, Any]:
        """Get worker statistics"""
        try:
            inspect = self.celery.control.inspect()

            stats = inspect.stats()

            if not stats:
                return {"workers": [], "error": "No workers available"}

            worker_info = []
            for worker_name, worker_stats in stats.items():
                worker_info.append({
                    "name": worker_name,
                    "status": "online",
                    "pool": worker_stats.get("pool", {}),
                    "total_tasks": worker_stats.get("total", {}),
                    "rusage": worker_stats.get("rusage", {}),
                    "clock": worker_stats.get("clock", 0)
                })

            return {
                "workers": worker_info,
                "total_workers": len(worker_info)
            }

        except Exception as e:
            logger.error(f"Error getting worker stats: {str(e)}")
            return {
                "workers": [],
                "total_workers": 0,
                "error": str(e)
            }

    async def get_failed_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get list of failed jobs"""
        try:
            db = SessionLocal()
            try:
                failed_jobs = db.query(ProcessingJob).filter(
                    ProcessingJob.status == "failed"
                ).order_by(
                    ProcessingJob.created_at.desc()
                ).limit(limit).all()

                results = []
                for job in failed_jobs:
                    results.append({
                        "job_id": job.id,
                        "task_id": job.celery_task_id,
                        "file_id": job.file_id,
                        "created_at": job.created_at.isoformat(),
                        "failed_at": job.updated_at.isoformat() if job.updated_at else None,
                        "retry_count": job.retry_count,
                        "error_message": job.error_message,
                        "error_details": job.error_details
                    })

                return results

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting failed jobs: {str(e)}")
            return []

    async def retry_job(self, job_id: int) -> Dict[str, Any]:
        """Retry a failed job"""
        try:
            db = SessionLocal()
            try:
                job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
                if not job:
                    return {
                        "success": False,
                        "error": "Job not found"
                    }

                if job.status not in ["failed", "cancelled"]:
                    return {
                        "success": False,
                        "error": f"Cannot retry job in {job.status} state"
                    }

                if job.retry_count >= 3:
                    return {
                        "success": False,
                        "error": "Maximum retry attempts exceeded"
                    }

                # Submit new task
                new_job_info = await self.submit_processing_job(
                    job.file_id,
                    job.user_id,
                    job.priority
                )

                # Update old job
                job.status = "retried"
                job.updated_at = datetime.utcnow()
                db.commit()

                logger.info(f"Retried job {job_id} as new job {new_job_info['job_id']}")

                return {
                    "success": True,
                    "old_job_id": job_id,
                    "new_job_id": new_job_info["job_id"],
                    "new_task_id": new_job_info["task_id"]
                }

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error retrying job {job_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def cleanup_old_jobs(self, days: int = 7) -> Dict[str, Any]:
        """Clean up old job records"""
        try:
            db = SessionLocal()
            try:
                cutoff_date = datetime.utcnow() - timedelta(days=days)

                # Delete old completed jobs
                completed_count = db.query(ProcessingJob).filter(
                    ProcessingJob.status == "completed",
                    ProcessingJob.created_at < cutoff_date
                ).delete()

                # Delete old failed jobs that have been retried
                failed_count = db.query(ProcessingJob).filter(
                    ProcessingJob.status.in_(["failed", "retried"]),
                    ProcessingJob.created_at < cutoff_date,
                    ProcessingJob.retry_count >= 3
                ).delete()

                db.commit()

                result = {
                    "completed_jobs_deleted": completed_count,
                    "failed_jobs_deleted": failed_count,
                    "total_deleted": completed_count + failed_count,
                    "cutoff_date": cutoff_date.isoformat()
                }

                logger.info(f"Cleaned up old jobs: {result}")
                return result

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error cleaning up old jobs: {str(e)}")
            return {
                "error": str(e),
                "completed_jobs_deleted": 0,
                "failed_jobs_deleted": 0,
                "total_deleted": 0
            }
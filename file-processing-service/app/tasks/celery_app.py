"""
Celery application configuration
"""
from celery import Celery
from app.config import settings

# Create Celery app
celery_app = Celery(
    "file_processing",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.processing_tasks"]
)

# Configure Celery
celery_app.conf.update(
    # Task routing
    task_routes={
        'app.tasks.processing_tasks.process_document': {'queue': 'processing'},
        'app.tasks.processing_tasks.cleanup_expired_files': {'queue': 'cleanup'},
        'app.tasks.processing_tasks.generate_statistics': {'queue': 'stats'},
    },

    # Worker configuration
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,

    # Task execution
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone=settings.timezone,
    enable_utc=True,

    # Task time limits
    task_time_limit=settings.task_time_limit,
    task_soft_time_limit=settings.task_soft_time_limit,

    # Retry configuration
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,

    # Result backend settings
    result_expires=3600,  # 1 hour
    result_persistent=True,

    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,

    # Beat schedule for periodic tasks
    beat_schedule={
        'cleanup-expired-files': {
            'task': 'app.tasks.processing_tasks.cleanup_expired_files',
            'schedule': 3600.0,  # Run every hour
        },
        'generate-statistics': {
            'task': 'app.tasks.processing_tasks.generate_statistics',
            'schedule': 21600.0,  # Run every 6 hours
        },
        'health-check': {
            'task': 'app.tasks.processing_tasks.health_check',
            'schedule': 300.0,  # Run every 5 minutes
        },
    },
)
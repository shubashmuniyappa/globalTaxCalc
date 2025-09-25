#!/usr/bin/env python3
"""
Start Celery beat scheduler for periodic tasks
"""
import os
import sys
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

from app.tasks.celery_app import celery_app

if __name__ == "__main__":
    # Set up environment
    os.environ.setdefault("CELERY_CONFIG_MODULE", "app.config")

    # Start beat scheduler
    celery_app.start([
        "beat",
        "--loglevel=info",
        "--schedule=/tmp/celerybeat-schedule",
        "--pidfile=/tmp/celerybeat.pid"
    ])
#!/usr/bin/env python3
"""
Start Celery worker for document processing
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

    # Start worker
    celery_app.start([
        "worker",
        "--loglevel=info",
        "--concurrency=4",  # Adjust based on your server capacity
        "--queues=processing,cleanup,stats",
        "--hostname=worker@%h",
        "--without-gossip",
        "--without-mingle",
        "--without-heartbeat"
    ])
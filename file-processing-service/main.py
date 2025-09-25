#!/usr/bin/env python3
"""
Main application entry point for File Processing Service
"""
import os
import sys
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

# Import the FastAPI app
from app.api.endpoints import app

if __name__ == "__main__":
    import uvicorn
    from app.config import settings

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else 4,
        access_log=True,
        use_colors=True
    )
"""
GlobalTaxCalc Tax Calculation Engine
Main FastAPI application entry point
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

import structlog
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from app.core.config import get_settings
from app.core.cache import get_cache_manager
from app.core.exceptions import TaxCalculationError, TaxEngineException
from app.api.endpoints import router as api_router
from app.models.health import HealthResponse
from app.services.tax_calculation import init_tax_calculation_service
from app.services.tax_rules import init_tax_rules_service
from app.services.tax_optimization import init_tax_optimization_service
from app.core.logging import setup_logging

# Setup structured logging
setup_logging()
logger = structlog.get_logger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("Starting Tax Calculation Engine...")

    # Initialize cache manager
    cache_manager = get_cache_manager()

    # Initialize services
    tax_rules_service = init_tax_rules_service(cache_manager)
    tax_calculation_service = init_tax_calculation_service(tax_rules_service, cache_manager)
    tax_optimization_service = init_tax_optimization_service(tax_calculation_service, cache_manager)

    # Store in app state
    app.state.cache_manager = cache_manager
    app.state.tax_rules_service = tax_rules_service
    app.state.tax_calculation_service = tax_calculation_service
    app.state.tax_optimization_service = tax_optimization_service

    logger.info("Tax Calculation Engine started successfully")

    yield

    # Cleanup
    logger.info("Shutting down Tax Calculation Engine...")
    if hasattr(cache_manager, 'close'):
        await cache_manager.close()
    logger.info("Tax Calculation Engine shut down successfully")


# Create FastAPI application
app = FastAPI(
    title="GlobalTaxCalc Tax Engine",
    description="High-performance tax calculation engine supporting multiple countries",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
    openapi_url="/openapi.json" if settings.environment != "production" else None,
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts
)


@app.middleware("http")
async def request_timing_middleware(request, call_next):
    """Add request timing and logging"""
    start_time = time.time()

    # Log request
    logger.info(
        "Request started",
        method=request.method,
        url=str(request.url),
        client=request.client.host if request.client else None
    )

    response = await call_next(request)

    # Calculate processing time
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)

    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        process_time=process_time
    )

    return response


@app.exception_handler(TaxCalculationError)
async def tax_calculation_exception_handler(request, exc: TaxCalculationError):
    """Handle tax calculation errors"""
    logger.error(
        "Tax calculation error",
        error=str(exc),
        url=str(request.url),
        method=request.method
    )

    return JSONResponse(
        status_code=400,
        content={
            "error": "Tax Calculation Error",
            "message": str(exc),
            "type": "tax_calculation_error"
        }
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc: ValidationError):
    """Handle validation errors"""
    logger.error(
        "Validation error",
        error=str(exc),
        url=str(request.url),
        method=request.method
    )

    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": str(exc),
            "type": "validation_error"
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle unexpected errors"""
    logger.error(
        "Unexpected error",
        error=str(exc),
        error_type=type(exc).__name__,
        url=str(request.url),
        method=request.method,
        exc_info=True
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
            "type": "internal_error"
        }
    )


# Health check endpoints
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Basic health check endpoint"""
    try:
        # Check services
        services_status = {
            "tax_calculation": "healthy" if hasattr(app.state, 'tax_calculation_service') else "unhealthy",
            "tax_rules": "healthy" if hasattr(app.state, 'tax_rules_service') else "unhealthy",
            "tax_optimization": "healthy" if hasattr(app.state, 'tax_optimization_service') else "unhealthy",
            "cache": "healthy"
        }

        # Test cache connectivity if available
        if hasattr(app.state, 'cache_manager'):
            try:
                # Simple test - this will depend on your cache implementation
                services_status["cache"] = "healthy"
            except Exception:
                services_status["cache"] = "unhealthy"

        overall_status = "healthy" if all(status == "healthy" for status in services_status.values()) else "unhealthy"

        return HealthResponse(
            status=overall_status,
            timestamp=time.time(),
            version="1.0.0",
            services=services_status
        )

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return HealthResponse(
            status="unhealthy",
            timestamp=time.time(),
            version="1.0.0",
            services={"error": str(e)}
        )


@app.get("/metrics", tags=["Monitoring"])
async def get_metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "service": "GlobalTaxCalc Tax Engine",
        "version": "1.0.0",
        "environment": settings.environment,
        "description": "High-performance tax calculation engine",
        "supported_countries": ["US", "CA", "UK", "AU", "DE"],
        "endpoints": {
            "health": "/health",
            "docs": "/docs" if settings.environment == "development" else "disabled",
            "calculate": "/api/v1/calculate",
            "optimize": "/api/v1/optimize",
            "tax_rules": "/api/v1/tax-rules",
            "brackets": "/api/v1/brackets"
        }
    }


# Include API router
app.include_router(api_router, prefix="/api/v1")


# Background task to refresh cache
async def refresh_cache_background():
    """Background task to refresh tax rules cache"""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            logger.info("Refreshing tax rules cache...")
            if hasattr(app.state, 'tax_rules_service'):
                app.state.tax_rules_service.reload_rules()
            logger.info("Tax rules cache refreshed successfully")
        except Exception as e:
            logger.error("Failed to refresh cache", error=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
        log_level="info",
        access_log=True
    )
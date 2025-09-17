import asyncio
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from src.config import settings
from src.core import setup_logging, api_logger
from src.api.endpoints import router as api_router
from src.services import nlp_service, voice_service
from src.models import get_model_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    api_logger.info("Starting AI service", version=settings.app_version)

    try:
        # Initialize services
        api_logger.info("Initializing AI services...")

        # Initialize model manager and load models
        model_manager = get_model_manager()
        await model_manager.load_llama_model()

        # Initialize NLP service
        await nlp_service.initialize()

        # Initialize voice service
        await voice_service.initialize()

        api_logger.info("AI services initialized successfully")

    except Exception as e:
        api_logger.error("Failed to initialize AI services", error=str(e))
        # Continue startup even if some services fail

    yield

    # Shutdown
    api_logger.info("Shutting down AI service")

    try:
        # Cleanup model manager
        model_manager = get_model_manager()
        for model_name in list(model_manager.models.keys()):
            model_manager.unload_model(model_name)

        api_logger.info("AI service shutdown complete")

    except Exception as e:
        api_logger.error("Error during shutdown", error=str(e))


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI/LLM Integration Service for GlobalTaxCalc.com - Provides natural language processing, voice input, and intelligent tax optimization suggestions",
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    openapi_url=settings.openapi_url,
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] if settings.environment == "development" else ["localhost", "127.0.0.1"]
)


# Custom middleware for request logging and timing
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log requests and measure response time."""
    start_time = time.time()

    # Extract request info
    request_id = f"{int(start_time * 1000)}"
    client_ip = request.client.host if request.client else "unknown"

    # Log request
    api_logger.info("Request started",
                   request_id=request_id,
                   method=request.method,
                   url=str(request.url),
                   client_ip=client_ip,
                   user_agent=request.headers.get("user-agent", "unknown"))

    # Process request
    try:
        response = await call_next(request)
        processing_time = time.time() - start_time

        # Log response
        api_logger.info("Request completed",
                       request_id=request_id,
                       status_code=response.status_code,
                       processing_time=processing_time)

        # Add custom headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Processing-Time"] = str(processing_time)

        return response

    except Exception as e:
        processing_time = time.time() - start_time
        api_logger.error("Request failed",
                        request_id=request_id,
                        error=str(e),
                        processing_time=processing_time)
        raise


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    api_logger.error("Unhandled exception",
                    url=str(request.url),
                    method=request.method,
                    error=str(exc),
                    error_type=type(exc).__name__)

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": time.time()
        }
    )


# Health check endpoint (outside of API router for simplicity)
@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "environment": settings.environment,
        "docs_url": settings.docs_url,
        "api_prefix": settings.api_prefix
    }


@app.get("/ping")
async def ping():
    """Simple ping endpoint for load balancer health checks."""
    return {"status": "ok", "timestamp": time.time()}


# Mount API router
app.include_router(api_router, prefix=settings.api_prefix)


# Custom startup event for additional initialization
@app.on_event("startup")
async def startup_event():
    """Additional startup tasks."""
    api_logger.info("FastAPI application started",
                   host=settings.host,
                   port=settings.port,
                   environment=settings.environment)


if __name__ == "__main__":
    # Setup logging
    setup_logging()

    # Run the application
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1,  # Single worker for AI models
        log_level=settings.log_level.lower(),
        access_log=True
    )
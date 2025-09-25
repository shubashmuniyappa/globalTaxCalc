"""
GlobalTaxCalc Multi-Country Tax Engine API

FastAPI application providing comprehensive tax calculations for 15+ countries
with real-time currency conversion, localized tax rules, and optimization features.
"""

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import time
import os
from typing import Dict, Any
import redis
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

# Import route modules
from .routes.multi_country_tax import router as tax_router
from .routes.subscriptions import router as subscription_router
from .routes.webhooks import router as webhook_router

# Import middleware
from .middleware.rate_limiting import RateLimitMiddleware
from .middleware.auth import AuthMiddleware
from .middleware.logging import LoggingMiddleware

# Import tax engine for startup validation
from .tax_engine.countries.india import IndiaTaxCalculator
from .tax_engine.countries.japan import JapanTaxCalculator
from .tax_engine.countries.singapore import SingaporeTaxCalculator
from .tax_engine.currency_converter import CurrencyConverter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

TAX_CALCULATIONS = Counter(
    'tax_calculations_total',
    'Total tax calculations performed',
    ['country', 'success']
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("Starting GlobalTaxCalc Multi-Country Tax Engine...")

    # Initialize Redis connection
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        redis_client = redis.from_url(redis_url)
        redis_client.ping()
        app.state.redis = redis_client
        logger.info("Redis connection established")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")
        app.state.redis = None

    # Initialize currency converter
    try:
        api_keys = {
            'exchangerate_api': os.getenv('EXCHANGERATE_API_KEY'),
            'fixer_io': os.getenv('FIXER_IO_API_KEY'),
            'currencylayer': os.getenv('CURRENCYLAYER_API_KEY'),
            'openexchangerates': os.getenv('OPENEXCHANGERATES_API_KEY')
        }

        currency_converter = CurrencyConverter(
            redis_url=redis_url if app.state.redis else None,
            api_keys=api_keys
        )
        app.state.currency_converter = currency_converter
        logger.info("Currency converter initialized")
    except Exception as e:
        logger.error(f"Currency converter initialization failed: {e}")
        raise

    # Validate tax calculators
    try:
        # Test each implemented calculator
        test_calculators = [
            ("India", IndiaTaxCalculator()),
            ("Japan", JapanTaxCalculator()),
            ("Singapore", SingaporeTaxCalculator())
        ]

        for name, calc in test_calculators:
            info = calc.get_country_info()
            logger.info(f"{name} tax calculator loaded: {info['currency']}")

        logger.info(f"Loaded {len(test_calculators)} tax calculators")

    except Exception as e:
        logger.error(f"Tax calculator validation failed: {e}")
        raise

    # Startup validation complete
    logger.info("Multi-Country Tax Engine startup complete")

    yield

    # Shutdown
    logger.info("Shutting down Multi-Country Tax Engine...")
    if hasattr(app.state, 'redis') and app.state.redis:
        app.state.redis.close()

# Create FastAPI application
app = FastAPI(
    title="GlobalTaxCalc Multi-Country Tax Engine",
    description="""
    Comprehensive tax calculation API supporting 15+ countries with:

    - **Accurate Tax Calculations**: Government-verified tax computations
    - **Multi-Country Support**: India, Japan, Singapore, Brazil, Mexico, Italy, Spain, Netherlands, Sweden, and more
    - **Real-time Currency Conversion**: Live exchange rates from multiple providers
    - **Tax Optimization**: Personalized suggestions for tax savings
    - **Localized Rules**: Country-specific deductions, credits, and regulations
    - **API-First Design**: RESTful API with comprehensive documentation

    ## Supported Countries

    ### Fully Implemented
    - 🇮🇳 **India**: Income tax slabs, TDS, CESS, old vs new regime
    - 🇯🇵 **Japan**: National and local taxes, social insurance, reconstruction tax
    - 🇸🇬 **Singapore**: Progressive rates, CPF, resident vs non-resident

    ### Coming Soon
    - 🇧🇷 Brazil: Federal and state tax structure
    - 🇲🇽 Mexico: ISR income tax calculations
    - 🇮🇹 Italy: IRPEF progressive taxation
    - 🇪🇸 Spain: IRPF income tax system
    - 🇳🇱 Netherlands: Income tax brackets and rates
    - 🇸🇪 Sweden: Municipal and national taxes

    ## Key Features

    - **Real-time Calculations**: Instant tax computations with government accuracy
    - **Currency Support**: 35+ currencies with live conversion rates
    - **Tax Optimization**: AI-powered suggestions for legitimate tax savings
    - **Regime Comparison**: Compare different tax filing options
    - **Historical Data**: Access to previous tax years and rates
    - **Compliance Ready**: Built for tax professionals and businesses
    """,
    version="1.0.0",
    contact={
        "name": "GlobalTaxCalc Support",
        "url": "https://globaltaxcalc.com/support",
        "email": "support@globaltaxcalc.com"
    },
    license_info={
        "name": "Commercial License",
        "url": "https://globaltaxcalc.com/license"
    },
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://globaltaxcalc.com",
        "https://www.globaltaxcalc.com",
        "https://app.globaltaxcalc.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "localhost",
        "127.0.0.1",
        "globaltaxcalc.com",
        "*.globaltaxcalc.com",
        "api.globaltaxcalc.com"
    ]
)

# Custom middleware
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Middleware to collect Prometheus metrics"""
    start_time = time.time()

    response = await call_next(request)

    # Record metrics
    duration = time.time() - start_time
    REQUEST_DURATION.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status_code=response.status_code
    ).inc()

    return response

# Include routers
app.include_router(tax_router)
app.include_router(subscription_router)
app.include_router(webhook_router)

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "GlobalTaxCalc Multi-Country Tax Engine API",
        "version": "1.0.0",
        "status": "operational",
        "features": [
            "Multi-country tax calculations",
            "Real-time currency conversion",
            "Tax optimization suggestions",
            "Government-verified accuracy",
            "Comprehensive API documentation"
        ],
        "supported_countries": {
            "implemented": ["IN", "JP", "SG"],
            "coming_soon": ["BR", "MX", "IT", "ES", "NL", "SE", "US", "GB", "CA", "AU", "DE", "FR"]
        },
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc",
            "openapi_spec": "/openapi.json"
        }
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring"""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "services": {}
    }

    # Check Redis connection
    try:
        if hasattr(app.state, 'redis') and app.state.redis:
            app.state.redis.ping()
            health_status["services"]["redis"] = "healthy"
        else:
            health_status["services"]["redis"] = "not_configured"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # Check currency converter
    try:
        if hasattr(app.state, 'currency_converter'):
            # Test basic functionality
            currencies = app.state.currency_converter.get_supported_currencies()
            health_status["services"]["currency_converter"] = f"healthy ({len(currencies)} currencies)"
        else:
            health_status["services"]["currency_converter"] = "not_configured"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["currency_converter"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # Check tax calculators
    try:
        calculators = [
            ("india", IndiaTaxCalculator),
            ("japan", JapanTaxCalculator),
            ("singapore", SingaporeTaxCalculator)
        ]

        working_calculators = 0
        for name, calc_class in calculators:
            try:
                calc = calc_class()
                calc.get_country_info()
                working_calculators += 1
            except Exception:
                pass

        health_status["services"]["tax_calculators"] = f"healthy ({working_calculators}/{len(calculators)} working)"

        if working_calculators == 0:
            health_status["status"] = "unhealthy"
        elif working_calculators < len(calculators):
            health_status["status"] = "degraded"

    except Exception as e:
        health_status["services"]["tax_calculators"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # Return appropriate status code
    if health_status["status"] == "unhealthy":
        return JSONResponse(content=health_status, status_code=503)
    elif health_status["status"] == "degraded":
        return JSONResponse(content=health_status, status_code=200)
    else:
        return health_status

@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/status", tags=["API Info"])
async def api_status():
    """Detailed API status and statistics"""
    return {
        "api_version": "1.0.0",
        "engine_status": "operational",
        "uptime": time.time(),
        "features": {
            "tax_calculation": True,
            "currency_conversion": True,
            "optimization_suggestions": True,
            "multi_country_support": True,
            "real_time_rates": True,
            "government_verified": True
        },
        "countries": {
            "total_supported": 15,
            "implemented": 3,
            "in_development": 12
        },
        "currencies": {
            "supported": len(app.state.currency_converter.get_supported_currencies())
                        if hasattr(app.state, 'currency_converter') else 0,
            "conversion_providers": 4
        },
        "rate_limits": {
            "tax_calculations": "20 per hour",
            "optimizations": "10 per hour",
            "currency_conversions": "100 per hour",
            "general_queries": "100 per hour"
        }
    }

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status_code": exc.status_code,
            "message": exc.detail,
            "timestamp": time.time(),
            "path": request.url.path
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "status_code": 500,
            "message": "An internal server error occurred",
            "timestamp": time.time(),
            "path": request.url.path
        }
    )

# Startup event to record successful initialization
@app.on_event("startup")
async def startup_event():
    """Record startup in metrics"""
    logger.info("GlobalTaxCalc Multi-Country Tax Engine started successfully")

if __name__ == "__main__":
    import uvicorn

    # Development server configuration
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )
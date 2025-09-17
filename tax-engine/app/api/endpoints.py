"""
Tax Engine API Endpoints
RESTful API endpoints for tax calculations and optimization
"""

import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse

from app.core.exceptions import TaxEngineException, TaxCalculationError, CountryNotSupportedException
from app.core.logging import LoggingMixin
from app.models.tax_calculation import (
    TaxCalculationRequest,
    TaxCalculationResponse,
    FilingStatus,
    Country
)
from app.models.tax_optimization import (
    TaxOptimizationRequest,
    TaxOptimizationResponse
)
from app.models.health import HealthResponse
from app.services.tax_calculation import get_tax_calculation_service, TaxCalculationService
from app.services.tax_optimization import get_tax_optimization_service, TaxOptimizationService
from app.services.tax_rules import get_tax_rules_service, TaxRulesService

# Create router
router = APIRouter()


class TaxEngineAPI(LoggingMixin):
    """Tax Engine API implementation"""

    def __init__(self):
        super().__init__()


# Global API instance
api = TaxEngineAPI()


@router.post("/calculate",
             response_model=TaxCalculationResponse,
             summary="Calculate taxes",
             description="Calculate federal and state/provincial taxes for supported countries")
async def calculate_tax(
    request: TaxCalculationRequest,
    tax_service: TaxCalculationService = Depends(get_tax_calculation_service)
) -> TaxCalculationResponse:
    """
    Calculate taxes based on income, deductions, and other factors.

    - **country**: Country code (US, CA, UK, AU, DE)
    - **tax_year**: Tax year (2024, 2025)
    - **filing_status**: Filing status (single, married_filing_jointly, etc.)
    - **income_items**: List of income sources
    - **deduction_items**: List of deductions
    - **total_income**: Total income amount
    """
    try:
        api.logger.info(
            f"Tax calculation requested for {request.country.value} {request.tax_year}",
            extra={
                "country": request.country.value,
                "tax_year": request.tax_year,
                "total_income": float(request.total_income),
                "filing_status": request.filing_status.value
            }
        )

        response = await tax_service.calculate_tax(request)

        api.logger.info(
            f"Tax calculation completed",
            extra={
                "country": request.country.value,
                "tax_year": request.tax_year,
                "total_tax": float(response.tax_breakdown.total_tax),
                "effective_rate": float(response.tax_breakdown.effective_tax_rate)
            }
        )

        return response

    except CountryNotSupportedException as e:
        api.logger.warning(f"Unsupported country: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country not supported: {str(e)}"
        )
    except TaxCalculationError as e:
        api.logger.error(f"Tax calculation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tax calculation failed: {str(e)}"
        )
    except Exception as e:
        api.logger.error(f"Unexpected error in tax calculation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during tax calculation"
        )


@router.post("/optimize",
             response_model=TaxOptimizationResponse,
             summary="Optimize taxes",
             description="Generate tax optimization suggestions and strategies")
async def optimize_tax(
    request: TaxOptimizationRequest,
    optimization_service: TaxOptimizationService = Depends(get_tax_optimization_service)
) -> TaxOptimizationResponse:
    """
    Generate tax optimization suggestions based on your financial situation.

    - **base_calculation**: Your current tax calculation request
    - **optimization_goals**: Specific goals (reduce_current_tax, retirement_planning, etc.)
    - **risk_tolerance**: Risk tolerance level (conservative, moderate, aggressive)
    """
    try:
        api.logger.info(
            f"Tax optimization requested for {request.base_calculation.country.value}",
            extra={
                "country": request.base_calculation.country.value,
                "tax_year": request.base_calculation.tax_year,
                "total_income": float(request.base_calculation.total_income)
            }
        )

        response = await optimization_service.optimize_tax(request)

        api.logger.info(
            f"Tax optimization completed",
            extra={
                "country": request.base_calculation.country.value,
                "baseline_tax": float(response.baseline_tax),
                "potential_savings": float(response.total_potential_savings),
                "suggestions_count": len(response.optimized_scenarios)
            }
        )

        return response

    except CountryNotSupportedException as e:
        api.logger.warning(f"Unsupported country for optimization: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country not supported for optimization: {str(e)}"
        )
    except TaxCalculationError as e:
        api.logger.error(f"Tax optimization error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tax optimization failed: {str(e)}"
        )
    except Exception as e:
        api.logger.error(f"Unexpected error in tax optimization: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during tax optimization"
        )


@router.get("/tax-rules/{country}",
            response_model=Dict[str, Any],
            summary="Get tax rules",
            description="Get tax rules and configuration for a specific country and year")
async def get_tax_rules(
    country: str,
    tax_year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    tax_rules_service: TaxRulesService = Depends(get_tax_rules_service)
) -> Dict[str, Any]:
    """
    Get tax rules for a specific country and year.

    - **country**: Country code (US, CA, UK, AU, DE)
    - **tax_year**: Tax year (2020-2030)
    """
    try:
        country = country.upper()

        api.logger.info(f"Tax rules requested for {country} {tax_year}")

        rules = tax_rules_service.get_tax_rules(country, tax_year)

        api.logger.info(f"Tax rules retrieved for {country} {tax_year}")

        return rules

    except CountryNotSupportedException as e:
        api.logger.warning(f"Unsupported country for tax rules: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country not supported: {str(e)}"
        )
    except Exception as e:
        api.logger.error(f"Error retrieving tax rules: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving tax rules"
        )


@router.get("/brackets/{country}",
            response_model=Dict[str, Any],
            summary="Get tax brackets",
            description="Get tax brackets for a specific country, year, and filing status")
async def get_tax_brackets(
    country: str,
    tax_year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    filing_status: str = Query(..., description="Filing status"),
    state_province: Optional[str] = Query(None, description="State or province code"),
    tax_service: TaxCalculationService = Depends(get_tax_calculation_service)
) -> Dict[str, Any]:
    """
    Get tax brackets for a specific country, year, and filing status.

    - **country**: Country code (US, CA, UK, AU, DE)
    - **tax_year**: Tax year (2020-2030)
    - **filing_status**: Filing status (single, married_filing_jointly, etc.)
    - **state_province**: Optional state or province code
    """
    try:
        country = country.upper()

        # Validate filing status
        try:
            filing_status_enum = FilingStatus(filing_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid filing status: {filing_status}"
            )

        api.logger.info(f"Tax brackets requested for {country} {tax_year} {filing_status}")

        brackets = await tax_service.get_tax_brackets(
            country, tax_year, filing_status, state_province
        )

        api.logger.info(f"Tax brackets retrieved for {country} {tax_year} {filing_status}")

        return brackets

    except CountryNotSupportedException as e:
        api.logger.warning(f"Unsupported country for tax brackets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country not supported: {str(e)}"
        )
    except TaxCalculationError as e:
        api.logger.error(f"Error retrieving tax brackets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error retrieving tax brackets: {str(e)}"
        )
    except Exception as e:
        api.logger.error(f"Unexpected error retrieving tax brackets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving tax brackets"
        )


@router.get("/countries",
            response_model=Dict[str, str],
            summary="Get supported countries",
            description="Get list of supported countries for tax calculations")
async def get_supported_countries(
    tax_service: TaxCalculationService = Depends(get_tax_calculation_service)
) -> Dict[str, str]:
    """
    Get list of supported countries with their names.
    """
    try:
        api.logger.info("Supported countries requested")

        countries = tax_service.get_supported_countries()

        api.logger.info(f"Returned {len(countries)} supported countries")

        return countries

    except Exception as e:
        api.logger.error(f"Error retrieving supported countries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving supported countries"
        )


@router.get("/countries/{country}/info",
            response_model=Dict[str, Any],
            summary="Get country information",
            description="Get detailed information about a country's tax system")
async def get_country_info(
    country: str,
    tax_service: TaxCalculationService = Depends(get_tax_calculation_service)
) -> Dict[str, Any]:
    """
    Get detailed information about a country's tax system.

    - **country**: Country code (US, CA, UK, AU, DE)
    """
    try:
        country = country.upper()

        api.logger.info(f"Country info requested for {country}")

        info = tax_service.get_country_info(country)

        api.logger.info(f"Country info retrieved for {country}")

        return info

    except CountryNotSupportedException as e:
        api.logger.warning(f"Unsupported country for info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country not supported: {str(e)}"
        )
    except Exception as e:
        api.logger.error(f"Error retrieving country info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving country information"
        )


@router.get("/filing-statuses",
            response_model=List[str],
            summary="Get filing statuses",
            description="Get list of supported filing statuses")
async def get_filing_statuses() -> List[str]:
    """
    Get list of supported filing statuses.
    """
    try:
        api.logger.info("Filing statuses requested")

        statuses = [status.value for status in FilingStatus]

        api.logger.info(f"Returned {len(statuses)} filing statuses")

        return statuses

    except Exception as e:
        api.logger.error(f"Error retrieving filing statuses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving filing statuses"
        )


@router.get("/health",
            response_model=HealthResponse,
            summary="Health check",
            description="Check the health status of the tax engine service")
async def health_check(
    tax_service: TaxCalculationService = Depends(get_tax_calculation_service),
    tax_rules_service: TaxRulesService = Depends(get_tax_rules_service)
) -> HealthResponse:
    """
    Health check endpoint to verify service status.
    """
    try:
        # Check if services are working
        countries = tax_service.get_supported_countries()
        supported_years = tax_rules_service.get_supported_years("US")

        return HealthResponse(
            status="healthy",
            version="1.0.0",
            timestamp=time.time(),
            services={
                "tax_calculation": "healthy",
                "tax_rules": "healthy",
                "tax_optimization": "healthy"
            },
            system_info={
                "supported_countries": len(countries),
                "supported_years": len(supported_years) if supported_years else 0
            }
        )

    except Exception as e:
        api.logger.error(f"Health check failed: {str(e)}")
        return HealthResponse(
            status="unhealthy",
            version="1.0.0",
            timestamp=time.time(),
            services={
                "tax_calculation": "unhealthy",
                "tax_rules": "unhealthy",
                "tax_optimization": "unhealthy"
            },
            system_info={
                "error": str(e)
            }
        )


# Error handlers
@router.exception_handler(TaxEngineException)
async def tax_engine_exception_handler(request, exc: TaxEngineException):
    """Handle tax engine exceptions"""
    api.logger.error(f"Tax engine exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc), "type": "TaxEngineException"}
    )


@router.exception_handler(ValueError)
async def value_error_handler(request, exc: ValueError):
    """Handle value errors"""
    api.logger.error(f"Value error: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "type": "ValueError"}
    )


# Add middleware for request logging
@router.middleware("http")
async def log_requests(request, call_next):
    """Log all API requests"""
    start_time = time.time()

    api.logger.info(
        f"API request started",
        extra={
            "method": request.method,
            "url": str(request.url),
            "client": request.client.host if request.client else "unknown"
        }
    )

    response = await call_next(request)

    duration = (time.time() - start_time) * 1000

    api.logger.info(
        f"API request completed",
        extra={
            "method": request.method,
            "url": str(request.url),
            "status_code": response.status_code,
            "duration_ms": duration
        }
    )

    return response
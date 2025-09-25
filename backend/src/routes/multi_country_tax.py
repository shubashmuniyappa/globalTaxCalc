"""
Multi-Country Tax API Routes

FastAPI routes for country-specific tax calculations, supporting
15+ countries with localized tax rules, currency conversion,
and optimization suggestions.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any, Union
from decimal import Decimal
from datetime import datetime, date
import logging
from enum import Enum

from ..tax_engine.base_calculator import TaxResult, Deduction, TaxCredit
from ..tax_engine.countries.india import IndiaTaxCalculator
from ..tax_engine.countries.japan import JapanTaxCalculator
from ..tax_engine.countries.singapore import SingaporeTaxCalculator
from ..tax_engine.currency_converter import CurrencyConverter
from ..middleware.rate_limiting import rate_limit
from ..middleware.auth import get_current_user

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/countries", tags=["Multi-Country Tax"])

# Initialize currency converter
currency_converter = CurrencyConverter()

class SupportedCountry(str, Enum):
    """Supported countries for tax calculations"""
    INDIA = "IN"
    JAPAN = "JP"
    SINGAPORE = "SG"
    BRAZIL = "BR"
    MEXICO = "MX"
    ITALY = "IT"
    SPAIN = "ES"
    NETHERLANDS = "NL"
    SWEDEN = "SE"
    UNITED_STATES = "US"
    UNITED_KINGDOM = "GB"
    CANADA = "CA"
    AUSTRALIA = "AU"
    GERMANY = "DE"
    FRANCE = "FR"

class TaxCalculationRequest(BaseModel):
    """Tax calculation request model"""
    gross_income: Decimal = Field(..., gt=0, description="Annual gross income")
    currency: str = Field(..., min_length=3, max_length=3, description="Income currency code")
    age: Optional[int] = Field(None, ge=18, le=100, description="Taxpayer age")
    filing_status: Optional[str] = Field(None, description="Filing status (married, single, etc.)")
    dependents: Optional[int] = Field(0, ge=0, description="Number of dependents")
    deductions: Optional[List[Dict[str, Any]]] = Field([], description="Additional deductions")
    credits: Optional[List[Dict[str, Any]]] = Field([], description="Tax credits")

    # Country-specific parameters
    extra_params: Optional[Dict[str, Any]] = Field({}, description="Country-specific parameters")

    @validator('currency')
    def validate_currency(cls, v):
        if not currency_converter.validate_currency_code(v):
            raise ValueError(f"Unsupported currency: {v}")
        return v.upper()

class TaxOptimizationRequest(BaseModel):
    """Tax optimization request model"""
    gross_income: Decimal = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    current_deductions: Optional[List[Dict[str, Any]]] = Field([])
    optimization_goals: Optional[List[str]] = Field(["minimize_tax"])
    extra_params: Optional[Dict[str, Any]] = Field({})

class CountryComparisonRequest(BaseModel):
    """Country comparison request model"""
    gross_income: Decimal = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    countries: List[SupportedCountry] = Field(..., min_items=2, max_items=10)
    normalize_currency: Optional[str] = Field(None, description="Currency for comparison")
    extra_params: Optional[Dict[str, Any]] = Field({})

def get_tax_calculator(country_code: str, **kwargs):
    """Factory function to get appropriate tax calculator"""
    country_code = country_code.upper()

    if country_code == "IN":
        regime = kwargs.get('regime', 'new')
        return IndiaTaxCalculator(regime=regime)
    elif country_code == "JP":
        prefecture = kwargs.get('prefecture', 'tokyo')
        return JapanTaxCalculator(prefecture=prefecture)
    elif country_code == "SG":
        resident_status = kwargs.get('resident_status', 'resident')
        return SingaporeTaxCalculator(resident_status=resident_status)
    else:
        # For now, return None for other countries until implemented
        raise HTTPException(
            status_code=501,
            detail=f"Tax calculator for {country_code} is not yet implemented"
        )

@router.get("/{country_code}/info")
@rate_limit(requests=100, window=3600)
async def get_country_info(
    country_code: SupportedCountry = Path(..., description="Country code")
):
    """Get country-specific tax information and metadata"""
    try:
        calculator = get_tax_calculator(country_code.value)
        info = calculator.get_country_info()

        return {
            "success": True,
            "data": info,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get country info for {country_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{country_code}/tax-rules")
@rate_limit(requests=50, window=3600)
async def get_tax_rules(
    country_code: SupportedCountry = Path(..., description="Country code"),
    tax_year: int = Query(2024, description="Tax year")
):
    """Get tax rules and brackets for a specific country"""
    try:
        calculator = get_tax_calculator(country_code.value, tax_year=tax_year)

        tax_brackets = [
            {
                "min_income": float(bracket.min_income),
                "max_income": float(bracket.max_income) if bracket.max_income else None,
                "rate": float(bracket.rate),
                "description": bracket.description
            }
            for bracket in calculator.get_tax_brackets()
        ]

        standard_deductions = [
            {
                "name": deduction.name,
                "amount": float(deduction.amount),
                "category": deduction.category,
                "description": deduction.description,
                "is_percentage": deduction.is_percentage,
                "max_amount": float(deduction.max_amount) if deduction.max_amount else None
            }
            for deduction in calculator.get_standard_deductions()
        ]

        return {
            "success": True,
            "data": {
                "country_code": country_code.value,
                "tax_year": tax_year,
                "tax_brackets": tax_brackets,
                "standard_deductions": standard_deductions,
                "currency": calculator.currency
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get tax rules for {country_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{country_code}/calculate")
@rate_limit(requests=20, window=3600)
async def calculate_tax(
    country_code: SupportedCountry = Path(..., description="Country code"),
    request: TaxCalculationRequest = ...,
    user = Depends(get_current_user)
):
    """Calculate tax for a specific country"""
    try:
        # Get calculator
        calculator = get_tax_calculator(country_code.value, **request.extra_params)

        # Convert currency if needed
        income_in_local_currency = request.gross_income
        if request.currency != calculator.currency:
            converted_amount = await currency_converter.convert_amount(
                request.gross_income,
                request.currency,
                calculator.currency
            )
            if converted_amount is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Currency conversion failed: {request.currency} to {calculator.currency}"
                )
            income_in_local_currency = converted_amount

        # Prepare calculation parameters
        calc_params = {
            "age": request.age,
            "filing_status": request.filing_status,
            "dependents": request.dependents,
            **request.extra_params
        }

        # Convert deductions to appropriate format
        deductions = []
        for ded in request.deductions:
            deductions.append(Deduction(
                name=ded.get('name', 'Custom Deduction'),
                amount=Decimal(str(ded.get('amount', 0))),
                category=ded.get('category', 'other'),
                description=ded.get('description', ''),
                is_percentage=ded.get('is_percentage', False),
                max_amount=Decimal(str(ded['max_amount'])) if ded.get('max_amount') else None
            ))

        # Convert credits to appropriate format
        credits = []
        for cred in request.credits:
            credits.append(TaxCredit(
                name=cred.get('name', 'Custom Credit'),
                amount=Decimal(str(cred.get('amount', 0))),
                is_refundable=cred.get('is_refundable', False),
                description=cred.get('description', '')
            ))

        # Perform calculation
        result = calculator.calculate_comprehensive_tax(
            income_in_local_currency,
            deductions=deductions,
            credits=credits,
            **calc_params
        )

        # Convert result back to original currency if needed
        if request.currency != calculator.currency:
            result.gross_income = float(request.gross_income)

            # Convert key monetary values
            conversion_rate = await currency_converter.get_exchange_rate(
                calculator.currency, request.currency
            )
            if conversion_rate:
                rate = conversion_rate.rate
                result.taxable_income = float(Decimal(str(result.taxable_income)) * rate)
                result.income_tax = float(Decimal(str(result.income_tax)) * rate)
                result.social_contributions = float(Decimal(str(result.social_contributions)) * rate)
                result.total_tax = float(Decimal(str(result.total_tax)) * rate)
                result.net_income = float(Decimal(str(result.net_income)) * rate)

        # Format response
        response_data = {
            "calculation": {
                "gross_income": result.gross_income,
                "taxable_income": result.taxable_income,
                "income_tax": result.income_tax,
                "social_contributions": result.social_contributions,
                "total_tax": result.total_tax,
                "net_income": result.net_income,
                "effective_tax_rate": result.effective_tax_rate,
                "marginal_tax_rate": result.marginal_tax_rate,
                "social_contribution_rate": result.social_contribution_rate
            },
            "breakdown": {
                "tax_brackets_applied": result.tax_brackets_applied,
                "deductions_applied": result.deductions_applied,
                "credits_applied": result.credits_applied,
                "social_contributions_breakdown": result.social_contributions_breakdown
            },
            "metadata": {
                "country_code": result.country_code,
                "tax_year": result.tax_year,
                "currency": request.currency,
                "local_currency": calculator.currency,
                "calculation_date": result.calculation_date.isoformat(),
                "warnings": result.warnings,
                "notes": result.notes
            }
        }

        return {
            "success": True,
            "data": response_data,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Tax calculation failed for {country_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{country_code}/optimize")
@rate_limit(requests=10, window=3600)
async def optimize_tax(
    country_code: SupportedCountry = Path(..., description="Country code"),
    request: TaxOptimizationRequest = ...,
    user = Depends(get_current_user)
):
    """Get tax optimization suggestions for a specific country"""
    try:
        calculator = get_tax_calculator(country_code.value, **request.extra_params)

        # Convert currency if needed
        income_in_local_currency = request.gross_income
        if request.currency != calculator.currency:
            converted_amount = await currency_converter.convert_amount(
                request.gross_income,
                request.currency,
                calculator.currency
            )
            if converted_amount is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Currency conversion failed: {request.currency} to {calculator.currency}"
                )
            income_in_local_currency = converted_amount

        # Convert current deductions
        current_deductions = []
        for ded in request.current_deductions:
            current_deductions.append(Deduction(
                name=ded.get('name', 'Current Deduction'),
                amount=Decimal(str(ded.get('amount', 0))),
                category=ded.get('category', 'other'),
                description=ded.get('description', '')
            ))

        # Get optimization suggestions
        suggestions = calculator.get_optimization_suggestions(
            income_in_local_currency,
            current_deductions,
            **request.extra_params
        )

        # Convert monetary values back to original currency if needed
        if request.currency != calculator.currency:
            conversion_rate = await currency_converter.get_exchange_rate(
                calculator.currency, request.currency
            )
            if conversion_rate:
                rate = conversion_rate.rate
                for suggestion in suggestions:
                    if 'potential_savings' in suggestion:
                        suggestion['potential_savings'] *= float(rate)

        return {
            "success": True,
            "data": {
                "country_code": country_code.value,
                "currency": request.currency,
                "optimization_suggestions": suggestions,
                "optimization_goals": request.optimization_goals
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Tax optimization failed for {country_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compare")
@rate_limit(requests=5, window=3600)
async def compare_countries(
    request: CountryComparisonRequest = ...,
    user = Depends(get_current_user)
):
    """Compare tax calculations across multiple countries"""
    try:
        comparison_results = []
        comparison_currency = request.normalize_currency or request.currency

        for country in request.countries:
            try:
                calculator = get_tax_calculator(country.value, **request.extra_params)

                # Convert income to local currency
                income_in_local_currency = request.gross_income
                if request.currency != calculator.currency:
                    converted_amount = await currency_converter.convert_amount(
                        request.gross_income,
                        request.currency,
                        calculator.currency
                    )
                    if converted_amount:
                        income_in_local_currency = converted_amount

                # Calculate tax
                result = calculator.calculate_comprehensive_tax(
                    income_in_local_currency,
                    **request.extra_params
                )

                # Convert results to comparison currency
                converted_result = {
                    "country_code": country.value,
                    "country_name": calculator.get_country_info().get('country_name', country.value),
                    "local_currency": calculator.currency,
                    "gross_income": float(request.gross_income),
                    "total_tax": result.total_tax,
                    "net_income": result.net_income,
                    "effective_tax_rate": result.effective_tax_rate,
                    "social_contribution_rate": result.social_contribution_rate
                }

                # Convert monetary values to comparison currency
                if calculator.currency != comparison_currency:
                    conversion_rate = await currency_converter.get_exchange_rate(
                        calculator.currency, comparison_currency
                    )
                    if conversion_rate:
                        rate = conversion_rate.rate
                        converted_result["total_tax"] = float(Decimal(str(result.total_tax)) * rate)
                        converted_result["net_income"] = float(Decimal(str(result.net_income)) * rate)

                comparison_results.append(converted_result)

            except Exception as e:
                logger.warning(f"Failed to calculate for {country}: {str(e)}")
                comparison_results.append({
                    "country_code": country.value,
                    "error": str(e),
                    "calculation_failed": True
                })

        # Sort by total tax (ascending)
        successful_results = [r for r in comparison_results if not r.get('calculation_failed')]
        failed_results = [r for r in comparison_results if r.get('calculation_failed')]

        successful_results.sort(key=lambda x: x.get('total_tax', float('inf')))

        # Find best and worst countries
        best_country = successful_results[0] if successful_results else None
        worst_country = successful_results[-1] if successful_results else None

        return {
            "success": True,
            "data": {
                "comparison_currency": comparison_currency,
                "gross_income": float(request.gross_income),
                "results": successful_results + failed_results,
                "summary": {
                    "best_country": best_country,
                    "worst_country": worst_country,
                    "countries_compared": len(successful_results),
                    "countries_failed": len(failed_results)
                }
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Country comparison failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{country_code}/deductions")
@rate_limit(requests=50, window=3600)
async def get_available_deductions(
    country_code: SupportedCountry = Path(..., description="Country code"),
    income: Optional[Decimal] = Query(None, description="Income level for income-dependent deductions"),
    category: Optional[str] = Query(None, description="Filter by deduction category")
):
    """Get available deductions for a specific country"""
    try:
        calculator = get_tax_calculator(country_code.value)
        standard_deductions = calculator.get_standard_deductions()

        # Filter by category if specified
        if category:
            standard_deductions = [d for d in standard_deductions if d.category == category]

        deductions_data = []
        for deduction in standard_deductions:
            deduction_info = {
                "name": deduction.name,
                "category": deduction.category,
                "description": deduction.description,
                "is_percentage": deduction.is_percentage,
                "base_amount": float(deduction.amount),
                "max_amount": float(deduction.max_amount) if deduction.max_amount else None
            }

            # Calculate actual amount if income provided
            if income and deduction.is_percentage:
                actual_amount = income * deduction.amount / Decimal('100')
                if deduction.max_amount:
                    actual_amount = min(actual_amount, deduction.max_amount)
                deduction_info["calculated_amount"] = float(actual_amount)

            deductions_data.append(deduction_info)

        return {
            "success": True,
            "data": {
                "country_code": country_code.value,
                "deductions": deductions_data,
                "categories": list(set(d.category for d in standard_deductions))
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get deductions for {country_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/supported")
async def get_supported_countries():
    """Get list of supported countries for tax calculations"""
    try:
        supported_countries = []

        for country in SupportedCountry:
            try:
                # Try to create calculator to verify implementation
                calculator = get_tax_calculator(country.value)
                info = calculator.get_country_info()

                supported_countries.append({
                    "code": country.value,
                    "name": info.get('country_name', country.value),
                    "currency": info.get('currency', 'N/A'),
                    "tax_authority": info.get('tax_authority', 'N/A'),
                    "features": info.get('supported_features', []),
                    "implemented": True
                })
            except:
                # Country not implemented yet
                supported_countries.append({
                    "code": country.value,
                    "name": country.name.replace('_', ' ').title(),
                    "currency": "N/A",
                    "tax_authority": "N/A",
                    "features": [],
                    "implemented": False
                })

        return {
            "success": True,
            "data": {
                "supported_countries": supported_countries,
                "total_countries": len(supported_countries),
                "implemented_countries": len([c for c in supported_countries if c['implemented']])
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get supported countries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/currencies/supported")
async def get_supported_currencies():
    """Get list of supported currencies"""
    try:
        currencies = currency_converter.get_supported_currencies()

        return {
            "success": True,
            "data": {
                "currencies": currencies,
                "total_count": len(currencies)
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get supported currencies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/currencies/convert")
@rate_limit(requests=100, window=3600)
async def convert_currency(
    amount: Decimal = Query(..., gt=0),
    from_currency: str = Query(..., min_length=3, max_length=3),
    to_currency: str = Query(..., min_length=3, max_length=3),
    date: Optional[str] = Query(None, description="Date for historical conversion (YYYY-MM-DD)")
):
    """Convert currency amounts with real-time or historical rates"""
    try:
        # Parse date if provided
        conversion_date = None
        if date:
            try:
                conversion_date = datetime.strptime(date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        # Perform conversion
        converted_amount = await currency_converter.convert_amount(
            amount, from_currency, to_currency, conversion_date
        )

        if converted_amount is None:
            raise HTTPException(
                status_code=400,
                detail=f"Currency conversion failed: {from_currency} to {to_currency}"
            )

        # Get exchange rate details
        rate_info = await currency_converter.get_exchange_rate(
            from_currency, to_currency, conversion_date
        )

        # Format amounts
        original_formatted = currency_converter.format_currency(amount, from_currency)
        converted_formatted = currency_converter.format_currency(converted_amount, to_currency)

        return {
            "success": True,
            "data": {
                "original_amount": float(amount),
                "converted_amount": float(converted_amount),
                "original_formatted": original_formatted,
                "converted_formatted": converted_formatted,
                "exchange_rate": float(rate_info.rate) if rate_info else None,
                "rate_source": rate_info.source if rate_info else None,
                "rate_timestamp": rate_info.timestamp.isoformat() if rate_info else None,
                "from_currency": from_currency.upper(),
                "to_currency": to_currency.upper(),
                "conversion_date": date or datetime.now().strftime('%Y-%m-%d')
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Currency conversion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
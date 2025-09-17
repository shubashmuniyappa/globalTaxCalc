"""
Tax Calculation Service
Main service that orchestrates tax calculations using country-specific calculators
"""

import time
from typing import Dict, Any, Optional, Type
from decimal import Decimal

from app.core.exceptions import TaxCalculationError, CountryNotSupportedException
from app.core.logging import LoggingMixin
from app.core.cache import TaxCalculationCacheManager
from app.models.tax_calculation import TaxCalculationRequest, TaxCalculationResponse
from app.services.tax_rules import TaxRulesService

# Import all calculators
from app.calculators.base import TaxCalculator
from app.calculators.usa import USATaxCalculator
from app.calculators.canada import CanadaTaxCalculator
from app.calculators.uk import UKTaxCalculator
from app.calculators.australia import AustraliaTaxCalculator
from app.calculators.germany import GermanyTaxCalculator


class TaxCalculationService(LoggingMixin):
    """Main tax calculation service"""

    def __init__(self,
                 tax_rules_service: TaxRulesService,
                 cache_manager: Optional[TaxCalculationCacheManager] = None):
        super().__init__()
        self.tax_rules_service = tax_rules_service
        self.cache_manager = cache_manager

        # Initialize calculator mapping
        self.calculators: Dict[str, Type[TaxCalculator]] = {
            "US": USATaxCalculator,
            "CA": CanadaTaxCalculator,
            "UK": UKTaxCalculator,
            "AU": AustraliaTaxCalculator,
            "DE": GermanyTaxCalculator
        }

        # Calculator instances cache
        self._calculator_instances: Dict[str, TaxCalculator] = {}

    def _get_calculator(self, country_code: str, tax_year: int) -> TaxCalculator:
        """Get or create calculator instance for a country"""
        country_code = country_code.upper()

        if country_code not in self.calculators:
            raise CountryNotSupportedException(f"Tax calculations not supported for {country_code}")

        # Cache key for calculator instance
        cache_key = f"{country_code}_{tax_year}"

        if cache_key not in self._calculator_instances:
            # Get tax rules for the country and year
            tax_rules = self.tax_rules_service.get_tax_rules(country_code, tax_year)

            # Create calculator instance
            calculator_class = self.calculators[country_code]
            calculator = calculator_class(tax_rules)

            # Cache the instance
            self._calculator_instances[cache_key] = calculator

        return self._calculator_instances[cache_key]

    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate taxes for the given request"""
        start_time = time.time()

        try:
            # Validate request
            self._validate_request(request)

            country_code = request.country.value.upper()

            # Check cache first
            if self.cache_manager:
                cached_result = await self.cache_manager.get_tax_calculation(request)
                if cached_result:
                    self.logger.info(
                        f"Retrieved cached tax calculation for {country_code} {request.tax_year}",
                        extra={
                            "country": country_code,
                            "tax_year": request.tax_year,
                            "total_income": float(request.total_income),
                            "cached": True,
                            "duration_ms": (time.time() - start_time) * 1000
                        }
                    )
                    return cached_result

            # Get calculator for the country
            calculator = self._get_calculator(country_code, request.tax_year)

            # Perform calculation
            response = await calculator.calculate_tax(request)

            # Cache the result
            if self.cache_manager:
                await self.cache_manager.set_tax_calculation(request, response)

            calculation_duration = (time.time() - start_time) * 1000

            self.logger.info(
                f"Completed tax calculation for {country_code} {request.tax_year}",
                extra={
                    "country": country_code,
                    "tax_year": request.tax_year,
                    "total_income": float(request.total_income),
                    "total_tax": float(response.tax_breakdown.total_tax),
                    "effective_rate": float(response.tax_breakdown.effective_tax_rate),
                    "cached": False,
                    "duration_ms": calculation_duration
                }
            )

            return response

        except Exception as e:
            calculation_duration = (time.time() - start_time) * 1000

            self.logger.error(
                f"Tax calculation failed: {str(e)}",
                extra={
                    "country": request.country.value,
                    "tax_year": request.tax_year,
                    "total_income": float(request.total_income) if request.total_income else 0,
                    "error": str(e),
                    "duration_ms": calculation_duration
                }
            )

            if isinstance(e, (TaxCalculationError, CountryNotSupportedException)):
                raise

            raise TaxCalculationError(f"Tax calculation failed: {str(e)}")

    def _validate_request(self, request: TaxCalculationRequest) -> None:
        """Validate tax calculation request"""
        if not request.country:
            raise TaxCalculationError("Country is required")

        if not request.tax_year:
            raise TaxCalculationError("Tax year is required")

        if request.tax_year < 2020 or request.tax_year > 2030:
            raise TaxCalculationError("Tax year must be between 2020 and 2030")

        if request.total_income < 0:
            raise TaxCalculationError("Total income cannot be negative")

        # Validate income items
        if not request.income_items:
            raise TaxCalculationError("At least one income item is required")

        total_income = sum(item.amount for item in request.income_items)
        if abs(total_income - request.total_income) > Decimal('0.01'):
            raise TaxCalculationError("Sum of income items must equal total income")

        # Validate state/province if state tax is requested
        if request.include_state_tax and not request.state_province:
            raise TaxCalculationError("State/province is required when state tax calculation is requested")

        # Country-specific validations
        country_code = request.country.value.upper()
        if country_code not in self.calculators:
            raise CountryNotSupportedException(f"Tax calculations not supported for {country_code}")

    def get_supported_countries(self) -> Dict[str, str]:
        """Get supported countries with names"""
        return {
            "US": "United States",
            "CA": "Canada",
            "UK": "United Kingdom",
            "AU": "Australia",
            "DE": "Germany"
        }

    def get_country_info(self, country_code: str) -> Dict[str, Any]:
        """Get detailed information about a country's tax system"""
        country_code = country_code.upper()

        if country_code not in self.calculators:
            raise CountryNotSupportedException(f"Country {country_code} is not supported")

        # Get supported years
        supported_years = self.tax_rules_service.get_supported_years(country_code)

        # Get a sample calculator to get filing statuses
        if supported_years:
            calculator = self._get_calculator(country_code, supported_years[0])
            filing_statuses = [status.value for status in calculator.get_supported_filing_statuses()]
        else:
            filing_statuses = []

        country_names = self.get_supported_countries()

        info = {
            "country_code": country_code,
            "country_name": country_names.get(country_code, country_code),
            "supported_years": supported_years,
            "supported_filing_statuses": filing_statuses,
            "has_state_tax": country_code in ["US", "CA"],
            "currency": self._get_country_currency(country_code),
            "features": self._get_country_features(country_code)
        }

        return info

    def _get_country_currency(self, country_code: str) -> str:
        """Get currency for a country"""
        currencies = {
            "US": "USD",
            "CA": "CAD",
            "UK": "GBP",
            "AU": "AUD",
            "DE": "EUR"
        }
        return currencies.get(country_code, "USD")

    def _get_country_features(self, country_code: str) -> Dict[str, bool]:
        """Get features supported by a country"""
        features = {
            "US": {
                "federal_tax": True,
                "state_tax": True,
                "social_security": True,
                "medicare": True,
                "quarterly_estimates": True,
                "itemized_deductions": True
            },
            "CA": {
                "federal_tax": True,
                "provincial_tax": True,
                "cpp_contributions": True,
                "ei_premiums": True,
                "rrsp_deductions": True,
                "basic_personal_amount": True
            },
            "UK": {
                "income_tax": True,
                "national_insurance": True,
                "personal_allowance": True,
                "marriage_allowance": True,
                "pension_contributions": True
            },
            "AU": {
                "income_tax": True,
                "medicare_levy": True,
                "medicare_levy_surcharge": True,
                "superannuation": True,
                "capital_gains_discount": True
            },
            "DE": {
                "income_tax": True,
                "solidarity_tax": True,
                "church_tax": True,
                "social_insurance": True,
                "tax_formula": True
            }
        }
        return features.get(country_code, {})

    async def get_tax_brackets(self, country_code: str, tax_year: int,
                             filing_status: str, state_province: Optional[str] = None) -> Dict[str, Any]:
        """Get tax brackets for a country and filing status"""
        try:
            calculator = self._get_calculator(country_code, tax_year)

            # Convert filing status string to enum
            from app.models.tax_calculation import FilingStatus
            filing_status_enum = FilingStatus(filing_status)

            federal_brackets, state_brackets = calculator.get_tax_brackets(
                tax_year, filing_status_enum, state_province
            )

            result = {
                "country": country_code,
                "tax_year": tax_year,
                "filing_status": filing_status,
                "federal_brackets": [
                    {
                        "rate": float(bracket.rate),
                        "min_income": float(bracket.min_income),
                        "max_income": float(bracket.max_income) if bracket.max_income else None
                    }
                    for bracket in federal_brackets
                ]
            }

            if state_brackets:
                result["state_province"] = state_province
                result["state_brackets"] = [
                    {
                        "rate": float(bracket.rate),
                        "min_income": float(bracket.min_income),
                        "max_income": float(bracket.max_income) if bracket.max_income else None
                    }
                    for bracket in state_brackets
                ]

            return result

        except Exception as e:
            self.logger.error(f"Failed to get tax brackets: {str(e)}")
            raise TaxCalculationError(f"Failed to get tax brackets: {str(e)}")

    def clear_calculator_cache(self) -> None:
        """Clear cached calculator instances"""
        self._calculator_instances.clear()
        self.logger.info("Cleared calculator instance cache")


# Global instance
_tax_calculation_service: Optional[TaxCalculationService] = None


def get_tax_calculation_service() -> TaxCalculationService:
    """Get the global tax calculation service instance"""
    global _tax_calculation_service
    if _tax_calculation_service is None:
        from app.services.tax_rules import get_tax_rules_service
        _tax_calculation_service = TaxCalculationService(get_tax_rules_service())
    return _tax_calculation_service


def init_tax_calculation_service(tax_rules_service: TaxRulesService,
                                cache_manager: Optional[TaxCalculationCacheManager] = None) -> TaxCalculationService:
    """Initialize the global tax calculation service"""
    global _tax_calculation_service
    _tax_calculation_service = TaxCalculationService(tax_rules_service, cache_manager)
    return _tax_calculation_service
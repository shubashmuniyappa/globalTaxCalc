"""
Custom exceptions for the tax engine
"""

from typing import Any, Dict, Optional


class TaxEngineException(Exception):
    """Base exception for tax engine errors"""

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary"""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details
        }


class TaxCalculationError(TaxEngineException):
    """Exception for tax calculation errors"""
    pass


class ValidationError(TaxEngineException):
    """Exception for input validation errors"""
    pass


class CountryNotSupportedError(TaxEngineException):
    """Exception for unsupported country errors"""

    def __init__(self, country: str, supported_countries: list):
        message = f"Country '{country}' is not supported. Supported countries: {', '.join(supported_countries)}"
        super().__init__(
            message=message,
            error_code="COUNTRY_NOT_SUPPORTED",
            details={
                "country": country,
                "supported_countries": supported_countries
            }
        )


class TaxYearNotSupportedError(TaxEngineException):
    """Exception for unsupported tax year errors"""

    def __init__(self, tax_year: int, supported_years: list):
        message = f"Tax year {tax_year} is not supported. Supported years: {', '.join(map(str, supported_years))}"
        super().__init__(
            message=message,
            error_code="TAX_YEAR_NOT_SUPPORTED",
            details={
                "tax_year": tax_year,
                "supported_years": supported_years
            }
        )


class TaxRuleNotFoundError(TaxEngineException):
    """Exception for missing tax rule errors"""

    def __init__(self, country: str, tax_year: int, rule_type: str):
        message = f"Tax rule not found: {rule_type} for {country} in {tax_year}"
        super().__init__(
            message=message,
            error_code="TAX_RULE_NOT_FOUND",
            details={
                "country": country,
                "tax_year": tax_year,
                "rule_type": rule_type
            }
        )


class InvalidTaxDataError(TaxEngineException):
    """Exception for invalid tax data errors"""

    def __init__(self, field: str, value: Any, reason: str):
        message = f"Invalid tax data: {field} = {value}. Reason: {reason}"
        super().__init__(
            message=message,
            error_code="INVALID_TAX_DATA",
            details={
                "field": field,
                "value": value,
                "reason": reason
            }
        )


class CacheError(TaxEngineException):
    """Exception for cache-related errors"""
    pass


class CalculationTimeoutError(TaxEngineException):
    """Exception for calculation timeout errors"""

    def __init__(self, timeout_seconds: float):
        message = f"Tax calculation timed out after {timeout_seconds} seconds"
        super().__init__(
            message=message,
            error_code="CALCULATION_TIMEOUT",
            details={"timeout_seconds": timeout_seconds}
        )


class OptimizationError(TaxEngineException):
    """Exception for tax optimization errors"""
    pass


class TaxBracketError(TaxEngineException):
    """Exception for tax bracket calculation errors"""
    pass


class DeductionError(TaxEngineException):
    """Exception for deduction calculation errors"""
    pass


class FilingStatusError(TaxEngineException):
    """Exception for filing status validation errors"""

    def __init__(self, filing_status: str, valid_statuses: list):
        message = f"Invalid filing status '{filing_status}'. Valid statuses: {', '.join(valid_statuses)}"
        super().__init__(
            message=message,
            error_code="INVALID_FILING_STATUS",
            details={
                "filing_status": filing_status,
                "valid_statuses": valid_statuses
            }
        )


class IncomeTypeError(TaxEngineException):
    """Exception for income type validation errors"""

    def __init__(self, income_type: str, valid_types: list):
        message = f"Invalid income type '{income_type}'. Valid types: {', '.join(valid_types)}"
        super().__init__(
            message=message,
            error_code="INVALID_INCOME_TYPE",
            details={
                "income_type": income_type,
                "valid_types": valid_types
            }
        )


class RuleValidationError(TaxEngineException):
    """Exception for tax rule validation errors"""
    pass


class ConfigurationError(TaxEngineException):
    """Exception for configuration errors"""
    pass
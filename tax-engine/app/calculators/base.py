"""
Abstract base class for tax calculators
"""

import asyncio
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
from pydantic import ValidationError

from app.core.logging import LoggingMixin
from app.core.exceptions import (
    TaxCalculationError,
    TaxBracketError,
    DeductionError,
    ValidationError as TaxValidationError
)
from app.models.tax_calculation import (
    TaxCalculationRequest,
    TaxCalculationResponse,
    TaxBreakdown,
    TaxBracket,
    FilingStatus,
    IncomeItem,
    DeductionItem
)


class TaxCalculator(ABC, LoggingMixin):
    """Abstract base class for country-specific tax calculators"""

    def __init__(self, country_code: str, tax_rules: Dict[str, Any]):
        self.country_code = country_code
        self.tax_rules = tax_rules
        self.supported_years = list(tax_rules.keys()) if tax_rules else []

    @abstractmethod
    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate tax for the given request"""
        pass

    @abstractmethod
    def get_tax_brackets(self, tax_year: int, filing_status: FilingStatus,
                        state_province: Optional[str] = None) -> Tuple[List[TaxBracket], Optional[List[TaxBracket]]]:
        """Get federal and state/provincial tax brackets"""
        pass

    @abstractmethod
    def get_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                             age: int, spouse_age: Optional[int] = None,
                             is_blind: bool = False, spouse_is_blind: bool = False) -> Decimal:
        """Get standard deduction amount"""
        pass

    def validate_request(self, request: TaxCalculationRequest) -> None:
        """Validate the tax calculation request"""
        try:
            # Validate country
            if request.country.value != self.country_code:
                raise TaxValidationError(
                    f"Calculator is for {self.country_code}, received {request.country.value}"
                )

            # Validate tax year
            if str(request.tax_year) not in self.supported_years:
                raise TaxValidationError(
                    f"Tax year {request.tax_year} not supported. Supported years: {self.supported_years}"
                )

            # Validate income
            total_income = request.total_income
            if total_income < 0:
                raise TaxValidationError("Total income cannot be negative")

            if total_income > Decimal('10000000'):  # 10 million limit
                raise TaxValidationError("Income exceeds maximum calculation limit")

            # Validate filing status for married couples
            married_statuses = [FilingStatus.MARRIED_FILING_JOINTLY, FilingStatus.MARRIED_FILING_SEPARATELY]
            if request.filing_status in married_statuses:
                if request.spouse_age is None:
                    raise TaxValidationError("Spouse age required for married filing status")

        except Exception as e:
            if isinstance(e, TaxValidationError):
                raise
            raise TaxValidationError(f"Request validation failed: {str(e)}")

    def calculate_progressive_tax(self, taxable_income: Decimal, tax_brackets: List[TaxBracket]) -> Tuple[Decimal, List[TaxBracket]]:
        """Calculate tax using progressive tax brackets"""
        if not tax_brackets:
            raise TaxBracketError("No tax brackets provided")

        total_tax = Decimal('0')
        used_brackets = []
        remaining_income = taxable_income

        for bracket in tax_brackets:
            if remaining_income <= 0:
                break

            # Calculate income in this bracket
            bracket_min = bracket.min_income
            bracket_max = bracket.max_income

            if taxable_income <= bracket_min:
                continue

            if bracket_max is not None:
                income_in_bracket = min(remaining_income, bracket_max - bracket_min)
                if taxable_income > bracket_max:
                    income_in_bracket = bracket_max - bracket_min
                else:
                    income_in_bracket = taxable_income - bracket_min
            else:
                # Top bracket - no maximum
                income_in_bracket = max(Decimal('0'), taxable_income - bracket_min)

            if income_in_bracket > 0:
                bracket_tax = income_in_bracket * bracket.rate
                total_tax += bracket_tax

                # Record this bracket usage
                used_brackets.append(TaxBracket(
                    rate=bracket.rate,
                    min_income=bracket_min,
                    max_income=bracket_max,
                    tax_on_bracket=bracket_tax
                ))

                remaining_income -= income_in_bracket

        return total_tax, used_brackets

    def calculate_marginal_tax_rate(self, taxable_income: Decimal, tax_brackets: List[TaxBracket]) -> Decimal:
        """Calculate marginal tax rate"""
        if not tax_brackets or taxable_income <= 0:
            return Decimal('0')

        for bracket in reversed(tax_brackets):
            if taxable_income > bracket.min_income:
                return bracket.rate

        return tax_brackets[0].rate if tax_brackets else Decimal('0')

    def calculate_effective_tax_rate(self, total_tax: Decimal, gross_income: Decimal) -> Decimal:
        """Calculate effective tax rate"""
        if gross_income <= 0:
            return Decimal('0')
        return (total_tax / gross_income) * Decimal('100')

    def calculate_adjusted_gross_income(self, income_items: List[IncomeItem],
                                      above_line_deductions: List[DeductionItem]) -> Decimal:
        """Calculate adjusted gross income (AGI)"""
        gross_income = sum(item.amount for item in income_items if item.is_taxable)
        above_line_total = sum(item.amount for item in above_line_deductions if item.is_above_line)
        return max(Decimal('0'), gross_income - above_line_total)

    def calculate_taxable_income(self, adjusted_gross_income: Decimal,
                               deduction_amount: Decimal) -> Decimal:
        """Calculate taxable income"""
        return max(Decimal('0'), adjusted_gross_income - deduction_amount)

    def determine_best_deduction(self, request: TaxCalculationRequest) -> Tuple[Decimal, str]:
        """Determine whether to use standard or itemized deduction"""
        standard_deduction = self.get_standard_deduction(
            request.tax_year,
            request.filing_status,
            request.age or 0,
            request.spouse_age,
            request.is_blind,
            request.spouse_is_blind
        )

        itemized_deductions = sum(
            item.amount for item in request.deduction_items
            if not item.is_above_line
        )

        if request.use_standard_deduction or itemized_deductions <= standard_deduction:
            return standard_deduction, "standard"
        else:
            return itemized_deductions, "itemized"

    def calculate_social_security_tax(self, wages: Decimal, tax_year: int) -> Decimal:
        """Calculate Social Security tax (US-specific, override in other countries)"""
        return Decimal('0')

    def calculate_medicare_tax(self, wages: Decimal, tax_year: int) -> Decimal:
        """Calculate Medicare tax (US-specific, override in other countries)"""
        return Decimal('0')

    def get_tax_rule(self, tax_year: int, rule_path: str) -> Any:
        """Get specific tax rule by path"""
        try:
            year_rules = self.tax_rules.get(str(tax_year), {})

            # Navigate the rule path
            current = year_rules
            for key in rule_path.split('.'):
                if isinstance(current, dict):
                    current = current.get(key)
                else:
                    return None

            return current
        except Exception:
            return None

    def convert_to_decimal(self, value: Any) -> Decimal:
        """Safely convert value to Decimal"""
        if value is None:
            return Decimal('0')

        try:
            if isinstance(value, str):
                # Remove currency symbols and commas
                value = value.replace('$', '').replace(',', '')
            return Decimal(str(value))
        except Exception:
            return Decimal('0')

    def round_currency(self, amount: Decimal) -> Decimal:
        """Round amount to 2 decimal places for currency"""
        return amount.quantize(Decimal('0.01'))

    async def calculate_with_timeout(self, request: TaxCalculationRequest,
                                   timeout_seconds: float = 10.0) -> TaxCalculationResponse:
        """Calculate tax with timeout protection"""
        try:
            return await asyncio.wait_for(
                self.calculate_tax(request),
                timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            raise TaxCalculationError(
                f"Tax calculation timed out after {timeout_seconds} seconds"
            )

    def get_supported_filing_statuses(self) -> List[FilingStatus]:
        """Get list of supported filing statuses for this country"""
        # Default implementation - override in country-specific calculators
        return [
            FilingStatus.SINGLE,
            FilingStatus.MARRIED_FILING_JOINTLY,
            FilingStatus.MARRIED_FILING_SEPARATELY,
            FilingStatus.HEAD_OF_HOUSEHOLD
        ]

    def get_calculation_complexity_score(self, request: TaxCalculationRequest) -> float:
        """Calculate complexity score for performance monitoring"""
        score = 1.0

        # Income complexity
        score += len(request.income_items) * 0.1

        # Deduction complexity
        score += len(request.deduction_items) * 0.2

        # State/provincial tax adds complexity
        if request.include_state_tax and request.state_province:
            score += 0.5

        # Optimization requests add complexity
        if request.optimization_suggestions:
            score += 1.0

        # Quarterly calculations add complexity
        if request.calculate_quarterly:
            score += 0.3

        return score

    def validate_calculation_result(self, response: TaxCalculationResponse) -> bool:
        """Validate calculation results for reasonableness"""
        try:
            breakdown = response.tax_breakdown

            # Basic sanity checks
            if breakdown.total_tax < 0:
                return False

            if breakdown.effective_tax_rate < 0 or breakdown.effective_tax_rate > 100:
                return False

            if breakdown.marginal_tax_rate < 0 or breakdown.marginal_tax_rate > 100:
                return False

            # Tax should not exceed income
            if breakdown.total_tax > breakdown.gross_income:
                return False

            # Taxable income should not exceed AGI
            if breakdown.taxable_income > breakdown.adjusted_gross_income:
                return False

            return True

        except Exception:
            return False
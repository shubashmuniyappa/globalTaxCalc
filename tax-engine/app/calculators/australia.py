"""
Australia Tax Calculator
Implements Income Tax and Medicare Levy calculations for Australia
"""

import time
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

from app.calculators.base import TaxCalculator
from app.models.tax_calculation import (
    TaxCalculationRequest,
    TaxCalculationResponse,
    TaxBreakdown,
    TaxBracket,
    FilingStatus
)
from app.core.exceptions import TaxCalculationError, TaxBracketError


class AustraliaTaxCalculator(TaxCalculator):
    """Australia Income Tax and Medicare Levy Calculator"""

    def __init__(self, tax_rules: Dict[str, Any]):
        super().__init__("AU", tax_rules)

    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate Australian Income Tax and Medicare Levy"""
        start_time = time.time()

        # Validate request
        self.validate_request(request)

        self.log_calculation_start(
            request.country.value,
            request.tax_year,
            float(request.total_income)
        )

        try:
            # Step 1: Calculate assessable income
            assessable_income = sum(item.amount for item in request.income_items if item.is_taxable)

            # Step 2: Calculate allowable deductions
            total_deductions = sum(item.amount for item in request.deduction_items)

            # Step 3: Calculate taxable income
            taxable_income = max(Decimal('0'), assessable_income - total_deductions)

            # Step 4: Calculate Income Tax
            income_tax_brackets, _ = self.get_tax_brackets(request.tax_year, request.filing_status)
            income_tax, income_tax_brackets_used = self.calculate_progressive_tax(taxable_income, income_tax_brackets)

            # Step 5: Calculate Medicare Levy
            medicare_levy = self.calculate_medicare_levy(request, assessable_income)

            # Step 6: Calculate Medicare Levy Surcharge (if applicable)
            medicare_levy_surcharge = self.calculate_medicare_levy_surcharge(request, assessable_income)

            # Step 7: Calculate totals
            total_tax = income_tax + medicare_levy + medicare_levy_surcharge

            # Step 8: Calculate tax rates
            marginal_rate = self.calculate_marginal_tax_rate(taxable_income, income_tax_brackets)
            effective_rate = self.calculate_effective_tax_rate(total_tax, assessable_income)

            # Step 9: Create tax breakdown
            tax_breakdown = TaxBreakdown(
                gross_income=assessable_income,
                adjusted_gross_income=assessable_income,  # Australia doesn't have AGI concept
                taxable_income=taxable_income,
                federal_income_tax=income_tax,
                federal_tax_brackets=income_tax_brackets_used,
                medicare_tax=medicare_levy + medicare_levy_surcharge,
                standard_deduction=Decimal('0'),  # Australia doesn't have standard deduction
                itemized_deductions=total_deductions,
                deduction_used=total_deductions,
                deduction_type_used="australian_deductions",
                marginal_tax_rate=marginal_rate,
                effective_tax_rate=effective_rate,
                total_tax=total_tax,
                total_tax_rate=self.calculate_effective_tax_rate(total_tax, assessable_income)
            )

            # Step 10: Create response
            calculation_duration = (time.time() - start_time) * 1000

            response = TaxCalculationResponse(
                country=request.country,
                tax_year=request.tax_year,
                filing_status=request.filing_status,
                tax_breakdown=tax_breakdown,
                calculation_date=datetime.now().isoformat(),
                calculation_duration_ms=calculation_duration,
                tax_rules_version=self.get_tax_rule(request.tax_year, "version") or "1.0",
                cached_result=False,
                warnings=[],
                notes=[]
            )

            # Add Australia-specific warnings
            self.add_calculation_warnings_au(response, request)

            self.log_calculation_end(
                request.country.value,
                request.tax_year,
                float(request.total_income),
                float(total_tax),
                calculation_duration / 1000
            )

            return response

        except Exception as e:
            self.log_calculation_error(
                request.country.value,
                request.tax_year,
                float(request.total_income),
                str(e)
            )
            if isinstance(e, TaxCalculationError):
                raise
            raise TaxCalculationError(f"Australia tax calculation failed: {str(e)}")

    def get_tax_brackets(self, tax_year: int, filing_status: FilingStatus,
                        state_province: Optional[str] = None) -> Tuple[List[TaxBracket], Optional[List[TaxBracket]]]:
        """Get Australian Income Tax brackets"""
        tax_brackets_data = self.get_tax_rule(tax_year, "income_tax.brackets")
        if not tax_brackets_data:
            raise TaxBracketError(f"Income tax brackets not found for {tax_year}")

        tax_brackets = [
            TaxBracket(
                rate=Decimal(str(bracket["rate"])),
                min_income=Decimal(str(bracket["min"])),
                max_income=Decimal(str(bracket["max"])) if bracket["max"] is not None else None,
                tax_on_bracket=Decimal('0')
            )
            for bracket in tax_brackets_data
        ]

        return tax_brackets, None  # Australia doesn't have state tax brackets

    def get_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                             age: int, spouse_age: Optional[int] = None,
                             is_blind: bool = False, spouse_is_blind: bool = False) -> Decimal:
        """Australia doesn't have a standard deduction"""
        return Decimal('0')

    def calculate_medicare_levy(self, request: TaxCalculationRequest, assessable_income: Decimal) -> Decimal:
        """Calculate Medicare Levy"""
        medicare_levy_rate = Decimal(str(self.get_tax_rule(request.tax_year, "medicare_levy.rate") or 0.02))
        medicare_levy_threshold = Decimal(str(self.get_tax_rule(
            request.tax_year, f"medicare_levy.threshold.{request.filing_status.value}"
        ) or 23226))

        if assessable_income <= medicare_levy_threshold:
            return Decimal('0')

        # Calculate Medicare Levy with low-income threshold taper
        low_income_threshold = medicare_levy_threshold * Decimal('1.1')  # 10% above threshold

        if assessable_income <= low_income_threshold:
            # Reduced Medicare Levy for low-income earners
            reduction_amount = medicare_levy_threshold * medicare_levy_rate
            taper_amount = (assessable_income - medicare_levy_threshold) * medicare_levy_rate
            return max(Decimal('0'), taper_amount - reduction_amount)
        else:
            # Full Medicare Levy
            return self.round_currency(assessable_income * medicare_levy_rate)

    def calculate_medicare_levy_surcharge(self, request: TaxCalculationRequest,
                                        assessable_income: Decimal) -> Decimal:
        """Calculate Medicare Levy Surcharge for high earners without private health insurance"""
        # This would typically require additional information about private health insurance
        # For now, we'll assume no surcharge applies

        surcharge_threshold = Decimal(str(self.get_tax_rule(
            request.tax_year, f"medicare_levy_surcharge.threshold.{request.filing_status.value}"
        ) or 90000))

        if assessable_income <= surcharge_threshold:
            return Decimal('0')

        # Get surcharge rates based on income tiers
        surcharge_tiers = self.get_tax_rule(request.tax_year, "medicare_levy_surcharge.tiers") or []

        for tier in surcharge_tiers:
            tier_min = Decimal(str(tier["min"]))
            tier_max = Decimal(str(tier["max"])) if tier["max"] is not None else None

            if assessable_income >= tier_min and (tier_max is None or assessable_income <= tier_max):
                surcharge_rate = Decimal(str(tier["rate"]))
                return self.round_currency(assessable_income * surcharge_rate)

        return Decimal('0')

    def add_calculation_warnings_au(self, response: TaxCalculationResponse,
                                  request: TaxCalculationRequest) -> None:
        """Add Australia-specific warnings"""
        warnings = []

        # High income warning
        if request.total_income > Decimal('180000'):
            warnings.append("High income earners may be subject to the top marginal tax rate of 45%")

        # Medicare Levy Surcharge
        if request.total_income > Decimal('90000'):
            warnings.append("Medicare Levy Surcharge may apply if you don't have private health insurance")

        # Superannuation contributions
        if request.total_income > Decimal('50000'):
            warnings.append("Consider salary sacrificing to superannuation for tax benefits")

        # Capital gains tax
        has_capital_gains = any(
            item.income_type.value == 'capital_gains' for item in request.income_items
        )
        if has_capital_gains:
            warnings.append("Capital gains discount may apply for assets held over 12 months")

        # Work-related deductions
        work_deductions = sum(
            item.amount for item in request.deduction_items
            if item.deduction_type.value == 'business_expense'
        )
        if work_deductions > Decimal('300'):
            warnings.append("Work-related deductions over $300 require receipts and documentation")

        # Private health insurance
        if request.total_income > Decimal('90000'):
            warnings.append("Consider private health insurance to avoid Medicare Levy Surcharge")

        response.warnings.extend(warnings)

    def get_supported_filing_statuses(self) -> List[FilingStatus]:
        """Get supported filing statuses for Australia"""
        return [
            FilingStatus.SINGLE,
            FilingStatus.MARRIED_FILING_JOINTLY,
            FilingStatus.MARRIED_FILING_SEPARATELY
        ]
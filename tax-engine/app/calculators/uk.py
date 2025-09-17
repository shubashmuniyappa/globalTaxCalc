"""
UK Tax Calculator
Implements Income Tax and National Insurance calculations for the United Kingdom
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


class UKTaxCalculator(TaxCalculator):
    """United Kingdom Income Tax and National Insurance Calculator"""

    def __init__(self, tax_rules: Dict[str, Any]):
        super().__init__("UK", tax_rules)

    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate UK Income Tax and National Insurance"""
        start_time = time.time()

        # Validate request
        self.validate_request(request)

        self.log_calculation_start(
            request.country.value,
            request.tax_year,
            float(request.total_income)
        )

        try:
            # Step 1: Calculate total income
            total_income = sum(item.amount for item in request.income_items if item.is_taxable)

            # Step 2: Calculate allowable deductions
            allowable_deductions = self.calculate_allowable_deductions(request)

            # Step 3: Calculate taxable income
            personal_allowance = self.get_personal_allowance(request.tax_year, total_income)
            taxable_income = max(Decimal('0'), total_income - personal_allowance - allowable_deductions)

            # Step 4: Calculate Income Tax
            income_tax_brackets, _ = self.get_tax_brackets(request.tax_year, request.filing_status)
            income_tax, income_tax_brackets_used = self.calculate_progressive_tax(taxable_income, income_tax_brackets)

            # Step 5: Calculate National Insurance
            ni_class1 = self.calculate_national_insurance_class1(request)
            ni_class2 = self.calculate_national_insurance_class2(request)
            total_ni = ni_class1 + ni_class2

            # Step 6: Calculate totals
            total_tax = income_tax + total_ni

            # Step 7: Calculate tax rates
            marginal_rate = self.calculate_marginal_tax_rate(taxable_income, income_tax_brackets)
            effective_rate = self.calculate_effective_tax_rate(total_tax, total_income)

            # Step 8: Create tax breakdown
            tax_breakdown = TaxBreakdown(
                gross_income=total_income,
                adjusted_gross_income=total_income - allowable_deductions,
                taxable_income=taxable_income,
                federal_income_tax=income_tax,
                federal_tax_brackets=income_tax_brackets_used,
                social_security_tax=total_ni,  # National Insurance is similar to Social Security
                standard_deduction=personal_allowance,
                itemized_deductions=allowable_deductions,
                deduction_used=personal_allowance + allowable_deductions,
                deduction_type_used="uk_allowances",
                marginal_tax_rate=marginal_rate,
                effective_tax_rate=effective_rate,
                total_tax=total_tax,
                total_tax_rate=self.calculate_effective_tax_rate(total_tax, total_income)
            )

            # Step 9: Create response
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

            # Add UK-specific warnings
            self.add_calculation_warnings_uk(response, request)

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
            raise TaxCalculationError(f"UK tax calculation failed: {str(e)}")

    def get_tax_brackets(self, tax_year: int, filing_status: FilingStatus,
                        state_province: Optional[str] = None) -> Tuple[List[TaxBracket], Optional[List[TaxBracket]]]:
        """Get UK Income Tax brackets"""
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

        return tax_brackets, None  # UK doesn't have state/regional tax brackets

    def get_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                             age: int, spouse_age: Optional[int] = None,
                             is_blind: bool = False, spouse_is_blind: bool = False) -> Decimal:
        """Get personal allowance (UK's equivalent to standard deduction)"""
        return self.get_personal_allowance(tax_year, Decimal('0'))  # Will be calculated based on income

    def get_personal_allowance(self, tax_year: int, total_income: Decimal) -> Decimal:
        """Calculate personal allowance based on income"""
        base_allowance = Decimal(str(self.get_tax_rule(tax_year, "personal_allowance.base") or 12570))
        taper_threshold = Decimal(str(self.get_tax_rule(tax_year, "personal_allowance.taper_threshold") or 100000))
        taper_rate = Decimal(str(self.get_tax_rule(tax_year, "personal_allowance.taper_rate") or 0.5))

        # Personal allowance is reduced for high earners
        if total_income > taper_threshold:
            reduction = (total_income - taper_threshold) * taper_rate
            return max(Decimal('0'), base_allowance - reduction)

        return base_allowance

    def calculate_allowable_deductions(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate allowable deductions for UK tax"""
        total_deductions = Decimal('0')

        for deduction in request.deduction_items:
            # UK has specific rules for deductible expenses
            if deduction.deduction_type.value in ['business_expense', 'education', 'charitable']:
                total_deductions += deduction.amount

        return total_deductions

    def calculate_national_insurance_class1(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate Class 1 National Insurance (for employees)"""
        employment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value in ['salary', 'wages']
        )

        if employment_income == 0:
            return Decimal('0')

        # Get NI thresholds and rates
        lower_threshold = Decimal(str(self.get_tax_rule(request.tax_year, "national_insurance.class1.lower_threshold") or 12570))
        upper_threshold = Decimal(str(self.get_tax_rule(request.tax_year, "national_insurance.class1.upper_threshold") or 50270))
        main_rate = Decimal(str(self.get_tax_rule(request.tax_year, "national_insurance.class1.main_rate") or 0.12))
        additional_rate = Decimal(str(self.get_tax_rule(request.tax_year, "national_insurance.class1.additional_rate") or 0.02))

        ni_contributions = Decimal('0')

        # Calculate NI on income between lower and upper thresholds
        if employment_income > lower_threshold:
            income_in_main_band = min(employment_income - lower_threshold, upper_threshold - lower_threshold)
            ni_contributions += income_in_main_band * main_rate

        # Calculate NI on income above upper threshold
        if employment_income > upper_threshold:
            income_above_upper = employment_income - upper_threshold
            ni_contributions += income_above_upper * additional_rate

        return self.round_currency(ni_contributions)

    def calculate_national_insurance_class2(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate Class 2 National Insurance (for self-employed)"""
        self_employment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value == 'self_employment'
        )

        if self_employment_income == 0:
            return Decimal('0')

        small_profits_threshold = Decimal(str(self.get_tax_rule(request.tax_year, "national_insurance.class2.small_profits_threshold") or 6515))
        weekly_rate = Decimal(str(self.get_tax_rule(request.tax_year, "national_insurance.class2.weekly_rate") or 3.45))

        # Class 2 NI is a flat weekly rate if profits exceed threshold
        if self_employment_income >= small_profits_threshold:
            return weekly_rate * 52  # 52 weeks in a year

        return Decimal('0')

    def add_calculation_warnings_uk(self, response: TaxCalculationResponse,
                                  request: TaxCalculationRequest) -> None:
        """Add UK-specific warnings"""
        warnings = []

        # High income warning
        if request.total_income > Decimal('150000'):
            warnings.append("High earners may be subject to additional rate of 45%")

        # Personal allowance taper
        if request.total_income > Decimal('100000'):
            warnings.append("Personal allowance is reduced for income over £100,000")

        # Pension contributions
        annual_allowance = Decimal('40000')  # Current annual allowance
        if request.total_income > Decimal('240000'):
            warnings.append("Annual allowance for pension contributions may be tapered")

        # Marriage allowance
        if (request.filing_status == FilingStatus.MARRIED_FILING_JOINTLY and
            request.total_income < Decimal('50270')):
            warnings.append("Consider Marriage Allowance if spouse has unused personal allowance")

        # Student loan repayments
        if request.total_income > Decimal('27295'):
            warnings.append("Student loan repayments may apply if you have outstanding student loans")

        response.warnings.extend(warnings)

    def get_supported_filing_statuses(self) -> List[FilingStatus]:
        """Get supported filing statuses for UK"""
        return [
            FilingStatus.SINGLE,
            FilingStatus.MARRIED_FILING_JOINTLY,
            FilingStatus.MARRIED_FILING_SEPARATELY
        ]
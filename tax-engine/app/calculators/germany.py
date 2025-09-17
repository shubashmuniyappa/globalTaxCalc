"""
Germany Tax Calculator
Implements Income Tax and Solidarity Tax calculations for Germany
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


class GermanyTaxCalculator(TaxCalculator):
    """Germany Income Tax and Solidarity Tax Calculator"""

    def __init__(self, tax_rules: Dict[str, Any]):
        super().__init__("DE", tax_rules)

    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate German Income Tax and Solidarity Tax"""
        start_time = time.time()

        # Validate request
        self.validate_request(request)

        self.log_calculation_start(
            request.country.value,
            request.tax_year,
            float(request.total_income)
        )

        try:
            # Step 1: Calculate gross income (Bruttoeinkommen)
            gross_income = sum(item.amount for item in request.income_items if item.is_taxable)

            # Step 2: Calculate allowable deductions
            total_deductions = self.calculate_german_deductions(request)

            # Step 3: Calculate taxable income (zu versteuerndes Einkommen)
            basic_allowance = self.get_basic_allowance(request.tax_year, request.filing_status)
            taxable_income = max(Decimal('0'), gross_income - total_deductions - basic_allowance)

            # Step 4: Calculate Income Tax (Einkommensteuer)
            income_tax = self.calculate_german_income_tax(taxable_income, request.tax_year, request.filing_status)

            # Step 5: Calculate Solidarity Tax (Solidaritätszuschlag)
            solidarity_tax = self.calculate_solidarity_tax(income_tax, request.tax_year)

            # Step 6: Calculate Church Tax (if applicable)
            church_tax = self.calculate_church_tax(income_tax, request)

            # Step 7: Calculate Social Insurance (estimation)
            social_insurance = self.calculate_social_insurance(request)

            # Step 8: Calculate totals
            total_tax = income_tax + solidarity_tax + church_tax + social_insurance

            # Step 9: Calculate tax rates
            marginal_rate = self.calculate_german_marginal_rate(taxable_income, request.tax_year)
            effective_rate = self.calculate_effective_tax_rate(total_tax, gross_income)

            # Step 10: Create tax breakdown
            tax_breakdown = TaxBreakdown(
                gross_income=gross_income,
                adjusted_gross_income=gross_income - total_deductions,
                taxable_income=taxable_income,
                federal_income_tax=income_tax,
                federal_tax_brackets=[],  # German tax uses formula, not brackets
                social_security_tax=social_insurance,
                standard_deduction=basic_allowance,
                itemized_deductions=total_deductions,
                deduction_used=basic_allowance + total_deductions,
                deduction_type_used="german_allowances",
                marginal_tax_rate=marginal_rate,
                effective_tax_rate=effective_rate,
                total_tax=total_tax,
                total_tax_rate=self.calculate_effective_tax_rate(total_tax, gross_income)
            )

            # Step 11: Create response
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
                notes=[
                    f"Solidarity Tax: €{solidarity_tax}",
                    f"Church Tax: €{church_tax}" if church_tax > 0 else "",
                    "Social insurance is estimated and may vary based on specific circumstances"
                ]
            )

            # Add Germany-specific warnings
            self.add_calculation_warnings_de(response, request)

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
            raise TaxCalculationError(f"Germany tax calculation failed: {str(e)}")

    def get_tax_brackets(self, tax_year: int, filing_status: FilingStatus,
                        state_province: Optional[str] = None) -> Tuple[List[TaxBracket], Optional[List[TaxBracket]]]:
        """Germany uses a tax formula rather than brackets, but we'll create equivalent brackets"""
        # This is a simplified representation - actual German tax uses a complex formula
        tax_brackets = [
            TaxBracket(rate=Decimal('0.14'), min_income=Decimal('0'), max_income=Decimal('14532'), tax_on_bracket=Decimal('0')),
            TaxBracket(rate=Decimal('0.24'), min_income=Decimal('14533'), max_income=Decimal('57051'), tax_on_bracket=Decimal('0')),
            TaxBracket(rate=Decimal('0.42'), min_income=Decimal('57052'), max_income=Decimal('270500'), tax_on_bracket=Decimal('0')),
            TaxBracket(rate=Decimal('0.45'), min_income=Decimal('270501'), max_income=None, tax_on_bracket=Decimal('0'))
        ]

        # Adjust for joint filing
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            for bracket in tax_brackets:
                bracket.min_income *= 2
                if bracket.max_income:
                    bracket.max_income *= 2

        return tax_brackets, None

    def get_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                             age: int, spouse_age: Optional[int] = None,
                             is_blind: bool = False, spouse_is_blind: bool = False) -> Decimal:
        """Get basic allowance (Grundfreibetrag)"""
        return self.get_basic_allowance(tax_year, filing_status)

    def get_basic_allowance(self, tax_year: int, filing_status: FilingStatus) -> Decimal:
        """Get basic tax allowance (Grundfreibetrag)"""
        base_allowance = Decimal(str(self.get_tax_rule(tax_year, "basic_allowance") or 10908))

        # Joint filing gets double allowance
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            return base_allowance * 2

        return base_allowance

    def calculate_german_deductions(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate German tax deductions"""
        total_deductions = Decimal('0')

        # Work-related expenses (Werbungskosten)
        work_expenses = sum(
            item.amount for item in request.deduction_items
            if item.deduction_type.value == 'business_expense'
        )
        work_expense_allowance = Decimal(str(self.get_tax_rule(request.tax_year, "work_expense_allowance") or 1230))
        total_deductions += max(work_expenses, work_expense_allowance)

        # Special expenses (Sonderausgaben)
        special_expenses = sum(
            item.amount for item in request.deduction_items
            if item.deduction_type.value in ['retirement', 'charitable']
        )
        total_deductions += special_expenses

        # Extraordinary expenses (Außergewöhnliche Belastungen)
        extraordinary_expenses = sum(
            item.amount for item in request.deduction_items
            if item.deduction_type.value == 'medical'
        )
        total_deductions += extraordinary_expenses

        return total_deductions

    def calculate_german_income_tax(self, taxable_income: Decimal, tax_year: int,
                                  filing_status: FilingStatus) -> Decimal:
        """Calculate German income tax using the official formula"""
        if taxable_income <= 0:
            return Decimal('0')

        # Get tax parameters
        basic_allowance = self.get_basic_allowance(tax_year, FilingStatus.SINGLE)  # Use single for formula
        threshold1 = Decimal(str(self.get_tax_rule(tax_year, "tax_formula.threshold1") or 14532))
        threshold2 = Decimal(str(self.get_tax_rule(tax_year, "tax_formula.threshold2") or 57051))
        threshold3 = Decimal(str(self.get_tax_rule(tax_year, "tax_formula.threshold3") or 270500))

        # Adjust thresholds for joint filing
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            taxable_income = taxable_income / 2  # Splitting method
            calculate_single = True
        else:
            calculate_single = False

        # Apply German tax formula
        if taxable_income <= threshold1:
            tax = Decimal('0')
        elif taxable_income <= threshold2:
            # Progressive zone 1
            y = (taxable_income - threshold1) / Decimal('10000')
            tax = (Decimal('1088.67') * y + Decimal('1400')) * y
        elif taxable_income <= threshold3:
            # Progressive zone 2
            z = (taxable_income - threshold2) / Decimal('10000')
            tax = (Decimal('206.43') * z + Decimal('2397')) * z + Decimal('950.96')
        else:
            # Top rate zone
            tax = Decimal('0.45') * taxable_income - Decimal('17078.74')

        tax = self.round_currency(tax)

        # For joint filing, double the tax
        if calculate_single and filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            tax = tax * 2

        return tax

    def calculate_solidarity_tax(self, income_tax: Decimal, tax_year: int) -> Decimal:
        """Calculate Solidarity Tax (Solidaritätszuschlag)"""
        solidarity_rate = Decimal(str(self.get_tax_rule(tax_year, "solidarity_tax.rate") or 0.055))
        solidarity_threshold = Decimal(str(self.get_tax_rule(tax_year, "solidarity_tax.threshold") or 972))

        if income_tax <= solidarity_threshold:
            return Decimal('0')

        return self.round_currency(income_tax * solidarity_rate)

    def calculate_church_tax(self, income_tax: Decimal, request: TaxCalculationRequest) -> Decimal:
        """Calculate Church Tax (Kirchensteuer) - optional"""
        # Church tax is typically 8-9% of income tax
        # This would require additional input about church membership
        # For now, we'll return 0 unless specifically requested
        return Decimal('0')

    def calculate_social_insurance(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate estimated social insurance contributions"""
        employment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value in ['salary', 'wages']
        )

        if employment_income == 0:
            return Decimal('0')

        # Estimated combined rate for employee portion
        # Pension: ~9.3%, Unemployment: ~1.2%, Health: ~7.3%, Care: ~1.525%
        combined_rate = Decimal('0.193')  # Approximate employee portion

        # Apply contribution ceiling
        contribution_ceiling = Decimal(str(self.get_tax_rule(request.tax_year, "social_insurance.ceiling") or 87600))
        contributory_income = min(employment_income, contribution_ceiling)

        return self.round_currency(contributory_income * combined_rate)

    def calculate_german_marginal_rate(self, taxable_income: Decimal, tax_year: int) -> Decimal:
        """Calculate German marginal tax rate"""
        if taxable_income <= 0:
            return Decimal('0')

        threshold1 = Decimal(str(self.get_tax_rule(tax_year, "tax_formula.threshold1") or 14532))
        threshold2 = Decimal(str(self.get_tax_rule(tax_year, "tax_formula.threshold2") or 57051))
        threshold3 = Decimal(str(self.get_tax_rule(tax_year, "tax_formula.threshold3") or 270500))

        if taxable_income <= threshold1:
            return Decimal('0')
        elif taxable_income <= threshold2:
            # Progressive calculation for zone 1
            y = (taxable_income - threshold1) / Decimal('10000')
            return (Decimal('2177.34') * y + Decimal('1400')) / Decimal('10000')
        elif taxable_income <= threshold3:
            # Progressive calculation for zone 2
            z = (taxable_income - threshold2) / Decimal('10000')
            return (Decimal('412.86') * z + Decimal('2397')) / Decimal('10000')
        else:
            return Decimal('0.45')

    def add_calculation_warnings_de(self, response: TaxCalculationResponse,
                                  request: TaxCalculationRequest) -> None:
        """Add Germany-specific warnings"""
        warnings = []

        # High income warning
        if request.total_income > Decimal('250000'):
            warnings.append("High income may trigger additional tax planning considerations")

        # Social insurance ceiling
        employment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value in ['salary', 'wages']
        )
        if employment_income > Decimal('87600'):
            warnings.append("Income exceeds social insurance contribution ceiling")

        # Church tax
        warnings.append("Church tax (8-9% of income tax) not included - applies to church members")

        # Trade tax
        business_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value == 'business'
        )
        if business_income > 0:
            warnings.append("Trade tax (Gewerbesteuer) may apply to business income - not calculated here")

        # Capital gains
        investment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value in ['investment', 'capital_gains']
        )
        if investment_income > 0:
            warnings.append("Capital gains may be subject to flat tax rate of 25% plus solidarity surcharge")

        response.warnings.extend(warnings)

    def get_supported_filing_statuses(self) -> List[FilingStatus]:
        """Get supported filing statuses for Germany"""
        return [
            FilingStatus.SINGLE,
            FilingStatus.MARRIED_FILING_JOINTLY,
            FilingStatus.MARRIED_FILING_SEPARATELY
        ]
"""
USA Tax Calculator
Implements Federal and State tax calculations for the United States
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
    FilingStatus,
    QuarterlyEstimate
)
from app.core.exceptions import TaxCalculationError, TaxBracketError


class USATaxCalculator(TaxCalculator):
    """United States Federal and State Tax Calculator"""

    def __init__(self, tax_rules: Dict[str, Any]):
        super().__init__("US", tax_rules)

    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate US Federal and State taxes"""
        start_time = time.time()

        # Validate request
        self.validate_request(request)

        self.log_calculation_start(
            request.country.value,
            request.tax_year,
            float(request.total_income)
        )

        try:
            # Step 1: Calculate Adjusted Gross Income (AGI)
            above_line_deductions = [d for d in request.deduction_items if d.is_above_line]
            agi = self.calculate_adjusted_gross_income(request.income_items, above_line_deductions)

            # Step 2: Determine deduction amount
            deduction_amount, deduction_type = self.determine_best_deduction(request)

            # Step 3: Calculate taxable income
            taxable_income = self.calculate_taxable_income(agi, deduction_amount)

            # Step 4: Calculate Federal income tax
            federal_brackets, _ = self.get_tax_brackets(request.tax_year, request.filing_status)
            federal_tax, federal_brackets_used = self.calculate_progressive_tax(taxable_income, federal_brackets)

            # Step 5: Calculate State tax (if applicable)
            state_tax = Decimal('0')
            state_brackets_used = None
            if request.include_state_tax and request.state_province:
                state_tax, state_brackets_used = self.calculate_state_tax(
                    request, taxable_income, agi
                )

            # Step 6: Calculate Social Security and Medicare taxes
            wages = sum(
                item.amount for item in request.income_items
                if item.income_type.value in ['salary', 'wages']
            )

            social_security_tax = self.calculate_social_security_tax(wages, request.tax_year)
            medicare_tax = self.calculate_medicare_tax(wages, request.tax_year)
            additional_medicare_tax = self.calculate_additional_medicare_tax(
                agi, request.filing_status, request.tax_year
            )

            # Step 7: Calculate totals
            total_tax = federal_tax + state_tax + social_security_tax + medicare_tax + additional_medicare_tax

            # Step 8: Calculate tax rates
            marginal_rate = self.calculate_marginal_tax_rate(taxable_income, federal_brackets)
            effective_rate = self.calculate_effective_tax_rate(total_tax, agi)

            # Step 9: Create tax breakdown
            tax_breakdown = TaxBreakdown(
                gross_income=sum(item.amount for item in request.income_items),
                adjusted_gross_income=agi,
                taxable_income=taxable_income,
                federal_income_tax=federal_tax,
                federal_tax_brackets=federal_brackets_used,
                state_income_tax=state_tax if request.include_state_tax else None,
                state_tax_brackets=state_brackets_used,
                social_security_tax=social_security_tax,
                medicare_tax=medicare_tax,
                additional_medicare_tax=additional_medicare_tax,
                standard_deduction=self.get_standard_deduction(
                    request.tax_year, request.filing_status,
                    request.age or 0, request.spouse_age,
                    request.is_blind, request.spouse_is_blind
                ),
                itemized_deductions=sum(
                    item.amount for item in request.deduction_items
                    if not item.is_above_line
                ),
                deduction_used=deduction_amount,
                deduction_type_used=deduction_type,
                marginal_tax_rate=marginal_rate,
                effective_tax_rate=effective_rate,
                total_tax=total_tax,
                total_tax_rate=self.calculate_effective_tax_rate(total_tax, agi)
            )

            # Step 10: Calculate quarterly estimates (if requested)
            quarterly_estimates = None
            if request.calculate_quarterly:
                quarterly_estimates = self.calculate_quarterly_estimates(
                    total_tax, request.tax_year
                )

            # Step 11: Create response
            calculation_duration = (time.time() - start_time) * 1000  # Convert to milliseconds

            response = TaxCalculationResponse(
                country=request.country,
                tax_year=request.tax_year,
                filing_status=request.filing_status,
                tax_breakdown=tax_breakdown,
                quarterly_estimates=quarterly_estimates,
                calculation_date=datetime.now().isoformat(),
                calculation_duration_ms=calculation_duration,
                tax_rules_version=self.get_tax_rule(request.tax_year, "version") or "1.0",
                cached_result=False,
                warnings=[],
                notes=[]
            )

            # Add warnings
            self.add_calculation_warnings(response, request)

            # Validate result
            if not self.validate_calculation_result(response):
                raise TaxCalculationError("Calculation result validation failed")

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
            raise TaxCalculationError(f"US tax calculation failed: {str(e)}")

    def get_tax_brackets(self, tax_year: int, filing_status: FilingStatus,
                        state_province: Optional[str] = None) -> Tuple[List[TaxBracket], Optional[List[TaxBracket]]]:
        """Get Federal and State tax brackets"""
        # Get Federal tax brackets
        federal_brackets_data = self.get_tax_rule(tax_year, f"federal.tax_brackets.{filing_status.value}")
        if not federal_brackets_data:
            raise TaxBracketError(f"Federal tax brackets not found for {filing_status.value} in {tax_year}")

        federal_brackets = [
            TaxBracket(
                rate=Decimal(str(bracket["rate"])),
                min_income=Decimal(str(bracket["min"])),
                max_income=Decimal(str(bracket["max"])) if bracket["max"] is not None else None,
                tax_on_bracket=Decimal('0')  # Will be calculated
            )
            for bracket in federal_brackets_data
        ]

        # Get State tax brackets (if applicable)
        state_brackets = None
        if state_province:
            state_brackets_data = self.get_tax_rule(
                tax_year, f"states.{state_province}.tax_brackets.{filing_status.value}"
            )
            if state_brackets_data:
                state_brackets = [
                    TaxBracket(
                        rate=Decimal(str(bracket["rate"])),
                        min_income=Decimal(str(bracket["min"])),
                        max_income=Decimal(str(bracket["max"])) if bracket["max"] is not None else None,
                        tax_on_bracket=Decimal('0')
                    )
                    for bracket in state_brackets_data
                ]

        return federal_brackets, state_brackets

    def get_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                             age: int, spouse_age: Optional[int] = None,
                             is_blind: bool = False, spouse_is_blind: bool = False) -> Decimal:
        """Get standard deduction amount"""
        base_deduction_data = self.get_tax_rule(tax_year, f"federal.standard_deduction.{filing_status.value}")
        if not base_deduction_data:
            raise TaxCalculationError(f"Standard deduction not found for {filing_status.value} in {tax_year}")

        base_deduction = Decimal(str(base_deduction_data))

        # Additional deductions for age and blindness
        additional_amount = Decimal('0')
        age_threshold = 65
        additional_deduction = Decimal(str(self.get_tax_rule(tax_year, "federal.additional_standard_deduction") or 0))

        # Taxpayer additional deductions
        if age >= age_threshold:
            additional_amount += additional_deduction
        if is_blind:
            additional_amount += additional_deduction

        # Spouse additional deductions (for joint filing)
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY and spouse_age is not None:
            if spouse_age >= age_threshold:
                additional_amount += additional_deduction
            if spouse_is_blind:
                additional_amount += additional_deduction

        return base_deduction + additional_amount

    def calculate_state_tax(self, request: TaxCalculationRequest,
                          taxable_income: Decimal, agi: Decimal) -> Tuple[Decimal, Optional[List[TaxBracket]]]:
        """Calculate state tax"""
        if not request.state_province:
            return Decimal('0'), None

        state_code = request.state_province.upper()

        # Check if state has income tax
        has_income_tax = self.get_tax_rule(request.tax_year, f"states.{state_code}.has_income_tax")
        if not has_income_tax:
            return Decimal('0'), None

        # Get state tax brackets
        _, state_brackets = self.get_tax_brackets(
            request.tax_year, request.filing_status, state_code
        )

        if not state_brackets:
            return Decimal('0'), None

        # Calculate state taxable income (may differ from federal)
        state_agi = self.calculate_state_agi(request, agi, state_code)
        state_deduction = self.get_state_standard_deduction(
            request.tax_year, request.filing_status, state_code
        )
        state_taxable_income = max(Decimal('0'), state_agi - state_deduction)

        # Calculate state tax
        state_tax, state_brackets_used = self.calculate_progressive_tax(
            state_taxable_income, state_brackets
        )

        return state_tax, state_brackets_used

    def calculate_state_agi(self, request: TaxCalculationRequest,
                          federal_agi: Decimal, state_code: str) -> Decimal:
        """Calculate state-specific AGI"""
        # Most states start with federal AGI and make adjustments
        state_agi = federal_agi

        # Get state-specific adjustments
        state_adjustments = self.get_tax_rule(
            request.tax_year, f"states.{state_code}.agi_adjustments"
        ) or {}

        # Apply state-specific adjustments (implementation would depend on state)
        # This is a simplified version - real implementation would handle specific adjustments

        return state_agi

    def get_state_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                                   state_code: str) -> Decimal:
        """Get state standard deduction"""
        state_deduction = self.get_tax_rule(
            tax_year, f"states.{state_code}.standard_deduction.{filing_status.value}"
        )
        return Decimal(str(state_deduction)) if state_deduction else Decimal('0')

    def calculate_social_security_tax(self, wages: Decimal, tax_year: int) -> Decimal:
        """Calculate Social Security tax"""
        ss_rate = Decimal(str(self.get_tax_rule(tax_year, "federal.social_security.rate") or 0.062))
        ss_wage_base = Decimal(str(self.get_tax_rule(tax_year, "federal.social_security.wage_base") or 160200))

        taxable_wages = min(wages, ss_wage_base)
        return self.round_currency(taxable_wages * ss_rate)

    def calculate_medicare_tax(self, wages: Decimal, tax_year: int) -> Decimal:
        """Calculate Medicare tax"""
        medicare_rate = Decimal(str(self.get_tax_rule(tax_year, "federal.medicare.rate") or 0.0145))
        return self.round_currency(wages * medicare_rate)

    def calculate_additional_medicare_tax(self, agi: Decimal, filing_status: FilingStatus,
                                        tax_year: int) -> Decimal:
        """Calculate Additional Medicare Tax (0.9% on high earners)"""
        thresholds = self.get_tax_rule(tax_year, "federal.additional_medicare.thresholds") or {}
        threshold = Decimal(str(thresholds.get(filing_status.value, 250000)))

        if agi > threshold:
            additional_rate = Decimal(str(self.get_tax_rule(tax_year, "federal.additional_medicare.rate") or 0.009))
            return self.round_currency((agi - threshold) * additional_rate)

        return Decimal('0')

    def calculate_quarterly_estimates(self, total_annual_tax: Decimal, tax_year: int) -> List[QuarterlyEstimate]:
        """Calculate quarterly tax estimates"""
        quarterly_amount = self.round_currency(total_annual_tax / Decimal('4'))

        # Due dates for quarterly payments
        due_dates = [
            f"{tax_year}-04-15",  # Q1
            f"{tax_year}-06-15",  # Q2
            f"{tax_year}-09-15",  # Q3
            f"{tax_year + 1}-01-15"  # Q4
        ]

        return [
            QuarterlyEstimate(
                quarter=i + 1,
                due_date=due_dates[i],
                estimated_payment=quarterly_amount
            )
            for i in range(4)
        ]

    def add_calculation_warnings(self, response: TaxCalculationResponse,
                               request: TaxCalculationRequest) -> None:
        """Add warnings to the calculation response"""
        warnings = []

        # High income warning
        if request.total_income > Decimal('500000'):
            warnings.append("High income may trigger additional taxes and AMT considerations")

        # State tax warning
        if request.include_state_tax and not request.state_province:
            warnings.append("State tax calculation requested but no state specified")

        # No state income tax
        if request.state_province:
            has_income_tax = self.get_tax_rule(
                request.tax_year, f"states.{request.state_province.upper()}.has_income_tax"
            )
            if not has_income_tax:
                warnings.append(f"{request.state_province} does not have state income tax")

        # Itemized vs standard deduction
        if response.tax_breakdown.deduction_type_used == "standard":
            if response.tax_breakdown.itemized_deductions > response.tax_breakdown.standard_deduction * Decimal('0.8'):
                warnings.append("Consider itemizing deductions for potential tax savings")

        # Large deductions
        if response.tax_breakdown.deduction_used > response.tax_breakdown.adjusted_gross_income * Decimal('0.3'):
            warnings.append("Unusually large deductions may require additional documentation")

        response.warnings.extend(warnings)

    def get_supported_states(self) -> List[str]:
        """Get list of supported US states"""
        # This would be loaded from tax rules
        return [
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
        ]
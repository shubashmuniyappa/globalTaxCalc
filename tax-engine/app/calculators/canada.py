"""
Canada Tax Calculator
Implements Federal and Provincial tax calculations for Canada
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


class CanadaTaxCalculator(TaxCalculator):
    """Canada Federal and Provincial Tax Calculator"""

    def __init__(self, tax_rules: Dict[str, Any]):
        super().__init__("CA", tax_rules)

    async def calculate_tax(self, request: TaxCalculationRequest) -> TaxCalculationResponse:
        """Calculate Canadian Federal and Provincial taxes"""
        start_time = time.time()

        # Validate request
        self.validate_request(request)

        self.log_calculation_start(
            request.country.value,
            request.tax_year,
            float(request.total_income)
        )

        try:
            # Step 1: Calculate Net Income
            net_income = self.calculate_net_income(request)

            # Step 2: Calculate Taxable Income
            taxable_income = self.calculate_taxable_income_ca(request, net_income)

            # Step 3: Calculate Federal income tax
            federal_brackets, _ = self.get_tax_brackets(request.tax_year, request.filing_status)
            federal_tax, federal_brackets_used = self.calculate_progressive_tax(taxable_income, federal_brackets)

            # Step 4: Calculate Provincial tax (if applicable)
            provincial_tax = Decimal('0')
            provincial_brackets_used = None
            if request.include_state_tax and request.state_province:
                provincial_tax, provincial_brackets_used = self.calculate_provincial_tax(
                    request, taxable_income, net_income
                )

            # Step 5: Calculate CPP contributions
            cpp_contributions = self.calculate_cpp_contributions(request)

            # Step 6: Calculate EI premiums
            ei_premiums = self.calculate_ei_premiums(request)

            # Step 7: Calculate totals
            total_tax = federal_tax + provincial_tax + cpp_contributions + ei_premiums

            # Step 8: Calculate tax rates
            marginal_rate = self.calculate_marginal_tax_rate(taxable_income, federal_brackets)
            if provincial_brackets_used:
                provincial_marginal = self.calculate_marginal_tax_rate(taxable_income, provincial_brackets_used)
                marginal_rate += provincial_marginal

            effective_rate = self.calculate_effective_tax_rate(total_tax, net_income)

            # Step 9: Calculate deductions
            deduction_amount, deduction_type = self.determine_best_deduction_ca(request)

            # Step 10: Create tax breakdown
            tax_breakdown = TaxBreakdown(
                gross_income=sum(item.amount for item in request.income_items),
                adjusted_gross_income=net_income,  # In Canada, this is Net Income
                taxable_income=taxable_income,
                federal_income_tax=federal_tax,
                federal_tax_brackets=federal_brackets_used,
                state_income_tax=provincial_tax if request.include_state_tax else None,
                state_tax_brackets=provincial_brackets_used,
                social_security_tax=cpp_contributions,  # CPP is similar to Social Security
                medicare_tax=ei_premiums,  # EI is similar to unemployment insurance
                standard_deduction=self.get_standard_deduction(
                    request.tax_year, request.filing_status,
                    request.age or 0, request.spouse_age
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
                total_tax_rate=self.calculate_effective_tax_rate(total_tax, net_income)
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
                notes=[]
            )

            # Add Canada-specific warnings
            self.add_calculation_warnings_ca(response, request)

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
            raise TaxCalculationError(f"Canada tax calculation failed: {str(e)}")

    def get_tax_brackets(self, tax_year: int, filing_status: FilingStatus,
                        state_province: Optional[str] = None) -> Tuple[List[TaxBracket], Optional[List[TaxBracket]]]:
        """Get Federal and Provincial tax brackets"""
        # Get Federal tax brackets (Canada doesn't differentiate by filing status like US)
        federal_brackets_data = self.get_tax_rule(tax_year, "federal.tax_brackets")
        if not federal_brackets_data:
            raise TaxBracketError(f"Federal tax brackets not found for {tax_year}")

        federal_brackets = [
            TaxBracket(
                rate=Decimal(str(bracket["rate"])),
                min_income=Decimal(str(bracket["min"])),
                max_income=Decimal(str(bracket["max"])) if bracket["max"] is not None else None,
                tax_on_bracket=Decimal('0')
            )
            for bracket in federal_brackets_data
        ]

        # Get Provincial tax brackets (if applicable)
        provincial_brackets = None
        if state_province:
            provincial_brackets_data = self.get_tax_rule(
                tax_year, f"provinces.{state_province}.tax_brackets"
            )
            if provincial_brackets_data:
                provincial_brackets = [
                    TaxBracket(
                        rate=Decimal(str(bracket["rate"])),
                        min_income=Decimal(str(bracket["min"])),
                        max_income=Decimal(str(bracket["max"])) if bracket["max"] is not None else None,
                        tax_on_bracket=Decimal('0')
                    )
                    for bracket in provincial_brackets_data
                ]

        return federal_brackets, provincial_brackets

    def get_standard_deduction(self, tax_year: int, filing_status: FilingStatus,
                             age: int, spouse_age: Optional[int] = None,
                             is_blind: bool = False, spouse_is_blind: bool = False) -> Decimal:
        """Get standard deduction amount (Canada uses Basic Personal Amount)"""
        basic_personal_amount = self.get_tax_rule(tax_year, "federal.basic_personal_amount")
        if not basic_personal_amount:
            raise TaxCalculationError(f"Basic personal amount not found for {tax_year}")

        return Decimal(str(basic_personal_amount))

    def calculate_net_income(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate Net Income (Canada's equivalent to AGI)"""
        total_income = sum(item.amount for item in request.income_items if item.is_taxable)

        # Subtract above-the-line deductions (RRSP contributions, etc.)
        above_line_deductions = sum(
            item.amount for item in request.deduction_items
            if item.is_above_line
        )

        return max(Decimal('0'), total_income - above_line_deductions)

    def calculate_taxable_income_ca(self, request: TaxCalculationRequest, net_income: Decimal) -> Decimal:
        """Calculate Taxable Income for Canada"""
        # Get basic personal amount and other non-refundable credits
        basic_personal_amount = self.get_standard_deduction(
            request.tax_year, request.filing_status, request.age or 0, request.spouse_age
        )

        # Calculate other deductions
        other_deductions = sum(
            item.amount for item in request.deduction_items
            if not item.is_above_line
        )

        total_deductions = basic_personal_amount + other_deductions

        return max(Decimal('0'), net_income - total_deductions)

    def determine_best_deduction_ca(self, request: TaxCalculationRequest) -> Tuple[Decimal, str]:
        """Determine deductions for Canada (different system than US)"""
        basic_personal_amount = self.get_standard_deduction(
            request.tax_year, request.filing_status, request.age or 0, request.spouse_age
        )

        other_deductions = sum(
            item.amount for item in request.deduction_items
            if not item.is_above_line
        )

        total_deductions = basic_personal_amount + other_deductions

        return total_deductions, "canadian_deductions"

    def calculate_provincial_tax(self, request: TaxCalculationRequest,
                               taxable_income: Decimal, net_income: Decimal) -> Tuple[Decimal, Optional[List[TaxBracket]]]:
        """Calculate provincial tax"""
        if not request.state_province:
            return Decimal('0'), None

        province_code = request.state_province.upper()

        # Get provincial tax brackets
        _, provincial_brackets = self.get_tax_brackets(
            request.tax_year, request.filing_status, province_code
        )

        if not provincial_brackets:
            return Decimal('0'), None

        # Calculate provincial taxable income (may differ from federal)
        provincial_basic_amount = self.get_provincial_basic_amount(
            request.tax_year, province_code
        )
        provincial_taxable_income = max(Decimal('0'), net_income - provincial_basic_amount)

        # Calculate provincial tax
        provincial_tax, provincial_brackets_used = self.calculate_progressive_tax(
            provincial_taxable_income, provincial_brackets
        )

        return provincial_tax, provincial_brackets_used

    def get_provincial_basic_amount(self, tax_year: int, province_code: str) -> Decimal:
        """Get provincial basic personal amount"""
        provincial_basic = self.get_tax_rule(
            tax_year, f"provinces.{province_code}.basic_personal_amount"
        )
        return Decimal(str(provincial_basic)) if provincial_basic else Decimal('0')

    def calculate_cpp_contributions(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate Canada Pension Plan contributions"""
        employment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value in ['salary', 'wages']
        )

        cpp_rate = Decimal(str(self.get_tax_rule(request.tax_year, "federal.cpp.rate") or 0.0595))
        cpp_exemption = Decimal(str(self.get_tax_rule(request.tax_year, "federal.cpp.exemption") or 3500))
        cpp_maximum = Decimal(str(self.get_tax_rule(request.tax_year, "federal.cpp.maximum") or 66600))

        if employment_income <= cpp_exemption:
            return Decimal('0')

        contributory_earnings = min(employment_income - cpp_exemption, cpp_maximum - cpp_exemption)
        return self.round_currency(contributory_earnings * cpp_rate)

    def calculate_ei_premiums(self, request: TaxCalculationRequest) -> Decimal:
        """Calculate Employment Insurance premiums"""
        employment_income = sum(
            item.amount for item in request.income_items
            if item.income_type.value in ['salary', 'wages']
        )

        ei_rate = Decimal(str(self.get_tax_rule(request.tax_year, "federal.ei.rate") or 0.0163))
        ei_maximum = Decimal(str(self.get_tax_rule(request.tax_year, "federal.ei.maximum_insurable") or 63300))

        insurable_earnings = min(employment_income, ei_maximum)
        return self.round_currency(insurable_earnings * ei_rate)

    def add_calculation_warnings_ca(self, response: TaxCalculationResponse,
                                  request: TaxCalculationRequest) -> None:
        """Add Canada-specific warnings"""
        warnings = []

        # High income warning
        if request.total_income > Decimal('200000'):
            warnings.append("High income may trigger additional surtaxes in some provinces")

        # Provincial tax warning
        if request.include_state_tax and not request.state_province:
            warnings.append("Provincial tax calculation requested but no province specified")

        # RRSP contribution room
        if request.total_income > Decimal('50000'):
            warnings.append("Consider maximizing RRSP contributions for tax savings")

        # Split income warning
        if request.filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            warnings.append("Consider income splitting strategies for married couples")

        response.warnings.extend(warnings)

    def get_supported_provinces(self) -> List[str]:
        """Get list of supported Canadian provinces and territories"""
        return [
            "AB",  # Alberta
            "BC",  # British Columbia
            "MB",  # Manitoba
            "NB",  # New Brunswick
            "NL",  # Newfoundland and Labrador
            "NS",  # Nova Scotia
            "NT",  # Northwest Territories
            "NU",  # Nunavut
            "ON",  # Ontario
            "PE",  # Prince Edward Island
            "QC",  # Quebec
            "SK",  # Saskatchewan
            "YT"   # Yukon
        ]

    def get_supported_filing_statuses(self) -> List[FilingStatus]:
        """Get supported filing statuses for Canada"""
        # Canada has simpler filing status options
        return [
            FilingStatus.SINGLE,
            FilingStatus.MARRIED_FILING_JOINTLY,
            FilingStatus.MARRIED_FILING_SEPARATELY
        ]
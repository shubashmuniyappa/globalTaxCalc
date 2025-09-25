"""
Corporate Tax Calculator - Advanced business tax calculations for C-Corporations
Handles complex corporate income tax scenarios including multi-level calculations
"""

from typing import Dict, List, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
from dataclasses import dataclass, field
from enum import Enum

from ..core.tax_engine import TaxCalculationResult, TaxpayerInfo, IncomeItem, DeductionItem
from ..utils.tax_constants import TaxConstants
from ..utils.exceptions import TaxCalculationError

import logging
logger = logging.getLogger(__name__)


class CorporateEntityType(Enum):
    C_CORPORATION = "c_corporation"
    PERSONAL_SERVICE_CORPORATION = "personal_service_corporation"
    CLOSELY_HELD_CORPORATION = "closely_held_corporation"


@dataclass
class CorporateInfo:
    """Corporate-specific information for tax calculations"""
    corporation_type: CorporateEntityType
    ein: str
    incorporation_date: date
    tax_year_end: date
    fiscal_year: bool = False

    # Corporate structure
    number_of_shareholders: int = 1
    is_publicly_traded: bool = False
    is_controlled_group: bool = False
    parent_corporation: Optional[str] = None

    # Business attributes
    primary_business_code: str = ""
    accounting_method: str = "accrual"  # accrual, cash, hybrid
    inventory_method: str = ""  # FIFO, LIFO, specific_identification

    # Tax attributes
    accumulated_earnings_credit: Decimal = Decimal('250000')  # Default for most corporations
    is_personal_holding_company: bool = False
    has_foreign_operations: bool = False

    # Prior year information
    prior_year_taxable_income: Decimal = Decimal('0')
    prior_year_tax: Decimal = Decimal('0')
    accumulated_earnings: Decimal = Decimal('0')


@dataclass
class CorporateIncomeItem(IncomeItem):
    """Corporate-specific income item"""
    # Book vs Tax differences
    book_amount: Optional[Decimal] = None
    permanent_difference: Decimal = Decimal('0')
    temporary_difference: Decimal = Decimal('0')

    # Corporate-specific attributes
    is_controlled_group_income: bool = False
    source_corporation: Optional[str] = None
    dividend_received_deduction_eligible: bool = False
    ownership_percentage: Optional[Decimal] = None


@dataclass
class CorporateDeductionItem(DeductionItem):
    """Corporate-specific deduction item"""
    # Book vs Tax differences
    book_amount: Optional[Decimal] = None
    permanent_difference: Decimal = Decimal('0')
    temporary_difference: Decimal = Decimal('0')

    # Corporate-specific limitations
    is_subject_to_limitation: bool = False
    limitation_type: Optional[str] = None  # meals, entertainment, executive_compensation, etc.
    limitation_percentage: Decimal = Decimal('100')

    # Depreciation attributes
    is_depreciation: bool = False
    depreciation_method: Optional[str] = None
    asset_class: Optional[str] = None
    placed_in_service_date: Optional[date] = None


@dataclass
class CorporateTaxResult(TaxCalculationResult):
    """Corporate tax calculation results"""

    # Corporate-specific tax components
    corporate_income_tax: Decimal = Decimal('0')
    accumulated_earnings_tax: Decimal = Decimal('0')
    personal_holding_company_tax: Decimal = Decimal('0')
    environmental_tax: Decimal = Decimal('0')

    # Book vs Tax reconciliation
    book_income: Decimal = Decimal('0')
    book_tax_differences: Dict[str, Decimal] = field(default_factory=dict)
    schedule_m1_adjustments: Dict[str, Decimal] = field(default_factory=dict)
    schedule_m3_required: bool = False

    # Corporate credits
    general_business_credit: Decimal = Decimal('0')
    foreign_tax_credit_corporate: Decimal = Decimal('0')
    prior_year_minimum_tax_credit: Decimal = Decimal('0')

    # Estimated tax calculations
    required_annual_payment: Decimal = Decimal('0')
    safe_harbor_payment: Decimal = Decimal('0')
    estimated_tax_penalty: Decimal = Decimal('0')

    # Special calculations
    dividends_received_deduction: Decimal = Decimal('0')
    net_operating_loss_carryforward: Decimal = Decimal('0')
    charitable_contribution_carryforward: Decimal = Decimal('0')

    # State tax considerations
    apportionment_factors: Dict[str, Decimal] = field(default_factory=dict)
    multistate_tax_liability: Decimal = Decimal('0')


class CorporateTaxCalculator:
    """
    Advanced Corporate Tax Calculator for C-Corporations
    Handles complex corporate income tax calculations including special taxes and credits
    """

    def __init__(self, tax_year: int = 2024):
        self.tax_year = tax_year
        self.tax_constants = TaxConstants(tax_year)

        # Corporate tax rates (flat 21% for 2024)
        self.corporate_tax_rate = Decimal('0.21')
        self.personal_service_corp_rate = Decimal('0.21')

        logger.info(f"Corporate Tax Calculator initialized for {tax_year}")

    def calculate_corporate_tax(
        self,
        corporate_info: CorporateInfo,
        income_items: List[CorporateIncomeItem],
        deduction_items: List[CorporateDeductionItem],
        additional_data: Optional[Dict] = None
    ) -> CorporateTaxResult:
        """
        Calculate comprehensive corporate income tax

        Args:
            corporate_info: Corporate entity information
            income_items: List of corporate income items
            deduction_items: List of corporate deduction items
            additional_data: Additional calculation data

        Returns:
            CorporateTaxResult: Comprehensive corporate tax results
        """
        try:
            logger.info(f"Calculating corporate tax for EIN: {corporate_info.ein}")

            # Create taxpayer info from corporate info
            taxpayer_info = self._create_taxpayer_info(corporate_info)

            # Initialize result
            result = CorporateTaxResult(taxpayer_info=taxpayer_info)

            # Step 1: Calculate gross income
            self._calculate_gross_income(result, income_items)

            # Step 2: Calculate dividends received deduction
            self._calculate_dividends_received_deduction(result, income_items)

            # Step 3: Calculate business deductions
            self._calculate_business_deductions(result, deduction_items)

            # Step 4: Apply net operating loss
            self._apply_net_operating_loss(result, corporate_info)

            # Step 5: Calculate taxable income
            self._calculate_corporate_taxable_income(result)

            # Step 6: Calculate corporate income tax
            self._calculate_corporate_income_tax(result, corporate_info)

            # Step 7: Calculate special taxes
            self._calculate_special_corporate_taxes(result, corporate_info)

            # Step 8: Calculate corporate credits
            self._calculate_corporate_credits(result, additional_data)

            # Step 9: Calculate estimated tax requirements
            self._calculate_estimated_tax_requirements(result, corporate_info)

            # Step 10: Book-tax reconciliation
            self._perform_book_tax_reconciliation(result, income_items, deduction_items)

            # Step 11: Calculate final liability
            self._calculate_final_corporate_liability(result)

            logger.info("Corporate tax calculation completed successfully")
            return result

        except Exception as e:
            logger.error(f"Corporate tax calculation failed: {str(e)}")
            raise TaxCalculationError(f"Corporate tax calculation failed: {str(e)}")

    def _create_taxpayer_info(self, corporate_info: CorporateInfo) -> TaxpayerInfo:
        """Create taxpayer info from corporate info"""
        from ..core.tax_engine import EntityType

        return TaxpayerInfo(
            entity_type=EntityType.CORPORATION,
            tax_year=self.tax_year,
            ssn_ein=corporate_info.ein,
            business_type=corporate_info.corporation_type.value,
            accounting_method=corporate_info.accounting_method,
            tax_year_end=corporate_info.tax_year_end
        )

    def _calculate_gross_income(self, result: CorporateTaxResult, income_items: List[CorporateIncomeItem]):
        """Calculate total gross income for the corporation"""
        income_categories = {
            'sales_revenue': Decimal('0'),
            'service_revenue': Decimal('0'),
            'investment_income': Decimal('0'),
            'dividend_income': Decimal('0'),
            'other_income': Decimal('0')
        }

        for item in income_items:
            if item.is_taxable:
                amount = self._round_currency(item.amount)

                # Categorize income
                if item.type in ['sales', 'gross_receipts']:
                    income_categories['sales_revenue'] += amount
                elif item.type in ['services', 'fees']:
                    income_categories['service_revenue'] += amount
                elif item.type == 'dividends':
                    income_categories['dividend_income'] += amount
                elif item.type in ['interest', 'capital_gains', 'investment']:
                    income_categories['investment_income'] += amount
                else:
                    income_categories['other_income'] += amount

                result.total_income += amount

        result.income_breakdown = income_categories

        result.audit_trail.append({
            'step': 'gross_income_calculation',
            'total_gross_income': str(result.total_income),
            'income_breakdown': {k: str(v) for k, v in income_categories.items()}
        })

    def _calculate_dividends_received_deduction(self, result: CorporateTaxResult, income_items: List[CorporateIncomeItem]):
        """Calculate dividends received deduction (DRD)"""
        total_drd = Decimal('0')

        for item in income_items:
            if (item.type == 'dividends' and
                item.dividend_received_deduction_eligible and
                item.ownership_percentage is not None):

                dividend_amount = item.amount
                ownership = item.ownership_percentage

                # Determine DRD percentage based on ownership
                if ownership < Decimal('20'):
                    drd_percentage = Decimal('0.50')  # 50% DRD
                elif ownership < Decimal('80'):
                    drd_percentage = Decimal('0.65')  # 65% DRD
                else:
                    drd_percentage = Decimal('1.00')  # 100% DRD for 80%+ ownership

                drd_amount = dividend_amount * drd_percentage

                # Apply taxable income limitation (except for 100% DRD)
                if drd_percentage < Decimal('1.00'):
                    # DRD cannot exceed 50%/65% of taxable income before DRD
                    tentative_taxable_income = result.total_income  # Simplified for this calculation
                    drd_limit = tentative_taxable_income * drd_percentage
                    drd_amount = min(drd_amount, drd_limit)

                total_drd += drd_amount

        result.dividends_received_deduction = self._round_currency(total_drd)

        result.audit_trail.append({
            'step': 'dividends_received_deduction',
            'total_drd': str(result.dividends_received_deduction)
        })

    def _calculate_business_deductions(self, result: CorporateTaxResult, deduction_items: List[CorporateDeductionItem]):
        """Calculate all business deductions with corporate limitations"""
        deduction_categories = {
            'cost_of_goods_sold': Decimal('0'),
            'salaries_wages': Decimal('0'),
            'employee_benefits': Decimal('0'),
            'rent': Decimal('0'),
            'depreciation': Decimal('0'),
            'interest_expense': Decimal('0'),
            'professional_fees': Decimal('0'),
            'meals_entertainment': Decimal('0'),
            'travel': Decimal('0'),
            'charitable_contributions': Decimal('0'),
            'other_deductions': Decimal('0')
        }

        charitable_contributions = Decimal('0')

        for item in deduction_items:
            if item.is_deductible:
                # Apply corporate-specific limitations
                deductible_amount = self._apply_corporate_limitations(item, result)

                # Categorize deductions
                category = self._categorize_corporate_deduction(item)
                if category in deduction_categories:
                    deduction_categories[category] += deductible_amount
                else:
                    deduction_categories['other_deductions'] += deductible_amount

                # Track charitable contributions separately for limitation
                if item.type == 'charitable_contribution':
                    charitable_contributions += deductible_amount

        # Apply charitable contribution limitation (10% of taxable income before charitable deduction)
        if charitable_contributions > 0:
            tentative_taxable_income = (result.total_income -
                                      sum(deduction_categories.values()) +
                                      charitable_contributions)
            charitable_limit = tentative_taxable_income * Decimal('0.10')

            if charitable_contributions > charitable_limit:
                excess_charitable = charitable_contributions - charitable_limit
                result.charitable_contribution_carryforward = excess_charitable
                deduction_categories['charitable_contributions'] = charitable_limit
            else:
                deduction_categories['charitable_contributions'] = charitable_contributions

        result.deduction_breakdown = deduction_categories

        result.audit_trail.append({
            'step': 'business_deductions',
            'total_deductions': str(sum(deduction_categories.values())),
            'charitable_carryforward': str(result.charitable_contribution_carryforward)
        })

    def _apply_corporate_limitations(self, item: CorporateDeductionItem, result: CorporateTaxResult) -> Decimal:
        """Apply corporate-specific limitations to deductions"""
        base_amount = item.amount

        # Apply general limitation percentage
        if item.limitation_percentage < Decimal('100'):
            base_amount = base_amount * (item.limitation_percentage / Decimal('100'))

        # Apply specific corporate limitations
        if item.limitation_type == 'meals_entertainment':
            # 50% limitation for business meals
            base_amount = base_amount * Decimal('0.50')
        elif item.limitation_type == 'executive_compensation':
            # $1M limitation for publicly traded corporations
            if hasattr(result.taxpayer_info, 'is_publicly_traded') and result.taxpayer_info.is_publicly_traded:
                base_amount = min(base_amount, Decimal('1000000'))
        elif item.limitation_type == 'interest_expense':
            # Business interest limitation (30% of adjusted taxable income)
            # Simplified calculation - would need more complex implementation
            pass

        return self._round_currency(base_amount)

    def _categorize_corporate_deduction(self, item: CorporateDeductionItem) -> str:
        """Categorize corporate deduction for reporting"""
        category_mapping = {
            'cost_of_goods_sold': 'cost_of_goods_sold',
            'salaries': 'salaries_wages',
            'wages': 'salaries_wages',
            'employee_benefits': 'employee_benefits',
            'rent': 'rent',
            'depreciation': 'depreciation',
            'interest': 'interest_expense',
            'professional_fees': 'professional_fees',
            'legal_fees': 'professional_fees',
            'accounting_fees': 'professional_fees',
            'meals': 'meals_entertainment',
            'entertainment': 'meals_entertainment',
            'travel': 'travel',
            'charitable_contribution': 'charitable_contributions'
        }

        return category_mapping.get(item.type, 'other_deductions')

    def _apply_net_operating_loss(self, result: CorporateTaxResult, corporate_info: CorporateInfo):
        """Apply net operating loss carryforward"""
        # NOL carryforward is limited to 80% of taxable income for losses from 2018 and later
        # Simplified implementation
        result.net_operating_loss_carryforward = Decimal('0')  # Would come from additional data

    def _calculate_corporate_taxable_income(self, result: CorporateTaxResult):
        """Calculate corporate taxable income"""
        total_deductions = sum(result.deduction_breakdown.values())

        result.taxable_income = (
            result.total_income -
            result.dividends_received_deduction -
            total_deductions -
            result.net_operating_loss_carryforward
        )

        # Ensure taxable income is not negative
        result.taxable_income = max(Decimal('0'), result.taxable_income)

        result.audit_trail.append({
            'step': 'corporate_taxable_income',
            'gross_income': str(result.total_income),
            'dividends_received_deduction': str(result.dividends_received_deduction),
            'total_deductions': str(total_deductions),
            'nol_carryforward': str(result.net_operating_loss_carryforward),
            'taxable_income': str(result.taxable_income)
        })

    def _calculate_corporate_income_tax(self, result: CorporateTaxResult, corporate_info: CorporateInfo):
        """Calculate corporate income tax"""
        # Apply flat corporate tax rate (21% for 2024)
        if corporate_info.corporation_type == CorporateEntityType.PERSONAL_SERVICE_CORPORATION:
            tax_rate = self.personal_service_corp_rate
        else:
            tax_rate = self.corporate_tax_rate

        result.corporate_income_tax = result.taxable_income * tax_rate
        result.regular_tax = result.corporate_income_tax

        result.audit_trail.append({
            'step': 'corporate_income_tax',
            'taxable_income': str(result.taxable_income),
            'tax_rate': str(tax_rate),
            'corporate_tax': str(result.corporate_income_tax)
        })

    def _calculate_special_corporate_taxes(self, result: CorporateTaxResult, corporate_info: CorporateInfo):
        """Calculate special corporate taxes (accumulated earnings, personal holding company)"""

        # Accumulated Earnings Tax (20% on accumulated taxable income above credit)
        if self._is_subject_to_accumulated_earnings_tax(corporate_info, result):
            accumulated_taxable_income = self._calculate_accumulated_taxable_income(result, corporate_info)
            if accumulated_taxable_income > corporate_info.accumulated_earnings_credit:
                result.accumulated_earnings_tax = (
                    (accumulated_taxable_income - corporate_info.accumulated_earnings_credit) *
                    Decimal('0.20')
                )

        # Personal Holding Company Tax (20% on undistributed personal holding company income)
        if corporate_info.is_personal_holding_company:
            # Simplified calculation - would need more complex implementation
            result.personal_holding_company_tax = Decimal('0')

        result.audit_trail.append({
            'step': 'special_corporate_taxes',
            'accumulated_earnings_tax': str(result.accumulated_earnings_tax),
            'personal_holding_company_tax': str(result.personal_holding_company_tax)
        })

    def _calculate_corporate_credits(self, result: CorporateTaxResult, additional_data: Optional[Dict]):
        """Calculate corporate tax credits"""

        # General Business Credit (simplified)
        result.general_business_credit = Decimal('0')

        # Foreign Tax Credit
        result.foreign_tax_credit_corporate = Decimal('0')

        # Prior Year Minimum Tax Credit
        result.prior_year_minimum_tax_credit = Decimal('0')

        result.total_credits = (
            result.general_business_credit +
            result.foreign_tax_credit_corporate +
            result.prior_year_minimum_tax_credit
        )

        result.audit_trail.append({
            'step': 'corporate_credits',
            'total_credits': str(result.total_credits)
        })

    def _calculate_estimated_tax_requirements(self, result: CorporateTaxResult, corporate_info: CorporateInfo):
        """Calculate estimated tax payment requirements"""
        current_year_tax = result.regular_tax + result.accumulated_earnings_tax + result.personal_holding_company_tax

        # Safe harbor: 100% of prior year tax (if prior year tax was $1,000 or more)
        if corporate_info.prior_year_tax >= Decimal('1000'):
            result.safe_harbor_payment = corporate_info.prior_year_tax
        else:
            result.safe_harbor_payment = Decimal('0')

        # Required annual payment: lesser of 100% of current year tax or safe harbor
        result.required_annual_payment = min(current_year_tax, result.safe_harbor_payment)

        # Large corporations (prior year taxable income > $1M) must pay 100% of current year
        if corporate_info.prior_year_taxable_income > Decimal('1000000'):
            result.required_annual_payment = current_year_tax

        result.audit_trail.append({
            'step': 'estimated_tax_requirements',
            'required_annual_payment': str(result.required_annual_payment),
            'safe_harbor_payment': str(result.safe_harbor_payment)
        })

    def _perform_book_tax_reconciliation(
        self,
        result: CorporateTaxResult,
        income_items: List[CorporateIncomeItem],
        deduction_items: List[CorporateDeductionItem]
    ):
        """Perform Schedule M-1/M-3 book-tax reconciliation"""

        # Calculate book income
        book_income = Decimal('0')
        permanent_differences = Decimal('0')
        temporary_differences = Decimal('0')

        # Process income items
        for item in income_items:
            if hasattr(item, 'book_amount') and item.book_amount is not None:
                book_income += item.book_amount
                permanent_differences += item.permanent_difference
                temporary_differences += item.temporary_difference

        # Process deduction items
        for item in deduction_items:
            if hasattr(item, 'book_amount') and item.book_amount is not None:
                book_income -= item.book_amount
                permanent_differences += item.permanent_difference
                temporary_differences += item.temporary_difference

        result.book_income = book_income
        result.book_tax_differences = {
            'permanent_differences': permanent_differences,
            'temporary_differences': temporary_differences
        }

        # Determine if Schedule M-3 is required (total assets >= $10M)
        result.schedule_m3_required = False  # Would be determined by balance sheet data

        result.audit_trail.append({
            'step': 'book_tax_reconciliation',
            'book_income': str(result.book_income),
            'taxable_income': str(result.taxable_income),
            'permanent_differences': str(permanent_differences),
            'temporary_differences': str(temporary_differences)
        })

    def _calculate_final_corporate_liability(self, result: CorporateTaxResult):
        """Calculate final corporate tax liability"""
        result.total_tax = (
            result.corporate_income_tax +
            result.accumulated_earnings_tax +
            result.personal_holding_company_tax +
            result.environmental_tax -
            result.total_credits
        )

        # Calculate amount owed or refund
        balance = result.total_tax - result.total_payments

        if balance > 0:
            result.amount_owed = balance
            result.refund_amount = Decimal('0')
        else:
            result.amount_owed = Decimal('0')
            result.refund_amount = abs(balance)

        # Calculate effective tax rate
        if result.total_income > 0:
            result.effective_tax_rate = (result.total_tax / result.total_income) * 100

        result.audit_trail.append({
            'step': 'final_corporate_liability',
            'total_tax': str(result.total_tax),
            'total_payments': str(result.total_payments),
            'amount_owed': str(result.amount_owed),
            'refund_amount': str(result.refund_amount)
        })

    def _is_subject_to_accumulated_earnings_tax(self, corporate_info: CorporateInfo, result: CorporateTaxResult) -> bool:
        """Determine if corporation is subject to accumulated earnings tax"""
        # Generally applies to corporations that accumulate earnings beyond reasonable business needs
        # Simplified determination
        return not corporate_info.is_publicly_traded and result.taxable_income > Decimal('100000')

    def _calculate_accumulated_taxable_income(self, result: CorporateTaxResult, corporate_info: CorporateInfo) -> Decimal:
        """Calculate accumulated taxable income for accumulated earnings tax"""
        # Simplified calculation - would need adjustments for dividends paid, etc.
        return result.taxable_income - result.corporate_income_tax

    def _round_currency(self, amount: Union[Decimal, float, int]) -> Decimal:
        """Round currency amount to 2 decimal places"""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def generate_corporate_tax_summary(self, result: CorporateTaxResult) -> Dict:
        """Generate summary of corporate tax calculation"""
        return {
            'corporation_name': result.taxpayer_info.name,
            'ein': result.taxpayer_info.ssn_ein,
            'tax_year': result.taxpayer_info.tax_year,
            'gross_income': str(result.total_income),
            'total_deductions': str(sum(result.deduction_breakdown.values())),
            'dividends_received_deduction': str(result.dividends_received_deduction),
            'taxable_income': str(result.taxable_income),
            'corporate_income_tax': str(result.corporate_income_tax),
            'accumulated_earnings_tax': str(result.accumulated_earnings_tax),
            'total_tax': str(result.total_tax),
            'effective_tax_rate': str(result.effective_tax_rate),
            'amount_owed': str(result.amount_owed),
            'refund_amount': str(result.refund_amount)
        }
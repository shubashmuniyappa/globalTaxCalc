"""
Advanced Tax Engine - Core calculation framework for complex tax scenarios
Provides comprehensive tax calculation capabilities for sophisticated tax situations
"""

from typing import Dict, List, Optional, Union, Tuple
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
import logging
from dataclasses import dataclass, field
from enum import Enum

from ..utils.tax_constants import TaxYear, TaxConstants
from ..utils.validators import TaxDataValidator
from ..utils.exceptions import TaxCalculationError, InvalidTaxDataError

logger = logging.getLogger(__name__)


class EntityType(Enum):
    INDIVIDUAL = "individual"
    CORPORATION = "corporation"
    PARTNERSHIP = "partnership"
    S_CORPORATION = "s_corporation"
    LLC = "llc"
    TRUST = "trust"
    ESTATE = "estate"


class FilingStatus(Enum):
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    QUALIFYING_WIDOW = "qualifying_widow"


@dataclass
class TaxpayerInfo:
    """Comprehensive taxpayer information for advanced calculations"""
    entity_type: EntityType
    filing_status: Optional[FilingStatus] = None
    tax_year: int = 2024
    ssn_ein: str = ""
    name: str = ""
    date_of_birth: Optional[date] = None
    is_resident: bool = True
    state_of_residence: str = ""
    foreign_countries: List[str] = field(default_factory=list)

    # Individual-specific
    age: Optional[int] = None
    is_blind: bool = False
    is_disabled: bool = False
    spouse_info: Optional[Dict] = None
    dependents: List[Dict] = field(default_factory=list)

    # Business-specific
    business_type: Optional[str] = None
    industry_code: Optional[str] = None
    accounting_method: str = "cash"  # cash, accrual
    tax_year_end: Optional[date] = None

    # International
    has_foreign_accounts: bool = False
    has_foreign_income: bool = False
    treaty_countries: List[str] = field(default_factory=list)


@dataclass
class IncomeItem:
    """Standardized income item for complex calculations"""
    type: str  # wages, business, investment, foreign, etc.
    description: str
    amount: Decimal
    source: str = ""
    tax_year: int = 2024
    date_received: Optional[date] = None
    payer_info: Optional[Dict] = None

    # Tax attributes
    is_taxable: bool = True
    is_subject_to_withholding: bool = False
    withholding_amount: Decimal = Decimal('0')
    is_foreign_source: bool = False
    country_of_source: str = ""

    # Business income attributes
    is_self_employment: bool = False
    business_code: Optional[str] = None

    # Investment attributes
    is_capital_gain: bool = False
    holding_period: Optional[int] = None  # days
    cost_basis: Optional[Decimal] = None

    # Additional attributes
    attributes: Dict = field(default_factory=dict)


@dataclass
class DeductionItem:
    """Standardized deduction item for complex calculations"""
    type: str  # business, itemized, above_line, etc.
    description: str
    amount: Decimal
    category: str = ""
    tax_year: int = 2024
    date_incurred: Optional[date] = None

    # Tax attributes
    is_deductible: bool = True
    deduction_percentage: Decimal = Decimal('100')
    is_above_line: bool = False
    is_subject_to_limitations: bool = False

    # Business deduction attributes
    business_use_percentage: Decimal = Decimal('100')
    is_ordinary_necessary: bool = True

    # Investment deduction attributes
    is_investment_expense: bool = False

    # Additional attributes
    attributes: Dict = field(default_factory=dict)


@dataclass
class TaxCalculationResult:
    """Comprehensive tax calculation result"""
    taxpayer_info: TaxpayerInfo
    calculation_date: datetime = field(default_factory=datetime.now)

    # Income components
    total_income: Decimal = Decimal('0')
    adjusted_gross_income: Decimal = Decimal('0')
    taxable_income: Decimal = Decimal('0')

    # Tax components
    regular_tax: Decimal = Decimal('0')
    alternative_minimum_tax: Decimal = Decimal('0')
    self_employment_tax: Decimal = Decimal('0')
    net_investment_income_tax: Decimal = Decimal('0')
    additional_medicare_tax: Decimal = Decimal('0')

    # Credits and payments
    total_credits: Decimal = Decimal('0')
    total_payments: Decimal = Decimal('0')
    withholding: Decimal = Decimal('0')
    estimated_payments: Decimal = Decimal('0')

    # Final calculation
    total_tax: Decimal = Decimal('0')
    amount_owed: Decimal = Decimal('0')
    refund_amount: Decimal = Decimal('0')

    # Detailed breakdowns
    income_breakdown: Dict[str, Decimal] = field(default_factory=dict)
    deduction_breakdown: Dict[str, Decimal] = field(default_factory=dict)
    credit_breakdown: Dict[str, Decimal] = field(default_factory=dict)
    tax_breakdown: Dict[str, Decimal] = field(default_factory=dict)

    # Multi-state results
    state_tax_results: Dict[str, Dict] = field(default_factory=dict)

    # International tax results
    foreign_tax_credit: Decimal = Decimal('0')
    foreign_income_exclusion: Decimal = Decimal('0')

    # Business tax results
    business_tax_results: Dict[str, Dict] = field(default_factory=dict)

    # Additional results
    effective_tax_rate: Decimal = Decimal('0')
    marginal_tax_rate: Decimal = Decimal('0')

    # Recommendations and planning
    recommendations: List[Dict] = field(default_factory=list)
    planning_opportunities: List[Dict] = field(default_factory=list)

    # Audit and compliance
    audit_trail: List[Dict] = field(default_factory=list)
    compliance_alerts: List[Dict] = field(default_factory=list)


class AdvancedTaxEngine:
    """
    Core advanced tax calculation engine for complex scenarios
    Orchestrates various tax calculators and provides unified interface
    """

    def __init__(self, tax_year: int = 2024):
        self.tax_year = tax_year
        self.tax_constants = TaxConstants(tax_year)
        self.validator = TaxDataValidator()

        # Initialize specialized calculators
        self._initialize_calculators()

        logger.info(f"Advanced Tax Engine initialized for tax year {tax_year}")

    def _initialize_calculators(self):
        """Initialize all specialized tax calculators"""
        # Will be populated as we implement each calculator
        self.calculators = {}

    def calculate_comprehensive_tax(
        self,
        taxpayer_info: TaxpayerInfo,
        income_items: List[IncomeItem],
        deduction_items: List[DeductionItem],
        additional_data: Optional[Dict] = None
    ) -> TaxCalculationResult:
        """
        Perform comprehensive tax calculation for complex scenarios

        Args:
            taxpayer_info: Complete taxpayer information
            income_items: List of all income items
            deduction_items: List of all deduction items
            additional_data: Additional calculation data

        Returns:
            TaxCalculationResult: Comprehensive calculation results
        """
        try:
            logger.info(f"Starting comprehensive tax calculation for {taxpayer_info.name}")

            # Validate input data
            self._validate_calculation_data(taxpayer_info, income_items, deduction_items)

            # Initialize result object
            result = TaxCalculationResult(taxpayer_info=taxpayer_info)

            # Step 1: Calculate income components
            self._calculate_income_components(result, income_items)

            # Step 2: Calculate deductions
            self._calculate_deductions(result, deduction_items)

            # Step 3: Calculate adjusted gross income
            self._calculate_adjusted_gross_income(result)

            # Step 4: Calculate taxable income
            self._calculate_taxable_income(result)

            # Step 5: Calculate regular income tax
            self._calculate_regular_tax(result)

            # Step 6: Calculate alternative minimum tax
            self._calculate_amt(result)

            # Step 7: Calculate additional taxes
            self._calculate_additional_taxes(result)

            # Step 8: Calculate credits
            self._calculate_credits(result)

            # Step 9: Calculate payments and withholding
            self._calculate_payments(result)

            # Step 10: Calculate final tax liability
            self._calculate_final_liability(result)

            # Step 11: Generate recommendations
            self._generate_recommendations(result)

            # Step 12: Create audit trail
            self._create_audit_trail(result)

            logger.info("Comprehensive tax calculation completed successfully")
            return result

        except Exception as e:
            logger.error(f"Tax calculation failed: {str(e)}")
            raise TaxCalculationError(f"Tax calculation failed: {str(e)}")

    def _validate_calculation_data(
        self,
        taxpayer_info: TaxpayerInfo,
        income_items: List[IncomeItem],
        deduction_items: List[DeductionItem]
    ):
        """Validate all input data for calculation"""
        if not self.validator.validate_taxpayer_info(taxpayer_info):
            raise InvalidTaxDataError("Invalid taxpayer information")

        for income_item in income_items:
            if not self.validator.validate_income_item(income_item):
                raise InvalidTaxDataError(f"Invalid income item: {income_item.description}")

        for deduction_item in deduction_items:
            if not self.validator.validate_deduction_item(deduction_item):
                raise InvalidTaxDataError(f"Invalid deduction item: {deduction_item.description}")

    def _calculate_income_components(self, result: TaxCalculationResult, income_items: List[IncomeItem]):
        """Calculate and categorize all income components"""
        income_categories = {
            'wages': Decimal('0'),
            'business_income': Decimal('0'),
            'investment_income': Decimal('0'),
            'foreign_income': Decimal('0'),
            'other_income': Decimal('0')
        }

        for item in income_items:
            if item.is_taxable:
                amount = self._round_currency(item.amount)

                # Categorize income
                if item.type in ['wages', 'salary', 'tips']:
                    income_categories['wages'] += amount
                elif item.type in ['business', 'self_employment']:
                    income_categories['business_income'] += amount
                elif item.type in ['dividends', 'interest', 'capital_gains']:
                    income_categories['investment_income'] += amount
                elif item.is_foreign_source:
                    income_categories['foreign_income'] += amount
                else:
                    income_categories['other_income'] += amount

                result.total_income += amount

        result.income_breakdown = income_categories
        result.audit_trail.append({
            'step': 'income_calculation',
            'total_income': str(result.total_income),
            'breakdown': {k: str(v) for k, v in income_categories.items()}
        })

    def _calculate_deductions(self, result: TaxCalculationResult, deduction_items: List[DeductionItem]):
        """Calculate all applicable deductions"""
        deduction_categories = {
            'above_line': Decimal('0'),
            'itemized': Decimal('0'),
            'business': Decimal('0'),
            'standard': Decimal('0')
        }

        total_itemized = Decimal('0')

        for item in deduction_items:
            if item.is_deductible:
                amount = self._calculate_deduction_amount(item)

                if item.is_above_line:
                    deduction_categories['above_line'] += amount
                elif item.type == 'business':
                    deduction_categories['business'] += amount
                else:
                    deduction_categories['itemized'] += amount
                    total_itemized += amount

        # Compare itemized vs standard deduction
        standard_deduction = self._get_standard_deduction(result.taxpayer_info)
        deduction_categories['standard'] = standard_deduction

        # Use the larger of itemized or standard
        result.deduction_breakdown = deduction_categories
        result.audit_trail.append({
            'step': 'deduction_calculation',
            'itemized_total': str(total_itemized),
            'standard_deduction': str(standard_deduction),
            'deduction_method': 'itemized' if total_itemized > standard_deduction else 'standard'
        })

    def _calculate_adjusted_gross_income(self, result: TaxCalculationResult):
        """Calculate Adjusted Gross Income (AGI)"""
        above_line_deductions = result.deduction_breakdown.get('above_line', Decimal('0'))
        result.adjusted_gross_income = result.total_income - above_line_deductions

        result.audit_trail.append({
            'step': 'agi_calculation',
            'total_income': str(result.total_income),
            'above_line_deductions': str(above_line_deductions),
            'agi': str(result.adjusted_gross_income)
        })

    def _calculate_taxable_income(self, result: TaxCalculationResult):
        """Calculate taxable income after all deductions"""
        itemized = result.deduction_breakdown.get('itemized', Decimal('0'))
        standard = result.deduction_breakdown.get('standard', Decimal('0'))

        # Use the larger deduction
        deduction = max(itemized, standard)

        result.taxable_income = max(Decimal('0'), result.adjusted_gross_income - deduction)

        result.audit_trail.append({
            'step': 'taxable_income_calculation',
            'agi': str(result.adjusted_gross_income),
            'deduction_used': str(deduction),
            'taxable_income': str(result.taxable_income)
        })

    def _calculate_regular_tax(self, result: TaxCalculationResult):
        """Calculate regular income tax using tax brackets"""
        tax_brackets = self.tax_constants.get_tax_brackets(result.taxpayer_info.filing_status)

        result.regular_tax = self._apply_tax_brackets(result.taxable_income, tax_brackets)

        result.audit_trail.append({
            'step': 'regular_tax_calculation',
            'taxable_income': str(result.taxable_income),
            'regular_tax': str(result.regular_tax)
        })

    def _calculate_amt(self, result: TaxCalculationResult):
        """Calculate Alternative Minimum Tax if applicable"""
        # This will be implemented with the AMT calculator
        result.alternative_minimum_tax = Decimal('0')

    def _calculate_additional_taxes(self, result: TaxCalculationResult):
        """Calculate additional taxes (SECA, NIIT, Additional Medicare)"""
        # These will be implemented with specialized calculators
        result.self_employment_tax = Decimal('0')
        result.net_investment_income_tax = Decimal('0')
        result.additional_medicare_tax = Decimal('0')

    def _calculate_credits(self, result: TaxCalculationResult):
        """Calculate all applicable tax credits"""
        # This will be expanded with various credit calculations
        result.total_credits = Decimal('0')

    def _calculate_payments(self, result: TaxCalculationResult):
        """Calculate total payments and withholding"""
        # Calculate from income items and additional payment data
        result.total_payments = result.withholding + result.estimated_payments

    def _calculate_final_liability(self, result: TaxCalculationResult):
        """Calculate final tax liability and amount owed/refund"""
        result.total_tax = (
            result.regular_tax +
            result.alternative_minimum_tax +
            result.self_employment_tax +
            result.net_investment_income_tax +
            result.additional_medicare_tax -
            result.total_credits
        )

        balance = result.total_tax - result.total_payments

        if balance > 0:
            result.amount_owed = balance
            result.refund_amount = Decimal('0')
        else:
            result.amount_owed = Decimal('0')
            result.refund_amount = abs(balance)

        # Calculate effective and marginal tax rates
        if result.adjusted_gross_income > 0:
            result.effective_tax_rate = (result.total_tax / result.adjusted_gross_income) * 100

        result.marginal_tax_rate = self._calculate_marginal_rate(result)

    def _generate_recommendations(self, result: TaxCalculationResult):
        """Generate tax planning recommendations"""
        recommendations = []

        # High-level recommendations based on calculation results
        if result.alternative_minimum_tax > 0:
            recommendations.append({
                'type': 'amt_planning',
                'priority': 'high',
                'title': 'Alternative Minimum Tax Planning',
                'description': 'Consider AMT planning strategies to minimize future liability'
            })

        if result.effective_tax_rate > 30:
            recommendations.append({
                'type': 'tax_reduction',
                'priority': 'medium',
                'title': 'Tax Reduction Strategies',
                'description': 'Explore additional deductions and tax-advantaged investments'
            })

        result.recommendations = recommendations

    def _create_audit_trail(self, result: TaxCalculationResult):
        """Create comprehensive audit trail for calculation"""
        result.audit_trail.append({
            'step': 'final_calculation',
            'total_tax': str(result.total_tax),
            'total_payments': str(result.total_payments),
            'final_balance': str(result.amount_owed - result.refund_amount),
            'calculation_timestamp': datetime.now().isoformat()
        })

    def _calculate_deduction_amount(self, item: DeductionItem) -> Decimal:
        """Calculate the actual deductible amount for a deduction item"""
        base_amount = item.amount

        # Apply percentage limitation
        if item.deduction_percentage < Decimal('100'):
            base_amount = base_amount * (item.deduction_percentage / Decimal('100'))

        # Apply business use percentage
        if hasattr(item, 'business_use_percentage'):
            base_amount = base_amount * (item.business_use_percentage / Decimal('100'))

        return self._round_currency(base_amount)

    def _get_standard_deduction(self, taxpayer_info: TaxpayerInfo) -> Decimal:
        """Get standard deduction amount based on filing status and taxpayer info"""
        return self.tax_constants.get_standard_deduction(taxpayer_info.filing_status, taxpayer_info)

    def _apply_tax_brackets(self, taxable_income: Decimal, tax_brackets: List[Dict]) -> Decimal:
        """Apply progressive tax brackets to calculate income tax"""
        total_tax = Decimal('0')
        remaining_income = taxable_income

        for bracket in tax_brackets:
            bracket_min = Decimal(str(bracket['min']))
            bracket_max = Decimal(str(bracket['max'])) if bracket['max'] is not None else None
            bracket_rate = Decimal(str(bracket['rate']))

            if remaining_income <= 0:
                break

            if bracket_max is None:
                # Top bracket
                taxable_in_bracket = remaining_income
            else:
                taxable_in_bracket = min(remaining_income, bracket_max - bracket_min)

            bracket_tax = taxable_in_bracket * bracket_rate
            total_tax += bracket_tax
            remaining_income -= taxable_in_bracket

        return self._round_currency(total_tax)

    def _calculate_marginal_rate(self, result: TaxCalculationResult) -> Decimal:
        """Calculate marginal tax rate"""
        # This would calculate the rate at which the next dollar of income would be taxed
        tax_brackets = self.tax_constants.get_tax_brackets(result.taxpayer_info.filing_status)

        for bracket in tax_brackets:
            bracket_min = Decimal(str(bracket['min']))
            bracket_max = Decimal(str(bracket['max'])) if bracket['max'] is not None else None

            if bracket_max is None or result.taxable_income <= bracket_max:
                return Decimal(str(bracket['rate'])) * 100

        return Decimal('0')

    def _round_currency(self, amount: Union[Decimal, float, int]) -> Decimal:
        """Round currency amount to 2 decimal places"""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_calculation_summary(self, result: TaxCalculationResult) -> Dict:
        """Generate a summary of the tax calculation"""
        return {
            'taxpayer': result.taxpayer_info.name,
            'tax_year': result.taxpayer_info.tax_year,
            'entity_type': result.taxpayer_info.entity_type.value,
            'total_income': str(result.total_income),
            'adjusted_gross_income': str(result.adjusted_gross_income),
            'taxable_income': str(result.taxable_income),
            'total_tax': str(result.total_tax),
            'effective_rate': str(result.effective_tax_rate),
            'marginal_rate': str(result.marginal_tax_rate),
            'amount_owed': str(result.amount_owed),
            'refund_amount': str(result.refund_amount),
            'calculation_date': result.calculation_date.isoformat()
        }
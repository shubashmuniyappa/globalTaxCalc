"""
Self-Employment Tax Calculator - Advanced SECA tax calculations
Handles complex self-employment tax scenarios for business owners and freelancers
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


class SelfEmploymentBusinessType(Enum):
    SOLE_PROPRIETORSHIP = "sole_proprietorship"
    SINGLE_MEMBER_LLC = "single_member_llc"
    PARTNERSHIP = "partnership"
    MULTI_MEMBER_LLC = "multi_member_llc"
    INDEPENDENT_CONTRACTOR = "independent_contractor"


@dataclass
class SelfEmploymentInfo:
    """Self-employment specific information"""
    business_type: SelfEmploymentBusinessType
    business_name: str
    ein: Optional[str] = None
    primary_business_code: str = ""

    # Business operations
    accounting_method: str = "cash"  # cash, accrual
    material_participation: bool = True
    at_risk_rules_apply: bool = True
    passive_activity_rules_apply: bool = False

    # Prior year information
    prior_year_se_income: Decimal = Decimal('0')
    prior_year_se_tax: Decimal = Decimal('0')

    # Multiple businesses
    has_multiple_businesses: bool = False
    other_businesses: List[Dict] = field(default_factory=list)

    # Special situations
    is_minister: bool = False
    minister_social_security_election: bool = False
    is_church_employee: bool = False


@dataclass
class SelfEmploymentIncomeItem(IncomeItem):
    """Self-employment specific income item"""
    business_name: str = ""
    business_code: str = ""

    # SE tax attributes
    is_subject_to_se_tax: bool = True
    conservation_reserve_program: bool = False
    statutory_employee: bool = False

    # Business attributes
    gross_receipts: Decimal = Decimal('0')
    returns_allowances: Decimal = Decimal('0')
    cost_of_goods_sold: Decimal = Decimal('0')

    # Special income types
    is_rental_income: bool = False
    is_farming_income: bool = False
    is_fishing_income: bool = False


@dataclass
class SelfEmploymentDeductionItem(DeductionItem):
    """Self-employment specific deduction item"""
    business_name: str = ""

    # Business expense categories
    expense_category: str = ""  # auto, office, travel, meals, etc.
    business_use_percentage: Decimal = Decimal('100')

    # Home office deduction
    is_home_office: bool = False
    home_office_method: str = ""  # actual, simplified
    home_office_square_feet: Optional[int] = None
    total_home_square_feet: Optional[int] = None

    # Vehicle expenses
    is_vehicle_expense: bool = False
    vehicle_method: str = ""  # actual, standard_mileage
    business_miles: Optional[int] = None
    total_miles: Optional[int] = None

    # Depreciation
    is_depreciable: bool = False
    depreciation_method: str = ""
    section_179_election: Decimal = Decimal('0')
    bonus_depreciation: Decimal = Decimal('0')


@dataclass
class SelfEmploymentTaxResult:
    """Self-employment tax calculation results"""
    taxpayer_info: TaxpayerInfo
    calculation_date: datetime = field(default_factory=datetime.now)

    # Business income/loss
    gross_receipts: Decimal = Decimal('0')
    gross_income: Decimal = Decimal('0')
    total_expenses: Decimal = Decimal('0')
    net_profit_loss: Decimal = Decimal('0')

    # Self-employment tax calculation
    se_income: Decimal = Decimal('0')
    se_tax_before_deduction: Decimal = Decimal('0')
    se_tax_deduction: Decimal = Decimal('0')
    se_tax_liability: Decimal = Decimal('0')

    # SE tax components
    social_security_tax: Decimal = Decimal('0')
    medicare_tax: Decimal = Decimal('0')
    additional_medicare_tax: Decimal = Decimal('0')

    # Multiple businesses
    business_results: Dict[str, Dict] = field(default_factory=dict)
    combined_se_income: Decimal = Decimal('0')

    # Deduction breakdowns
    expense_breakdown: Dict[str, Decimal] = field(default_factory=dict)
    home_office_deduction: Decimal = Decimal('0')
    vehicle_deduction: Decimal = Decimal('0')
    depreciation_deduction: Decimal = Decimal('0')

    # Special calculations
    qualified_business_income: Decimal = Decimal('0')  # For QBI deduction
    section_199a_deduction: Decimal = Decimal('0')

    # Estimated tax considerations
    se_tax_for_estimated: Decimal = Decimal('0')
    quarterly_payment_amount: Decimal = Decimal('0')

    # Audit trail
    audit_trail: List[Dict] = field(default_factory=list)


class SelfEmploymentTaxCalculator:
    """
    Advanced Self-Employment Tax Calculator
    Handles comprehensive SECA tax calculations for various business structures
    """

    def __init__(self, tax_year: int = 2024):
        self.tax_year = tax_year
        self.tax_constants = TaxConstants(tax_year)

        # 2024 SE tax parameters
        self.se_tax_rate = Decimal('0.1413')  # 14.13% (12.4% SS + 1.45% Medicare)
        self.social_security_rate = Decimal('0.124')  # 12.4%
        self.medicare_rate = Decimal('0.029')  # 2.9%
        self.additional_medicare_rate = Decimal('0.009')  # 0.9%

        # 2024 wage bases and thresholds
        self.social_security_wage_base = Decimal('168600')
        self.additional_medicare_threshold_single = Decimal('200000')
        self.additional_medicare_threshold_mfj = Decimal('250000')
        self.additional_medicare_threshold_mfs = Decimal('125000')

        # SE tax deduction rate
        self.se_deduction_rate = Decimal('0.9235')  # 92.35%

        logger.info(f"Self-Employment Tax Calculator initialized for {tax_year}")

    def calculate_self_employment_tax(
        self,
        se_info: SelfEmploymentInfo,
        income_items: List[SelfEmploymentIncomeItem],
        deduction_items: List[SelfEmploymentDeductionItem],
        taxpayer_info: Optional[TaxpayerInfo] = None,
        wage_income: Decimal = Decimal('0')
    ) -> SelfEmploymentTaxResult:
        """
        Calculate comprehensive self-employment tax

        Args:
            se_info: Self-employment business information
            income_items: List of self-employment income items
            deduction_items: List of business deduction items
            taxpayer_info: General taxpayer information
            wage_income: W-2 wage income for Additional Medicare Tax calculation

        Returns:
            SelfEmploymentTaxResult: Comprehensive SE tax results
        """
        try:
            logger.info(f"Calculating self-employment tax for {se_info.business_name}")

            # Create or use taxpayer info
            if taxpayer_info is None:
                taxpayer_info = self._create_taxpayer_info(se_info)

            # Initialize result
            result = SelfEmploymentTaxResult(taxpayer_info=taxpayer_info)

            # Step 1: Calculate business income
            self._calculate_business_income(result, income_items)

            # Step 2: Calculate business expenses
            self._calculate_business_expenses(result, deduction_items)

            # Step 3: Calculate net profit/loss
            self._calculate_net_profit_loss(result)

            # Step 4: Calculate self-employment income
            self._calculate_se_income(result)

            # Step 5: Calculate self-employment tax components
            self._calculate_se_tax_components(result, wage_income)

            # Step 6: Calculate SE tax deduction
            self._calculate_se_tax_deduction(result)

            # Step 7: Calculate QBI (Qualified Business Income)
            self._calculate_qualified_business_income(result)

            # Step 8: Handle multiple businesses if applicable
            if se_info.has_multiple_businesses:
                self._handle_multiple_businesses(result, se_info)

            # Step 9: Calculate estimated tax requirements
            self._calculate_estimated_tax_requirements(result)

            # Step 10: Generate recommendations
            self._generate_se_recommendations(result)

            logger.info("Self-employment tax calculation completed successfully")
            return result

        except Exception as e:
            logger.error(f"Self-employment tax calculation failed: {str(e)}")
            raise TaxCalculationError(f"Self-employment tax calculation failed: {str(e)}")

    def _create_taxpayer_info(self, se_info: SelfEmploymentInfo) -> TaxpayerInfo:
        """Create taxpayer info from SE info"""
        from ..core.tax_engine import EntityType

        return TaxpayerInfo(
            entity_type=EntityType.INDIVIDUAL,
            tax_year=self.tax_year,
            business_type=se_info.business_type.value,
            accounting_method=se_info.accounting_method
        )

    def _calculate_business_income(self, result: SelfEmploymentTaxResult, income_items: List[SelfEmploymentIncomeItem]):
        """Calculate total business income"""
        income_categories = {
            'gross_receipts': Decimal('0'),
            'services': Decimal('0'),
            'sales': Decimal('0'),
            'other_income': Decimal('0'),
            'returns_allowances': Decimal('0'),
            'cost_of_goods_sold': Decimal('0')
        }

        for item in income_items:
            if item.type == 'gross_receipts':
                income_categories['gross_receipts'] += item.amount
                # Track COGS separately if provided
                if item.cost_of_goods_sold > 0:
                    income_categories['cost_of_goods_sold'] += item.cost_of_goods_sold
                if item.returns_allowances > 0:
                    income_categories['returns_allowances'] += item.returns_allowances

            elif item.type in ['services', 'fees']:
                income_categories['services'] += item.amount
            elif item.type == 'sales':
                income_categories['sales'] += item.amount
            else:
                income_categories['other_income'] += item.amount

        # Calculate gross income
        result.gross_receipts = (
            income_categories['gross_receipts'] +
            income_categories['services'] +
            income_categories['sales'] +
            income_categories['other_income']
        )

        result.gross_income = (
            result.gross_receipts -
            income_categories['returns_allowances'] -
            income_categories['cost_of_goods_sold']
        )

        result.audit_trail.append({
            'step': 'business_income_calculation',
            'gross_receipts': str(result.gross_receipts),
            'returns_allowances': str(income_categories['returns_allowances']),
            'cost_of_goods_sold': str(income_categories['cost_of_goods_sold']),
            'gross_income': str(result.gross_income)
        })

    def _calculate_business_expenses(self, result: SelfEmploymentTaxResult, deduction_items: List[SelfEmploymentDeductionItem]):
        """Calculate all business expenses with proper limitations"""
        expense_categories = {
            'advertising': Decimal('0'),
            'car_truck_expenses': Decimal('0'),
            'commissions_fees': Decimal('0'),
            'contract_labor': Decimal('0'),
            'depletion': Decimal('0'),
            'depreciation': Decimal('0'),
            'employee_benefits': Decimal('0'),
            'insurance': Decimal('0'),
            'interest_mortgage': Decimal('0'),
            'interest_other': Decimal('0'),
            'legal_professional': Decimal('0'),
            'office_expense': Decimal('0'),
            'pension_profit_sharing': Decimal('0'),
            'rent_lease_vehicles': Decimal('0'),
            'rent_lease_other': Decimal('0'),
            'repairs_maintenance': Decimal('0'),
            'supplies': Decimal('0'),
            'taxes_licenses': Decimal('0'),
            'travel': Decimal('0'),
            'meals': Decimal('0'),
            'utilities': Decimal('0'),
            'wages': Decimal('0'),
            'other_expenses': Decimal('0'),
            'home_office': Decimal('0')
        }

        for item in deduction_items:
            if item.is_deductible:
                # Calculate deductible amount with business use percentage
                deductible_amount = item.amount * (item.business_use_percentage / Decimal('100'))

                # Apply specific limitations
                if item.type == 'meals':
                    # 50% limitation for business meals
                    deductible_amount = deductible_amount * Decimal('0.50')
                elif item.type == 'entertainment':
                    # Entertainment expenses are generally not deductible (100% limitation)
                    deductible_amount = Decimal('0')

                # Handle special expense types
                if item.is_home_office:
                    home_office_amount = self._calculate_home_office_deduction(item)
                    expense_categories['home_office'] += home_office_amount
                    result.home_office_deduction += home_office_amount
                elif item.is_vehicle_expense:
                    vehicle_amount = self._calculate_vehicle_deduction(item)
                    expense_categories['car_truck_expenses'] += vehicle_amount
                    result.vehicle_deduction += vehicle_amount
                elif item.is_depreciable:
                    depreciation_amount = self._calculate_depreciation_deduction(item)
                    expense_categories['depreciation'] += depreciation_amount
                    result.depreciation_deduction += depreciation_amount
                else:
                    # Categorize regular business expenses
                    category = self._categorize_business_expense(item)
                    expense_categories[category] += deductible_amount

        result.total_expenses = sum(expense_categories.values())
        result.expense_breakdown = expense_categories

        result.audit_trail.append({
            'step': 'business_expenses_calculation',
            'total_expenses': str(result.total_expenses),
            'home_office_deduction': str(result.home_office_deduction),
            'vehicle_deduction': str(result.vehicle_deduction),
            'depreciation_deduction': str(result.depreciation_deduction)
        })

    def _calculate_home_office_deduction(self, item: SelfEmploymentDeductionItem) -> Decimal:
        """Calculate home office deduction"""
        if item.home_office_method == 'simplified':
            # Simplified method: $5 per square foot up to 300 sq ft
            if item.home_office_square_feet:
                max_sq_ft = min(item.home_office_square_feet, 300)
                return Decimal(str(max_sq_ft)) * Decimal('5')
        else:
            # Actual expense method
            if (item.home_office_square_feet and
                item.total_home_square_feet and
                item.total_home_square_feet > 0):
                business_percentage = (
                    Decimal(str(item.home_office_square_feet)) /
                    Decimal(str(item.total_home_square_feet))
                )
                return item.amount * business_percentage

        return Decimal('0')

    def _calculate_vehicle_deduction(self, item: SelfEmploymentDeductionItem) -> Decimal:
        """Calculate vehicle expense deduction"""
        if item.vehicle_method == 'standard_mileage':
            # Standard mileage rate for 2024: $0.67 per mile (would be in tax constants)
            standard_rate = Decimal('0.67')
            if item.business_miles:
                return Decimal(str(item.business_miles)) * standard_rate
        else:
            # Actual expense method
            if (item.business_miles and
                item.total_miles and
                item.total_miles > 0):
                business_percentage = (
                    Decimal(str(item.business_miles)) /
                    Decimal(str(item.total_miles))
                )
                return item.amount * business_percentage

        return Decimal('0')

    def _calculate_depreciation_deduction(self, item: SelfEmploymentDeductionItem) -> Decimal:
        """Calculate depreciation deduction including Section 179 and bonus depreciation"""
        total_depreciation = item.amount

        # Add Section 179 election
        total_depreciation += item.section_179_election

        # Add bonus depreciation
        total_depreciation += item.bonus_depreciation

        return total_depreciation

    def _categorize_business_expense(self, item: SelfEmploymentDeductionItem) -> str:
        """Categorize business expense for Schedule C"""
        category_mapping = {
            'advertising': 'advertising',
            'auto': 'car_truck_expenses',
            'vehicle': 'car_truck_expenses',
            'commissions': 'commissions_fees',
            'contract_labor': 'contract_labor',
            'insurance': 'insurance',
            'interest': 'interest_other',
            'legal': 'legal_professional',
            'professional': 'legal_professional',
            'office': 'office_expense',
            'rent': 'rent_lease_other',
            'repairs': 'repairs_maintenance',
            'supplies': 'supplies',
            'taxes': 'taxes_licenses',
            'travel': 'travel',
            'meals': 'meals',
            'utilities': 'utilities',
            'wages': 'wages'
        }

        return category_mapping.get(item.type, 'other_expenses')

    def _calculate_net_profit_loss(self, result: SelfEmploymentTaxResult):
        """Calculate net profit or loss"""
        result.net_profit_loss = result.gross_income - result.total_expenses

        result.audit_trail.append({
            'step': 'net_profit_loss_calculation',
            'gross_income': str(result.gross_income),
            'total_expenses': str(result.total_expenses),
            'net_profit_loss': str(result.net_profit_loss)
        })

    def _calculate_se_income(self, result: SelfEmploymentTaxResult):
        """Calculate self-employment income subject to SE tax"""
        if result.net_profit_loss < Decimal('400'):
            # No SE tax if net earnings less than $400
            result.se_income = Decimal('0')
        else:
            # SE income is 92.35% of net earnings
            result.se_income = result.net_profit_loss * self.se_deduction_rate

        result.audit_trail.append({
            'step': 'se_income_calculation',
            'net_profit_loss': str(result.net_profit_loss),
            'se_deduction_rate': str(self.se_deduction_rate),
            'se_income': str(result.se_income)
        })

    def _calculate_se_tax_components(self, result: SelfEmploymentTaxResult, wage_income: Decimal):
        """Calculate SE tax components (Social Security and Medicare)"""
        if result.se_income <= 0:
            return

        # Social Security tax (12.4% up to wage base)
        ss_taxable_income = min(result.se_income, self.social_security_wage_base - wage_income)
        if ss_taxable_income > 0:
            result.social_security_tax = ss_taxable_income * self.social_security_rate

        # Medicare tax (2.9% on all SE income)
        result.medicare_tax = result.se_income * self.medicare_rate

        # Additional Medicare tax (0.9% on income over threshold)
        total_income_for_medicare = result.se_income + wage_income
        threshold = self._get_additional_medicare_threshold(result.taxpayer_info.filing_status)

        if total_income_for_medicare > threshold:
            excess_income = total_income_for_medicare - threshold
            # Only apply to SE income portion above threshold
            se_income_above_threshold = min(excess_income, result.se_income)
            result.additional_medicare_tax = se_income_above_threshold * self.additional_medicare_rate

        # Total SE tax before deduction
        result.se_tax_before_deduction = (
            result.social_security_tax +
            result.medicare_tax +
            result.additional_medicare_tax
        )

        result.audit_trail.append({
            'step': 'se_tax_components',
            'social_security_tax': str(result.social_security_tax),
            'medicare_tax': str(result.medicare_tax),
            'additional_medicare_tax': str(result.additional_medicare_tax),
            'se_tax_before_deduction': str(result.se_tax_before_deduction)
        })

    def _calculate_se_tax_deduction(self, result: SelfEmploymentTaxResult):
        """Calculate the deductible portion of SE tax (50% of SE tax)"""
        result.se_tax_deduction = result.se_tax_before_deduction * Decimal('0.50')
        result.se_tax_liability = result.se_tax_before_deduction

        result.audit_trail.append({
            'step': 'se_tax_deduction',
            'se_tax_before_deduction': str(result.se_tax_before_deduction),
            'se_tax_deduction': str(result.se_tax_deduction),
            'se_tax_liability': str(result.se_tax_liability)
        })

    def _calculate_qualified_business_income(self, result: SelfEmploymentTaxResult):
        """Calculate qualified business income for Section 199A deduction"""
        # QBI is generally the net profit/loss from the business
        if result.net_profit_loss > 0:
            result.qualified_business_income = result.net_profit_loss
            # The actual Section 199A deduction would be calculated at the individual level
            # This is just identifying the QBI amount

        result.audit_trail.append({
            'step': 'qualified_business_income',
            'qbi_amount': str(result.qualified_business_income)
        })

    def _handle_multiple_businesses(self, result: SelfEmploymentTaxResult, se_info: SelfEmploymentInfo):
        """Handle multiple self-employment businesses"""
        # This would aggregate results from multiple businesses
        # For now, just placeholder for the framework
        result.combined_se_income = result.se_income

    def _calculate_estimated_tax_requirements(self, result: SelfEmploymentTaxResult):
        """Calculate estimated tax payment requirements for SE tax"""
        # SE tax is generally paid through estimated tax payments
        result.se_tax_for_estimated = result.se_tax_liability
        result.quarterly_payment_amount = result.se_tax_for_estimated / Decimal('4')

        result.audit_trail.append({
            'step': 'estimated_tax_requirements',
            'se_tax_for_estimated': str(result.se_tax_for_estimated),
            'quarterly_payment_amount': str(result.quarterly_payment_amount)
        })

    def _generate_se_recommendations(self, result: SelfEmploymentTaxResult):
        """Generate self-employment tax planning recommendations"""
        recommendations = []

        if result.se_tax_liability > Decimal('1000'):
            recommendations.append({
                'type': 'estimated_payments',
                'priority': 'high',
                'title': 'Quarterly Estimated Tax Payments',
                'description': f'Consider making quarterly estimated tax payments of ${result.quarterly_payment_amount}'
            })

        if result.net_profit_loss > Decimal('50000'):
            recommendations.append({
                'type': 'business_structure',
                'priority': 'medium',
                'title': 'Business Structure Optimization',
                'description': 'Consider S-Corporation election to potentially reduce SE tax liability'
            })

        if result.home_office_deduction == 0 and result.total_expenses > 0:
            recommendations.append({
                'type': 'home_office',
                'priority': 'low',
                'title': 'Home Office Deduction',
                'description': 'Review eligibility for home office deduction if you work from home'
            })

        # Store recommendations in result (would need to add field to dataclass)
        # result.recommendations = recommendations

    def _get_additional_medicare_threshold(self, filing_status) -> Decimal:
        """Get Additional Medicare Tax threshold based on filing status"""
        from ..core.tax_engine import FilingStatus

        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            return self.additional_medicare_threshold_mfj
        elif filing_status == FilingStatus.MARRIED_FILING_SEPARATELY:
            return self.additional_medicare_threshold_mfs
        else:
            return self.additional_medicare_threshold_single

    def _round_currency(self, amount: Union[Decimal, float, int]) -> Decimal:
        """Round currency amount to 2 decimal places"""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def generate_se_tax_summary(self, result: SelfEmploymentTaxResult) -> Dict:
        """Generate summary of self-employment tax calculation"""
        return {
            'business_name': result.taxpayer_info.name,
            'tax_year': result.taxpayer_info.tax_year,
            'gross_receipts': str(result.gross_receipts),
            'gross_income': str(result.gross_income),
            'total_expenses': str(result.total_expenses),
            'net_profit_loss': str(result.net_profit_loss),
            'se_income': str(result.se_income),
            'social_security_tax': str(result.social_security_tax),
            'medicare_tax': str(result.medicare_tax),
            'additional_medicare_tax': str(result.additional_medicare_tax),
            'total_se_tax': str(result.se_tax_liability),
            'se_tax_deduction': str(result.se_tax_deduction),
            'quarterly_estimated_payment': str(result.quarterly_payment_amount)
        }
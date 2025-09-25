"""
Foreign Income Tax Calculator
Handles international tax calculations including:
- Foreign Earned Income Exclusion (Form 2555)
- Foreign Tax Credit (Form 1116)
- Subpart F income (CFC rules)
- GILTI (Global Intangible Low-Taxed Income)
- Passive Foreign Investment Company (PFIC) rules
- Foreign currency gain/loss calculations
- Treaty benefits and tie-breaker rules
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import date, datetime
from enum import Enum
import logging


class IncomeType(Enum):
    EARNED = "earned"
    PASSIVE = "passive"
    GENERAL = "general"
    SHIPPING = "shipping"
    HIGH_TAX_KICKOUT = "high_tax_kickout"
    TREATY_SHOPPING = "treaty_shopping"


class ForeignTaxCreditBasket(Enum):
    PASSIVE = "passive"
    GENERAL = "general"
    GLOBAL_INTANGIBLE_LOW_TAXED = "gilti"
    FOREIGN_BRANCH = "foreign_branch"
    SHIPPING = "shipping"


@dataclass
class ForeignCountry:
    """Foreign country information"""
    country_code: str
    country_name: str
    tax_treaty_exists: bool = False
    treaty_article: Optional[str] = None
    currency_code: str = 'USD'
    exchange_rate: Decimal = Decimal('1.0')


@dataclass
class ForeignIncomeItem:
    """Foreign income item"""
    income_id: str
    country_code: str
    income_type: IncomeType
    basket: ForeignTaxCreditBasket
    foreign_currency_amount: Decimal
    usd_amount: Decimal
    foreign_tax_paid: Decimal
    foreign_tax_withheld: Decimal = Decimal('0')
    source_description: str = ""
    treaty_benefits_claimed: bool = False
    deemed_paid_credit: Decimal = Decimal('0')


@dataclass
class ForeignEarnedIncomeInfo:
    """Foreign earned income exclusion information"""
    taxpayer_name: str
    tax_home_country: str
    foreign_residence_test_met: bool = False
    physical_presence_test_met: bool = False
    days_outside_us: int = 0
    qualifying_period_start: Optional[date] = None
    qualifying_period_end: Optional[date] = None
    foreign_earned_income: Decimal = Decimal('0')
    foreign_housing_expenses: Decimal = Decimal('0')
    employer_provided_housing: Decimal = Decimal('0')


@dataclass
class ControlledForeignCorporation:
    """CFC information for Subpart F calculations"""
    cfc_name: str
    cfc_country: str
    ownership_percentage: Decimal
    earnings_and_profits: Decimal
    subpart_f_income: Decimal
    tested_income: Decimal  # For GILTI
    tested_loss: Decimal = Decimal('0')
    foreign_tax_paid: Decimal = Decimal('0')
    qualified_business_asset_investment: Decimal = Decimal('0')


@dataclass
class PFICInvestment:
    """PFIC investment information"""
    pfic_name: str
    pfic_country: str
    shares_owned: Decimal
    total_shares: Decimal
    beginning_value: Decimal
    ending_value: Decimal
    distributions_received: Decimal
    excess_distributions: Decimal = Decimal('0')
    qef_election: bool = False
    mark_to_market_election: bool = False


@dataclass
class ForeignIncomeResult:
    """Comprehensive foreign income tax calculation results"""
    # Foreign Earned Income Exclusion
    foreign_earned_income_exclusion: Decimal = Decimal('0')
    foreign_housing_exclusion: Decimal = Decimal('0')
    foreign_housing_deduction: Decimal = Decimal('0')

    # Foreign Tax Credit
    foreign_tax_credit_by_basket: Dict[str, Decimal] = field(default_factory=dict)
    total_foreign_tax_credit: Decimal = Decimal('0')
    foreign_tax_credit_carryforward: Decimal = Decimal('0')
    foreign_tax_credit_carryback: Decimal = Decimal('0')

    # Subpart F and GILTI
    subpart_f_inclusion: Decimal = Decimal('0')
    gilti_inclusion: Decimal = Decimal('0')
    section_962_election_benefit: Decimal = Decimal('0')

    # PFIC calculations
    pfic_ordinary_income: Decimal = Decimal('0')
    pfic_interest_charge: Decimal = Decimal('0')

    # Foreign currency gains/losses
    section_988_gains: Decimal = Decimal('0')
    section_988_losses: Decimal = Decimal('0')

    # Treaty benefits
    treaty_withholding_reduction: Decimal = Decimal('0')
    treaty_tie_breaker_applied: bool = False

    # Income by basket for limitation purposes
    passive_basket_income: Decimal = Decimal('0')
    general_basket_income: Decimal = Decimal('0')
    gilti_basket_income: Decimal = Decimal('0')
    foreign_branch_basket_income: Decimal = Decimal('0')

    # U.S. tax before credits
    us_tax_on_foreign_income: Decimal = Decimal('0')
    foreign_tax_credit_limitation: Decimal = Decimal('0')

    # Detailed calculations
    income_details: List[Dict[str, Any]] = field(default_factory=list)
    cfc_details: List[Dict[str, Any]] = field(default_factory=list)
    pfic_details: List[Dict[str, Any]] = field(default_factory=list)

    # Audit trail
    calculation_notes: List[str] = field(default_factory=list)
    compliance_issues: List[str] = field(default_factory=list)


class ForeignIncomeCalculator:
    """Advanced Foreign Income Tax Calculator"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # 2024 tax year constants
        self.foreign_earned_income_exclusion_limit = Decimal('126500')  # 2024 limit
        self.foreign_housing_base_amount = Decimal('20240')  # 16% of FEIE limit
        self.physical_presence_test_days = 330  # Days required in 12-month period
        self.cfc_ownership_threshold = Decimal('10')  # 10% ownership threshold
        self.gilti_deduction_percentage = Decimal('0.50')  # 50% deduction
        self.section_962_corporate_rate = Decimal('0.21')  # Corporate tax rate

    def calculate_foreign_income_tax(
        self,
        foreign_income_items: List[ForeignIncomeItem],
        countries: List[ForeignCountry],
        earned_income_info: Optional[ForeignEarnedIncomeInfo] = None,
        cfcs: Optional[List[ControlledForeignCorporation]] = None,
        pfic_investments: Optional[List[PFICInvestment]] = None,
        us_tax_before_credits: Decimal = Decimal('0'),
        total_worldwide_income: Decimal = Decimal('0'),
        tax_year: int = 2024
    ) -> ForeignIncomeResult:
        """
        Calculate comprehensive foreign income tax
        """
        result = ForeignIncomeResult()

        try:
            # Create country lookup
            country_lookup = {country.country_code: country for country in countries}

            # Calculate Foreign Earned Income Exclusion
            if earned_income_info:
                self._calculate_foreign_earned_income_exclusion(result, earned_income_info)

            # Process foreign income items
            self._process_foreign_income_items(result, foreign_income_items, country_lookup)

            # Calculate Foreign Tax Credit
            self._calculate_foreign_tax_credit(
                result, foreign_income_items, us_tax_before_credits, total_worldwide_income
            )

            # Process CFC income (Subpart F and GILTI)
            if cfcs:
                self._calculate_cfc_inclusions(result, cfcs)

            # Process PFIC investments
            if pfic_investments:
                self._calculate_pfic_tax(result, pfic_investments)

            # Calculate foreign currency gains/losses
            self._calculate_foreign_currency_gains_losses(result, foreign_income_items, country_lookup)

            # Apply treaty benefits
            self._apply_treaty_benefits(result, foreign_income_items, country_lookup)

            # Validate and consolidate results
            self._validate_results(result)

            self.logger.info(f"Foreign income tax calculation completed")

        except Exception as e:
            self.logger.error(f"Foreign income tax calculation failed: {str(e)}")
            result.compliance_issues.append(f"Calculation error: {str(e)}")

        return result

    def _calculate_foreign_earned_income_exclusion(
        self,
        result: ForeignIncomeResult,
        earned_income_info: ForeignEarnedIncomeInfo
    ):
        """Calculate Foreign Earned Income Exclusion (Form 2555)"""

        # Check if taxpayer qualifies
        if not (earned_income_info.foreign_residence_test_met or earned_income_info.physical_presence_test_met):
            result.compliance_issues.append("Neither bona fide residence nor physical presence test met")
            return

        if earned_income_info.physical_presence_test_met and earned_income_info.days_outside_us < self.physical_presence_test_days:
            result.compliance_issues.append(
                f"Physical presence test requires {self.physical_presence_test_days} days, "
                f"only {earned_income_info.days_outside_us} days met"
            )
            return

        # Calculate exclusion amount
        exclusion_amount = min(
            earned_income_info.foreign_earned_income,
            self.foreign_earned_income_exclusion_limit
        )

        result.foreign_earned_income_exclusion = exclusion_amount

        # Calculate housing exclusion/deduction
        self._calculate_foreign_housing_exclusion(result, earned_income_info)

        result.calculation_notes.append(
            f"Foreign earned income exclusion: ${exclusion_amount:,.2f} "
            f"of ${earned_income_info.foreign_earned_income:,.2f} foreign earned income"
        )

    def _calculate_foreign_housing_exclusion(
        self,
        result: ForeignIncomeResult,
        earned_income_info: ForeignEarnedIncomeInfo
    ):
        """Calculate foreign housing exclusion and deduction"""

        # Housing amount calculation
        total_housing_expenses = (
            earned_income_info.foreign_housing_expenses -
            earned_income_info.employer_provided_housing
        )

        # Base housing amount (16% of FEIE limit)
        housing_amount = total_housing_expenses - self.foreign_housing_base_amount

        if housing_amount > 0:
            # Maximum housing amount (30% of FEIE limit for most locations)
            max_housing_amount = self.foreign_earned_income_exclusion_limit * Decimal('0.30')

            qualifying_housing_amount = min(housing_amount, max_housing_amount)

            # Employer-provided housing is excluded, self-employed is deducted
            if earned_income_info.employer_provided_housing > 0:
                result.foreign_housing_exclusion = qualifying_housing_amount
            else:
                result.foreign_housing_deduction = qualifying_housing_amount

            result.calculation_notes.append(
                f"Foreign housing amount: ${qualifying_housing_amount:,.2f}"
            )

    def _process_foreign_income_items(
        self,
        result: ForeignIncomeResult,
        foreign_income_items: List[ForeignIncomeItem],
        country_lookup: Dict[str, ForeignCountry]
    ):
        """Process foreign income items and categorize by basket"""

        for item in foreign_income_items:
            # Categorize income by basket
            if item.basket == ForeignTaxCreditBasket.PASSIVE:
                result.passive_basket_income += item.usd_amount
            elif item.basket == ForeignTaxCreditBasket.GENERAL:
                result.general_basket_income += item.usd_amount
            elif item.basket == ForeignTaxCreditBasket.GLOBAL_INTANGIBLE_LOW_TAXED:
                result.gilti_basket_income += item.usd_amount
            elif item.basket == ForeignTaxCreditBasket.FOREIGN_BRANCH:
                result.foreign_branch_basket_income += item.usd_amount

            # Track income details
            income_detail = {
                'income_id': item.income_id,
                'country': country_lookup.get(item.country_code, {}).get('country_name', item.country_code),
                'income_type': item.income_type.value,
                'basket': item.basket.value,
                'foreign_amount': item.foreign_currency_amount,
                'usd_amount': item.usd_amount,
                'foreign_tax_paid': item.foreign_tax_paid,
                'foreign_tax_withheld': item.foreign_tax_withheld
            }

            result.income_details.append(income_detail)

    def _calculate_foreign_tax_credit(
        self,
        result: ForeignIncomeResult,
        foreign_income_items: List[ForeignIncomeItem],
        us_tax_before_credits: Decimal,
        total_worldwide_income: Decimal
    ):
        """Calculate Foreign Tax Credit by basket (Form 1116)"""

        if total_worldwide_income <= 0:
            return

        # Calculate by basket
        baskets = {
            'passive': (result.passive_basket_income, []),
            'general': (result.general_basket_income, []),
            'gilti': (result.gilti_basket_income, []),
            'foreign_branch': (result.foreign_branch_basket_income, [])
        }

        # Group foreign taxes by basket
        for item in foreign_income_items:
            basket_key = item.basket.value.replace('global_intangible_low_taxed', 'gilti')
            if basket_key in baskets:
                baskets[basket_key][1].append(item)

        total_credit = Decimal('0')

        for basket_name, (basket_income, basket_items) in baskets.items():
            if basket_income <= 0:
                continue

            # Calculate limitation
            limitation = (basket_income / total_worldwide_income) * us_tax_before_credits

            # Calculate total foreign taxes paid for this basket
            foreign_taxes_paid = sum(
                item.foreign_tax_paid + item.foreign_tax_withheld + item.deemed_paid_credit
                for item in basket_items
            )

            # Credit is lesser of foreign taxes paid or limitation
            basket_credit = min(foreign_taxes_paid, limitation)
            result.foreign_tax_credit_by_basket[basket_name] = basket_credit
            total_credit += basket_credit

            # Track any excess for carryforward
            if foreign_taxes_paid > limitation:
                excess = foreign_taxes_paid - limitation
                result.foreign_tax_credit_carryforward += excess

            result.calculation_notes.append(
                f"{basket_name.title()} basket: Credit ${basket_credit:,.2f} "
                f"(Foreign taxes ${foreign_taxes_paid:,.2f}, Limitation ${limitation:,.2f})"
            )

        result.total_foreign_tax_credit = total_credit
        result.foreign_tax_credit_limitation = sum(
            (basket_income / total_worldwide_income) * us_tax_before_credits
            for basket_income in [result.passive_basket_income, result.general_basket_income,
                                result.gilti_basket_income, result.foreign_branch_basket_income]
            if basket_income > 0
        )

    def _calculate_cfc_inclusions(self, result: ForeignIncomeResult, cfcs: List[ControlledForeignCorporation]):
        """Calculate Subpart F and GILTI inclusions"""

        total_subpart_f = Decimal('0')
        total_gilti_income = Decimal('0')
        total_tested_income = Decimal('0')
        total_tested_loss = Decimal('0')
        total_qbai = Decimal('0')
        total_foreign_taxes = Decimal('0')

        for cfc in cfcs:
            # Subpart F inclusion
            subpart_f_inclusion = cfc.subpart_f_income * (cfc.ownership_percentage / Decimal('100'))
            total_subpart_f += subpart_f_inclusion

            # GILTI calculation components
            tested_income = max(cfc.tested_income - cfc.tested_loss, Decimal('0'))
            total_tested_income += tested_income * (cfc.ownership_percentage / Decimal('100'))
            total_qbai += cfc.qualified_business_asset_investment * (cfc.ownership_percentage / Decimal('100'))
            total_foreign_taxes += cfc.foreign_tax_paid * (cfc.ownership_percentage / Decimal('100'))

            # Track CFC details
            cfc_detail = {
                'cfc_name': cfc.cfc_name,
                'country': cfc.cfc_country,
                'ownership_percentage': cfc.ownership_percentage,
                'subpart_f_inclusion': subpart_f_inclusion,
                'tested_income': tested_income,
                'qbai': cfc.qualified_business_asset_investment,
                'foreign_taxes': cfc.foreign_tax_paid
            }
            result.cfc_details.append(cfc_detail)

        result.subpart_f_inclusion = total_subpart_f

        # GILTI calculation
        if total_tested_income > 0:
            # Net deemed tangible income return (10% of QBAI)
            net_dtir = total_qbai * Decimal('0.10')
            gilti_amount = max(total_tested_income - net_dtir, Decimal('0'))

            result.gilti_inclusion = gilti_amount
            result.gilti_basket_income += gilti_amount

            # Section 962 election consideration
            if gilti_amount > 0:
                corporate_tax = gilti_amount * self.section_962_corporate_rate
                individual_tax_rate = Decimal('0.37')  # Assume top rate
                individual_tax = gilti_amount * individual_tax_rate * self.gilti_deduction_percentage

                if corporate_tax < individual_tax:
                    result.section_962_election_benefit = individual_tax - corporate_tax
                    result.calculation_notes.append(
                        f"Section 962 election may save ${result.section_962_election_benefit:,.2f}"
                    )

            result.calculation_notes.append(
                f"GILTI inclusion: ${gilti_amount:,.2f} "
                f"(Tested income ${total_tested_income:,.2f} - Net DTIR ${net_dtir:,.2f})"
            )

    def _calculate_pfic_tax(self, result: ForeignIncomeResult, pfic_investments: List[PFICInvestment]):
        """Calculate PFIC tax and interest charge"""

        for pfic in pfic_investments:
            if pfic.qef_election:
                # QEF election - current taxation
                ownership_percentage = pfic.shares_owned / pfic.total_shares
                qef_inclusion = (pfic.ending_value - pfic.beginning_value) * ownership_percentage

                if qef_inclusion > 0:
                    result.pfic_ordinary_income += qef_inclusion

            elif pfic.mark_to_market_election:
                # Mark-to-market election
                unrealized_gain = pfic.ending_value - pfic.beginning_value
                if unrealized_gain > 0:
                    result.pfic_ordinary_income += unrealized_gain

            else:
                # Default excess distribution method
                if pfic.excess_distributions > 0:
                    # Calculate interest charge (simplified)
                    years_held = 3  # Simplified assumption
                    interest_rate = Decimal('0.06')  # Simplified rate
                    interest_charge = pfic.excess_distributions * interest_rate * years_held

                    result.pfic_ordinary_income += pfic.excess_distributions
                    result.pfic_interest_charge += interest_charge

            # Track PFIC details
            pfic_detail = {
                'pfic_name': pfic.pfic_name,
                'country': pfic.pfic_country,
                'shares_owned': pfic.shares_owned,
                'beginning_value': pfic.beginning_value,
                'ending_value': pfic.ending_value,
                'qef_election': pfic.qef_election,
                'mark_to_market_election': pfic.mark_to_market_election
            }
            result.pfic_details.append(pfic_detail)

    def _calculate_foreign_currency_gains_losses(
        self,
        result: ForeignIncomeResult,
        foreign_income_items: List[ForeignIncomeItem],
        country_lookup: Dict[str, ForeignCountry]
    ):
        """Calculate Section 988 foreign currency gains and losses"""

        # Simplified calculation - in practice, this requires detailed transaction tracking
        for item in foreign_income_items:
            country = country_lookup.get(item.country_code)
            if country and country.currency_code != 'USD':
                # Simplified calculation for demonstration
                # In practice, you'd track acquisition and disposition rates
                currency_gain_loss = item.usd_amount * Decimal('0.001')  # Simplified 0.1% assumption

                if currency_gain_loss > 0:
                    result.section_988_gains += currency_gain_loss
                else:
                    result.section_988_losses += abs(currency_gain_loss)

    def _apply_treaty_benefits(
        self,
        result: ForeignIncomeResult,
        foreign_income_items: List[ForeignIncomeItem],
        country_lookup: Dict[str, ForeignCountry]
    ):
        """Apply tax treaty benefits"""

        total_reduction = Decimal('0')

        for item in foreign_income_items:
            if item.treaty_benefits_claimed:
                country = country_lookup.get(item.country_code)
                if country and country.tax_treaty_exists:
                    # Simplified treaty benefit calculation
                    # In practice, this depends on specific treaty provisions
                    withholding_reduction = item.foreign_tax_withheld * Decimal('0.15')  # Example reduction
                    total_reduction += withholding_reduction

        result.treaty_withholding_reduction = total_reduction

        if total_reduction > 0:
            result.calculation_notes.append(
                f"Treaty benefits reduced withholding by ${total_reduction:,.2f}"
            )

    def _validate_results(self, result: ForeignIncomeResult):
        """Validate calculation results"""

        # Check for common issues
        if result.foreign_earned_income_exclusion > self.foreign_earned_income_exclusion_limit:
            result.compliance_issues.append(
                f"FEIE exceeds annual limit of ${self.foreign_earned_income_exclusion_limit:,.2f}"
            )

        if result.total_foreign_tax_credit > result.foreign_tax_credit_limitation:
            result.compliance_issues.append(
                "Foreign tax credit exceeds limitation - excess should be carried forward"
            )

        # Ensure proper basket separation
        total_basket_income = (
            result.passive_basket_income +
            result.general_basket_income +
            result.gilti_basket_income +
            result.foreign_branch_basket_income
        )

        if total_basket_income <= 0:
            result.compliance_issues.append("No foreign income properly categorized by basket")
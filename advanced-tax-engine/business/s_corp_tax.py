"""
S-Corporation Tax Calculator
Handles S-Corporation (Form 1120S) tax calculations including:
- Pass-through taxation
- Shareholder basis tracking
- Built-in gains tax
- Excess net passive income tax
- LIFO recapture tax
- Shareholder distributions
- Section 1377 allocations
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import date
import logging


@dataclass
class ShareholderInfo:
    """Information about S-Corporation shareholders"""
    shareholder_id: str
    name: str
    ownership_percentage: Decimal
    shares_outstanding: int
    stock_basis_beginning: Decimal
    stock_basis_ending: Decimal
    debt_basis_beginning: Decimal = Decimal('0')
    debt_basis_ending: Decimal = Decimal('0')
    distributions_received: Decimal = Decimal('0')
    loans_to_corporation: Decimal = Decimal('0')
    is_more_than_2_percent: bool = False
    acquisition_date: Optional[date] = None


@dataclass
class SCorpIncomeItem:
    """S-Corporation income/loss items"""
    description: str
    amount: Decimal
    category: str  # ordinary, portfolio, capital, section_1231, etc.
    per_share_allocation: bool = True
    special_allocations: Optional[Dict[str, Decimal]] = None
    built_in_gain_item: bool = False


@dataclass
class SCorpExpenseItem:
    """S-Corporation expense/deduction items"""
    description: str
    amount: Decimal
    category: str
    is_deductible: bool = True
    section_179_eligible: bool = False
    per_share_allocation: bool = True
    special_allocations: Optional[Dict[str, Decimal]] = None


@dataclass
class SCorpTaxResult:
    """Comprehensive S-Corporation tax calculation results"""
    # Corporate-level income (generally not taxed)
    ordinary_business_income: Decimal = Decimal('0')
    net_rental_real_estate_income: Decimal = Decimal('0')
    other_net_rental_income: Decimal = Decimal('0')
    interest_income: Decimal = Decimal('0')
    dividend_income: Decimal = Decimal('0')
    royalty_income: Decimal = Decimal('0')
    net_short_term_capital_gain: Decimal = Decimal('0')
    net_long_term_capital_gain: Decimal = Decimal('0')
    net_section_1231_gain: Decimal = Decimal('0')
    other_income: Decimal = Decimal('0')

    # Corporate-level deductions
    compensation_of_officers: Decimal = Decimal('0')
    salaries_and_wages: Decimal = Decimal('0')
    repairs_and_maintenance: Decimal = Decimal('0')
    bad_debts: Decimal = Decimal('0')
    rent_expense: Decimal = Decimal('0')
    taxes_and_licenses: Decimal = Decimal('0')
    interest_expense: Decimal = Decimal('0')
    depreciation: Decimal = Decimal('0')
    section_179_deduction: Decimal = Decimal('0')
    other_deductions: Decimal = Decimal('0')

    # Special S-Corp taxes at corporate level
    built_in_gains_tax: Decimal = Decimal('0')
    excess_net_passive_income_tax: Decimal = Decimal('0')
    lifo_recapture_tax: Decimal = Decimal('0')
    total_corporate_tax: Decimal = Decimal('0')

    # Shareholder allocations
    shareholder_allocations: Dict[str, Dict[str, Decimal]] = field(default_factory=dict)

    # Shareholder basis tracking
    beginning_stock_basis: Dict[str, Decimal] = field(default_factory=dict)
    ending_stock_basis: Dict[str, Decimal] = field(default_factory=dict)
    beginning_debt_basis: Dict[str, Decimal] = field(default_factory=dict)
    ending_debt_basis: Dict[str, Decimal] = field(default_factory=dict)

    # Distribution analysis
    ordinary_distributions: Dict[str, Decimal] = field(default_factory=dict)
    capital_gain_distributions: Dict[str, Decimal] = field(default_factory=dict)
    return_of_capital: Dict[str, Decimal] = field(default_factory=dict)

    # AAA and other earnings accounts
    accumulated_adjustments_account: Decimal = Decimal('0')
    other_adjustments_account: Decimal = Decimal('0')
    previously_taxed_income: Decimal = Decimal('0')

    # Audit trail
    calculation_notes: List[str] = field(default_factory=list)
    compliance_issues: List[str] = field(default_factory=list)


class SCorpTaxCalculator:
    """Advanced S-Corporation Tax Calculator for Form 1120S"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # 2024 tax year constants
        self.built_in_gains_tax_rate = Decimal('0.21')  # Corporate tax rate
        self.passive_investment_income_threshold = Decimal('0.25')  # 25% threshold
        self.section_179_limit = Decimal('1220000')  # 2024 Section 179 limit
        self.section_179_phaseout_threshold = Decimal('3050000')

    def calculate_s_corp_tax(
        self,
        shareholders: List[ShareholderInfo],
        income_items: List[SCorpIncomeItem],
        expense_items: List[SCorpExpenseItem],
        prior_year_aaa: Decimal = Decimal('0'),
        c_corp_earnings_and_profits: Decimal = Decimal('0'),
        tax_year: int = 2024,
        additional_data: Optional[Dict] = None
    ) -> SCorpTaxResult:
        """
        Calculate comprehensive S-Corporation tax
        """
        result = SCorpTaxResult()
        result.accumulated_adjustments_account = prior_year_aaa

        try:
            # Validate inputs
            self._validate_s_corp_inputs(shareholders, income_items, expense_items)

            # Calculate corporate-level income and deductions (generally pass-through)
            self._calculate_corporate_income(result, income_items)
            self._calculate_corporate_deductions(result, expense_items)

            # Calculate ordinary business income (pass-through to shareholders)
            self._calculate_ordinary_business_income(result)

            # Calculate special S-Corp taxes at corporate level
            self._calculate_built_in_gains_tax(result, income_items, c_corp_earnings_and_profits)
            self._calculate_excess_passive_income_tax(result, income_items, c_corp_earnings_and_profits)
            self._calculate_lifo_recapture_tax(result, additional_data)

            # Allocate income/loss to shareholders
            self._allocate_to_shareholders(result, shareholders, income_items, expense_items)

            # Track shareholder basis
            self._track_shareholder_basis(result, shareholders)

            # Analyze distributions
            self._analyze_distributions(result, shareholders, c_corp_earnings_and_profits)

            # Update AAA and other accounts
            self._update_earnings_accounts(result, shareholders)

            # Validate S-Corp election requirements
            self._validate_s_corp_requirements(result, shareholders)

            self.logger.info(f"S-Corp tax calculation completed for {len(shareholders)} shareholders")

        except Exception as e:
            self.logger.error(f"S-Corp tax calculation failed: {str(e)}")
            result.compliance_issues.append(f"Calculation error: {str(e)}")

        return result

    def _validate_s_corp_inputs(
        self,
        shareholders: List[ShareholderInfo],
        income_items: List[SCorpIncomeItem],
        expense_items: List[SCorpExpenseItem]
    ):
        """Validate S-Corporation tax calculation inputs"""
        if not shareholders:
            raise ValueError("At least one shareholder required")

        if len(shareholders) > 100:
            raise ValueError("S-Corporations cannot have more than 100 shareholders")

        # Validate ownership percentages sum to 100%
        total_ownership = sum(shareholder.ownership_percentage for shareholder in shareholders)
        if abs(total_ownership - Decimal('100')) > Decimal('0.01'):
            raise ValueError(f"Shareholder ownership percentages must sum to 100%, got {total_ownership}%")

        # Validate shareholder IDs are unique
        shareholder_ids = [shareholder.shareholder_id for shareholder in shareholders]
        if len(shareholder_ids) != len(set(shareholder_ids)):
            raise ValueError("Shareholder IDs must be unique")

    def _calculate_corporate_income(self, result: SCorpTaxResult, income_items: List[SCorpIncomeItem]):
        """Calculate corporate-level income items (generally pass-through)"""
        for item in income_items:
            if item.category == 'ordinary_business':
                result.ordinary_business_income += item.amount
            elif item.category == 'rental_real_estate':
                result.net_rental_real_estate_income += item.amount
            elif item.category == 'other_rental':
                result.other_net_rental_income += item.amount
            elif item.category == 'interest':
                result.interest_income += item.amount
            elif item.category == 'dividends':
                result.dividend_income += item.amount
            elif item.category == 'royalties':
                result.royalty_income += item.amount
            elif item.category == 'short_term_capital_gain':
                result.net_short_term_capital_gain += item.amount
            elif item.category == 'long_term_capital_gain':
                result.net_long_term_capital_gain += item.amount
            elif item.category == 'section_1231_gain':
                result.net_section_1231_gain += item.amount
            else:
                result.other_income += item.amount

    def _calculate_corporate_deductions(self, result: SCorpTaxResult, expense_items: List[SCorpExpenseItem]):
        """Calculate corporate-level deductions"""
        total_section_179 = Decimal('0')

        for item in expense_items:
            if not item.is_deductible:
                continue

            if item.category == 'officer_compensation':
                result.compensation_of_officers += item.amount
            elif item.category == 'salaries_wages':
                result.salaries_and_wages += item.amount
            elif item.category == 'repairs_maintenance':
                result.repairs_and_maintenance += item.amount
            elif item.category == 'bad_debts':
                result.bad_debts += item.amount
            elif item.category == 'rent':
                result.rent_expense += item.amount
            elif item.category == 'taxes_licenses':
                result.taxes_and_licenses += item.amount
            elif item.category == 'interest':
                result.interest_expense += item.amount
            elif item.category == 'depreciation':
                if item.section_179_eligible:
                    # Apply Section 179 limitations
                    section_179_amount = min(item.amount, self.section_179_limit - total_section_179)
                    total_section_179 += section_179_amount
                    result.section_179_deduction += section_179_amount

                    # Remaining amount as regular depreciation
                    remaining_amount = item.amount - section_179_amount
                    result.depreciation += remaining_amount
                else:
                    result.depreciation += item.amount
            else:
                result.other_deductions += item.amount

        # Apply Section 179 phaseout
        if total_section_179 > self.section_179_phaseout_threshold:
            phaseout = total_section_179 - self.section_179_phaseout_threshold
            result.section_179_deduction = max(Decimal('0'), result.section_179_deduction - phaseout)
            result.depreciation += phaseout

    def _calculate_ordinary_business_income(self, result: SCorpTaxResult):
        """Calculate ordinary business income (loss) - passes through to shareholders"""
        total_income = (
            result.ordinary_business_income +
            result.other_income
        )

        total_deductions = (
            result.compensation_of_officers +
            result.salaries_and_wages +
            result.repairs_and_maintenance +
            result.bad_debts +
            result.rent_expense +
            result.taxes_and_licenses +
            result.interest_expense +
            result.depreciation +
            result.section_179_deduction +
            result.other_deductions
        )

        result.ordinary_business_income = total_income - total_deductions

    def _calculate_built_in_gains_tax(
        self,
        result: SCorpTaxResult,
        income_items: List[SCorpIncomeItem],
        c_corp_earnings_and_profits: Decimal
    ):
        """Calculate built-in gains tax (Section 1374)"""
        if c_corp_earnings_and_profits <= 0:
            return  # No BIG tax if no C-Corp E&P

        # Identify built-in gain items
        built_in_gains = Decimal('0')
        for item in income_items:
            if item.built_in_gain_item:
                built_in_gains += max(item.amount, Decimal('0'))

        if built_in_gains > 0:
            # Calculate taxable built-in gains
            taxable_gains = min(built_in_gains, c_corp_earnings_and_profits)
            result.built_in_gains_tax = taxable_gains * self.built_in_gains_tax_rate

            result.calculation_notes.append(
                f"Built-in gains tax: ${result.built_in_gains_tax:,.2f} on ${taxable_gains:,.2f} of gains"
            )

    def _calculate_excess_passive_income_tax(
        self,
        result: SCorpTaxResult,
        income_items: List[SCorpIncomeItem],
        c_corp_earnings_and_profits: Decimal
    ):
        """Calculate excess net passive income tax (Section 1375)"""
        if c_corp_earnings_and_profits <= 0:
            return  # No tax if no C-Corp E&P

        # Calculate passive investment income
        passive_income = (
            result.interest_income +
            result.dividend_income +
            result.royalty_income +
            result.net_rental_real_estate_income +
            result.other_net_rental_income
        )

        # Calculate gross receipts
        gross_receipts = (
            result.ordinary_business_income +
            passive_income +
            result.net_short_term_capital_gain +
            result.net_long_term_capital_gain +
            result.other_income
        )

        if gross_receipts > 0:
            passive_income_percentage = passive_income / gross_receipts

            # Tax applies if passive income > 25% of gross receipts
            if passive_income_percentage > self.passive_investment_income_threshold:
                excess_passive_income = passive_income - (gross_receipts * self.passive_investment_income_threshold)

                # Tax rate is highest corporate rate on excess passive income
                result.excess_net_passive_income_tax = excess_passive_income * self.built_in_gains_tax_rate

                result.calculation_notes.append(
                    f"Excess passive income tax: ${result.excess_net_passive_income_tax:,.2f} "
                    f"on ${excess_passive_income:,.2f} of excess passive income "
                    f"({passive_income_percentage:.1%} of gross receipts)"
                )

    def _calculate_lifo_recapture_tax(self, result: SCorpTaxResult, additional_data: Optional[Dict]):
        """Calculate LIFO recapture tax (Section 1363(d))"""
        if not additional_data or 'lifo_recapture_amount' not in additional_data:
            return

        lifo_recapture = additional_data.get('lifo_recapture_amount', Decimal('0'))
        if lifo_recapture > 0:
            # LIFO recapture is taxed at corporate rates and paid over 4 years
            result.lifo_recapture_tax = lifo_recapture * self.built_in_gains_tax_rate / Decimal('4')

            result.calculation_notes.append(
                f"LIFO recapture tax (1/4): ${result.lifo_recapture_tax:,.2f} "
                f"on ${lifo_recapture:,.2f} total recapture"
            )

    def _allocate_to_shareholders(
        self,
        result: SCorpTaxResult,
        shareholders: List[ShareholderInfo],
        income_items: List[SCorpIncomeItem],
        expense_items: List[SCorpExpenseItem]
    ):
        """Allocate income and deductions to shareholders per-share, per-day"""
        total_shares = sum(shareholder.shares_outstanding for shareholder in shareholders)

        for shareholder in shareholders:
            shareholder_allocation = {}

            # Pro-rata allocation based on shares outstanding
            share_percentage = Decimal(shareholder.shares_outstanding) / Decimal(total_shares)

            # Allocate income items
            shareholder_allocation['ordinary_business_income'] = result.ordinary_business_income * share_percentage
            shareholder_allocation['net_rental_real_estate_income'] = result.net_rental_real_estate_income * share_percentage
            shareholder_allocation['other_net_rental_income'] = result.other_net_rental_income * share_percentage
            shareholder_allocation['interest_income'] = result.interest_income * share_percentage
            shareholder_allocation['dividend_income'] = result.dividend_income * share_percentage
            shareholder_allocation['royalty_income'] = result.royalty_income * share_percentage
            shareholder_allocation['net_short_term_capital_gain'] = result.net_short_term_capital_gain * share_percentage
            shareholder_allocation['net_long_term_capital_gain'] = result.net_long_term_capital_gain * share_percentage
            shareholder_allocation['net_section_1231_gain'] = result.net_section_1231_gain * share_percentage

            # Handle special allocations (limited in S-Corps)
            self._apply_special_allocations_s_corp(shareholder_allocation, shareholder, income_items, expense_items)

            result.shareholder_allocations[shareholder.shareholder_id] = shareholder_allocation

    def _apply_special_allocations_s_corp(
        self,
        shareholder_allocation: Dict[str, Decimal],
        shareholder: ShareholderInfo,
        income_items: List[SCorpIncomeItem],
        expense_items: List[SCorpExpenseItem]
    ):
        """Apply limited special allocations allowed in S-Corps"""
        # S-Corps have limited ability for special allocations compared to partnerships
        # Most allocations must be per-share, per-day

        # Check for any items that have special allocations
        for item in income_items:
            if not item.per_share_allocation and item.special_allocations:
                if shareholder.shareholder_id in item.special_allocations:
                    # This is unusual for S-Corps and may indicate compliance issues
                    self.compliance_issues.append(
                        f"Special allocation detected for shareholder {shareholder.shareholder_id} "
                        f"- S-Corps generally require per-share allocations"
                    )

    def _track_shareholder_basis(self, result: SCorpTaxResult, shareholders: List[ShareholderInfo]):
        """Track shareholder stock and debt basis"""
        for shareholder in shareholders:
            shareholder_id = shareholder.shareholder_id
            allocation = result.shareholder_allocations.get(shareholder_id, {})

            # Track stock basis
            result.beginning_stock_basis[shareholder_id] = shareholder.stock_basis_beginning
            stock_basis = shareholder.stock_basis_beginning

            # Increase basis for income allocations
            for key, amount in allocation.items():
                if amount > 0:
                    stock_basis += amount

            # Decrease basis for loss allocations (limited to basis)
            total_losses = sum(abs(amount) for amount in allocation.values() if amount < 0)

            if total_losses > stock_basis:
                # Losses exceed stock basis - move to debt basis
                remaining_losses = total_losses - stock_basis
                stock_basis = Decimal('0')

                # Apply remaining losses against debt basis
                debt_basis = shareholder.debt_basis_beginning
                debt_basis = max(debt_basis - remaining_losses, Decimal('0'))

                if remaining_losses > shareholder.debt_basis_beginning:
                    suspended_losses = remaining_losses - shareholder.debt_basis_beginning
                    result.calculation_notes.append(
                        f"Shareholder {shareholder_id}: ${suspended_losses:,.2f} losses suspended due to insufficient basis"
                    )

                result.ending_debt_basis[shareholder_id] = debt_basis
            else:
                stock_basis -= total_losses
                result.ending_debt_basis[shareholder_id] = shareholder.debt_basis_beginning

            # Decrease basis for distributions
            stock_basis = max(stock_basis - shareholder.distributions_received, Decimal('0'))

            result.ending_stock_basis[shareholder_id] = stock_basis

    def _analyze_distributions(
        self,
        result: SCorpTaxResult,
        shareholders: List[ShareholderInfo],
        c_corp_earnings_and_profits: Decimal
    ):
        """Analyze character of distributions to shareholders"""
        for shareholder in shareholders:
            shareholder_id = shareholder.shareholder_id
            distribution = shareholder.distributions_received

            if distribution <= 0:
                continue

            # S-Corp distribution ordering rules:
            # 1. First from AAA (tax-free to extent of stock basis)
            # 2. Then from previously taxed income (tax-free)
            # 3. Then from C-Corp E&P (dividend income)
            # 4. Then return of capital (reduces basis)
            # 5. Finally capital gain (if basis reduced to zero)

            remaining_distribution = distribution
            ordinary_dividend = Decimal('0')
            return_of_capital = Decimal('0')
            capital_gain = Decimal('0')

            # Shareholder's share of AAA
            total_shares = sum(sh.shares_outstanding for sh in shareholders)
            shareholder_aaa_share = (
                result.accumulated_adjustments_account *
                Decimal(shareholder.shares_outstanding) / Decimal(total_shares)
            )

            # Step 1: Distribution from AAA
            aaa_distribution = min(remaining_distribution, shareholder_aaa_share)
            remaining_distribution -= aaa_distribution

            # Step 2: Distribution from C-Corp E&P (if any)
            if remaining_distribution > 0 and c_corp_earnings_and_profits > 0:
                shareholder_ep_share = (
                    c_corp_earnings_and_profits *
                    Decimal(shareholder.shares_outstanding) / Decimal(total_shares)
                )
                ordinary_dividend = min(remaining_distribution, shareholder_ep_share)
                remaining_distribution -= ordinary_dividend

            # Step 3: Return of capital (reduces basis)
            stock_basis = result.ending_stock_basis.get(shareholder_id, Decimal('0'))
            if remaining_distribution > 0:
                return_of_capital = min(remaining_distribution, stock_basis)
                remaining_distribution -= return_of_capital

            # Step 4: Capital gain (excess over basis)
            if remaining_distribution > 0:
                capital_gain = remaining_distribution

            result.ordinary_distributions[shareholder_id] = ordinary_dividend
            result.capital_gain_distributions[shareholder_id] = capital_gain
            result.return_of_capital[shareholder_id] = return_of_capital

    def _update_earnings_accounts(self, result: SCorpTaxResult, shareholders: List[ShareholderInfo]):
        """Update AAA and other earnings accounts"""
        # Calculate net income for AAA purposes
        total_income = sum(
            sum(allocation.values())
            for allocation in result.shareholder_allocations.values()
        )

        # AAA increases for income (except tax-exempt income)
        # AAA decreases for losses and distributions
        result.accumulated_adjustments_account += total_income

        # Decrease AAA for distributions from AAA
        total_aaa_distributions = sum(
            result.ordinary_distributions.values()
        ) - sum(result.capital_gain_distributions.values())

        result.accumulated_adjustments_account -= total_aaa_distributions

        # AAA cannot go below zero
        result.accumulated_adjustments_account = max(result.accumulated_adjustments_account, Decimal('0'))

    def _validate_s_corp_requirements(self, result: SCorpTaxResult, shareholders: List[ShareholderInfo]):
        """Validate S-Corporation election requirements"""
        # Check shareholder count
        if len(shareholders) > 100:
            result.compliance_issues.append("S-Corporation has more than 100 shareholders")

        # Check for more than 2% shareholders with fringe benefits
        for shareholder in shareholders:
            if shareholder.is_more_than_2_percent:
                result.calculation_notes.append(
                    f"Shareholder {shareholder.shareholder_id} owns >2% - "
                    f"fringe benefits may be taxable as wages"
                )

        # Calculate total corporate-level taxes
        result.total_corporate_tax = (
            result.built_in_gains_tax +
            result.excess_net_passive_income_tax +
            result.lifo_recapture_tax
        )

        if result.total_corporate_tax > 0:
            result.calculation_notes.append(
                f"Total S-Corp level taxes: ${result.total_corporate_tax:,.2f}"
            )
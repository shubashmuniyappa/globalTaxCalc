"""
Partnership Tax Calculator
Handles Partnership (Form 1065) tax calculations including:
- Partnership income/loss allocation
- Partner basis tracking
- Guaranteed payments
- Section 704 allocations
- Partnership distributions
- At-risk and passive activity limitations
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import date
import logging


@dataclass
class PartnerInfo:
    """Information about individual partners"""
    partner_id: str
    name: str
    ownership_percentage: Decimal
    capital_account_beginning: Decimal
    capital_account_ending: Decimal
    basis_beginning: Decimal
    basis_ending: Decimal
    guaranteed_payments: Decimal = Decimal('0')
    distributions_received: Decimal = Decimal('0')
    at_risk_amount: Decimal = Decimal('0')
    passive_activity_participation: bool = False
    section_704c_adjustments: Decimal = Decimal('0')


@dataclass
class PartnershipIncomeItem:
    """Partnership income/loss items"""
    description: str
    amount: Decimal
    category: str  # ordinary, portfolio, capital, section_1231, etc.
    is_passive: bool = False
    is_at_risk: bool = True
    special_allocations: Optional[Dict[str, Decimal]] = None


@dataclass
class PartnershipExpenseItem:
    """Partnership expense/deduction items"""
    description: str
    amount: Decimal
    category: str
    is_deductible: bool = True
    section_179_eligible: bool = False
    depreciation_method: str = 'straight_line'
    special_allocations: Optional[Dict[str, Decimal]] = None


@dataclass
class PartnershipTaxResult:
    """Comprehensive partnership tax calculation results"""
    # Partnership-level results
    ordinary_business_income: Decimal = Decimal('0')
    net_rental_real_estate_income: Decimal = Decimal('0')
    other_net_rental_income: Decimal = Decimal('0')
    guaranteed_payments: Decimal = Decimal('0')
    interest_income: Decimal = Decimal('0')
    dividend_income: Decimal = Decimal('0')
    royalty_income: Decimal = Decimal('0')
    net_short_term_capital_gain: Decimal = Decimal('0')
    net_long_term_capital_gain: Decimal = Decimal('0')
    net_section_1231_gain: Decimal = Decimal('0')
    other_income: Decimal = Decimal('0')

    # Deductions
    salaries_and_wages: Decimal = Decimal('0')
    guaranteed_payments_deducted: Decimal = Decimal('0')
    rent_expense: Decimal = Decimal('0')
    interest_expense: Decimal = Decimal('0')
    taxes_and_licenses: Decimal = Decimal('0')
    depreciation: Decimal = Decimal('0')
    section_179_deduction: Decimal = Decimal('0')
    other_deductions: Decimal = Decimal('0')

    # Partner allocations
    partner_allocations: Dict[str, Dict[str, Decimal]] = field(default_factory=dict)

    # Balance sheet information
    beginning_capital_accounts: Dict[str, Decimal] = field(default_factory=dict)
    ending_capital_accounts: Dict[str, Decimal] = field(default_factory=dict)
    partner_basis_tracking: Dict[str, Decimal] = field(default_factory=dict)

    # Special calculations
    at_risk_limitations: Dict[str, Decimal] = field(default_factory=dict)
    passive_activity_limitations: Dict[str, Decimal] = field(default_factory=dict)

    # Audit trail
    calculation_notes: List[str] = field(default_factory=list)
    compliance_issues: List[str] = field(default_factory=list)


class PartnershipTaxCalculator:
    """Advanced Partnership Tax Calculator for Form 1065"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # 2024 tax year constants
        self.section_179_limit = Decimal('1220000')  # 2024 Section 179 limit
        self.section_179_phaseout_threshold = Decimal('3050000')  # 2024 phaseout threshold

    def calculate_partnership_tax(
        self,
        partners: List[PartnerInfo],
        income_items: List[PartnershipIncomeItem],
        expense_items: List[PartnershipExpenseItem],
        tax_year: int = 2024,
        additional_data: Optional[Dict] = None
    ) -> PartnershipTaxResult:
        """
        Calculate comprehensive partnership tax
        """
        result = PartnershipTaxResult()

        try:
            # Validate inputs
            self._validate_partnership_inputs(partners, income_items, expense_items)

            # Calculate partnership-level income and deductions
            self._calculate_partnership_income(result, income_items)
            self._calculate_partnership_deductions(result, expense_items)

            # Calculate ordinary business income
            self._calculate_ordinary_business_income(result)

            # Allocate income/loss to partners
            self._allocate_to_partners(result, partners, income_items, expense_items)

            # Apply at-risk limitations
            self._apply_at_risk_limitations(result, partners)

            # Apply passive activity limitations
            self._apply_passive_activity_limitations(result, partners)

            # Track partner basis
            self._track_partner_basis(result, partners)

            # Calculate capital accounts
            self._calculate_capital_accounts(result, partners)

            # Validate allocations under Section 704
            self._validate_section_704_allocations(result, partners)

            self.logger.info(f"Partnership tax calculation completed for {len(partners)} partners")

        except Exception as e:
            self.logger.error(f"Partnership tax calculation failed: {str(e)}")
            result.compliance_issues.append(f"Calculation error: {str(e)}")

        return result

    def _validate_partnership_inputs(
        self,
        partners: List[PartnerInfo],
        income_items: List[PartnershipIncomeItem],
        expense_items: List[PartnershipExpenseItem]
    ):
        """Validate partnership tax calculation inputs"""
        if not partners:
            raise ValueError("At least one partner required")

        # Validate ownership percentages sum to 100%
        total_ownership = sum(partner.ownership_percentage for partner in partners)
        if abs(total_ownership - Decimal('100')) > Decimal('0.01'):
            raise ValueError(f"Partner ownership percentages must sum to 100%, got {total_ownership}%")

        # Validate partner IDs are unique
        partner_ids = [partner.partner_id for partner in partners]
        if len(partner_ids) != len(set(partner_ids)):
            raise ValueError("Partner IDs must be unique")

    def _calculate_partnership_income(self, result: PartnershipTaxResult, income_items: List[PartnershipIncomeItem]):
        """Calculate partnership-level income items"""
        for item in income_items:
            if item.category == 'ordinary_business':
                result.ordinary_business_income += item.amount
            elif item.category == 'rental_real_estate':
                result.net_rental_real_estate_income += item.amount
            elif item.category == 'other_rental':
                result.other_net_rental_income += item.amount
            elif item.category == 'guaranteed_payments':
                result.guaranteed_payments += item.amount
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

    def _calculate_partnership_deductions(self, result: PartnershipTaxResult, expense_items: List[PartnershipExpenseItem]):
        """Calculate partnership-level deductions"""
        total_section_179 = Decimal('0')

        for item in expense_items:
            if not item.is_deductible:
                continue

            if item.category == 'salaries_wages':
                result.salaries_and_wages += item.amount
            elif item.category == 'guaranteed_payments':
                result.guaranteed_payments_deducted += item.amount
            elif item.category == 'rent':
                result.rent_expense += item.amount
            elif item.category == 'interest':
                result.interest_expense += item.amount
            elif item.category == 'taxes_licenses':
                result.taxes_and_licenses += item.amount
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

    def _calculate_ordinary_business_income(self, result: PartnershipTaxResult):
        """Calculate ordinary business income (loss)"""
        total_income = (
            result.ordinary_business_income +
            result.guaranteed_payments +
            result.other_income
        )

        total_deductions = (
            result.salaries_and_wages +
            result.guaranteed_payments_deducted +
            result.rent_expense +
            result.interest_expense +
            result.taxes_and_licenses +
            result.depreciation +
            result.section_179_deduction +
            result.other_deductions
        )

        result.ordinary_business_income = total_income - total_deductions

    def _allocate_to_partners(
        self,
        result: PartnershipTaxResult,
        partners: List[PartnerInfo],
        income_items: List[PartnershipIncomeItem],
        expense_items: List[PartnershipExpenseItem]
    ):
        """Allocate income and deductions to partners"""
        for partner in partners:
            partner_allocation = {}

            # Default allocation based on ownership percentage
            ownership_pct = partner.ownership_percentage / Decimal('100')

            # Allocate income items
            partner_allocation['ordinary_business_income'] = result.ordinary_business_income * ownership_pct
            partner_allocation['net_rental_real_estate_income'] = result.net_rental_real_estate_income * ownership_pct
            partner_allocation['other_net_rental_income'] = result.other_net_rental_income * ownership_pct
            partner_allocation['interest_income'] = result.interest_income * ownership_pct
            partner_allocation['dividend_income'] = result.dividend_income * ownership_pct
            partner_allocation['royalty_income'] = result.royalty_income * ownership_pct
            partner_allocation['net_short_term_capital_gain'] = result.net_short_term_capital_gain * ownership_pct
            partner_allocation['net_long_term_capital_gain'] = result.net_long_term_capital_gain * ownership_pct
            partner_allocation['net_section_1231_gain'] = result.net_section_1231_gain * ownership_pct

            # Add guaranteed payments
            partner_allocation['guaranteed_payments'] = partner.guaranteed_payments

            # Handle special allocations
            self._apply_special_allocations(partner_allocation, partner, income_items, expense_items)

            # Apply Section 704(c) adjustments
            partner_allocation['section_704c_adjustments'] = partner.section_704c_adjustments

            result.partner_allocations[partner.partner_id] = partner_allocation

    def _apply_special_allocations(
        self,
        partner_allocation: Dict[str, Decimal],
        partner: PartnerInfo,
        income_items: List[PartnershipIncomeItem],
        expense_items: List[PartnershipExpenseItem]
    ):
        """Apply special allocations under Section 704(b)"""
        # Check for special allocations in income items
        for item in income_items:
            if item.special_allocations and partner.partner_id in item.special_allocations:
                special_amount = item.special_allocations[partner.partner_id]

                # Adjust the regular allocation
                if item.category in partner_allocation:
                    regular_amount = partner_allocation[item.category]
                    ownership_amount = item.amount * (partner.ownership_percentage / Decimal('100'))

                    # Replace ownership-based allocation with special allocation
                    partner_allocation[item.category] = regular_amount - ownership_amount + special_amount

        # Check for special allocations in expense items
        for item in expense_items:
            if item.special_allocations and partner.partner_id in item.special_allocations:
                special_amount = item.special_allocations[partner.partner_id]

                # Add special expense allocation (negative for deductions)
                if 'special_deductions' not in partner_allocation:
                    partner_allocation['special_deductions'] = Decimal('0')
                partner_allocation['special_deductions'] -= special_amount

    def _apply_at_risk_limitations(self, result: PartnershipTaxResult, partners: List[PartnerInfo]):
        """Apply at-risk limitations under Section 465"""
        for partner in partners:
            partner_id = partner.partner_id
            allocation = result.partner_allocations.get(partner_id, {})

            # Calculate total loss allocated to partner
            total_loss = Decimal('0')
            for key, amount in allocation.items():
                if amount < 0:  # Losses are negative
                    total_loss += abs(amount)

            # Compare to at-risk amount
            if total_loss > partner.at_risk_amount:
                excess_loss = total_loss - partner.at_risk_amount
                result.at_risk_limitations[partner_id] = excess_loss

                # Suspend excess loss
                result.calculation_notes.append(
                    f"Partner {partner_id}: ${excess_loss:,.2f} loss suspended due to at-risk limitations"
                )

    def _apply_passive_activity_limitations(self, result: PartnershipTaxResult, partners: List[PartnerInfo]):
        """Apply passive activity limitations under Section 469"""
        for partner in partners:
            if not partner.passive_activity_participation:
                partner_id = partner.partner_id
                allocation = result.partner_allocations.get(partner_id, {})

                # Calculate passive losses
                passive_loss = Decimal('0')
                for key, amount in allocation.items():
                    if amount < 0 and 'rental' in key.lower():  # Rental losses are typically passive
                        passive_loss += abs(amount)

                if passive_loss > 0:
                    result.passive_activity_limitations[partner_id] = passive_loss
                    result.calculation_notes.append(
                        f"Partner {partner_id}: ${passive_loss:,.2f} passive loss suspended"
                    )

    def _track_partner_basis(self, result: PartnershipTaxResult, partners: List[PartnerInfo]):
        """Track partner basis adjustments"""
        for partner in partners:
            partner_id = partner.partner_id
            allocation = result.partner_allocations.get(partner_id, {})

            # Start with beginning basis
            ending_basis = partner.basis_beginning

            # Add income allocations (increase basis)
            for key, amount in allocation.items():
                if amount > 0:
                    ending_basis += amount

            # Subtract loss allocations and distributions (decrease basis)
            for key, amount in allocation.items():
                if amount < 0:
                    ending_basis += amount  # amount is already negative

            ending_basis -= partner.distributions_received

            # Basis cannot go below zero
            ending_basis = max(ending_basis, Decimal('0'))

            result.partner_basis_tracking[partner_id] = ending_basis

            # Check for basis limitations
            if ending_basis == 0 and any(amount < 0 for amount in allocation.values()):
                result.compliance_issues.append(
                    f"Partner {partner_id}: Insufficient basis to deduct allocated losses"
                )

    def _calculate_capital_accounts(self, result: PartnershipTaxResult, partners: List[PartnerInfo]):
        """Calculate partner capital accounts"""
        for partner in partners:
            partner_id = partner.partner_id
            allocation = result.partner_allocations.get(partner_id, {})

            result.beginning_capital_accounts[partner_id] = partner.capital_account_beginning

            # Calculate ending capital account
            ending_capital = partner.capital_account_beginning

            # Add/subtract income and loss allocations
            for key, amount in allocation.items():
                ending_capital += amount

            # Subtract distributions
            ending_capital -= partner.distributions_received

            result.ending_capital_accounts[partner_id] = ending_capital

    def _validate_section_704_allocations(self, result: PartnershipTaxResult, partners: List[PartnerInfo]):
        """Validate allocations have substantial economic effect under Section 704(b)"""
        # Check if allocations follow capital account maintenance
        total_beginning_capital = sum(result.beginning_capital_accounts.values())
        total_ending_capital = sum(result.ending_capital_accounts.values())

        # Verify allocations are proportionate to capital accounts where required
        for partner in partners:
            partner_id = partner.partner_id
            capital_percentage = (
                result.ending_capital_accounts[partner_id] / total_ending_capital
                if total_ending_capital != 0 else Decimal('0')
            )

            ownership_percentage = partner.ownership_percentage / Decimal('100')

            # Flag significant disproportionate allocations
            if abs(capital_percentage - ownership_percentage) > Decimal('0.10'):  # 10% threshold
                result.compliance_issues.append(
                    f"Partner {partner_id}: Allocation may lack substantial economic effect "
                    f"(Capital: {capital_percentage:.1%}, Ownership: {ownership_percentage:.1%})"
                )
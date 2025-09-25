"""
Capital Gains Tax Calculator
Handles comprehensive capital gains and losses calculations including:
- Short-term vs long-term capital gains
- Capital loss limitations and carryforwards
- Section 1202 qualified small business stock
- Section 1244 small business stock losses
- Collectibles and Section 1250 depreciation recapture
- Installment sale reporting
- Like-kind exchanges (Section 1031)
- Wash sale rules
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import date, timedelta
import logging


@dataclass
class CapitalAsset:
    """Information about a capital asset"""
    asset_id: str
    description: str
    asset_type: str  # stock, bond, real_estate, collectible, crypto, etc.
    acquisition_date: date
    acquisition_cost: Decimal
    improvements: Decimal = Decimal('0')
    depreciation_taken: Decimal = Decimal('0')
    section_1202_eligible: bool = False
    section_1244_eligible: bool = False
    collectible_type: Optional[str] = None  # art, coins, gems, etc.


@dataclass
class CapitalTransaction:
    """Capital gain/loss transaction"""
    transaction_id: str
    asset_id: str
    transaction_date: date
    proceeds: Decimal
    expenses: Decimal = Decimal('0')
    quantity_sold: Decimal = Decimal('1')
    total_quantity: Decimal = Decimal('1')
    installment_sale: bool = False
    like_kind_exchange: bool = False
    wash_sale: bool = False
    disallowed_loss: Decimal = Decimal('0')


@dataclass
class InstallmentSaleInfo:
    """Installment sale information"""
    total_selling_price: Decimal
    total_cost_basis: Decimal
    payments_received_current_year: Decimal
    gross_profit_percentage: Decimal
    depreciation_recapture: Decimal = Decimal('0')


@dataclass
class CapitalGainsResult:
    """Comprehensive capital gains calculation results"""
    # Short-term capital gains/losses
    short_term_capital_gains: Decimal = Decimal('0')
    short_term_capital_losses: Decimal = Decimal('0')
    net_short_term_capital_gain_loss: Decimal = Decimal('0')

    # Long-term capital gains/losses
    long_term_capital_gains: Decimal = Decimal('0')
    long_term_capital_losses: Decimal = Decimal('0')
    net_long_term_capital_gain_loss: Decimal = Decimal('0')

    # Special capital gains
    collectibles_gains: Decimal = Decimal('0')
    section_1250_recapture: Decimal = Decimal('0')
    unrecaptured_section_1250_gain: Decimal = Decimal('0')

    # Net capital gain/loss
    net_capital_gain_loss: Decimal = Decimal('0')
    capital_loss_limitation: Decimal = Decimal('3000')  # 2024 limit
    capital_loss_deduction: Decimal = Decimal('0')
    capital_loss_carryforward: Decimal = Decimal('0')

    # Special provisions
    section_1202_exclusion: Decimal = Decimal('0')
    section_1244_ordinary_loss: Decimal = Decimal('0')

    # Installment sales
    installment_sale_income: Decimal = Decimal('0')
    installment_sale_depreciation_recapture: Decimal = Decimal('0')

    # Transaction details
    transaction_details: List[Dict[str, Any]] = field(default_factory=list)

    # Prior year carryforwards
    short_term_loss_carryforward: Decimal = Decimal('0')
    long_term_loss_carryforward: Decimal = Decimal('0')

    # Wash sale adjustments
    wash_sale_disallowed_losses: Decimal = Decimal('0')

    # Audit trail
    calculation_notes: List[str] = field(default_factory=list)
    compliance_issues: List[str] = field(default_factory=list)


class CapitalGainsCalculator:
    """Advanced Capital Gains Tax Calculator"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # 2024 tax year constants
        self.capital_loss_limit = Decimal('3000')
        self.long_term_holding_period = 365  # Days for long-term treatment
        self.section_1202_exclusion_limit = Decimal('10000000')  # $10M or 10x basis
        self.section_1244_ordinary_loss_limit_single = Decimal('50000')
        self.section_1244_ordinary_loss_limit_joint = Decimal('100000')
        self.collectibles_tax_rate = Decimal('0.28')  # 28% max rate
        self.wash_sale_period = 30  # 30 days before and after

    def calculate_capital_gains(
        self,
        assets: List[CapitalAsset],
        transactions: List[CapitalTransaction],
        installment_sales: Optional[List[InstallmentSaleInfo]] = None,
        prior_year_carryforwards: Optional[Tuple[Decimal, Decimal]] = None,
        filing_status: str = 'single',
        tax_year: int = 2024
    ) -> CapitalGainsResult:
        """
        Calculate comprehensive capital gains and losses
        """
        result = CapitalGainsResult()

        # Apply prior year carryforwards
        if prior_year_carryforwards:
            result.short_term_loss_carryforward = prior_year_carryforwards[0]
            result.long_term_loss_carryforward = prior_year_carryforwards[1]

        try:
            # Create asset lookup
            asset_lookup = {asset.asset_id: asset for asset in assets}

            # Check for wash sales
            self._identify_wash_sales(transactions, asset_lookup)

            # Process each transaction
            for transaction in transactions:
                self._process_capital_transaction(result, transaction, asset_lookup)

            # Apply capital loss carryforwards
            self._apply_loss_carryforwards(result)

            # Calculate net capital gain/loss
            self._calculate_net_capital_gain_loss(result)

            # Apply capital loss limitations
            self._apply_capital_loss_limitations(result)

            # Process installment sales
            if installment_sales:
                self._process_installment_sales(result, installment_sales)

            # Calculate special provisions
            self._calculate_section_1202_exclusion(result, filing_status)
            self._calculate_section_1244_treatment(result, filing_status)

            # Calculate carryforwards
            self._calculate_carryforwards(result)

            self.logger.info(f"Capital gains calculation completed for {len(transactions)} transactions")

        except Exception as e:
            self.logger.error(f"Capital gains calculation failed: {str(e)}")
            result.compliance_issues.append(f"Calculation error: {str(e)}")

        return result

    def _identify_wash_sales(self, transactions: List[CapitalTransaction], asset_lookup: Dict[str, CapitalAsset]):
        """Identify wash sales under Section 1091"""
        # Sort transactions by date
        sorted_transactions = sorted(transactions, key=lambda t: t.transaction_date)

        for i, transaction in enumerate(sorted_transactions):
            if transaction.proceeds <= transaction.expenses:  # Only check loss transactions
                continue

            asset = asset_lookup.get(transaction.asset_id)
            if not asset:
                continue

            # Check for substantially identical purchases within wash sale period
            wash_sale_start = transaction.transaction_date - timedelta(days=self.wash_sale_period)
            wash_sale_end = transaction.transaction_date + timedelta(days=self.wash_sale_period)

            for j, other_transaction in enumerate(sorted_transactions):
                if i == j:
                    continue

                if (other_transaction.asset_id == transaction.asset_id and
                    wash_sale_start <= other_transaction.transaction_date <= wash_sale_end and
                    other_transaction.proceeds > other_transaction.expenses):  # Purchase transaction

                    # Mark as wash sale
                    transaction.wash_sale = True
                    loss_amount = transaction.expenses - transaction.proceeds
                    transaction.disallowed_loss = loss_amount

                    break

    def _process_capital_transaction(
        self,
        result: CapitalGainsResult,
        transaction: CapitalTransaction,
        asset_lookup: Dict[str, CapitalAsset]
    ):
        """Process individual capital transaction"""
        asset = asset_lookup.get(transaction.asset_id)
        if not asset:
            result.compliance_issues.append(f"Asset not found for transaction {transaction.transaction_id}")
            return

        # Calculate basis
        proportion_sold = transaction.quantity_sold / transaction.total_quantity
        cost_basis = (asset.acquisition_cost + asset.improvements) * proportion_sold
        depreciation_taken = asset.depreciation_taken * proportion_sold

        # Adjust basis for depreciation
        adjusted_basis = cost_basis - depreciation_taken

        # Calculate gain/loss
        net_proceeds = transaction.proceeds - transaction.expenses
        gain_loss = net_proceeds - adjusted_basis

        # Apply wash sale rules
        if transaction.wash_sale:
            gain_loss += transaction.disallowed_loss
            result.wash_sale_disallowed_losses += transaction.disallowed_loss

        # Determine holding period
        holding_period = (transaction.transaction_date - asset.acquisition_date).days
        is_long_term = holding_period > self.long_term_holding_period

        # Special handling for different asset types
        if asset.asset_type == 'collectible' and gain_loss > 0:
            result.collectibles_gains += gain_loss
        elif asset.asset_type == 'real_estate' and depreciation_taken > 0:
            # Section 1250 depreciation recapture
            recapture_amount = min(gain_loss, depreciation_taken)
            result.section_1250_recapture += recapture_amount
            gain_loss -= recapture_amount

        # Categorize gain/loss
        if is_long_term:
            if gain_loss > 0:
                result.long_term_capital_gains += gain_loss
            else:
                result.long_term_capital_losses += abs(gain_loss)
        else:
            if gain_loss > 0:
                result.short_term_capital_gains += gain_loss
            else:
                result.short_term_capital_losses += abs(gain_loss)

        # Track transaction details
        transaction_detail = {
            'transaction_id': transaction.transaction_id,
            'asset_description': asset.description,
            'acquisition_date': asset.acquisition_date,
            'sale_date': transaction.transaction_date,
            'proceeds': net_proceeds,
            'basis': adjusted_basis,
            'gain_loss': gain_loss,
            'holding_period_days': holding_period,
            'is_long_term': is_long_term,
            'wash_sale': transaction.wash_sale,
            'asset_type': asset.asset_type
        }

        # Special provisions
        if asset.section_1202_eligible and gain_loss > 0 and is_long_term:
            transaction_detail['section_1202_eligible'] = True

        if asset.section_1244_eligible and gain_loss < 0:
            transaction_detail['section_1244_eligible'] = True

        result.transaction_details.append(transaction_detail)

    def _apply_loss_carryforwards(self, result: CapitalGainsResult):
        """Apply capital loss carryforwards from prior years"""
        # Short-term loss carryforward offsets short-term gains first
        if result.short_term_loss_carryforward > 0:
            offset = min(result.short_term_capital_gains, result.short_term_loss_carryforward)
            result.short_term_capital_gains -= offset
            result.short_term_loss_carryforward -= offset

        # Long-term loss carryforward offsets long-term gains first
        if result.long_term_loss_carryforward > 0:
            offset = min(result.long_term_capital_gains, result.long_term_loss_carryforward)
            result.long_term_capital_gains -= offset
            result.long_term_loss_carryforward -= offset

        # Remaining carryforwards can offset gains of opposite character
        if result.short_term_loss_carryforward > 0:
            offset = min(result.long_term_capital_gains, result.short_term_loss_carryforward)
            result.long_term_capital_gains -= offset
            result.short_term_loss_carryforward -= offset

        if result.long_term_loss_carryforward > 0:
            offset = min(result.short_term_capital_gains, result.long_term_loss_carryforward)
            result.short_term_capital_gains -= offset
            result.long_term_loss_carryforward -= offset

    def _calculate_net_capital_gain_loss(self, result: CapitalGainsResult):
        """Calculate net capital gain/loss"""
        result.net_short_term_capital_gain_loss = result.short_term_capital_gains - result.short_term_capital_losses
        result.net_long_term_capital_gain_loss = result.long_term_capital_gains - result.long_term_capital_losses

        result.net_capital_gain_loss = (
            result.net_short_term_capital_gain_loss +
            result.net_long_term_capital_gain_loss
        )

    def _apply_capital_loss_limitations(self, result: CapitalGainsResult):
        """Apply capital loss limitations"""
        if result.net_capital_gain_loss < 0:
            # Capital loss - limited to $3,000 deduction
            capital_loss = abs(result.net_capital_gain_loss)
            result.capital_loss_deduction = min(capital_loss, self.capital_loss_limit)
            result.capital_loss_carryforward = capital_loss - result.capital_loss_deduction

    def _process_installment_sales(self, result: CapitalGainsResult, installment_sales: List[InstallmentSaleInfo]):
        """Process installment sale income"""
        for sale in installment_sales:
            # Calculate installment income for current year
            installment_income = sale.payments_received_current_year * sale.gross_profit_percentage
            result.installment_sale_income += installment_income

            # Add depreciation recapture
            result.installment_sale_depreciation_recapture += sale.depreciation_recapture

            result.calculation_notes.append(
                f"Installment sale income: ${installment_income:,.2f} "
                f"({sale.gross_profit_percentage:.1%} of ${sale.payments_received_current_year:,.2f})"
            )

    def _calculate_section_1202_exclusion(self, result: CapitalGainsResult, filing_status: str):
        """Calculate Section 1202 qualified small business stock exclusion"""
        section_1202_gains = Decimal('0')

        for detail in result.transaction_details:
            if detail.get('section_1202_eligible') and detail['gain_loss'] > 0:
                section_1202_gains += detail['gain_loss']

        if section_1202_gains > 0:
            # 50% exclusion up to $10M limit
            exclusion_amount = min(
                section_1202_gains * Decimal('0.50'),
                self.section_1202_exclusion_limit
            )

            result.section_1202_exclusion = exclusion_amount
            result.calculation_notes.append(
                f"Section 1202 exclusion: ${exclusion_amount:,.2f} "
                f"(50% of ${section_1202_gains:,.2f} QSBS gain)"
            )

    def _calculate_section_1244_treatment(self, result: CapitalGainsResult, filing_status: str):
        """Calculate Section 1244 small business stock ordinary loss treatment"""
        section_1244_losses = Decimal('0')

        for detail in result.transaction_details:
            if detail.get('section_1244_eligible') and detail['gain_loss'] < 0:
                section_1244_losses += abs(detail['gain_loss'])

        if section_1244_losses > 0:
            # Ordinary loss treatment up to limits
            if filing_status in ['married_filing_jointly', 'qualifying_widow']:
                limit = self.section_1244_ordinary_loss_limit_joint
            else:
                limit = self.section_1244_ordinary_loss_limit_single

            ordinary_loss = min(section_1244_losses, limit)
            result.section_1244_ordinary_loss = ordinary_loss

            result.calculation_notes.append(
                f"Section 1244 ordinary loss: ${ordinary_loss:,.2f} "
                f"of ${section_1244_losses:,.2f} total Section 1244 losses"
            )

    def _calculate_carryforwards(self, result: CapitalGainsResult):
        """Calculate capital loss carryforwards to future years"""
        if result.capital_loss_carryforward > 0:
            # Determine character of carryforward
            if result.net_short_term_capital_gain_loss < 0:
                short_term_excess = abs(result.net_short_term_capital_gain_loss)
                short_term_carryforward = min(short_term_excess, result.capital_loss_carryforward)
                long_term_carryforward = result.capital_loss_carryforward - short_term_carryforward
            else:
                short_term_carryforward = Decimal('0')
                long_term_carryforward = result.capital_loss_carryforward

            result.calculation_notes.append(
                f"Capital loss carryforward: Short-term ${short_term_carryforward:,.2f}, "
                f"Long-term ${long_term_carryforward:,.2f}"
            )
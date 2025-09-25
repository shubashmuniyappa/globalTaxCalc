"""
Cryptocurrency Tax Calculator
Handles comprehensive cryptocurrency tax calculations including:
- Crypto-to-crypto transactions
- Mining income and expenses
- Staking rewards
- DeFi transactions (lending, liquidity pools, yield farming)
- NFT transactions
- Airdrops and hard forks
- Cost basis tracking with FIFO/LIFO/Specific ID methods
- Foreign exchange rate calculations
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import date, datetime
from enum import Enum
import logging


class CostBasisMethod(Enum):
    FIFO = "fifo"
    LIFO = "lifo"
    SPECIFIC_ID = "specific_id"
    AVERAGE_COST = "average_cost"


class CryptoTransactionType(Enum):
    BUY = "buy"
    SELL = "sell"
    TRADE = "trade"  # crypto-to-crypto
    MINING = "mining"
    STAKING = "staking"
    AIRDROP = "airdrop"
    HARD_FORK = "hard_fork"
    DEFI_LENDING = "defi_lending"
    DEFI_BORROWING = "defi_borrowing"
    LIQUIDITY_POOL = "liquidity_pool"
    NFT_PURCHASE = "nft_purchase"
    NFT_SALE = "nft_sale"
    GIFT_RECEIVED = "gift_received"
    GIFT_GIVEN = "gift_given"


@dataclass
class CryptoCurrency:
    """Cryptocurrency information"""
    symbol: str
    name: str
    is_stablecoin: bool = False
    is_nft: bool = False
    contract_address: Optional[str] = None


@dataclass
class CryptoTransaction:
    """Cryptocurrency transaction"""
    transaction_id: str
    timestamp: datetime
    transaction_type: CryptoTransactionType
    from_currency: Optional[str]  # Currency being sold/traded from
    from_amount: Decimal = Decimal('0')
    to_currency: Optional[str]  # Currency being bought/traded to
    to_amount: Decimal = Decimal('0')
    usd_value: Decimal = Decimal('0')  # USD value at time of transaction
    fee: Decimal = Decimal('0')
    fee_currency: str = 'USD'
    exchange: Optional[str] = None
    wallet_address: Optional[str] = None
    specific_lot_id: Optional[str] = None  # For specific ID method
    mining_pool: Optional[str] = None
    defi_protocol: Optional[str] = None


@dataclass
class CryptoHolding:
    """Cryptocurrency holding for basis tracking"""
    lot_id: str
    currency: str
    amount: Decimal
    cost_basis_per_unit: Decimal
    acquisition_date: datetime
    is_long_term: bool = False


@dataclass
class MiningOperation:
    """Mining operation details"""
    operation_id: str
    start_date: date
    end_date: Optional[date]
    equipment_cost: Decimal
    electricity_cost: Decimal
    other_expenses: Decimal
    total_coins_mined: Decimal
    currency_mined: str
    is_business_activity: bool = False


@dataclass
class StakingReward:
    """Staking reward information"""
    reward_id: str
    timestamp: datetime
    currency: str
    amount: Decimal
    usd_value: Decimal
    validator: Optional[str] = None
    staking_period_days: int = 0


@dataclass
class CryptoTaxResult:
    """Comprehensive cryptocurrency tax calculation results"""
    # Capital gains/losses
    short_term_capital_gains: Decimal = Decimal('0')
    short_term_capital_losses: Decimal = Decimal('0')
    long_term_capital_gains: Decimal = Decimal('0')
    long_term_capital_losses: Decimal = Decimal('0')
    net_capital_gain_loss: Decimal = Decimal('0')

    # Ordinary income
    mining_income: Decimal = Decimal('0')
    staking_income: Decimal = Decimal('0')
    airdrop_income: Decimal = Decimal('0')
    hard_fork_income: Decimal = Decimal('0')
    defi_income: Decimal = Decimal('0')
    total_ordinary_income: Decimal = Decimal('0')

    # Business income/expenses (if mining as business)
    mining_business_income: Decimal = Decimal('0')
    mining_business_expenses: Decimal = Decimal('0')
    net_mining_business_income: Decimal = Decimal('0')

    # Current holdings
    current_holdings: List[CryptoHolding] = field(default_factory=list)
    total_portfolio_cost_basis: Decimal = Decimal('0')
    total_portfolio_value: Decimal = Decimal('0')

    # Transaction summaries
    total_transactions: int = 0
    taxable_events: int = 0
    crypto_to_crypto_trades: int = 0

    # Foreign currency considerations
    foreign_exchange_gains_losses: Decimal = Decimal('0')

    # Detailed transaction results
    transaction_results: List[Dict[str, Any]] = field(default_factory=list)

    # Audit trail
    calculation_notes: List[str] = field(default_factory=list)
    compliance_issues: List[str] = field(default_factory=list)


class CryptocurrencyTaxCalculator:
    """Advanced Cryptocurrency Tax Calculator"""

    def __init__(self, cost_basis_method: CostBasisMethod = CostBasisMethod.FIFO):
        self.logger = logging.getLogger(__name__)
        self.cost_basis_method = cost_basis_method
        self.holdings: Dict[str, List[CryptoHolding]] = {}
        self.long_term_threshold_days = 365

    def calculate_crypto_taxes(
        self,
        transactions: List[CryptoTransaction],
        currencies: List[CryptoCurrency],
        mining_operations: Optional[List[MiningOperation]] = None,
        staking_rewards: Optional[List[StakingReward]] = None,
        tax_year: int = 2024
    ) -> CryptoTaxResult:
        """
        Calculate comprehensive cryptocurrency taxes
        """
        result = CryptoTaxResult()

        try:
            # Create currency lookup
            currency_lookup = {currency.symbol: currency for currency in currencies}

            # Sort transactions by timestamp
            sorted_transactions = sorted(transactions, key=lambda t: t.timestamp)

            # Process each transaction
            for transaction in sorted_transactions:
                self._process_crypto_transaction(result, transaction, currency_lookup, tax_year)

            # Process mining operations
            if mining_operations:
                self._process_mining_operations(result, mining_operations, tax_year)

            # Process staking rewards
            if staking_rewards:
                self._process_staking_rewards(result, staking_rewards, tax_year)

            # Calculate totals
            self._calculate_totals(result)

            # Calculate current portfolio value
            self._calculate_portfolio_value(result)

            result.total_transactions = len(sorted_transactions)
            result.taxable_events = len([t for t in result.transaction_results if t.get('taxable_event')])
            result.crypto_to_crypto_trades = len([t for t in sorted_transactions
                                                if t.transaction_type == CryptoTransactionType.TRADE])

            self.logger.info(f"Crypto tax calculation completed for {len(sorted_transactions)} transactions")

        except Exception as e:
            self.logger.error(f"Crypto tax calculation failed: {str(e)}")
            result.compliance_issues.append(f"Calculation error: {str(e)}")

        return result

    def _process_crypto_transaction(
        self,
        result: CryptoTaxResult,
        transaction: CryptoTransaction,
        currency_lookup: Dict[str, CryptoCurrency],
        tax_year: int
    ):
        """Process individual cryptocurrency transaction"""
        transaction_year = transaction.timestamp.year
        if transaction_year != tax_year:
            return  # Skip transactions from other years

        transaction_result = {
            'transaction_id': transaction.transaction_id,
            'timestamp': transaction.timestamp,
            'type': transaction.transaction_type.value,
            'taxable_event': False,
            'gain_loss': Decimal('0'),
            'ordinary_income': Decimal('0')
        }

        if transaction.transaction_type == CryptoTransactionType.BUY:
            self._process_buy_transaction(transaction, transaction_result)

        elif transaction.transaction_type == CryptoTransactionType.SELL:
            self._process_sell_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type == CryptoTransactionType.TRADE:
            self._process_trade_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type == CryptoTransactionType.MINING:
            self._process_mining_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type == CryptoTransactionType.STAKING:
            self._process_staking_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type == CryptoTransactionType.AIRDROP:
            self._process_airdrop_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type == CryptoTransactionType.HARD_FORK:
            self._process_hard_fork_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type in [CryptoTransactionType.DEFI_LENDING,
                                            CryptoTransactionType.LIQUIDITY_POOL]:
            self._process_defi_transaction(result, transaction, transaction_result)

        elif transaction.transaction_type in [CryptoTransactionType.NFT_PURCHASE,
                                            CryptoTransactionType.NFT_SALE]:
            self._process_nft_transaction(result, transaction, transaction_result)

        result.transaction_results.append(transaction_result)

    def _process_buy_transaction(self, transaction: CryptoTransaction, transaction_result: Dict):
        """Process cryptocurrency purchase"""
        if not transaction.to_currency or transaction.to_amount <= 0:
            return

        # Calculate cost basis per unit
        total_cost = transaction.usd_value + transaction.fee
        cost_per_unit = total_cost / transaction.to_amount

        # Create new holding
        holding = CryptoHolding(
            lot_id=f"{transaction.transaction_id}_{transaction.to_currency}",
            currency=transaction.to_currency,
            amount=transaction.to_amount,
            cost_basis_per_unit=cost_per_unit,
            acquisition_date=transaction.timestamp
        )

        # Add to holdings
        if transaction.to_currency not in self.holdings:
            self.holdings[transaction.to_currency] = []
        self.holdings[transaction.to_currency].append(holding)

        transaction_result.update({
            'currency': transaction.to_currency,
            'amount': transaction.to_amount,
            'cost_basis': total_cost,
            'cost_per_unit': cost_per_unit
        })

    def _process_sell_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process cryptocurrency sale"""
        if not transaction.from_currency or transaction.from_amount <= 0:
            return

        # Calculate proceeds
        proceeds = transaction.usd_value - transaction.fee

        # Determine cost basis using selected method
        cost_basis, holdings_used = self._calculate_cost_basis(
            transaction.from_currency,
            transaction.from_amount,
            transaction.specific_lot_id if self.cost_basis_method == CostBasisMethod.SPECIFIC_ID else None
        )

        # Calculate gain/loss
        gain_loss = proceeds - cost_basis

        # Determine if long-term or short-term
        is_long_term = all(
            (transaction.timestamp - holding['acquisition_date']).days > self.long_term_threshold_days
            for holding in holdings_used
        )

        # Record gain/loss
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

        transaction_result.update({
            'taxable_event': True,
            'currency': transaction.from_currency,
            'amount': transaction.from_amount,
            'proceeds': proceeds,
            'cost_basis': cost_basis,
            'gain_loss': gain_loss,
            'is_long_term': is_long_term
        })

    def _process_trade_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process crypto-to-crypto trade (taxable event)"""
        # Treat as disposal of from_currency and acquisition of to_currency
        if transaction.from_currency and transaction.from_amount > 0:
            # Calculate fair market value of disposed crypto
            fmv_disposed = transaction.usd_value

            # Calculate cost basis of disposed crypto
            cost_basis, holdings_used = self._calculate_cost_basis(
                transaction.from_currency,
                transaction.from_amount,
                transaction.specific_lot_id if self.cost_basis_method == CostBasisMethod.SPECIFIC_ID else None
            )

            # Calculate gain/loss
            gain_loss = fmv_disposed - cost_basis

            # Determine holding period
            is_long_term = all(
                (transaction.timestamp - holding['acquisition_date']).days > self.long_term_threshold_days
                for holding in holdings_used
            )

            # Record gain/loss
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

            transaction_result['gain_loss'] = gain_loss
            transaction_result['taxable_event'] = True

        # Add received cryptocurrency to holdings
        if transaction.to_currency and transaction.to_amount > 0:
            cost_per_unit = transaction.usd_value / transaction.to_amount

            holding = CryptoHolding(
                lot_id=f"{transaction.transaction_id}_{transaction.to_currency}",
                currency=transaction.to_currency,
                amount=transaction.to_amount,
                cost_basis_per_unit=cost_per_unit,
                acquisition_date=transaction.timestamp
            )

            if transaction.to_currency not in self.holdings:
                self.holdings[transaction.to_currency] = []
            self.holdings[transaction.to_currency].append(holding)

        transaction_result.update({
            'from_currency': transaction.from_currency,
            'from_amount': transaction.from_amount,
            'to_currency': transaction.to_currency,
            'to_amount': transaction.to_amount,
            'fair_market_value': transaction.usd_value
        })

    def _process_mining_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process mining income"""
        # Mining is ordinary income at fair market value
        mining_income = transaction.usd_value
        result.mining_income += mining_income

        # Add mined coins to holdings at FMV basis
        if transaction.to_currency and transaction.to_amount > 0:
            cost_per_unit = mining_income / transaction.to_amount

            holding = CryptoHolding(
                lot_id=f"{transaction.transaction_id}_{transaction.to_currency}",
                currency=transaction.to_currency,
                amount=transaction.to_amount,
                cost_basis_per_unit=cost_per_unit,
                acquisition_date=transaction.timestamp
            )

            if transaction.to_currency not in self.holdings:
                self.holdings[transaction.to_currency] = []
            self.holdings[transaction.to_currency].append(holding)

        transaction_result.update({
            'taxable_event': True,
            'ordinary_income': mining_income,
            'currency': transaction.to_currency,
            'amount': transaction.to_amount
        })

    def _process_staking_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process staking rewards"""
        # Staking rewards are ordinary income at fair market value
        staking_income = transaction.usd_value
        result.staking_income += staking_income

        # Add staking rewards to holdings at FMV basis
        if transaction.to_currency and transaction.to_amount > 0:
            cost_per_unit = staking_income / transaction.to_amount

            holding = CryptoHolding(
                lot_id=f"{transaction.transaction_id}_{transaction.to_currency}",
                currency=transaction.to_currency,
                amount=transaction.to_amount,
                cost_basis_per_unit=cost_per_unit,
                acquisition_date=transaction.timestamp
            )

            if transaction.to_currency not in self.holdings:
                self.holdings[transaction.to_currency] = []
            self.holdings[transaction.to_currency].append(holding)

        transaction_result.update({
            'taxable_event': True,
            'ordinary_income': staking_income,
            'currency': transaction.to_currency,
            'amount': transaction.to_amount
        })

    def _process_airdrop_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process airdrop income"""
        # Airdrops are ordinary income at fair market value
        airdrop_income = transaction.usd_value
        result.airdrop_income += airdrop_income

        # Add airdropped tokens to holdings at FMV basis
        if transaction.to_currency and transaction.to_amount > 0:
            cost_per_unit = airdrop_income / transaction.to_amount if transaction.to_amount > 0 else Decimal('0')

            holding = CryptoHolding(
                lot_id=f"{transaction.transaction_id}_{transaction.to_currency}",
                currency=transaction.to_currency,
                amount=transaction.to_amount,
                cost_basis_per_unit=cost_per_unit,
                acquisition_date=transaction.timestamp
            )

            if transaction.to_currency not in self.holdings:
                self.holdings[transaction.to_currency] = []
            self.holdings[transaction.to_currency].append(holding)

        transaction_result.update({
            'taxable_event': True,
            'ordinary_income': airdrop_income,
            'currency': transaction.to_currency,
            'amount': transaction.to_amount
        })

    def _process_hard_fork_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process hard fork income"""
        # Hard forks may be ordinary income at fair market value
        hard_fork_income = transaction.usd_value
        result.hard_fork_income += hard_fork_income

        # Add forked coins to holdings at FMV basis
        if transaction.to_currency and transaction.to_amount > 0:
            cost_per_unit = hard_fork_income / transaction.to_amount if transaction.to_amount > 0 else Decimal('0')

            holding = CryptoHolding(
                lot_id=f"{transaction.transaction_id}_{transaction.to_currency}",
                currency=transaction.to_currency,
                amount=transaction.to_amount,
                cost_basis_per_unit=cost_per_unit,
                acquisition_date=transaction.timestamp
            )

            if transaction.to_currency not in self.holdings:
                self.holdings[transaction.to_currency] = []
            self.holdings[transaction.to_currency].append(holding)

        transaction_result.update({
            'taxable_event': True,
            'ordinary_income': hard_fork_income,
            'currency': transaction.to_currency,
            'amount': transaction.to_amount
        })

    def _process_defi_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process DeFi transactions"""
        # DeFi income is generally ordinary income
        defi_income = transaction.usd_value
        result.defi_income += defi_income

        transaction_result.update({
            'taxable_event': True,
            'ordinary_income': defi_income,
            'protocol': transaction.defi_protocol
        })

    def _process_nft_transaction(self, result: CryptoTaxResult, transaction: CryptoTransaction, transaction_result: Dict):
        """Process NFT transactions"""
        if transaction.transaction_type == CryptoTransactionType.NFT_SALE:
            # NFT sale is capital gain/loss
            proceeds = transaction.usd_value - transaction.fee

            # For simplicity, assume zero basis unless specified
            cost_basis = Decimal('0')  # This should be tracked separately for NFTs
            gain_loss = proceeds - cost_basis

            # Assume short-term for NFTs unless proven otherwise
            result.short_term_capital_gains += max(gain_loss, Decimal('0'))
            result.short_term_capital_losses += max(-gain_loss, Decimal('0'))

            transaction_result.update({
                'taxable_event': True,
                'gain_loss': gain_loss,
                'proceeds': proceeds,
                'cost_basis': cost_basis
            })

    def _calculate_cost_basis(
        self,
        currency: str,
        amount: Decimal,
        specific_lot_id: Optional[str] = None
    ) -> Tuple[Decimal, List[Dict]]:
        """Calculate cost basis using selected method"""
        if currency not in self.holdings or not self.holdings[currency]:
            return Decimal('0'), []

        holdings_used = []
        total_cost_basis = Decimal('0')
        remaining_amount = amount

        if self.cost_basis_method == CostBasisMethod.SPECIFIC_ID and specific_lot_id:
            # Use specific lot
            for i, holding in enumerate(self.holdings[currency]):
                if holding.lot_id == specific_lot_id:
                    used_amount = min(remaining_amount, holding.amount)
                    cost_basis = used_amount * holding.cost_basis_per_unit
                    total_cost_basis += cost_basis

                    holdings_used.append({
                        'acquisition_date': holding.acquisition_date,
                        'amount': used_amount,
                        'cost_basis': cost_basis
                    })

                    # Update holding
                    holding.amount -= used_amount
                    if holding.amount <= 0:
                        self.holdings[currency].pop(i)

                    break

        elif self.cost_basis_method == CostBasisMethod.FIFO:
            # First In, First Out
            holdings = sorted(self.holdings[currency], key=lambda h: h.acquisition_date)
            for holding in holdings[:]:
                if remaining_amount <= 0:
                    break

                used_amount = min(remaining_amount, holding.amount)
                cost_basis = used_amount * holding.cost_basis_per_unit
                total_cost_basis += cost_basis

                holdings_used.append({
                    'acquisition_date': holding.acquisition_date,
                    'amount': used_amount,
                    'cost_basis': cost_basis
                })

                holding.amount -= used_amount
                remaining_amount -= used_amount

                if holding.amount <= 0:
                    self.holdings[currency].remove(holding)

        elif self.cost_basis_method == CostBasisMethod.LIFO:
            # Last In, First Out
            holdings = sorted(self.holdings[currency], key=lambda h: h.acquisition_date, reverse=True)
            for holding in holdings[:]:
                if remaining_amount <= 0:
                    break

                used_amount = min(remaining_amount, holding.amount)
                cost_basis = used_amount * holding.cost_basis_per_unit
                total_cost_basis += cost_basis

                holdings_used.append({
                    'acquisition_date': holding.acquisition_date,
                    'amount': used_amount,
                    'cost_basis': cost_basis
                })

                holding.amount -= used_amount
                remaining_amount -= used_amount

                if holding.amount <= 0:
                    self.holdings[currency].remove(holding)

        return total_cost_basis, holdings_used

    def _process_mining_operations(self, result: CryptoTaxResult, mining_operations: List[MiningOperation], tax_year: int):
        """Process mining operations for business tax treatment"""
        for operation in mining_operations:
            if operation.start_date.year <= tax_year <= (operation.end_date.year if operation.end_date else tax_year):
                if operation.is_business_activity:
                    # Treat as business income/expenses
                    # Income would be from mining transactions
                    result.mining_business_expenses += (
                        operation.equipment_cost +
                        operation.electricity_cost +
                        operation.other_expenses
                    )

    def _process_staking_rewards(self, result: CryptoTaxResult, staking_rewards: List[StakingReward], tax_year: int):
        """Process staking rewards"""
        for reward in staking_rewards:
            if reward.timestamp.year == tax_year:
                result.staking_income += reward.usd_value

    def _calculate_totals(self, result: CryptoTaxResult):
        """Calculate total results"""
        result.net_capital_gain_loss = (
            result.short_term_capital_gains - result.short_term_capital_losses +
            result.long_term_capital_gains - result.long_term_capital_losses
        )

        result.total_ordinary_income = (
            result.mining_income +
            result.staking_income +
            result.airdrop_income +
            result.hard_fork_income +
            result.defi_income
        )

        result.net_mining_business_income = result.mining_business_income - result.mining_business_expenses

    def _calculate_portfolio_value(self, result: CryptoTaxResult):
        """Calculate current portfolio cost basis and holdings"""
        total_cost_basis = Decimal('0')

        for currency, holdings in self.holdings.items():
            for holding in holdings:
                total_cost = holding.amount * holding.cost_basis_per_unit
                total_cost_basis += total_cost

                result.current_holdings.append(holding)

        result.total_portfolio_cost_basis = total_cost_basis
# Investment Tax Calculations Package
# Handles various investment-related tax calculations

__version__ = "1.0.0"
__author__ = "GlobalTaxCalc Development Team"

from .capital_gains import CapitalGainsCalculator, CapitalAsset, CapitalTransaction, CapitalGainsResult
from .crypto_tax import (
    CryptocurrencyTaxCalculator,
    CryptoCurrency,
    CryptoTransaction,
    CryptoTaxResult,
    CostBasisMethod,
    CryptoTransactionType
)

__all__ = [
    'CapitalGainsCalculator',
    'CapitalAsset',
    'CapitalTransaction',
    'CapitalGainsResult',
    'CryptocurrencyTaxCalculator',
    'CryptoCurrency',
    'CryptoTransaction',
    'CryptoTaxResult',
    'CostBasisMethod',
    'CryptoTransactionType'
]
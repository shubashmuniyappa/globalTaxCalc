# Advanced Tax Engine for GlobalTaxCalc
# Comprehensive tax calculation system for complex scenarios

__version__ = "1.0.0"
__author__ = "GlobalTaxCalc Development Team"

from .core.tax_engine import AdvancedTaxEngine
from .business.corporate_tax import CorporateTaxCalculator
from .business.partnership_tax import PartnershipTaxCalculator
from .business.self_employment import SelfEmploymentTaxCalculator
from .investments.capital_gains import CapitalGainsCalculator
from .investments.crypto_tax import CryptocurrencyTaxCalculator
from .international.foreign_income import ForeignIncomeCalculator
from .international.tax_treaties import TaxTreatyCalculator
from .estate.estate_tax import EstateTaxCalculator
from .estate.gift_tax import GiftTaxCalculator
from .amt.amt_calculator import AMTCalculator
from .multistate.state_tax import MultiStateTaxCalculator
from .planning.tax_planning import TaxPlanningEngine
from .specialized.niit import NetInvestmentIncomeTaxCalculator

__all__ = [
    'AdvancedTaxEngine',
    'CorporateTaxCalculator',
    'PartnershipTaxCalculator',
    'SelfEmploymentTaxCalculator',
    'CapitalGainsCalculator',
    'CryptocurrencyTaxCalculator',
    'ForeignIncomeCalculator',
    'TaxTreatyCalculator',
    'EstateTaxCalculator',
    'GiftTaxCalculator',
    'AMTCalculator',
    'MultiStateTaxCalculator',
    'TaxPlanningEngine',
    'NetInvestmentIncomeTaxCalculator'
]
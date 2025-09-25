# International Tax Calculations Package
# Handles international tax compliance and calculations

__version__ = "1.0.0"
__author__ = "GlobalTaxCalc Development Team"

from .foreign_income import (
    ForeignIncomeCalculator,
    ForeignCountry,
    ForeignIncomeItem,
    ForeignEarnedIncomeInfo,
    ControlledForeignCorporation,
    PFICInvestment,
    ForeignIncomeResult,
    IncomeType,
    ForeignTaxCreditBasket
)

from .tax_treaties import (
    TaxTreatyCalculator,
    TaxTreaty,
    TreatyBenefit,
    DualResident,
    PermanentEstablishment,
    LimitationOnBenefits,
    TreatyCalculationResult,
    TreatyIncomeType,
    ResidencyTest
)

__all__ = [
    'ForeignIncomeCalculator',
    'ForeignCountry',
    'ForeignIncomeItem',
    'ForeignEarnedIncomeInfo',
    'ControlledForeignCorporation',
    'PFICInvestment',
    'ForeignIncomeResult',
    'IncomeType',
    'ForeignTaxCreditBasket',
    'TaxTreatyCalculator',
    'TaxTreaty',
    'TreatyBenefit',
    'DualResident',
    'PermanentEstablishment',
    'LimitationOnBenefits',
    'TreatyCalculationResult',
    'TreatyIncomeType',
    'ResidencyTest'
]
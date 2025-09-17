"""
Pydantic models for the tax engine
"""

from .tax_calculation import *
from .tax_optimization import *
from .health import *

__all__ = [
    "TaxCalculationRequest",
    "TaxCalculationResponse",
    "IncomeItem",
    "DeductionItem",
    "TaxBracket",
    "TaxOptimizationRequest",
    "TaxOptimizationResponse",
    "OptimizationSuggestion",
    "HealthResponse",
    "SystemInfo"
]
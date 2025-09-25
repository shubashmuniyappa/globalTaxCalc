"""
Competitive Intelligence Package

This package provides comprehensive competitive intelligence capabilities
for GlobalTaxCalc.com analytics platform including competitor monitoring,
market analysis, and strategic insights.
"""

from .market_analysis import (
    CompetitiveIntelligenceEngine,
    CompetitorData,
    MarketTrend,
    PricePoint
)

__all__ = [
    'CompetitiveIntelligenceEngine',
    'CompetitorData',
    'MarketTrend',
    'PricePoint'
]
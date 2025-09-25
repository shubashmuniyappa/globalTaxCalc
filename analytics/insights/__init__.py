"""
Insights Package

This package provides automated insights generation capabilities
for GlobalTaxCalc.com analytics platform including anomaly detection,
trend analysis, and intelligent business insights.
"""

from .automated_insights import (
    AutomatedInsightsEngine,
    Insight,
    TrendAnalysis
)

__all__ = [
    'AutomatedInsightsEngine',
    'Insight',
    'TrendAnalysis'
]
"""
Funnel Analysis Package

This package provides comprehensive funnel analysis and optimization capabilities
for GlobalTaxCalc.com analytics platform.
"""

from .conversion_funnel import ConversionFunnelAnalyzer, FunnelStep, CohortAnalysisResult
from .funnel_optimization import FunnelOptimizer, OptimizationRecommendation, BottleneckAnalysis

__all__ = [
    'ConversionFunnelAnalyzer',
    'FunnelStep',
    'CohortAnalysisResult',
    'FunnelOptimizer',
    'OptimizationRecommendation',
    'BottleneckAnalysis'
]
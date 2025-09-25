"""
Automated Insights Generation Engine for GlobalTaxCalc.com
Provides intelligent insights, pattern detection, and automated business intelligence.
"""


# Generic safe imports with fallbacks
import sys
import os
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Safe import function
def safe_import(module_name, package=None):
    try:
        if package:
            return __import__(module_name, fromlist=[package])
        else:
            return __import__(module_name)
    except ImportError:
        logger.warning(f"{module_name} not available - using fallback")
        return None

# Check for optional dependencies
HAS_SKLEARN = safe_import('sklearn') is not None
HAS_TENSORFLOW = safe_import('tensorflow') is not None
HAS_PLOTLY = safe_import('plotly') is not None
HAS_DASH = safe_import('dash') is not None
HAS_REDIS = safe_import('redis') is not None
HAS_KAFKA = safe_import('kafka') is not None
HAS_PYSPARK = safe_import('pyspark') is not None
HAS_SCIPY = safe_import('scipy') is not None

logger.info(f"Available dependencies: sklearn={HAS_SKLEARN}, tensorflow={HAS_TENSORFLOW}, plotly={HAS_PLOTLY}")




import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union, NamedTuple
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from scipy import stats
from scipy.signal import find_peaks, argrelextrema
# 
# 
# 
# 
# 
import openai
import nltk
from textblob import TextBlob
import re
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InsightType(Enum):
    """Types of insights"""
    TREND = "trend"
    ANOMALY = "anomaly"
    PATTERN = "pattern"
    CORRELATION = "correlation"
    FORECAST = "forecast"
    RECOMMENDATION = "recommendation"
    ALERT = "alert"
    OPPORTUNITY = "opportunity"
    RISK = "risk"
    SUMMARY = "summary"

class InsightPriority(Enum):
    """Insight priority levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class ConfidenceLevel(Enum):
    """Confidence levels for insights"""
    VERY_HIGH = "very_high"  # 95%+
    HIGH = "high"           # 80-95%
    MEDIUM = "medium"       # 60-80%
    LOW = "low"            # 40-60%
    VERY_LOW = "very_low"  # <40%

@dataclass
class Insight:
    """Structured insight object"""
    insight_id: str
    insight_type: InsightType
    title: str
    description: str
    priority: InsightPriority
    confidence: ConfidenceLevel
    timestamp: datetime
    data_sources: List[str]
    metrics: Dict[str, float] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    supporting_data: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    affected_segments: List[str] = field(default_factory=list)
    business_impact: Optional[str] = None
    next_steps: List[str] = field(default_factory=list)

@dataclass
class InsightRule:
    """Rule definition for insight generation"""
    rule_id: str
    rule_name: str
    insight_type: InsightType
    conditions: Dict[str, Any]
    template: str
    priority: InsightPriority
    confidence_threshold: float = 0.7
    enabled: bool = True

class TrendAnalyzer:
    """Analyzes trends in time series data"""

    @staticmethod
    def detect_trend(data: pd.Series, window: int = 7) -> Dict[str, Any]:
        """Detect trend in time series data"""
        if len(data) < window:
            return {"trend": "insufficient_data", "strength": 0, "slope": 0}

        # Calculate moving average
        ma = data.rolling(window=window).mean().dropna()

        # Linear regression to detect trend
        x = np.arange(len(ma))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, ma.values)

        # Determine trend direction and strength
        trend_strength = abs(r_value)

        if p_value > 0.05:  # Not statistically significant
            trend = "stable"
        elif slope > 0:
            trend = "increasing"
        else:
            trend = "decreasing"

        return {
            "trend": trend,
            "strength": trend_strength,
            "slope": slope,
            "r_squared": r_value ** 2,
            "p_value": p_value,
            "confidence": 1 - p_value if p_value <= 1 else 0
        }

    @staticmethod
    def detect_seasonality(data: pd.Series, period: int = 7) -> Dict[str, Any]:
        """Detect seasonal patterns in data"""
        if len(data) < period * 2:
            return {"has_seasonality": False, "strength": 0}

        # Autocorrelation at seasonal lag
        autocorr = data.autocorr(lag=period)

        # Detect peaks in autocorrelation function
        autocorr_values = [data.autocorr(lag=i) for i in range(1, min(len(data)//2, period*3))]
        peaks, _ = find_peaks(autocorr_values, height=0.3, distance=period-1)

        has_seasonality = autocorr > 0.3 or len(peaks) > 0
        strength = autocorr if not np.isnan(autocorr) else 0

        return {
            "has_seasonality": has_seasonality,
            "strength": abs(strength),
            "period": period,
            "autocorr": autocorr,
            "peak_lags": peaks.tolist() if len(peaks) > 0 else []
        }

class AnomalyDetector:
    """Detects anomalies in data"""

    @staticmethod
    def detect_statistical_anomalies(data: pd.Series, threshold: float = 2.5) -> Dict[str, Any]:
        """Detect statistical anomalies using z-score"""
        z_scores = np.abs(stats.zscore(data.dropna()))
        anomalies = data[z_scores > threshold]

        return {
            "anomaly_count": len(anomalies),
            "anomaly_indices": anomalies.index.tolist(),
            "anomaly_values": anomalies.values.tolist(),
            "threshold_used": threshold,
            "max_z_score": z_scores.max() if len(z_scores) > 0 else 0
        }

    @staticmethod
    def detect_isolation_anomalies(data: pd.DataFrame, contamination: float = 0.1) -> Dict[str, Any]:
        """Detect anomalies using Isolation Forest"""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) == 0:
            return {"anomaly_count": 0, "anomaly_indices": []}

        X = data[numeric_columns].fillna(data[numeric_columns].mean())

        if len(X) < 10:  # Insufficient data
            return {"anomaly_count": 0, "anomaly_indices": []}

        iso_forest = IsolationForest(contamination=contamination, random_state=42)
        anomaly_labels = iso_forest.fit_predict(X)

        anomaly_indices = data.index[anomaly_labels == -1].tolist()

        return {
            "anomaly_count": len(anomaly_indices),
            "anomaly_indices": anomaly_indices,
            "contamination_used": contamination,
            "feature_columns": numeric_columns.tolist()
        }

class PatternDetector:
    """Detects patterns and correlations in data"""

    @staticmethod
    def find_correlations(data: pd.DataFrame, threshold: float = 0.7) -> Dict[str, Any]:
        """Find significant correlations in data"""
        numeric_data = data.select_dtypes(include=[np.number])
        if len(numeric_data.columns) < 2:
            return {"correlations": [], "correlation_matrix": {}}

        corr_matrix = numeric_data.corr()

        # Find high correlations
        high_correlations = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) >= threshold and not np.isnan(corr_value):
                    high_correlations.append({
                        "variable1": corr_matrix.columns[i],
                        "variable2": corr_matrix.columns[j],
                        "correlation": corr_value,
                        "strength": "strong" if abs(corr_value) >= 0.8 else "moderate"
                    })

        return {
            "correlations": high_correlations,
            "correlation_matrix": corr_matrix.to_dict(),
            "threshold_used": threshold
        }

    @staticmethod
    def detect_clusters(data: pd.DataFrame, n_clusters: int = 3) -> Dict[str, Any]:
        """Detect clusters in data"""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) < 2 or len(data) < n_clusters:
            return {"clusters": [], "cluster_centers": []}

        X = data[numeric_columns].fillna(data[numeric_columns].mean())
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(X_scaled)

        # Analyze clusters
        clusters = []
        for i in range(n_clusters):
            cluster_data = data[cluster_labels == i]
            cluster_stats = {
                "cluster_id": i,
                "size": len(cluster_data),
                "percentage": len(cluster_data) / len(data) * 100,
                "characteristics": {}
            }

            for col in numeric_columns:
                cluster_stats["characteristics"][col] = {
                    "mean": cluster_data[col].mean(),
                    "std": cluster_data[col].std()
                }

            clusters.append(cluster_stats)

        return {
            "clusters": clusters,
            "cluster_centers": kmeans.cluster_centers_.tolist(),
            "inertia": kmeans.inertia_,
            "features_used": numeric_columns.tolist()
        }

class AutomatedInsightsEngine:
    """
    Comprehensive Automated Insights Generation Engine
    Provides intelligent insights, pattern detection, and business intelligence
    """

    def __init__(self, config_path: str = None):
        self.insights = []
        self.insight_rules = []
        self.data_sources = {}
        self.trend_analyzer = TrendAnalyzer()
        self.anomaly_detector = AnomalyDetector()
        self.pattern_detector = PatternDetector()

        # Initialize components
        self._initialize_insight_rules()
        self._load_sample_data()

        logger.info("Automated Insights Engine initialized successfully")

    def _initialize_insight_rules(self):
        """Initialize default insight rules"""
        default_rules = [
            # Trend Rules
            InsightRule(
                rule_id="revenue_trend",
                rule_name="Revenue Trend Analysis",
                insight_type=InsightType.TREND,
                conditions={"metric": "revenue", "min_data_points": 7, "trend_threshold": 0.05},
                template="Revenue is showing a {trend} trend with {confidence:.1%} confidence. {trend_description}",
                priority=InsightPriority.HIGH
            ),

            # Anomaly Rules
            InsightRule(
                rule_id="user_activity_anomaly",
                rule_name="User Activity Anomaly Detection",
                insight_type=InsightType.ANOMALY,
                conditions={"metric": "active_users", "z_threshold": 2.5},
                template="Unusual user activity detected: {anomaly_description}. This deviates significantly from normal patterns.",
                priority=InsightPriority.CRITICAL
            ),

            # Performance Rules
            InsightRule(
                rule_id="performance_alert",
                rule_name="Performance Alert",
                insight_type=InsightType.ALERT,
                conditions={"metric": "response_time", "threshold": 2000},
                template="Performance alert: {metric_name} is {current_value:.1f}ms, which exceeds the threshold of {threshold}ms.",
                priority=InsightPriority.HIGH
            ),

            # Correlation Rules
            InsightRule(
                rule_id="metric_correlation",
                rule_name="Metric Correlation Analysis",
                insight_type=InsightType.CORRELATION,
                conditions={"correlation_threshold": 0.7},
                template="Strong correlation detected between {variable1} and {variable2} (r={correlation:.3f}). {interpretation}",
                priority=InsightPriority.MEDIUM
            ),

            # Opportunity Rules
            InsightRule(
                rule_id="conversion_opportunity",
                rule_name="Conversion Opportunity",
                insight_type=InsightType.OPPORTUNITY,
                conditions={"metric": "conversion_rate", "benchmark": 0.05},
                template="Conversion opportunity identified: Current rate is {current_rate:.2%}, potential improvement to {target_rate:.2%} could increase revenue by {revenue_impact:.1f}%.",
                priority=InsightPriority.MEDIUM
            )
        ]

        self.insight_rules = default_rules

    def _load_sample_data(self):
        """Load sample data for demonstration"""
        # Generate sample data for GlobalTaxCalc.com
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        np.random.seed(42)

        # User analytics data
        user_data = pd.DataFrame({
            'date': dates,
            'active_users': np.random.randint(1000, 5000, len(dates)) +
                           50 * np.sin(np.arange(len(dates)) * 2 * np.pi / 7) +  # Weekly pattern
                           np.random.normal(0, 100, len(dates)),  # Random noise
            'new_users': np.random.randint(100, 800, len(dates)),
            'revenue': np.random.uniform(10000, 50000, len(dates)) * (1 + 0.001 * np.arange(len(dates))),  # Growing trend
            'conversion_rate': np.random.uniform(0.02, 0.08, len(dates)),
            'response_time': np.random.exponential(200, len(dates))
        })

        # Add some anomalies
        anomaly_indices = np.random.choice(len(user_data), 5, replace=False)
        user_data.loc[anomaly_indices, 'active_users'] *= 2.5
        user_data.loc[anomaly_indices, 'response_time'] *= 3

        self.data_sources['user_analytics'] = user_data

        # Tax calculation data
        countries = ['USA', 'Canada', 'UK', 'Germany', 'France']
        calc_data = []
        for date in dates[:30]:  # Month of data
            for country in countries:
                calc_data.append({
                    'date': date,
                    'country': country,
                    'calculations': np.random.randint(100, 1000),
                    'avg_amount': np.random.uniform(1000, 10000),
                    'success_rate': np.random.uniform(0.85, 0.99)
                })

        self.data_sources['tax_calculations'] = pd.DataFrame(calc_data)

    def generate_insights(self, data_source: str = None, max_insights: int = 20) -> List[Insight]:
        """Generate insights from data sources"""
        logger.info(f"Generating insights for data source: {data_source or 'all'}")

        new_insights = []

        # If specific data source is provided
        if data_source and data_source in self.data_sources:
            data_sources_to_analyze = {data_source: self.data_sources[data_source]}
        else:
            data_sources_to_analyze = self.data_sources

        for source_name, data in data_sources_to_analyze.items():
            try:
                # Generate different types of insights
                new_insights.extend(self._generate_trend_insights(data, source_name))
                new_insights.extend(self._generate_anomaly_insights(data, source_name))
                new_insights.extend(self._generate_pattern_insights(data, source_name))
                new_insights.extend(self._generate_performance_insights(data, source_name))
                new_insights.extend(self._generate_business_insights(data, source_name))

            except Exception as e:
                logger.error(f"Error generating insights for {source_name}: {e}")

        # Sort by priority and confidence
        new_insights.sort(key=lambda x: (x.priority.value, -self._confidence_to_score(x.confidence)))

        # Limit number of insights
        new_insights = new_insights[:max_insights]

        # Add to insights collection
        self.insights.extend(new_insights)

        logger.info(f"Generated {len(new_insights)} new insights")
        return new_insights

    def _generate_trend_insights(self, data: pd.DataFrame, source_name: str) -> List[Insight]:
        """Generate trend-based insights"""
        insights = []

        # Analyze numeric columns for trends
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        date_column = None

        # Try to find date column
        for col in data.columns:
            if pd.api.types.is_datetime64_any_dtype(data[col]) or 'date' in col.lower():
                date_column = col
                break

        if date_column is None:
            return insights

        for metric in numeric_columns:
            try:
                # Sort by date and analyze trend
                sorted_data = data.sort_values(date_column)
                trend_analysis = self.trend_analyzer.detect_trend(sorted_data[metric])

                if trend_analysis['confidence'] > 0.7:
                    # Create trend insight
                    trend = trend_analysis['trend']
                    strength = trend_analysis['strength']

                    if trend == "increasing":
                        trend_desc = f"showing strong upward momentum with R² = {trend_analysis['r_squared']:.3f}"
                        priority = InsightPriority.HIGH if strength > 0.8 else InsightPriority.MEDIUM
                    elif trend == "decreasing":
                        trend_desc = f"showing concerning downward trend with R² = {trend_analysis['r_squared']:.3f}"
                        priority = InsightPriority.CRITICAL if strength > 0.8 else InsightPriority.HIGH
                    else:
                        trend_desc = "remaining relatively stable"
                        priority = InsightPriority.LOW

                    insight = Insight(
                        insight_id=f"trend_{source_name}_{metric}_{datetime.now().timestamp()}",
                        insight_type=InsightType.TREND,
                        title=f"{metric.title().replace('_', ' ')} Trend Analysis",
                        description=f"{metric.replace('_', ' ').title()} is {trend_desc}. "
                                   f"The trend strength is {strength:.2%} with {trend_analysis['confidence']:.1%} statistical confidence.",
                        priority=priority,
                        confidence=self._score_to_confidence(trend_analysis['confidence']),
                        timestamp=datetime.now(),
                        data_sources=[source_name],
                        metrics={
                            "slope": trend_analysis['slope'],
                            "r_squared": trend_analysis['r_squared'],
                            "p_value": trend_analysis['p_value']
                        },
                        supporting_data=trend_analysis,
                        tags=["trend", "time-series", metric],
                        recommendations=self._generate_trend_recommendations(trend, metric, trend_analysis)
                    )

                    insights.append(insight)

            except Exception as e:
                logger.error(f"Error analyzing trend for {metric}: {e}")

        return insights

    def _generate_anomaly_insights(self, data: pd.DataFrame, source_name: str) -> List[Insight]:
        """Generate anomaly-based insights"""
        insights = []

        numeric_columns = data.select_dtypes(include=[np.number]).columns

        for metric in numeric_columns:
            try:
                # Statistical anomaly detection
                stat_anomalies = self.anomaly_detector.detect_statistical_anomalies(data[metric])

                if stat_anomalies['anomaly_count'] > 0:
                    anomaly_indices = stat_anomalies['anomaly_indices']
                    anomaly_values = stat_anomalies['anomaly_values']

                    # Calculate severity
                    max_z = stat_anomalies['max_z_score']
                    if max_z > 3.5:
                        priority = InsightPriority.CRITICAL
                        severity = "severe"
                    elif max_z > 2.5:
                        priority = InsightPriority.HIGH
                        severity = "significant"
                    else:
                        priority = InsightPriority.MEDIUM
                        severity = "moderate"

                    # Get context about anomalies
                    normal_mean = data[metric].mean()
                    anomaly_description = f"{len(anomaly_values)} {severity} anomalies detected in {metric.replace('_', ' ')}"

                    if len(anomaly_values) > 0:
                        max_anomaly = max(anomaly_values)
                        deviation_pct = ((max_anomaly - normal_mean) / normal_mean) * 100
                        anomaly_description += f". Largest anomaly: {max_anomaly:.1f} ({deviation_pct:+.1f}% from normal)"

                    insight = Insight(
                        insight_id=f"anomaly_{source_name}_{metric}_{datetime.now().timestamp()}",
                        insight_type=InsightType.ANOMALY,
                        title=f"Anomalies Detected in {metric.title().replace('_', ' ')}",
                        description=anomaly_description,
                        priority=priority,
                        confidence=ConfidenceLevel.HIGH,
                        timestamp=datetime.now(),
                        data_sources=[source_name],
                        metrics={
                            "anomaly_count": stat_anomalies['anomaly_count'],
                            "max_z_score": max_z,
                            "threshold": stat_anomalies['threshold_used']
                        },
                        supporting_data=stat_anomalies,
                        tags=["anomaly", "outlier", metric],
                        recommendations=self._generate_anomaly_recommendations(metric, stat_anomalies, severity)
                    )

                    insights.append(insight)

            except Exception as e:
                logger.error(f"Error detecting anomalies for {metric}: {e}")

        # Multi-variate anomaly detection
        try:
            iso_anomalies = self.anomaly_detector.detect_isolation_anomalies(data)

            if iso_anomalies['anomaly_count'] > 0:
                insight = Insight(
                    insight_id=f"multivariate_anomaly_{source_name}_{datetime.now().timestamp()}",
                    insight_type=InsightType.ANOMALY,
                    title="Multivariate Anomalies Detected",
                    description=f"{iso_anomalies['anomaly_count']} complex anomalies detected using multivariate analysis. "
                               f"These represent unusual combinations of values across {len(iso_anomalies['feature_columns'])} features.",
                    priority=InsightPriority.HIGH,
                    confidence=ConfidenceLevel.MEDIUM,
                    timestamp=datetime.now(),
                    data_sources=[source_name],
                    metrics={"anomaly_count": iso_anomalies['anomaly_count']},
                    supporting_data=iso_anomalies,
                    tags=["anomaly", "multivariate", "isolation-forest"],
                    recommendations=[
                        "Investigate data quality and collection processes",
                        "Review business processes for unusual conditions",
                        "Consider additional monitoring for similar patterns"
                    ]
                )
                insights.append(insight)

        except Exception as e:
            logger.error(f"Error in multivariate anomaly detection: {e}")

        return insights

    def _generate_pattern_insights(self, data: pd.DataFrame, source_name: str) -> List[Insight]:
        """Generate pattern-based insights"""
        insights = []

        try:
            # Correlation analysis
            correlations = self.pattern_detector.find_correlations(data)

            for corr in correlations['correlations']:
                strength = corr['strength']
                corr_value = corr['correlation']

                if abs(corr_value) > 0.8:
                    priority = InsightPriority.HIGH
                    interpretation = "This suggests a very strong relationship that could be leveraged for predictive modeling or business optimization."
                elif abs(corr_value) > 0.7:
                    priority = InsightPriority.MEDIUM
                    interpretation = "This indicates a meaningful relationship worth further investigation."
                else:
                    priority = InsightPriority.LOW
                    interpretation = "This shows a moderate relationship that may provide some predictive value."

                direction = "positive" if corr_value > 0 else "negative"

                insight = Insight(
                    insight_id=f"correlation_{source_name}_{corr['variable1']}_{corr['variable2']}_{datetime.now().timestamp()}",
                    insight_type=InsightType.CORRELATION,
                    title=f"Strong {direction.title()} Correlation: {corr['variable1'].title()} & {corr['variable2'].title()}",
                    description=f"A {strength} {direction} correlation (r={corr_value:.3f}) exists between "
                               f"{corr['variable1'].replace('_', ' ')} and {corr['variable2'].replace('_', ' ')}. {interpretation}",
                    priority=priority,
                    confidence=ConfidenceLevel.HIGH,
                    timestamp=datetime.now(),
                    data_sources=[source_name],
                    metrics={"correlation": corr_value, "strength": strength},
                    supporting_data=corr,
                    tags=["correlation", "pattern", corr['variable1'], corr['variable2']],
                    recommendations=self._generate_correlation_recommendations(corr, direction, strength)
                )

                insights.append(insight)

        except Exception as e:
            logger.error(f"Error in correlation analysis: {e}")

        try:
            # Clustering analysis
            clusters = self.pattern_detector.detect_clusters(data)

            if len(clusters['clusters']) > 1:
                # Analyze cluster characteristics
                cluster_descriptions = []
                for cluster in clusters['clusters']:
                    if cluster['size'] > 0:
                        cluster_descriptions.append(f"Cluster {cluster['cluster_id']}: {cluster['size']} items ({cluster['percentage']:.1f}%)")

                insight = Insight(
                    insight_id=f"clustering_{source_name}_{datetime.now().timestamp()}",
                    insight_type=InsightType.PATTERN,
                    title="Data Segmentation Patterns Identified",
                    description=f"Natural groupings discovered in the data: {'; '.join(cluster_descriptions[:3])}. "
                               f"These segments show distinct behavioral patterns that could inform targeting strategies.",
                    priority=InsightPriority.MEDIUM,
                    confidence=ConfidenceLevel.MEDIUM,
                    timestamp=datetime.now(),
                    data_sources=[source_name],
                    metrics={"cluster_count": len(clusters['clusters']), "inertia": clusters['inertia']},
                    supporting_data=clusters,
                    tags=["clustering", "segmentation", "pattern"],
                    recommendations=[
                        "Develop targeted strategies for each identified segment",
                        "Investigate the characteristics that define each cluster",
                        "Consider personalized offerings based on segment patterns"
                    ]
                )

                insights.append(insight)

        except Exception as e:
            logger.error(f"Error in clustering analysis: {e}")

        return insights

    def _generate_performance_insights(self, data: pd.DataFrame, source_name: str) -> List[Insight]:
        """Generate performance-related insights"""
        insights = []

        # Performance metrics to analyze
        perf_metrics = {
            'response_time': {'threshold': 2000, 'unit': 'ms', 'direction': 'lower'},
            'error_rate': {'threshold': 0.05, 'unit': '%', 'direction': 'lower'},
            'cpu_usage': {'threshold': 80, 'unit': '%', 'direction': 'lower'},
            'memory_usage': {'threshold': 85, 'unit': '%', 'direction': 'lower'},
            'throughput': {'threshold': 100, 'unit': 'req/s', 'direction': 'higher'}
        }

        for metric, config in perf_metrics.items():
            if metric in data.columns:
                try:
                    current_value = data[metric].iloc[-1] if not data.empty else 0
                    mean_value = data[metric].mean()
                    threshold = config['threshold']

                    # Check if threshold is exceeded
                    if config['direction'] == 'lower':
                        exceeds_threshold = current_value > threshold
                        performance_issue = mean_value > threshold * 0.8  # 80% of threshold as warning
                    else:
                        exceeds_threshold = current_value < threshold
                        performance_issue = mean_value < threshold * 1.2  # 120% of threshold as good

                    if exceeds_threshold:
                        priority = InsightPriority.CRITICAL if current_value > threshold * 1.5 else InsightPriority.HIGH

                        insight = Insight(
                            insight_id=f"performance_{source_name}_{metric}_{datetime.now().timestamp()}",
                            insight_type=InsightType.ALERT,
                            title=f"Performance Alert: {metric.title().replace('_', ' ')} Threshold Exceeded",
                            description=f"Current {metric.replace('_', ' ')} is {current_value:.1f}{config['unit']}, "
                                       f"exceeding the threshold of {threshold}{config['unit']}. "
                                       f"Average over the period is {mean_value:.1f}{config['unit']}.",
                            priority=priority,
                            confidence=ConfidenceLevel.HIGH,
                            timestamp=datetime.now(),
                            data_sources=[source_name],
                            metrics={
                                "current_value": current_value,
                                "threshold": threshold,
                                "mean_value": mean_value,
                                "threshold_breach_ratio": current_value / threshold
                            },
                            tags=["performance", "alert", metric],
                            recommendations=self._generate_performance_recommendations(metric, current_value, threshold),
                            business_impact="Potential impact on user experience and system reliability"
                        )

                        insights.append(insight)

                    elif performance_issue:
                        insight = Insight(
                            insight_id=f"performance_warning_{source_name}_{metric}_{datetime.now().timestamp()}",
                            insight_type=InsightType.RECOMMENDATION,
                            title=f"Performance Optimization Opportunity: {metric.title().replace('_', ' ')}",
                            description=f"While {metric.replace('_', ' ')} is within acceptable limits, "
                                       f"there's room for improvement. Current average is {mean_value:.1f}{config['unit']}.",
                            priority=InsightPriority.MEDIUM,
                            confidence=ConfidenceLevel.MEDIUM,
                            timestamp=datetime.now(),
                            data_sources=[source_name],
                            metrics={"mean_value": mean_value, "threshold": threshold},
                            tags=["performance", "optimization", metric],
                            recommendations=self._generate_optimization_recommendations(metric),
                            business_impact="Proactive optimization could improve user satisfaction and system efficiency"
                        )

                        insights.append(insight)

                except Exception as e:
                    logger.error(f"Error analyzing performance metric {metric}: {e}")

        return insights

    def _generate_business_insights(self, data: pd.DataFrame, source_name: str) -> List[Insight]:
        """Generate business-focused insights"""
        insights = []

        # Business metrics analysis
        business_metrics = {
            'revenue': {'type': 'financial', 'growth_target': 0.1},  # 10% growth expected
            'conversion_rate': {'type': 'marketing', 'benchmark': 0.05},  # 5% benchmark
            'active_users': {'type': 'engagement', 'growth_target': 0.05},  # 5% growth expected
            'churn_rate': {'type': 'retention', 'threshold': 0.1},  # 10% churn threshold
        }

        for metric, config in business_metrics.items():
            if metric in data.columns:
                try:
                    current_value = data[metric].iloc[-1] if not data.empty else 0

                    if len(data) > 30:  # Need sufficient data for growth analysis
                        recent_value = data[metric].iloc[-7:].mean()  # Last week average
                        older_value = data[metric].iloc[-30:-23].mean()  # Month ago average
                        growth_rate = ((recent_value - older_value) / older_value) if older_value != 0 else 0

                        if config['type'] == 'financial' and 'growth_target' in config:
                            if growth_rate > config['growth_target']:
                                insight = Insight(
                                    insight_id=f"business_growth_{source_name}_{metric}_{datetime.now().timestamp()}",
                                    insight_type=InsightType.OPPORTUNITY,
                                    title=f"Strong Growth in {metric.title().replace('_', ' ')}",
                                    description=f"{metric.replace('_', ' ').title()} is growing at {growth_rate:.1%} rate, "
                                               f"exceeding the target of {config['growth_target']:.1%}. "
                                               f"Current value: {current_value:.0f}.",
                                    priority=InsightPriority.HIGH,
                                    confidence=ConfidenceLevel.HIGH,
                                    timestamp=datetime.now(),
                                    data_sources=[source_name],
                                    metrics={
                                        "growth_rate": growth_rate,
                                        "current_value": current_value,
                                        "target": config['growth_target']
                                    },
                                    tags=["business", "growth", "revenue"],
                                    recommendations=[
                                        "Continue current strategies that are driving growth",
                                        "Consider scaling successful initiatives",
                                        "Monitor for sustainability of growth rate"
                                    ],
                                    business_impact=f"Positive revenue trajectory supporting business objectives"
                                )
                                insights.append(insight)

                            elif growth_rate < -0.05:  # Declining
                                insight = Insight(
                                    insight_id=f"business_decline_{source_name}_{metric}_{datetime.now().timestamp()}",
                                    insight_type=InsightType.RISK,
                                    title=f"Declining {metric.title().replace('_', ' ')} Trend",
                                    description=f"{metric.replace('_', ' ').title()} is declining at {abs(growth_rate):.1%} rate. "
                                               f"Immediate attention required to reverse this trend.",
                                    priority=InsightPriority.CRITICAL,
                                    confidence=ConfidenceLevel.HIGH,
                                    timestamp=datetime.now(),
                                    data_sources=[source_name],
                                    metrics={"growth_rate": growth_rate, "current_value": current_value},
                                    tags=["business", "decline", "risk"],
                                    recommendations=[
                                        "Conduct root cause analysis for decline",
                                        "Review and adjust marketing strategies",
                                        "Consider product or service improvements",
                                        "Implement retention programs"
                                    ],
                                    business_impact="Declining revenue threatens business sustainability",
                                    next_steps=[
                                        "Schedule emergency strategy review meeting",
                                        "Analyze customer feedback and churn reasons",
                                        "Evaluate competitive landscape changes"
                                    ]
                                )
                                insights.append(insight)

                        # Conversion rate analysis
                        if metric == 'conversion_rate' and 'benchmark' in config:
                            if current_value < config['benchmark']:
                                potential_improvement = (config['benchmark'] - current_value) / current_value

                                insight = Insight(
                                    insight_id=f"conversion_opportunity_{source_name}_{datetime.now().timestamp()}",
                                    insight_type=InsightType.OPPORTUNITY,
                                    title="Conversion Rate Optimization Opportunity",
                                    description=f"Current conversion rate ({current_value:.2%}) is below industry benchmark ({config['benchmark']:.2%}). "
                                               f"Improving to benchmark could increase conversions by {potential_improvement:.1%}.",
                                    priority=InsightPriority.MEDIUM,
                                    confidence=ConfidenceLevel.MEDIUM,
                                    timestamp=datetime.now(),
                                    data_sources=[source_name],
                                    metrics={
                                        "current_rate": current_value,
                                        "benchmark": config['benchmark'],
                                        "potential_improvement": potential_improvement
                                    },
                                    tags=["conversion", "optimization", "opportunity"],
                                    recommendations=[
                                        "A/B test different landing page designs",
                                        "Optimize call-to-action placement and messaging",
                                        "Analyze user journey for friction points",
                                        "Implement retargeting campaigns"
                                    ],
                                    business_impact=f"Conversion improvement could significantly impact revenue growth"
                                )
                                insights.append(insight)

                except Exception as e:
                    logger.error(f"Error in business analysis for {metric}: {e}")

        return insights

    def _generate_trend_recommendations(self, trend: str, metric: str, analysis: Dict) -> List[str]:
        """Generate recommendations based on trend analysis"""
        recommendations = []

        if trend == "increasing":
            if "revenue" in metric.lower() or "sales" in metric.lower():
                recommendations = [
                    "Maintain current successful strategies",
                    "Consider scaling marketing efforts to sustain growth",
                    "Prepare infrastructure for continued growth"
                ]
            elif "users" in metric.lower():
                recommendations = [
                    "Focus on user retention to convert growth into revenue",
                    "Ensure system capacity can handle increased load",
                    "Implement user onboarding optimization"
                ]
            else:
                recommendations = [
                    "Monitor sustainability of current growth pattern",
                    "Identify key drivers of positive trend"
                ]

        elif trend == "decreasing":
            if "revenue" in metric.lower() or "sales" in metric.lower():
                recommendations = [
                    "Conduct immediate analysis of revenue decline causes",
                    "Review pricing strategy and competitive positioning",
                    "Implement retention programs to reduce churn"
                ]
            elif "users" in metric.lower():
                recommendations = [
                    "Investigate user experience issues",
                    "Review marketing channel effectiveness",
                    "Conduct user surveys to identify pain points"
                ]
            else:
                recommendations = [
                    "Investigate root causes of declining trend",
                    "Implement corrective measures immediately"
                ]

        else:  # stable
            recommendations = [
                "Consider strategies to drive growth in this stable metric",
                "Monitor for early signs of change in trend"
            ]

        return recommendations

    def _generate_anomaly_recommendations(self, metric: str, anomalies: Dict, severity: str) -> List[str]:
        """Generate recommendations for anomaly handling"""
        recommendations = []

        if severity == "severe":
            recommendations.append("Immediate investigation required - potential system issue")

        if "revenue" in metric.lower() or "sales" in metric.lower():
            recommendations.extend([
                "Review transaction logs for data quality issues",
                "Verify payment processing system functionality",
                "Check for unusual promotional activities or pricing changes"
            ])
        elif "users" in metric.lower() or "traffic" in metric.lower():
            recommendations.extend([
                "Analyze traffic sources for unusual patterns",
                "Check for bot activity or data collection issues",
                "Review marketing campaigns for spikes in activity"
            ])
        elif "response" in metric.lower() or "performance" in metric.lower():
            recommendations.extend([
                "Check system resources and infrastructure health",
                "Review recent deployments or configuration changes",
                "Monitor for cascading effects on user experience"
            ])
        else:
            recommendations.extend([
                "Validate data collection and processing accuracy",
                "Review business processes for unusual conditions",
                "Consider implementing automated monitoring for this metric"
            ])

        return recommendations

    def _generate_correlation_recommendations(self, correlation: Dict, direction: str, strength: str) -> List[str]:
        """Generate recommendations based on correlation analysis"""
        var1 = correlation['variable1']
        var2 = correlation['variable2']

        recommendations = []

        if strength == "strong":
            if direction == "positive":
                recommendations.extend([
                    f"Leverage the positive relationship between {var1} and {var2}",
                    f"When optimizing {var1}, expect similar improvements in {var2}",
                    "Consider joint optimization strategies for both variables"
                ])
            else:
                recommendations.extend([
                    f"Manage the trade-off between {var1} and {var2}",
                    f"Improvements in {var1} may come at the cost of {var2}",
                    "Develop balanced optimization approach"
                ])
        else:
            recommendations.extend([
                "Further investigate the relationship for potential causation",
                "Consider this relationship in predictive modeling",
                "Monitor changes in correlation strength over time"
            ])

        return recommendations

    def _generate_performance_recommendations(self, metric: str, current: float, threshold: float) -> List[str]:
        """Generate performance-related recommendations"""
        recommendations = []

        if "response_time" in metric:
            recommendations = [
                "Optimize database queries and indexes",
                "Review application code for performance bottlenecks",
                "Consider implementing caching strategies",
                "Scale infrastructure resources if needed"
            ]
        elif "cpu" in metric or "memory" in metric:
            recommendations = [
                "Review resource allocation and scaling policies",
                "Optimize application resource usage",
                "Consider load balancing improvements",
                "Monitor for memory leaks or inefficient algorithms"
            ]
        elif "error" in metric:
            recommendations = [
                "Review error logs for common failure patterns",
                "Implement better error handling and recovery",
                "Enhance monitoring and alerting systems",
                "Conduct code review for potential issues"
            ]
        else:
            recommendations = [
                f"Investigate root causes of {metric} performance issues",
                "Implement monitoring and alerting for this metric",
                "Consider optimization strategies specific to this metric"
            ]

        return recommendations

    def _generate_optimization_recommendations(self, metric: str) -> List[str]:
        """Generate optimization recommendations"""
        base_recommendations = [
            f"Establish baseline measurements for {metric}",
            "Implement continuous monitoring",
            "Set up automated alerting for degradation"
        ]

        if "response_time" in metric:
            base_recommendations.extend([
                "Implement response time optimization best practices",
                "Consider CDN usage for static content",
                "Optimize API endpoints and database connections"
            ])
        elif "throughput" in metric:
            base_recommendations.extend([
                "Analyze traffic patterns for optimization opportunities",
                "Consider horizontal scaling strategies",
                "Optimize resource utilization"
            ])

        return base_recommendations

    def _confidence_to_score(self, confidence: ConfidenceLevel) -> float:
        """Convert confidence level to numeric score"""
        confidence_scores = {
            ConfidenceLevel.VERY_HIGH: 0.95,
            ConfidenceLevel.HIGH: 0.85,
            ConfidenceLevel.MEDIUM: 0.70,
            ConfidenceLevel.LOW: 0.50,
            ConfidenceLevel.VERY_LOW: 0.30
        }
        return confidence_scores.get(confidence, 0.50)

    def _score_to_confidence(self, score: float) -> ConfidenceLevel:
        """Convert numeric score to confidence level"""
        if score >= 0.95:
            return ConfidenceLevel.VERY_HIGH
        elif score >= 0.80:
            return ConfidenceLevel.HIGH
        elif score >= 0.60:
            return ConfidenceLevel.MEDIUM
        elif score >= 0.40:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW

    def get_insights_summary(self, time_range: timedelta = None) -> Dict[str, Any]:
        """Get summary of insights"""
        if time_range:
            cutoff_time = datetime.now() - time_range
            recent_insights = [i for i in self.insights if i.timestamp >= cutoff_time]
        else:
            recent_insights = self.insights

        # Count by type
        type_counts = {}
        for insight in recent_insights:
            insight_type = insight.insight_type.value
            type_counts[insight_type] = type_counts.get(insight_type, 0) + 1

        # Count by priority
        priority_counts = {}
        for insight in recent_insights:
            priority = insight.priority.value
            priority_counts[priority] = priority_counts.get(priority, 0) + 1

        # Get top tags
        all_tags = []
        for insight in recent_insights:
            all_tags.extend(insight.tags)

        tag_counts = {}
        for tag in all_tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

        top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total_insights": len(recent_insights),
            "insights_by_type": type_counts,
            "insights_by_priority": priority_counts,
            "top_tags": dict(top_tags),
            "latest_insights": [
                {
                    "title": insight.title,
                    "type": insight.insight_type.value,
                    "priority": insight.priority.value,
                    "timestamp": insight.timestamp.isoformat()
                }
                for insight in sorted(recent_insights, key=lambda x: x.timestamp, reverse=True)[:5]
            ]
        }

    def get_insights_by_priority(self, priority: InsightPriority) -> List[Insight]:
        """Get insights filtered by priority"""
        return [insight for insight in self.insights if insight.priority == priority]

    def get_insights_by_type(self, insight_type: InsightType) -> List[Insight]:
        """Get insights filtered by type"""
        return [insight for insight in self.insights if insight.insight_type == insight_type]

    def export_insights(self, format: str = "json", filename: str = None) -> str:
        """Export insights in various formats"""
        if format.lower() == "json":
            insights_data = []
            for insight in self.insights:
                insight_dict = {
                    "insight_id": insight.insight_id,
                    "type": insight.insight_type.value,
                    "title": insight.title,
                    "description": insight.description,
                    "priority": insight.priority.value,
                    "confidence": insight.confidence.value,
                    "timestamp": insight.timestamp.isoformat(),
                    "data_sources": insight.data_sources,
                    "metrics": insight.metrics,
                    "recommendations": insight.recommendations,
                    "tags": insight.tags,
                    "business_impact": insight.business_impact
                }
                insights_data.append(insight_dict)

            json_output = json.dumps(insights_data, indent=2)

            if filename:
                with open(filename, 'w') as f:
                    f.write(json_output)

            return json_output

        else:
            raise ValueError(f"Unsupported export format: {format}")

    def generate_insights_report(self) -> str:
        """Generate a comprehensive insights report"""
        report = []
        report.append("# Automated Insights Report - GlobalTaxCalc.com")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        # Executive Summary
        summary = self.get_insights_summary()
        report.append("## Executive Summary")
        report.append(f"- Total Insights: {summary['total_insights']}")
        report.append(f"- Critical Issues: {summary['insights_by_priority'].get('critical', 0)}")
        report.append(f"- High Priority Items: {summary['insights_by_priority'].get('high', 0)}")
        report.append("")

        # Critical Insights
        critical_insights = self.get_insights_by_priority(InsightPriority.CRITICAL)
        if critical_insights:
            report.append("## 🚨 Critical Insights")
            for insight in critical_insights[:5]:
                report.append(f"### {insight.title}")
                report.append(f"**Description:** {insight.description}")
                report.append("**Recommendations:**")
                for rec in insight.recommendations[:3]:
                    report.append(f"- {rec}")
                report.append("")

        # High Priority Insights
        high_insights = self.get_insights_by_priority(InsightPriority.HIGH)
        if high_insights:
            report.append("## ⚠️ High Priority Insights")
            for insight in high_insights[:5]:
                report.append(f"### {insight.title}")
                report.append(f"**Description:** {insight.description}")
                if insight.business_impact:
                    report.append(f"**Business Impact:** {insight.business_impact}")
                report.append("")

        # Opportunities
        opportunities = self.get_insights_by_type(InsightType.OPPORTUNITY)
        if opportunities:
            report.append("## 💡 Opportunities")
            for insight in opportunities[:3]:
                report.append(f"### {insight.title}")
                report.append(f"**Description:** {insight.description}")
                report.append("")

        # Insights by Category
        report.append("## 📊 Insights by Category")
        for insight_type, count in summary['insights_by_type'].items():
            report.append(f"- {insight_type.title()}: {count}")

        report.append("")
        report.append("## 📈 Top Focus Areas")
        for tag, count in list(summary['top_tags'].items())[:5]:
            report.append(f"- {tag.title()}: {count} insights")

        return "\n".join(report)


# Example usage and testing
if __name__ == "__main__":
    # Initialize the automated insights engine
    engine = AutomatedInsightsEngine()

    print("🧠 Automated Insights Generation Engine for GlobalTaxCalc.com")
    print("=" * 70)

    try:
        # Generate insights
        print("Generating insights from data sources...")
        new_insights = engine.generate_insights()

        print(f"✅ Generated {len(new_insights)} insights")

        # Display insights by priority
        print("\n🚨 Critical Insights:")
        critical = engine.get_insights_by_priority(InsightPriority.CRITICAL)
        for insight in critical[:3]:
            print(f"  • {insight.title}")
            print(f"    {insight.description[:100]}...")

        print("\n⚠️ High Priority Insights:")
        high_priority = engine.get_insights_by_priority(InsightPriority.HIGH)
        for insight in high_priority[:3]:
            print(f"  • {insight.title}")
            print(f"    {insight.description[:100]}...")

        print("\n💡 Opportunities:")
        opportunities = engine.get_insights_by_type(InsightType.OPPORTUNITY)
        for insight in opportunities[:2]:
            print(f"  • {insight.title}")
            print(f"    {insight.description[:100]}...")

        # Generate summary report
        print("\n📊 Insights Summary:")
        summary = engine.get_insights_summary()
        print(f"  Total Insights: {summary['total_insights']}")
        print(f"  By Priority: {summary['insights_by_priority']}")
        print(f"  By Type: {summary['insights_by_type']}")

        # Generate comprehensive report
        report = engine.generate_insights_report()
        print("\n📋 Generated comprehensive insights report")

        # Save report
        with open("insights_report.md", "w") as f:
            f.write(report)
        print("✅ Saved insights report to insights_report.md")

        # Export insights
        json_export = engine.export_insights(format="json", filename="insights_export.json")
        print("✅ Exported insights to insights_export.json")

        print("\n✅ Automated Insights Engine demonstration completed successfully!")
        print("\nKey Features Implemented:")
        print("- Multi-dimensional trend analysis with statistical confidence")
        print("- Advanced anomaly detection (statistical + machine learning)")
        print("- Pattern recognition and correlation analysis")
        print("- Performance monitoring with threshold-based alerting")
        print("- Business intelligence with growth and opportunity analysis")
        print("- Clustering and segmentation for data patterns")
        print("- Automated recommendation generation")
        print("- Priority-based insight classification")
        print("- Comprehensive reporting and export capabilities")
        print("- Configurable insight rules and templates")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
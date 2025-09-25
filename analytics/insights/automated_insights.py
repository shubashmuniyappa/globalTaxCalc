"""
Automated Insights Generation Module

This module provides automated insights generation capabilities including:
- Statistical anomaly detection
- Trend analysis and forecasting
- Business KPI insights
- Automated narrative generation
- Intelligent alerting
- Performance insights
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import clickhouse_connect
import redis
from dataclasses import dataclass, asdict
import json
import logging
from scipy import stats
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import plotly.graph_objects as go
import plotly.express as px
from textblob import TextBlob
import re
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

@dataclass
class Insight:
    """Represents an automated insight"""
    id: str
    title: str
    description: str
    category: str  # 'anomaly', 'trend', 'performance', 'opportunity', 'risk'
    priority: str  # 'low', 'medium', 'high', 'critical'
    confidence_score: float
    data_points: List[Dict[str, Any]]
    recommendations: List[str]
    timestamp: datetime
    expires_at: Optional[datetime] = None
    tags: List[str] = None

@dataclass
class TrendAnalysis:
    """Represents trend analysis results"""
    metric_name: str
    trend_direction: str  # 'increasing', 'decreasing', 'stable', 'volatile'
    trend_strength: float  # 0-1
    seasonal_component: bool
    forecast_values: List[float]
    change_rate: float
    significance_level: float

class AutomatedInsightsEngine:
    """
    Automated insights generation engine for GlobalTaxCalc analytics
    """

    def __init__(self,
                 clickhouse_config: Dict[str, str],
                 redis_config: Dict[str, str]):
        """
        Initialize the automated insights engine

        Args:
            clickhouse_config: ClickHouse connection configuration
            redis_config: Redis connection configuration
        """
        self.clickhouse_config = clickhouse_config
        self.redis_config = redis_config

        # Connections
        self.clickhouse_client = None
        self.redis_client = None

        # Insights state
        self.active_insights = {}
        self.insight_history = []

        # Analysis parameters
        self.anomaly_threshold = 2.0  # Standard deviations
        self.trend_confidence_threshold = 0.7
        self.min_data_points = 30

        # Templates for narrative generation
        self.narrative_templates = {
            'anomaly': {
                'high': "{metric} showed an unusual spike of {value:.1f}% on {date}, which is {std_dev:.1f} standard deviations above normal.",
                'low': "{metric} dropped significantly to {value:.1f}% on {date}, which is {std_dev:.1f} standard deviations below normal."
            },
            'trend': {
                'increasing': "{metric} has been steadily increasing by {rate:.1f}% over the past {period}, indicating {context}.",
                'decreasing': "{metric} has been declining by {rate:.1f}% over the past {period}, suggesting {context}."
            },
            'performance': {
                'good': "{metric} performance is {value:.1f}% above target, showing {context}.",
                'poor': "{metric} performance is {value:.1f}% below target, requiring {context}."
            }
        }

        self._setup_connections()

    def _setup_connections(self):
        """Setup database and cache connections"""
        try:
            # ClickHouse connection
            self.clickhouse_client = clickhouse_connect.get_client(
                host=self.clickhouse_config['host'],
                port=self.clickhouse_config['port'],
                username=self.clickhouse_config['username'],
                password=self.clickhouse_config['password'],
                database=self.clickhouse_config['database']
            )

            # Redis connection
            self.redis_client = redis.Redis(
                host=self.redis_config['host'],
                port=self.redis_config['port'],
                password=self.redis_config.get('password'),
                decode_responses=True
            )

            logger.info("Automated insights engine connections established")

        except Exception as e:
            logger.error(f"Failed to establish connections: {e}")
            raise

    def generate_all_insights(self,
                            date_range: Tuple[str, str] = None,
                            categories: List[str] = None) -> List[Insight]:
        """
        Generate all types of insights for the specified period

        Args:
            date_range: Optional date range tuple (start_date, end_date)
            categories: Optional list of insight categories to generate

        Returns:
            List of generated insights
        """
        try:
            if not date_range:
                end_date = datetime.now()
                start_date = end_date - timedelta(days=30)
                date_range = (start_date.isoformat(), end_date.isoformat())

            all_categories = ['anomaly', 'trend', 'performance', 'opportunity', 'risk']
            categories = categories or all_categories

            insights = []

            # Generate different types of insights
            if 'anomaly' in categories:
                insights.extend(self._detect_anomalies(date_range))

            if 'trend' in categories:
                insights.extend(self._analyze_trends(date_range))

            if 'performance' in categories:
                insights.extend(self._analyze_performance(date_range))

            if 'opportunity' in categories:
                insights.extend(self._identify_opportunities(date_range))

            if 'risk' in categories:
                insights.extend(self._identify_risks(date_range))

            # Store insights
            for insight in insights:
                self._store_insight(insight)

            # Sort by priority and confidence
            insights.sort(key=lambda x: (
                {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}[x.priority],
                x.confidence_score
            ), reverse=True)

            logger.info(f"Generated {len(insights)} insights for period {date_range}")
            return insights

        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return []

    def _detect_anomalies(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect statistical anomalies in key metrics"""
        try:
            insights = []

            # Key metrics to monitor for anomalies
            metrics_queries = {
                'conversion_rate': """
                    SELECT
                        toDate(timestamp) as date,
                        COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) * 100.0 / COUNT(*) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """,
                'revenue_per_day': """
                    SELECT
                        toDate(timestamp) as date,
                        SUM(event_value) as value
                    FROM user_events
                    WHERE event_type = 'revenue'
                    AND timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """,
                'error_rate': """
                    SELECT
                        toDate(timestamp) as date,
                        COUNT(CASE WHEN event_type = 'error' THEN 1 END) * 100.0 / COUNT(*) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """,
                'active_users': """
                    SELECT
                        toDate(timestamp) as date,
                        COUNT(DISTINCT user_id) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """
            }

            for metric_name, query in metrics_queries.items():
                formatted_query = query.format(
                    start_date=date_range[0],
                    end_date=date_range[1]
                )

                result = self.clickhouse_client.query(formatted_query)
                if not result.result_rows or len(result.result_rows) < self.min_data_points:
                    continue

                df = pd.DataFrame(result.result_rows, columns=['date', 'value'])
                df['date'] = pd.to_datetime(df['date'])
                df = df.sort_values('date')

                # Detect anomalies using statistical methods
                anomalies = self._detect_statistical_anomalies(df, metric_name)
                insights.extend(anomalies)

            return insights

        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            return []

    def _detect_statistical_anomalies(self, df: pd.DataFrame, metric_name: str) -> List[Insight]:
        """Detect statistical anomalies in time series data"""
        try:
            insights = []

            if len(df) < self.min_data_points:
                return insights

            # Calculate rolling statistics
            window_size = min(7, len(df) // 4)
            df['rolling_mean'] = df['value'].rolling(window=window_size, center=True).mean()
            df['rolling_std'] = df['value'].rolling(window=window_size, center=True).std()

            # Z-score method
            overall_mean = df['value'].mean()
            overall_std = df['value'].std()
            df['z_score'] = (df['value'] - overall_mean) / overall_std

            # Identify anomalies
            anomaly_points = df[abs(df['z_score']) > self.anomaly_threshold]

            for _, point in anomaly_points.iterrows():
                anomaly_type = 'high' if point['z_score'] > 0 else 'low'

                insight = Insight(
                    id=f"anomaly_{metric_name}_{point['date'].strftime('%Y%m%d')}",
                    title=f"Anomaly Detected in {metric_name.replace('_', ' ').title()}",
                    description=self._generate_anomaly_narrative(
                        metric_name, point, anomaly_type
                    ),
                    category='anomaly',
                    priority=self._determine_anomaly_priority(point['z_score']),
                    confidence_score=min(abs(point['z_score']) / 4.0, 1.0),
                    data_points=[{
                        'date': point['date'].isoformat(),
                        'value': point['value'],
                        'z_score': point['z_score'],
                        'expected_range': [
                            overall_mean - 2 * overall_std,
                            overall_mean + 2 * overall_std
                        ]
                    }],
                    recommendations=self._generate_anomaly_recommendations(
                        metric_name, anomaly_type, point['z_score']
                    ),
                    timestamp=datetime.now(),
                    expires_at=datetime.now() + timedelta(days=7),
                    tags=[metric_name, anomaly_type, 'statistical']
                )

                insights.append(insight)

            return insights

        except Exception as e:
            logger.error(f"Error detecting statistical anomalies for {metric_name}: {e}")
            return []

    def _generate_anomaly_narrative(self, metric_name: str, point: pd.Series, anomaly_type: str) -> str:
        """Generate narrative description for anomaly"""
        try:
            template = self.narrative_templates['anomaly'][anomaly_type]

            narrative = template.format(
                metric=metric_name.replace('_', ' ').title(),
                value=point['value'],
                date=point['date'].strftime('%Y-%m-%d'),
                std_dev=abs(point['z_score'])
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating anomaly narrative: {e}")
            return f"Anomaly detected in {metric_name}"

    def _determine_anomaly_priority(self, z_score: float) -> str:
        """Determine priority based on anomaly severity"""
        abs_z = abs(z_score)

        if abs_z >= 4.0:
            return 'critical'
        elif abs_z >= 3.0:
            return 'high'
        elif abs_z >= 2.5:
            return 'medium'
        else:
            return 'low'

    def _generate_anomaly_recommendations(self, metric_name: str, anomaly_type: str, z_score: float) -> List[str]:
        """Generate recommendations for anomaly"""
        recommendations = []

        if metric_name == 'conversion_rate':
            if anomaly_type == 'low':
                recommendations.extend([
                    "Investigate funnel bottlenecks immediately",
                    "Check for technical issues affecting user flow",
                    "Review recent changes to landing pages or checkout process"
                ])
            else:
                recommendations.extend([
                    "Analyze what drove the conversion spike",
                    "Document successful strategies for replication",
                    "Consider scaling successful campaigns"
                ])

        elif metric_name == 'error_rate':
            if anomaly_type == 'high':
                recommendations.extend([
                    "Check application logs for error patterns",
                    "Review recent deployments or configuration changes",
                    "Monitor system resources and performance"
                ])

        elif metric_name == 'revenue_per_day':
            if anomaly_type == 'low':
                recommendations.extend([
                    "Investigate payment processing issues",
                    "Review pricing strategy and competitor analysis",
                    "Check for seasonal effects or market changes"
                ])

        # General recommendations based on severity
        if abs(z_score) >= 3.0:
            recommendations.append("Immediate investigation required due to high severity")

        return recommendations

    def _analyze_trends(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Analyze trends in key business metrics"""
        try:
            insights = []

            # Key metrics for trend analysis
            trend_metrics = {
                'user_growth': """
                    SELECT
                        toDate(timestamp) as date,
                        COUNT(DISTINCT user_id) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """,
                'revenue_trend': """
                    SELECT
                        toDate(timestamp) as date,
                        SUM(event_value) as value
                    FROM user_events
                    WHERE event_type = 'revenue'
                    AND timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """,
                'engagement_trend': """
                    SELECT
                        toDate(timestamp) as date,
                        AVG(session_duration) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    GROUP BY date
                    ORDER BY date
                """
            }

            for metric_name, query in trend_metrics.items():
                formatted_query = query.format(
                    start_date=date_range[0],
                    end_date=date_range[1]
                )

                result = self.clickhouse_client.query(formatted_query)
                if not result.result_rows or len(result.result_rows) < 14:  # Need at least 2 weeks
                    continue

                df = pd.DataFrame(result.result_rows, columns=['date', 'value'])
                df['date'] = pd.to_datetime(df['date'])
                df = df.sort_values('date')

                # Analyze trend
                trend_analysis = self._perform_trend_analysis(df, metric_name)
                if trend_analysis:
                    insight = self._create_trend_insight(trend_analysis, metric_name)
                    if insight:
                        insights.append(insight)

            return insights

        except Exception as e:
            logger.error(f"Error analyzing trends: {e}")
            return []

    def _perform_trend_analysis(self, df: pd.DataFrame, metric_name: str) -> Optional[TrendAnalysis]:
        """Perform statistical trend analysis"""
        try:
            if len(df) < 14:
                return None

            # Linear regression for trend direction
            x = np.arange(len(df))
            y = df['value'].values

            # Remove NaN values
            mask = ~np.isnan(y)
            x = x[mask]
            y = y[mask]

            if len(x) < 10:
                return None

            slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

            # Determine trend direction
            if p_value > 0.05:  # Not statistically significant
                trend_direction = 'stable'
                trend_strength = 0.0
            elif slope > 0:
                trend_direction = 'increasing'
                trend_strength = min(abs(r_value), 1.0)
            else:
                trend_direction = 'decreasing'
                trend_strength = min(abs(r_value), 1.0)

            # Calculate change rate
            if len(y) >= 7:
                recent_avg = np.mean(y[-7:])
                previous_avg = np.mean(y[-14:-7]) if len(y) >= 14 else np.mean(y[:-7])
                change_rate = ((recent_avg - previous_avg) / previous_avg * 100) if previous_avg != 0 else 0
            else:
                change_rate = 0

            # Simple forecast (extend trend)
            forecast_x = np.arange(len(df), len(df) + 7)  # 7 days ahead
            forecast_values = slope * forecast_x + intercept

            return TrendAnalysis(
                metric_name=metric_name,
                trend_direction=trend_direction,
                trend_strength=trend_strength,
                seasonal_component=False,  # Would need more sophisticated analysis
                forecast_values=forecast_values.tolist(),
                change_rate=change_rate,
                significance_level=p_value
            )

        except Exception as e:
            logger.error(f"Error performing trend analysis for {metric_name}: {e}")
            return None

    def _create_trend_insight(self, trend_analysis: TrendAnalysis, metric_name: str) -> Optional[Insight]:
        """Create insight from trend analysis"""
        try:
            if trend_analysis.trend_direction == 'stable':
                return None  # Don't create insights for stable trends

            # Determine priority based on trend strength and direction
            if trend_analysis.trend_strength >= 0.7:
                if metric_name in ['revenue_trend', 'user_growth'] and trend_analysis.trend_direction == 'decreasing':
                    priority = 'high'
                elif metric_name in ['revenue_trend', 'user_growth'] and trend_analysis.trend_direction == 'increasing':
                    priority = 'medium'
                else:
                    priority = 'medium'
            else:
                priority = 'low'

            # Generate description
            description = self._generate_trend_narrative(trend_analysis)

            # Generate recommendations
            recommendations = self._generate_trend_recommendations(trend_analysis)

            insight = Insight(
                id=f"trend_{metric_name}_{datetime.now().strftime('%Y%m%d')}",
                title=f"{trend_analysis.trend_direction.title()} Trend in {metric_name.replace('_', ' ').title()}",
                description=description,
                category='trend',
                priority=priority,
                confidence_score=trend_analysis.trend_strength,
                data_points=[{
                    'metric': metric_name,
                    'trend_direction': trend_analysis.trend_direction,
                    'change_rate': trend_analysis.change_rate,
                    'significance': trend_analysis.significance_level,
                    'forecast': trend_analysis.forecast_values
                }],
                recommendations=recommendations,
                timestamp=datetime.now(),
                expires_at=datetime.now() + timedelta(days=14),
                tags=[metric_name, trend_analysis.trend_direction, 'trend_analysis']
            )

            return insight

        except Exception as e:
            logger.error(f"Error creating trend insight: {e}")
            return None

    def _generate_trend_narrative(self, trend_analysis: TrendAnalysis) -> str:
        """Generate narrative for trend insight"""
        try:
            template = self.narrative_templates['trend'][trend_analysis.trend_direction]

            period = "past 30 days"  # Could be made dynamic
            context = self._get_trend_context(trend_analysis)

            narrative = template.format(
                metric=trend_analysis.metric_name.replace('_', ' ').title(),
                rate=abs(trend_analysis.change_rate),
                period=period,
                context=context
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating trend narrative: {e}")
            return f"Trend detected in {trend_analysis.metric_name}"

    def _get_trend_context(self, trend_analysis: TrendAnalysis) -> str:
        """Get contextual meaning for trend"""
        metric = trend_analysis.metric_name
        direction = trend_analysis.trend_direction

        contexts = {
            ('user_growth', 'increasing'): "strong business growth and market expansion",
            ('user_growth', 'decreasing'): "potential market saturation or competitive pressure",
            ('revenue_trend', 'increasing'): "healthy business performance and customer value",
            ('revenue_trend', 'decreasing'): "revenue challenges requiring immediate attention",
            ('engagement_trend', 'increasing'): "improved user experience and product value",
            ('engagement_trend', 'decreasing'): "declining user satisfaction or product issues"
        }

        return contexts.get((metric, direction), "significant business metric changes")

    def _generate_trend_recommendations(self, trend_analysis: TrendAnalysis) -> List[str]:
        """Generate recommendations for trend insight"""
        recommendations = []
        metric = trend_analysis.metric_name
        direction = trend_analysis.trend_direction

        if metric == 'user_growth':
            if direction == 'increasing':
                recommendations.extend([
                    "Scale marketing efforts to capitalize on growth momentum",
                    "Ensure infrastructure can handle increased user load",
                    "Analyze growth drivers for replication"
                ])
            else:
                recommendations.extend([
                    "Investigate causes of user growth decline",
                    "Review competitor activity and market changes",
                    "Consider new user acquisition strategies"
                ])

        elif metric == 'revenue_trend':
            if direction == 'increasing':
                recommendations.extend([
                    "Analyze revenue drivers for optimization",
                    "Consider expanding successful offerings",
                    "Plan for reinvestment in growth initiatives"
                ])
            else:
                recommendations.extend([
                    "Immediate revenue recovery plan needed",
                    "Review pricing strategy and value proposition",
                    "Analyze customer churn and retention"
                ])

        # Add general recommendations based on trend strength
        if trend_analysis.trend_strength >= 0.8:
            recommendations.append("High confidence trend - consider strategic planning adjustments")

        return recommendations

    def _analyze_performance(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Analyze performance against targets and benchmarks"""
        try:
            insights = []

            # Define performance targets (these could be configurable)
            performance_targets = {
                'conversion_rate': 2.5,  # 2.5% target
                'average_session_duration': 180,  # 3 minutes
                'bounce_rate': 40,  # 40% max bounce rate
                'customer_acquisition_cost': 50,  # $50 CAC target
                'customer_lifetime_value': 200  # $200 LTV target
            }

            for metric_name, target in performance_targets.items():
                current_performance = self._get_current_performance(metric_name, date_range)

                if current_performance is not None:
                    insight = self._create_performance_insight(
                        metric_name, current_performance, target
                    )
                    if insight:
                        insights.append(insight)

            return insights

        except Exception as e:
            logger.error(f"Error analyzing performance: {e}")
            return []

    def _get_current_performance(self, metric_name: str, date_range: Tuple[str, str]) -> Optional[float]:
        """Get current performance for a specific metric"""
        try:
            queries = {
                'conversion_rate': """
                    SELECT COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) * 100.0 / COUNT(*) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                """,
                'average_session_duration': """
                    SELECT AVG(session_duration) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                    AND session_duration > 0
                """,
                'bounce_rate': """
                    SELECT COUNT(CASE WHEN session_duration < 30 THEN 1 END) * 100.0 / COUNT(*) as value
                    FROM user_events
                    WHERE timestamp >= '{start_date}' AND timestamp <= '{end_date}'
                """
            }

            if metric_name not in queries:
                return None

            query = queries[metric_name].format(
                start_date=date_range[0],
                end_date=date_range[1]
            )

            result = self.clickhouse_client.query(query)
            if result.result_rows:
                return result.result_rows[0][0]

            return None

        except Exception as e:
            logger.error(f"Error getting performance for {metric_name}: {e}")
            return None

    def _create_performance_insight(self, metric_name: str, current_value: float, target: float) -> Optional[Insight]:
        """Create performance insight"""
        try:
            variance_pct = ((current_value - target) / target) * 100

            # Only create insights for significant variances
            if abs(variance_pct) < 10:  # Less than 10% variance
                return None

            performance_type = 'good' if current_value >= target else 'poor'
            priority = self._determine_performance_priority(variance_pct, metric_name)

            description = self._generate_performance_narrative(
                metric_name, current_value, target, variance_pct, performance_type
            )

            recommendations = self._generate_performance_recommendations(
                metric_name, performance_type, variance_pct
            )

            insight = Insight(
                id=f"performance_{metric_name}_{datetime.now().strftime('%Y%m%d')}",
                title=f"Performance {'Above' if performance_type == 'good' else 'Below'} Target: {metric_name.replace('_', ' ').title()}",
                description=description,
                category='performance',
                priority=priority,
                confidence_score=0.8,  # High confidence in performance metrics
                data_points=[{
                    'metric': metric_name,
                    'current_value': current_value,
                    'target': target,
                    'variance_percent': variance_pct,
                    'performance_type': performance_type
                }],
                recommendations=recommendations,
                timestamp=datetime.now(),
                expires_at=datetime.now() + timedelta(days=7),
                tags=[metric_name, performance_type, 'performance_analysis']
            )

            return insight

        except Exception as e:
            logger.error(f"Error creating performance insight: {e}")
            return None

    def _determine_performance_priority(self, variance_pct: float, metric_name: str) -> str:
        """Determine priority for performance insight"""
        abs_variance = abs(variance_pct)

        # Critical metrics get higher priority for large variances
        critical_metrics = ['conversion_rate', 'customer_acquisition_cost']

        if metric_name in critical_metrics:
            if abs_variance >= 30:
                return 'critical'
            elif abs_variance >= 20:
                return 'high'
            else:
                return 'medium'
        else:
            if abs_variance >= 50:
                return 'high'
            elif abs_variance >= 25:
                return 'medium'
            else:
                return 'low'

    def _generate_performance_narrative(self, metric_name: str, current_value: float,
                                      target: float, variance_pct: float, performance_type: str) -> str:
        """Generate performance narrative"""
        try:
            template = self.narrative_templates['performance'][performance_type]
            context = self._get_performance_context(metric_name, performance_type, variance_pct)

            narrative = template.format(
                metric=metric_name.replace('_', ' ').title(),
                value=abs(variance_pct),
                context=context
            )

            return narrative

        except Exception as e:
            logger.error(f"Error generating performance narrative: {e}")
            return f"Performance analysis for {metric_name}"

    def _get_performance_context(self, metric_name: str, performance_type: str, variance_pct: float) -> str:
        """Get contextual meaning for performance"""
        if performance_type == 'good':
            contexts = {
                'conversion_rate': "excellent user experience and value proposition",
                'average_session_duration': "high user engagement and content quality",
                'customer_lifetime_value': "strong customer relationships and retention"
            }
        else:
            contexts = {
                'conversion_rate': "optimization of user funnel and experience",
                'average_session_duration': "content and UX improvements",
                'bounce_rate': "immediate attention to landing page optimization",
                'customer_acquisition_cost': "marketing efficiency improvements"
            }

        return contexts.get(metric_name, "strategic attention and optimization")

    def _generate_performance_recommendations(self, metric_name: str, performance_type: str, variance_pct: float) -> List[str]:
        """Generate performance recommendations"""
        recommendations = []

        if metric_name == 'conversion_rate':
            if performance_type == 'poor':
                recommendations.extend([
                    "Conduct A/B tests on checkout process",
                    "Optimize landing page conversion elements",
                    "Review pricing strategy and value proposition"
                ])
            else:
                recommendations.extend([
                    "Analyze successful conversion factors",
                    "Scale high-performing marketing channels",
                    "Document best practices for replication"
                ])

        elif metric_name == 'average_session_duration':
            if performance_type == 'poor':
                recommendations.extend([
                    "Improve content quality and relevance",
                    "Optimize page loading speeds",
                    "Enhance user interface and navigation"
                ])

        elif metric_name == 'bounce_rate':
            if performance_type == 'poor':
                recommendations.extend([
                    "Optimize landing page design and content",
                    "Improve page loading performance",
                    "Review traffic source quality"
                ])

        return recommendations

    def _identify_opportunities(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Identify business opportunities from data patterns"""
        try:
            insights = []

            # Opportunity detection strategies
            opportunities = [
                self._detect_growth_opportunities(date_range),
                self._detect_optimization_opportunities(date_range),
                self._detect_market_opportunities(date_range)
            ]

            for opportunity_list in opportunities:
                insights.extend(opportunity_list)

            return insights

        except Exception as e:
            logger.error(f"Error identifying opportunities: {e}")
            return []

    def _detect_growth_opportunities(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect growth opportunities"""
        # Implementation would analyze user segments, high-value customers, etc.
        return []

    def _detect_optimization_opportunities(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect optimization opportunities"""
        # Implementation would analyze conversion bottlenecks, user paths, etc.
        return []

    def _detect_market_opportunities(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect market opportunities"""
        # Implementation would analyze competitor data, market trends, etc.
        return []

    def _identify_risks(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Identify potential business risks"""
        try:
            insights = []

            # Risk detection strategies
            risks = [
                self._detect_churn_risks(date_range),
                self._detect_performance_risks(date_range),
                self._detect_competitive_risks(date_range)
            ]

            for risk_list in risks:
                insights.extend(risk_list)

            return insights

        except Exception as e:
            logger.error(f"Error identifying risks: {e}")
            return []

    def _detect_churn_risks(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect customer churn risks"""
        # Implementation would analyze user engagement patterns, usage decline, etc.
        return []

    def _detect_performance_risks(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect performance risks"""
        # Implementation would analyze system performance, error patterns, etc.
        return []

    def _detect_competitive_risks(self, date_range: Tuple[str, str]) -> List[Insight]:
        """Detect competitive risks"""
        # Implementation would analyze market changes, competitor moves, etc.
        return []

    def _store_insight(self, insight: Insight):
        """Store insight in database and cache"""
        try:
            # Store in Redis for quick access
            redis_key = f"insight:{insight.id}"
            insight_data = asdict(insight)
            insight_data['timestamp'] = insight_data['timestamp'].isoformat()
            if insight_data['expires_at']:
                insight_data['expires_at'] = insight_data['expires_at'].isoformat()

            self.redis_client.setex(redis_key, 86400, json.dumps(insight_data))

            # Store in ClickHouse for historical analysis
            row_data = [
                insight.timestamp.isoformat(),
                insight.id,
                insight.title,
                insight.description,
                insight.category,
                insight.priority,
                insight.confidence_score,
                json.dumps(insight.data_points),
                json.dumps(insight.recommendations),
                json.dumps(insight.tags or []),
                insight.expires_at.isoformat() if insight.expires_at else None
            ]

            self.clickhouse_client.insert(
                'automated_insights',
                [row_data],
                column_names=[
                    'timestamp', 'insight_id', 'title', 'description',
                    'category', 'priority', 'confidence_score',
                    'data_points', 'recommendations', 'tags', 'expires_at'
                ]
            )

            # Add to active insights
            self.active_insights[insight.id] = insight

            logger.info(f"Stored insight: {insight.title}")

        except Exception as e:
            logger.error(f"Error storing insight {insight.id}: {e}")

    def get_active_insights(self,
                          category: Optional[str] = None,
                          priority: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get currently active insights"""
        try:
            insights = []

            for insight in self.active_insights.values():
                # Check if insight has expired
                if insight.expires_at and datetime.now() > insight.expires_at:
                    continue

                # Apply filters
                if category and insight.category != category:
                    continue

                if priority and insight.priority != priority:
                    continue

                insight_dict = asdict(insight)
                insight_dict['timestamp'] = insight_dict['timestamp'].isoformat()
                if insight_dict['expires_at']:
                    insight_dict['expires_at'] = insight_dict['expires_at'].isoformat()

                insights.append(insight_dict)

            # Sort by priority and confidence
            priority_order = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
            insights.sort(key=lambda x: (
                priority_order.get(x['priority'], 0),
                x['confidence_score']
            ), reverse=True)

            return insights

        except Exception as e:
            logger.error(f"Error getting active insights: {e}")
            return []

    def get_insights_summary(self) -> Dict[str, Any]:
        """Get summary of insights"""
        try:
            active_insights = self.get_active_insights()

            summary = {
                'total_insights': len(active_insights),
                'by_category': {},
                'by_priority': {},
                'last_updated': datetime.now().isoformat()
            }

            for insight in active_insights:
                # Count by category
                category = insight['category']
                summary['by_category'][category] = summary['by_category'].get(category, 0) + 1

                # Count by priority
                priority = insight['priority']
                summary['by_priority'][priority] = summary['by_priority'].get(priority, 0) + 1

            return summary

        except Exception as e:
            logger.error(f"Error getting insights summary: {e}")
            return {}

# Example usage
if __name__ == "__main__":
    clickhouse_config = {
        'host': 'localhost',
        'port': 9000,
        'username': 'default',
        'password': '',
        'database': 'analytics'
    }

    redis_config = {
        'host': 'localhost',
        'port': 6379,
        'password': None
    }

    insights_engine = AutomatedInsightsEngine(clickhouse_config, redis_config)
    insights = insights_engine.generate_all_insights()

    print(f"Generated {len(insights)} insights")
    for insight in insights[:5]:  # Show top 5
        print(f"- {insight.title} ({insight.category}, {insight.priority})")
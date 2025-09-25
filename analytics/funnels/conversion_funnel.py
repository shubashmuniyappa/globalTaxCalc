"""
Conversion Funnel Analysis Module

This module provides comprehensive conversion funnel analysis capabilities including:
- Multi-step funnel visualization
- Cohort analysis for user retention
- A/B test result analysis
- Attribution modeling
- Conversion optimization insights
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import clickhouse_connect
from scipy import stats
import seaborn as sns
import matplotlib.pyplot as plt
from dataclasses import dataclass
import json
import logging

logger = logging.getLogger(__name__)

@dataclass
class FunnelStep:
    """Represents a step in the conversion funnel"""
    name: str
    event_type: str
    conditions: Dict[str, Any] = None
    order: int = 0

@dataclass
class CohortAnalysisResult:
    """Result of cohort analysis"""
    cohort_data: pd.DataFrame
    retention_rates: pd.DataFrame
    average_retention: Dict[str, float]
    cohort_sizes: Dict[str, int]

class ConversionFunnelAnalyzer:
    """
    Advanced conversion funnel analysis engine
    """

    def __init__(self, clickhouse_config: Dict[str, str]):
        """
        Initialize the conversion funnel analyzer

        Args:
            clickhouse_config: ClickHouse connection configuration
        """
        self.clickhouse_config = clickhouse_config
        self.client = None
        self._connect_to_clickhouse()

        # Define standard tax calculator funnel steps
        self.standard_funnel = [
            FunnelStep("landing", "page_view", {"page": "/"}, 1),
            FunnelStep("calculator_start", "calculator_start", {}, 2),
            FunnelStep("input_complete", "calculator_input_complete", {}, 3),
            FunnelStep("results_view", "calculator_results_view", {}, 4),
            FunnelStep("signup", "user_signup", {}, 5),
            FunnelStep("subscription", "subscription_created", {}, 6)
        ]

    def _connect_to_clickhouse(self):
        """Establish connection to ClickHouse"""
        try:
            self.client = clickhouse_connect.get_client(
                host=self.clickhouse_config['host'],
                port=self.clickhouse_config['port'],
                username=self.clickhouse_config['username'],
                password=self.clickhouse_config['password'],
                database=self.clickhouse_config['database']
            )
            logger.info("Connected to ClickHouse successfully")
        except Exception as e:
            logger.error(f"Failed to connect to ClickHouse: {e}")
            raise

    def analyze_conversion_funnel(self,
                                funnel_steps: List[FunnelStep] = None,
                                date_range: Tuple[str, str] = None,
                                segment_by: str = None) -> Dict[str, Any]:
        """
        Analyze conversion funnel with step-by-step metrics

        Args:
            funnel_steps: List of funnel steps to analyze
            date_range: Tuple of (start_date, end_date) in YYYY-MM-DD format
            segment_by: Optional field to segment analysis by (e.g., 'country', 'utm_source')

        Returns:
            Dictionary containing funnel analysis results
        """
        if funnel_steps is None:
            funnel_steps = self.standard_funnel

        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"AND timestamp >= '{date_range[0]}' AND timestamp <= '{date_range[1]}'"

            funnel_data = []

            for step in sorted(funnel_steps, key=lambda x: x.order):
                # Build conditions filter
                conditions_filter = ""
                if step.conditions:
                    conditions = []
                    for key, value in step.conditions.items():
                        if isinstance(value, str):
                            conditions.append(f"{key} = '{value}'")
                        else:
                            conditions.append(f"{key} = {value}")
                    if conditions:
                        conditions_filter = f"AND {' AND '.join(conditions)}"

                # Query for this step
                if segment_by:
                    query = f"""
                    SELECT
                        {segment_by},
                        COUNT(DISTINCT user_id) as users,
                        COUNT(*) as events
                    FROM user_events
                    WHERE event_type = '{step.event_type}'
                    {date_filter}
                    {conditions_filter}
                    GROUP BY {segment_by}
                    ORDER BY {segment_by}
                    """
                else:
                    query = f"""
                    SELECT
                        COUNT(DISTINCT user_id) as users,
                        COUNT(*) as events
                    FROM user_events
                    WHERE event_type = '{step.event_type}'
                    {date_filter}
                    {conditions_filter}
                    """

                result = self.client.query(query)

                if segment_by:
                    step_data = {
                        'step_name': step.name,
                        'step_order': step.order,
                        'segment_data': result.result_rows
                    }
                else:
                    users, events = result.result_rows[0] if result.result_rows else (0, 0)
                    step_data = {
                        'step_name': step.name,
                        'step_order': step.order,
                        'users': users,
                        'events': events
                    }

                funnel_data.append(step_data)

            # Calculate conversion rates
            if not segment_by:
                funnel_metrics = self._calculate_funnel_metrics(funnel_data)
            else:
                funnel_metrics = self._calculate_segmented_funnel_metrics(funnel_data, segment_by)

            return {
                'funnel_data': funnel_data,
                'funnel_metrics': funnel_metrics,
                'analysis_date': datetime.now().isoformat(),
                'date_range': date_range,
                'segment_by': segment_by
            }

        except Exception as e:
            logger.error(f"Error analyzing conversion funnel: {e}")
            raise

    def _calculate_funnel_metrics(self, funnel_data: List[Dict]) -> Dict[str, Any]:
        """Calculate conversion rates and drop-off metrics"""
        metrics = {
            'total_users_at_top': funnel_data[0]['users'] if funnel_data else 0,
            'step_metrics': [],
            'overall_conversion_rate': 0.0,
            'biggest_drop_off_step': None,
            'biggest_drop_off_rate': 0.0
        }

        previous_users = None
        biggest_drop_off = 0.0
        biggest_drop_off_step = None

        for i, step in enumerate(funnel_data):
            current_users = step['users']

            if previous_users is not None:
                conversion_rate = (current_users / previous_users * 100) if previous_users > 0 else 0
                drop_off_rate = 100 - conversion_rate

                if drop_off_rate > biggest_drop_off:
                    biggest_drop_off = drop_off_rate
                    biggest_drop_off_step = step['step_name']
            else:
                conversion_rate = 100.0  # First step is 100%
                drop_off_rate = 0.0

            step_metric = {
                'step_name': step['step_name'],
                'step_order': step['step_order'],
                'users': current_users,
                'events': step['events'],
                'conversion_rate_from_previous': conversion_rate,
                'drop_off_rate': drop_off_rate,
                'conversion_rate_from_top': (current_users / metrics['total_users_at_top'] * 100) if metrics['total_users_at_top'] > 0 else 0
            }

            metrics['step_metrics'].append(step_metric)
            previous_users = current_users

        # Overall conversion rate (last step / first step)
        if funnel_data and metrics['total_users_at_top'] > 0:
            final_users = funnel_data[-1]['users']
            metrics['overall_conversion_rate'] = (final_users / metrics['total_users_at_top']) * 100

        metrics['biggest_drop_off_step'] = biggest_drop_off_step
        metrics['biggest_drop_off_rate'] = biggest_drop_off

        return metrics

    def _calculate_segmented_funnel_metrics(self, funnel_data: List[Dict], segment_by: str) -> Dict[str, Any]:
        """Calculate conversion rates for segmented funnel analysis"""
        # Get all unique segments
        segments = set()
        for step in funnel_data:
            for row in step['segment_data']:
                segments.add(row[0])  # First column is the segment value

        segmented_metrics = {}

        for segment in segments:
            segment_funnel_data = []

            for step in funnel_data:
                # Find data for this segment in this step
                segment_row = next((row for row in step['segment_data'] if row[0] == segment), None)
                users = segment_row[1] if segment_row else 0
                events = segment_row[2] if segment_row else 0

                segment_funnel_data.append({
                    'step_name': step['step_name'],
                    'step_order': step['step_order'],
                    'users': users,
                    'events': events
                })

            # Calculate metrics for this segment
            segment_metrics = self._calculate_funnel_metrics(segment_funnel_data)
            segmented_metrics[segment] = segment_metrics

        return segmented_metrics

    def perform_cohort_analysis(self,
                               cohort_period: str = 'monthly',
                               retention_periods: int = 12,
                               date_range: Tuple[str, str] = None) -> CohortAnalysisResult:
        """
        Perform cohort analysis to understand user retention

        Args:
            cohort_period: 'monthly' or 'weekly'
            retention_periods: Number of periods to analyze
            date_range: Optional date range filter

        Returns:
            CohortAnalysisResult object
        """
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"WHERE timestamp >= '{date_range[0]}' AND timestamp <= '{date_range[1]}'"

            # Query to get user first activity and subsequent activities
            query = f"""
            WITH user_first_activity AS (
                SELECT
                    user_id,
                    MIN(timestamp) as first_activity_date,
                    {f"toStartOf{cohort_period.title()}(MIN(timestamp))" if cohort_period == 'monthly' else "toMonday(MIN(timestamp))"} as cohort_period
                FROM user_events
                {date_filter}
                GROUP BY user_id
            ),
            user_activities AS (
                SELECT
                    ue.user_id,
                    ufa.cohort_period,
                    {f"toStartOf{cohort_period.title()}(ue.timestamp)" if cohort_period == 'monthly' else "toMonday(ue.timestamp)"} as activity_period,
                    COUNT(*) as activities
                FROM user_events ue
                JOIN user_first_activity ufa ON ue.user_id = ufa.user_id
                {date_filter.replace('WHERE', 'WHERE ue.timestamp >= ufa.first_activity_date AND')}
                GROUP BY ue.user_id, ufa.cohort_period, activity_period
            )
            SELECT
                cohort_period,
                activity_period,
                COUNT(DISTINCT user_id) as active_users,
                SUM(activities) as total_activities
            FROM user_activities
            GROUP BY cohort_period, activity_period
            ORDER BY cohort_period, activity_period
            """

            result = self.client.query(query)
            df = pd.DataFrame(result.result_rows,
                            columns=['cohort_period', 'activity_period', 'active_users', 'total_activities'])

            # Convert to datetime
            df['cohort_period'] = pd.to_datetime(df['cohort_period'])
            df['activity_period'] = pd.to_datetime(df['activity_period'])

            # Calculate period number (0 for cohort period, 1 for next period, etc.)
            if cohort_period == 'monthly':
                df['period_number'] = ((df['activity_period'].dt.year - df['cohort_period'].dt.year) * 12 +
                                     df['activity_period'].dt.month - df['cohort_period'].dt.month)
            else:  # weekly
                df['period_number'] = ((df['activity_period'] - df['cohort_period']).dt.days // 7)

            # Filter to desired retention periods
            df = df[df['period_number'] <= retention_periods]

            # Get cohort sizes (users in period 0)
            cohort_sizes = df[df['period_number'] == 0].set_index('cohort_period')['active_users'].to_dict()

            # Create retention rate table
            retention_table = df.pivot_table(index='cohort_period',
                                           columns='period_number',
                                           values='active_users',
                                           fill_value=0)

            # Calculate retention rates
            retention_rates = retention_table.divide(retention_table[0], axis=0)

            # Calculate average retention rates across cohorts
            average_retention = {}
            for period in retention_rates.columns:
                avg_retention = retention_rates[period].mean()
                average_retention[f'period_{period}'] = avg_retention

            return CohortAnalysisResult(
                cohort_data=df,
                retention_rates=retention_rates,
                average_retention=average_retention,
                cohort_sizes=cohort_sizes
            )

        except Exception as e:
            logger.error(f"Error performing cohort analysis: {e}")
            raise

    def analyze_ab_test_results(self,
                              test_name: str,
                              metric_name: str,
                              date_range: Tuple[str, str] = None) -> Dict[str, Any]:
        """
        Analyze A/B test results with statistical significance

        Args:
            test_name: Name of the A/B test
            metric_name: Metric to analyze (e.g., 'conversion_rate', 'revenue')
            date_range: Optional date range filter

        Returns:
            Dictionary containing A/B test analysis results
        """
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"AND timestamp >= '{date_range[0]}' AND timestamp <= '{date_range[1]}'"

            # Query A/B test data
            query = f"""
            SELECT
                variant,
                COUNT(DISTINCT user_id) as users,
                COUNT(*) as events,
                AVG(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) as conversion_rate,
                SUM(CASE WHEN event_type = 'revenue' THEN event_value ELSE 0 END) as total_revenue,
                AVG(CASE WHEN event_type = 'revenue' THEN event_value ELSE 0 END) as avg_revenue_per_user
            FROM ab_test_results
            WHERE test_name = '{test_name}'
            {date_filter}
            GROUP BY variant
            ORDER BY variant
            """

            result = self.client.query(query)
            df = pd.DataFrame(result.result_rows,
                            columns=['variant', 'users', 'events', 'conversion_rate', 'total_revenue', 'avg_revenue_per_user'])

            if len(df) < 2:
                raise ValueError("Need at least 2 variants for A/B test analysis")

            # Perform statistical significance test
            control = df[df['variant'] == 'control'].iloc[0] if 'control' in df['variant'].values else df.iloc[0]
            treatment = df[df['variant'] != control['variant']].iloc[0]

            # Statistical test based on metric type
            if metric_name == 'conversion_rate':
                # Chi-square test for conversion rates
                control_conversions = int(control['conversion_rate'] * control['users'])
                treatment_conversions = int(treatment['conversion_rate'] * treatment['users'])

                observed = np.array([[control_conversions, control['users'] - control_conversions],
                                   [treatment_conversions, treatment['users'] - treatment_conversions]])

                chi2, p_value, _, _ = stats.chi2_contingency(observed)
                test_statistic = chi2
                test_type = 'chi_square'

            else:  # Revenue or other continuous metrics
                # T-test for continuous metrics
                # Note: We'd need individual user data for proper t-test
                # This is a simplified version using summary statistics
                control_mean = control[metric_name]
                treatment_mean = treatment[metric_name]

                # Simplified calculation - in practice, you'd want individual observations
                pooled_std = np.sqrt(((control['users'] - 1) * (control_mean * 0.3)**2 +
                                    (treatment['users'] - 1) * (treatment_mean * 0.3)**2) /
                                   (control['users'] + treatment['users'] - 2))

                standard_error = pooled_std * np.sqrt(1/control['users'] + 1/treatment['users'])
                test_statistic = (treatment_mean - control_mean) / standard_error

                # Two-tailed t-test
                degrees_freedom = control['users'] + treatment['users'] - 2
                p_value = 2 * (1 - stats.t.cdf(abs(test_statistic), degrees_freedom))
                test_type = 't_test'

            # Calculate effect size and confidence interval
            control_value = control[metric_name]
            treatment_value = treatment[metric_name]

            relative_improvement = ((treatment_value - control_value) / control_value * 100) if control_value > 0 else 0
            absolute_improvement = treatment_value - control_value

            # Determine significance
            is_significant = p_value < 0.05
            significance_level = "significant" if is_significant else "not significant"

            return {
                'test_name': test_name,
                'metric_name': metric_name,
                'variants': df.to_dict('records'),
                'statistical_test': {
                    'test_type': test_type,
                    'test_statistic': float(test_statistic),
                    'p_value': float(p_value),
                    'is_significant': is_significant,
                    'significance_level': significance_level
                },
                'effect_size': {
                    'control_value': float(control_value),
                    'treatment_value': float(treatment_value),
                    'absolute_improvement': float(absolute_improvement),
                    'relative_improvement': float(relative_improvement)
                },
                'sample_sizes': {
                    'control': int(control['users']),
                    'treatment': int(treatment['users']),
                    'total': int(control['users'] + treatment['users'])
                },
                'analysis_date': datetime.now().isoformat(),
                'date_range': date_range
            }

        except Exception as e:
            logger.error(f"Error analyzing A/B test results: {e}")
            raise

    def create_attribution_model(self,
                                attribution_window: int = 30,
                                model_type: str = 'linear',
                                date_range: Tuple[str, str] = None) -> Dict[str, Any]:
        """
        Create marketing attribution model

        Args:
            attribution_window: Days to look back for attribution
            model_type: 'first_touch', 'last_touch', 'linear', 'time_decay'
            date_range: Optional date range filter

        Returns:
            Dictionary containing attribution analysis results
        """
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"WHERE conversion_timestamp >= '{date_range[0]}' AND conversion_timestamp <= '{date_range[1]}'"

            # Query marketing attribution data
            query = f"""
            WITH conversions AS (
                SELECT
                    user_id,
                    timestamp as conversion_timestamp,
                    event_value as conversion_value
                FROM user_events
                WHERE event_type = 'conversion'
                {date_filter.replace('WHERE', 'AND') if date_filter else ''}
            ),
            touchpoints AS (
                SELECT
                    ma.user_id,
                    ma.channel,
                    ma.campaign,
                    ma.timestamp as touchpoint_timestamp,
                    c.conversion_timestamp,
                    c.conversion_value,
                    dateDiff('day', ma.timestamp, c.conversion_timestamp) as days_to_conversion
                FROM marketing_attribution ma
                JOIN conversions c ON ma.user_id = c.user_id
                WHERE dateDiff('day', ma.timestamp, c.conversion_timestamp) BETWEEN 0 AND {attribution_window}
            )
            SELECT
                user_id,
                channel,
                campaign,
                touchpoint_timestamp,
                conversion_timestamp,
                conversion_value,
                days_to_conversion,
                ROW_NUMBER() OVER (PARTITION BY user_id, conversion_timestamp ORDER BY touchpoint_timestamp) as touch_order,
                COUNT(*) OVER (PARTITION BY user_id, conversion_timestamp) as total_touches
            FROM touchpoints
            ORDER BY user_id, conversion_timestamp, touchpoint_timestamp
            """

            result = self.client.query(query)
            df = pd.DataFrame(result.result_rows,
                            columns=['user_id', 'channel', 'campaign', 'touchpoint_timestamp',
                                   'conversion_timestamp', 'conversion_value', 'days_to_conversion',
                                   'touch_order', 'total_touches'])

            if df.empty:
                return {'error': 'No attribution data found for the specified parameters'}

            # Apply attribution model
            if model_type == 'first_touch':
                df['attribution_weight'] = np.where(df['touch_order'] == 1, 1.0, 0.0)
            elif model_type == 'last_touch':
                df['attribution_weight'] = np.where(df['touch_order'] == df['total_touches'], 1.0, 0.0)
            elif model_type == 'linear':
                df['attribution_weight'] = 1.0 / df['total_touches']
            elif model_type == 'time_decay':
                # Time decay with half-life of 7 days
                half_life = 7
                decay_rate = np.log(2) / half_life
                df['attribution_weight'] = np.exp(-decay_rate * df['days_to_conversion'])
                # Normalize weights per conversion
                df['attribution_weight'] = df.groupby(['user_id', 'conversion_timestamp'])['attribution_weight'].transform(
                    lambda x: x / x.sum()
                )

            # Calculate attributed conversions and revenue
            df['attributed_conversions'] = df['attribution_weight']
            df['attributed_revenue'] = df['attribution_weight'] * df['conversion_value']

            # Aggregate by channel
            channel_attribution = df.groupby('channel').agg({
                'attributed_conversions': 'sum',
                'attributed_revenue': 'sum',
                'user_id': 'nunique'
            }).reset_index()

            channel_attribution.columns = ['channel', 'attributed_conversions', 'attributed_revenue', 'unique_users']
            channel_attribution['cost_per_conversion'] = channel_attribution['attributed_revenue'] / channel_attribution['attributed_conversions']
            channel_attribution['revenue_per_user'] = channel_attribution['attributed_revenue'] / channel_attribution['unique_users']

            # Aggregate by campaign
            campaign_attribution = df.groupby(['channel', 'campaign']).agg({
                'attributed_conversions': 'sum',
                'attributed_revenue': 'sum',
                'user_id': 'nunique'
            }).reset_index()

            campaign_attribution.columns = ['channel', 'campaign', 'attributed_conversions', 'attributed_revenue', 'unique_users']

            return {
                'model_type': model_type,
                'attribution_window': attribution_window,
                'channel_attribution': channel_attribution.to_dict('records'),
                'campaign_attribution': campaign_attribution.to_dict('records'),
                'total_attributed_conversions': float(df['attributed_conversions'].sum()),
                'total_attributed_revenue': float(df['attributed_revenue'].sum()),
                'unique_converting_users': int(df['user_id'].nunique()),
                'analysis_date': datetime.now().isoformat(),
                'date_range': date_range
            }

        except Exception as e:
            logger.error(f"Error creating attribution model: {e}")
            raise

    def generate_funnel_visualizations(self, funnel_analysis: Dict[str, Any]) -> Dict[str, go.Figure]:
        """
        Generate interactive visualizations for funnel analysis

        Args:
            funnel_analysis: Result from analyze_conversion_funnel

        Returns:
            Dictionary of Plotly figures
        """
        figures = {}

        try:
            # Basic funnel chart
            if 'funnel_metrics' in funnel_analysis and 'step_metrics' in funnel_analysis['funnel_metrics']:
                step_metrics = funnel_analysis['funnel_metrics']['step_metrics']

                fig_funnel = go.Figure(go.Funnel(
                    y=[step['step_name'] for step in step_metrics],
                    x=[step['users'] for step in step_metrics],
                    textinfo="value+percent initial",
                    textfont=dict(size=12),
                    connector=dict(line=dict(color="royalblue", dash="dot", width=2))
                ))

                fig_funnel.update_layout(
                    title="Conversion Funnel",
                    font=dict(size=10)
                )

                figures['funnel_chart'] = fig_funnel

                # Conversion rate chart
                fig_conversion = go.Figure()

                fig_conversion.add_trace(go.Bar(
                    x=[step['step_name'] for step in step_metrics],
                    y=[step['conversion_rate_from_previous'] for step in step_metrics],
                    name='Conversion Rate from Previous Step',
                    text=[f"{step['conversion_rate_from_previous']:.1f}%" for step in step_metrics],
                    textposition='auto'
                ))

                fig_conversion.update_layout(
                    title='Step-by-Step Conversion Rates',
                    xaxis_title='Funnel Steps',
                    yaxis_title='Conversion Rate (%)',
                    showlegend=False
                )

                figures['conversion_rates'] = fig_conversion

            return figures

        except Exception as e:
            logger.error(f"Error generating funnel visualizations: {e}")
            return {}

    def generate_cohort_heatmap(self, cohort_result: CohortAnalysisResult) -> go.Figure:
        """
        Generate cohort retention heatmap

        Args:
            cohort_result: Result from perform_cohort_analysis

        Returns:
            Plotly heatmap figure
        """
        try:
            retention_rates = cohort_result.retention_rates

            # Convert to percentage and round
            retention_percentage = (retention_rates * 100).round(1)

            fig = go.Figure(data=go.Heatmap(
                z=retention_percentage.values,
                x=retention_percentage.columns,
                y=[date.strftime('%Y-%m') for date in retention_percentage.index],
                colorscale='RdYlBu',
                text=retention_percentage.values,
                texttemplate="%{text}%",
                textfont={"size": 10},
                colorbar=dict(title="Retention Rate (%)")
            ))

            fig.update_layout(
                title='Cohort Retention Heatmap',
                xaxis_title='Period Number',
                yaxis_title='Cohort Month',
                yaxis=dict(autorange='reversed')
            )

            return fig

        except Exception as e:
            logger.error(f"Error generating cohort heatmap: {e}")
            return go.Figure()

    def export_analysis_results(self,
                              analysis_results: Dict[str, Any],
                              file_path: str,
                              format: str = 'json') -> bool:
        """
        Export analysis results to file

        Args:
            analysis_results: Results to export
            file_path: Output file path
            format: Export format ('json', 'csv', 'excel')

        Returns:
            Boolean indicating success
        """
        try:
            if format == 'json':
                with open(file_path, 'w') as f:
                    json.dump(analysis_results, f, indent=2, default=str)

            elif format == 'csv':
                # Export step metrics to CSV
                if 'funnel_metrics' in analysis_results and 'step_metrics' in analysis_results['funnel_metrics']:
                    df = pd.DataFrame(analysis_results['funnel_metrics']['step_metrics'])
                    df.to_csv(file_path, index=False)

            elif format == 'excel':
                with pd.ExcelWriter(file_path) as writer:
                    if 'funnel_metrics' in analysis_results:
                        df_funnel = pd.DataFrame(analysis_results['funnel_metrics']['step_metrics'])
                        df_funnel.to_excel(writer, sheet_name='Funnel_Metrics', index=False)

                    if 'channel_attribution' in analysis_results:
                        df_attribution = pd.DataFrame(analysis_results['channel_attribution'])
                        df_attribution.to_excel(writer, sheet_name='Attribution', index=False)

            logger.info(f"Analysis results exported to {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error exporting analysis results: {e}")
            return False
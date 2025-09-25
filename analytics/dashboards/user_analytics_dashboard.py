"""
User Analytics Dashboard for GlobalTaxCalc Analytics Platform

This module provides detailed user behavior analysis, acquisition tracking,
retention metrics, and engagement insights.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from scipy import stats

class UserAnalyticsDashboard:
    """Comprehensive user analytics dashboard"""

    def __init__(self, clickhouse_client):
        self.client = clickhouse_client
        self.colors = {
            'primary': '#667eea',
            'secondary': '#f59e0b',
            'success': '#10b981',
            'danger': '#ef4444',
            'warning': '#f97316',
            'info': '#06b6d4',
            'purple': '#8b5cf6',
            'pink': '#ec4899'
        }

    def get_user_acquisition_metrics(self, date_range: Tuple[datetime, datetime]) -> Dict[str, Any]:
        """Get comprehensive user acquisition metrics"""

        query = """
        SELECT
            -- Acquisition overview
            COUNT(DISTINCT CASE WHEN event_name = 'signup' THEN user_id END) as new_users,
            COUNT(DISTINCT user_id) as total_active_users,

            -- Acquisition channels
            COUNT(DISTINCT CASE WHEN attribution_channel = 'organic' THEN user_id END) as organic_users,
            COUNT(DISTINCT CASE WHEN attribution_channel = 'paid_search' THEN user_id END) as paid_search_users,
            COUNT(DISTINCT CASE WHEN attribution_channel = 'social' THEN user_id END) as social_users,
            COUNT(DISTINCT CASE WHEN attribution_channel = 'email' THEN user_id END) as email_users,
            COUNT(DISTINCT CASE WHEN attribution_channel = 'referral' THEN user_id END) as referral_users,
            COUNT(DISTINCT CASE WHEN attribution_channel = 'direct' THEN user_id END) as direct_users,

            -- Geographic distribution
            uniqArray(user_country) as countries,
            COUNT(DISTINCT CASE WHEN user_country = 'US' THEN user_id END) as us_users,
            COUNT(DISTINCT CASE WHEN user_country = 'CA' THEN user_id END) as canada_users,
            COUNT(DISTINCT CASE WHEN user_country = 'GB' THEN user_id END) as uk_users,

            -- Device breakdown
            COUNT(DISTINCT CASE WHEN device_type = 'mobile' THEN user_id END) as mobile_signups,
            COUNT(DISTINCT CASE WHEN device_type = 'desktop' THEN user_id END) as desktop_signups,
            COUNT(DISTINCT CASE WHEN device_type = 'tablet' THEN user_id END) as tablet_signups,

            -- Time-based patterns
            AVG(CASE WHEN toHour(event_timestamp) BETWEEN 9 AND 17 THEN 1 ELSE 0 END) as business_hours_ratio,

            -- Campaign performance
            COUNT(DISTINCT utm_campaign) as active_campaigns,
            COUNT(DISTINCT CASE WHEN utm_campaign != '' THEN user_id END) as campaign_attributed_users

        FROM user_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d %H:%M:%S'),
            end_date=date_range[1].strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'new_users': data[0],
                'total_active_users': data[1],
                'acquisition_channels': {
                    'organic': data[2],
                    'paid_search': data[3],
                    'social': data[4],
                    'email': data[5],
                    'referral': data[6],
                    'direct': data[7]
                },
                'geographic': {
                    'total_countries': len(data[8]),
                    'us_users': data[9],
                    'canada_users': data[10],
                    'uk_users': data[11]
                },
                'device_breakdown': {
                    'mobile': data[12],
                    'desktop': data[13],
                    'tablet': data[14]
                },
                'business_hours_ratio': round(data[15] * 100, 1),
                'campaign_metrics': {
                    'active_campaigns': data[16],
                    'campaign_attributed_users': data[17]
                }
            }

        return {}

    def get_user_engagement_metrics(self, date_range: Tuple[datetime, datetime]) -> Dict[str, Any]:
        """Calculate detailed user engagement metrics"""

        query = """
        SELECT
            -- Session metrics
            COUNT(DISTINCT session_id) as total_sessions,
            AVG(session_duration_seconds) as avg_session_duration,
            percentile(session_duration_seconds, 0.5) as median_session_duration,
            percentile(session_duration_seconds, 0.95) as p95_session_duration,

            -- Page engagement
            SUM(page_views) as total_page_views,
            AVG(page_views) as avg_page_views_per_session,
            AVG(time_on_page) as avg_time_on_page,
            AVG(page_load_time) as avg_page_load_time,

            -- User activity levels
            COUNT(DISTINCT CASE WHEN event_name = 'calculation_completed' THEN user_id END) as active_calculators,
            COUNT(DISTINCT CASE WHEN event_name = 'export' THEN user_id END) as export_users,
            COUNT(DISTINCT CASE WHEN event_name = 'share' THEN user_id END) as sharing_users,
            COUNT(DISTINCT CASE WHEN event_name = 'save_calculation' THEN user_id END) as saving_users,

            -- Bounce analysis
            COUNT(DISTINCT CASE WHEN page_views = 1 AND session_duration_seconds < 30 THEN session_id END) as bounce_sessions,

            -- Return behavior
            COUNT(DISTINCT CASE WHEN is_new_session = 0 THEN user_id END) as returning_users,

            -- Feature adoption
            COUNT(DISTINCT CASE WHEN event_name LIKE '%premium%' THEN user_id END) as premium_feature_users,
            COUNT(DISTINCT CASE WHEN event_name = 'widget_used' THEN user_id END) as widget_users,

            -- Error tracking
            COUNT(CASE WHEN event_name = 'error' THEN 1 END) as total_errors,
            COUNT(DISTINCT CASE WHEN event_name = 'error' THEN user_id END) as users_with_errors

        FROM user_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d %H:%M:%S'),
            end_date=date_range[1].strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            bounce_rate = (data[12] / max(data[0], 1)) * 100 if data[0] > 0 else 0

            return {
                'session_metrics': {
                    'total_sessions': data[0],
                    'avg_session_duration': round(data[1], 2) if data[1] else 0,
                    'median_session_duration': round(data[2], 2) if data[2] else 0,
                    'p95_session_duration': round(data[3], 2) if data[3] else 0
                },
                'page_metrics': {
                    'total_page_views': data[4],
                    'avg_page_views_per_session': round(data[5], 2) if data[5] else 0,
                    'avg_time_on_page': round(data[6], 2) if data[6] else 0,
                    'avg_page_load_time': round(data[7], 2) if data[7] else 0
                },
                'feature_engagement': {
                    'active_calculators': data[8],
                    'export_users': data[9],
                    'sharing_users': data[10],
                    'saving_users': data[11],
                    'premium_feature_users': data[15],
                    'widget_users': data[16]
                },
                'bounce_rate': round(bounce_rate, 2),
                'returning_users': data[13],
                'error_metrics': {
                    'total_errors': data[17],
                    'users_with_errors': data[18],
                    'error_rate': round((data[18] / max(data[0], 1)) * 100, 2)
                }
            }

        return {}

    def get_user_retention_cohorts(self, cohort_months: int = 12) -> Dict[str, Any]:
        """Calculate user retention cohorts"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=cohort_months * 30)

        query = """
        WITH user_first_activity AS (
            SELECT
                user_id,
                min(toDate(event_timestamp)) as first_activity_date,
                toStartOfMonth(min(toDate(event_timestamp))) as cohort_month
            FROM user_events
            WHERE event_timestamp >= '{start_date}'
                AND event_name = 'signup'
            GROUP BY user_id
        ),
        user_activities AS (
            SELECT
                ue.user_id,
                ufa.cohort_month,
                toStartOfMonth(toDate(ue.event_timestamp)) as activity_month,
                dateDiff('month', ufa.cohort_month, toStartOfMonth(toDate(ue.event_timestamp))) as period_number
            FROM user_events ue
            JOIN user_first_activity ufa ON ue.user_id = ufa.user_id
            WHERE ue.event_timestamp >= '{start_date}'
                AND ue.event_name IN ('page_view', 'calculation_completed', 'subscription')
            GROUP BY ue.user_id, ufa.cohort_month, activity_month
        )
        SELECT
            cohort_month,
            period_number,
            COUNT(DISTINCT user_id) as retained_users
        FROM user_activities
        WHERE period_number <= 11
        GROUP BY cohort_month, period_number
        ORDER BY cohort_month, period_number
        """.format(start_date=start_date.strftime('%Y-%m-%d'))

        result = self.client.execute(query)

        if not result:
            return {}

        # Process cohort data
        cohort_data = {}
        for row in result:
            cohort_month = row[0].strftime('%Y-%m')
            period = row[1]
            users = row[2]

            if cohort_month not in cohort_data:
                cohort_data[cohort_month] = {}

            cohort_data[cohort_month][period] = users

        # Calculate retention rates
        retention_matrix = []
        cohort_sizes = {}

        for cohort_month in sorted(cohort_data.keys()):
            cohort_size = cohort_data[cohort_month].get(0, 0)
            cohort_sizes[cohort_month] = cohort_size

            retention_row = [cohort_month]
            for period in range(12):
                retained = cohort_data[cohort_month].get(period, 0)
                retention_rate = (retained / cohort_size * 100) if cohort_size > 0 else 0
                retention_row.append(round(retention_rate, 1))

            retention_matrix.append(retention_row)

        return {
            'retention_matrix': retention_matrix,
            'cohort_sizes': cohort_sizes,
            'average_retention_by_period': self._calculate_average_retention(retention_matrix)
        }

    def _calculate_average_retention(self, retention_matrix: List[List]) -> List[float]:
        """Calculate average retention rates across cohorts"""

        if not retention_matrix:
            return []

        avg_retention = []
        for period in range(1, len(retention_matrix[0])):  # Skip cohort name column
            period_retentions = [row[period] for row in retention_matrix if len(row) > period]
            avg_retention.append(round(np.mean(period_retentions), 1) if period_retentions else 0)

        return avg_retention

    def create_acquisition_funnel_chart(self, date_range: Tuple[datetime, datetime]) -> go.Figure:
        """Create detailed acquisition funnel visualization"""

        query = """
        SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN user_id END) as page_views,
            COUNT(DISTINCT CASE WHEN event_name = 'signup_started' THEN user_id END) as signup_started,
            COUNT(DISTINCT CASE WHEN event_name = 'signup' THEN user_id END) as signups,
            COUNT(DISTINCT CASE WHEN event_name = 'first_calculation' THEN user_id END) as first_calculation,
            COUNT(DISTINCT CASE WHEN event_name = 'calculation_completed' THEN user_id END) as calculation_completed,
            COUNT(DISTINCT CASE WHEN event_name = 'export' THEN user_id END) as exports,
            COUNT(DISTINCT CASE WHEN event_name = 'subscription' THEN user_id END) as subscriptions
        FROM user_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d %H:%M:%S'),
            end_date=date_range[1].strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        data = result[0]

        stages = [
            'Page Views', 'Signup Started', 'Signups', 'First Calculation',
            'Calculation Completed', 'Exports', 'Subscriptions'
        ]
        values = list(data)

        # Calculate conversion rates
        conversion_rates = []
        for i in range(1, len(values)):
            if values[0] > 0:  # Convert from page views
                rate = (values[i] / values[0]) * 100
                conversion_rates.append(f"{rate:.1f}%")
            else:
                conversion_rates.append("0%")

        fig = go.Figure()

        # Add funnel
        fig.add_trace(go.Funnel(
            y=stages,
            x=values,
            textinfo="value+percent initial",
            marker=dict(
                color=[self.colors['primary'], self.colors['info'], self.colors['success'],
                      self.colors['warning'], self.colors['secondary'], self.colors['purple'],
                      self.colors['danger']]
            )
        ))

        fig.update_layout(
            title='User Acquisition Funnel',
            height=600,
            font=dict(size=12)
        )

        return fig

    def create_user_engagement_timeline(self, days: int = 30) -> go.Figure:
        """Create user engagement timeline chart"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            toDate(event_timestamp) as date,
            COUNT(DISTINCT user_id) as daily_active_users,
            COUNT(DISTINCT session_id) as daily_sessions,
            AVG(session_duration_seconds) as avg_session_duration,
            COUNT(DISTINCT CASE WHEN event_name = 'calculation_completed' THEN user_id END) as calculating_users,
            COUNT(DISTINCT CASE WHEN is_new_session = 1 THEN user_id END) as new_users
        FROM user_events
        WHERE toDate(event_timestamp) BETWEEN '{start_date}' AND '{end_date}'
        GROUP BY date
        ORDER BY date
        """.format(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=[
            'date', 'dau', 'sessions', 'avg_session_duration', 'calculating_users', 'new_users'
        ])
        df['date'] = pd.to_datetime(df['date'])

        # Create subplots
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Daily Active Users', 'Daily Sessions', 'Session Duration', 'User Activity'),
            specs=[[{"secondary_y": True}, {"secondary_y": True}],
                   [{"secondary_y": False}, {"secondary_y": True}]]
        )

        # Daily Active Users
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['dau'], name='DAU',
                      line=dict(color=self.colors['primary'], width=3)),
            row=1, col=1
        )

        # Daily Sessions
        fig.add_trace(
            go.Bar(x=df['date'], y=df['sessions'], name='Sessions',
                   marker_color=self.colors['info']),
            row=1, col=2
        )

        # Session Duration
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['avg_session_duration'], name='Avg Duration',
                      line=dict(color=self.colors['warning'], width=2)),
            row=2, col=1
        )

        # User Activity (Calculating vs New)
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['calculating_users'], name='Calculating Users',
                      line=dict(color=self.colors['success'], width=2)),
            row=2, col=2
        )
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['new_users'], name='New Users',
                      line=dict(color=self.colors['danger'], width=2)),
            row=2, col=2
        )

        fig.update_layout(
            title='User Engagement Timeline - Last 30 Days',
            height=700,
            showlegend=True
        )

        return fig

    def create_retention_heatmap(self) -> go.Figure:
        """Create user retention cohort heatmap"""

        cohort_data = self.get_user_retention_cohorts()
        retention_matrix = cohort_data.get('retention_matrix', [])

        if not retention_matrix:
            return go.Figure()

        # Extract data for heatmap
        cohort_labels = [row[0] for row in retention_matrix]
        retention_data = [row[1:] for row in retention_matrix]

        # Create period labels
        period_labels = [f'Month {i}' for i in range(len(retention_data[0]))]

        fig = go.Figure(data=go.Heatmap(
            z=retention_data,
            x=period_labels,
            y=cohort_labels,
            colorscale='RdYlBu_r',
            text=[[f'{val}%' for val in row] for row in retention_data],
            texttemplate='%{text}',
            textfont={"size": 10},
            colorbar=dict(title="Retention %")
        ))

        fig.update_layout(
            title='User Retention Cohort Analysis',
            xaxis_title='Period',
            yaxis_title='Cohort Month',
            height=600
        )

        return fig

    def create_acquisition_channel_performance(self, days: int = 30) -> go.Figure:
        """Create acquisition channel performance comparison"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            attribution_channel,
            COUNT(DISTINCT user_id) as users,
            COUNT(DISTINCT session_id) as sessions,
            AVG(session_duration_seconds) as avg_session_duration,
            COUNT(DISTINCT CASE WHEN event_name = 'calculation_completed' THEN user_id END) as converting_users,
            COUNT(DISTINCT CASE WHEN event_name = 'subscription' THEN user_id END) as subscribers
        FROM user_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            AND attribution_channel != ''
        GROUP BY attribution_channel
        ORDER BY users DESC
        """.format(
            start_date=start_date.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=end_date.strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=[
            'channel', 'users', 'sessions', 'avg_duration', 'converting_users', 'subscribers'
        ])

        # Calculate rates
        df['conversion_rate'] = (df['converting_users'] / df['users'] * 100).round(2)
        df['subscription_rate'] = (df['subscribers'] / df['users'] * 100).round(2)

        # Create subplots
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Users by Channel', 'Conversion Rate', 'Session Duration', 'Subscription Rate'),
            specs=[[{"type": "bar"}, {"type": "bar"}],
                   [{"type": "bar"}, {"type": "bar"}]]
        )

        # Users by channel
        fig.add_trace(
            go.Bar(x=df['channel'], y=df['users'], name='Users',
                   marker_color=self.colors['primary']),
            row=1, col=1
        )

        # Conversion rate
        fig.add_trace(
            go.Bar(x=df['channel'], y=df['conversion_rate'], name='Conversion %',
                   marker_color=self.colors['success']),
            row=1, col=2
        )

        # Session duration
        fig.add_trace(
            go.Bar(x=df['channel'], y=df['avg_duration'], name='Avg Duration',
                   marker_color=self.colors['warning']),
            row=2, col=1
        )

        # Subscription rate
        fig.add_trace(
            go.Bar(x=df['channel'], y=df['subscription_rate'], name='Subscription %',
                   marker_color=self.colors['danger']),
            row=2, col=2
        )

        fig.update_layout(
            title='Acquisition Channel Performance',
            height=600,
            showlegend=False
        )

        return fig

    def create_user_journey_analysis(self, days: int = 7) -> go.Figure:
        """Create user journey flow analysis"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        WITH user_sequences AS (
            SELECT
                user_id,
                event_name,
                ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_timestamp) as step_number
            FROM user_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
                AND event_name IN ('page_view', 'signup', 'calculation_completed', 'export', 'subscription')
        ),
        step_transitions AS (
            SELECT
                current.event_name as from_step,
                next.event_name as to_step,
                COUNT(*) as transition_count
            FROM user_sequences current
            LEFT JOIN user_sequences next ON current.user_id = next.user_id
                AND next.step_number = current.step_number + 1
            WHERE next.event_name IS NOT NULL
            GROUP BY from_step, to_step
        )
        SELECT from_step, to_step, transition_count
        FROM step_transitions
        ORDER BY transition_count DESC
        """.format(
            start_date=start_date.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=end_date.strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        # Create Sankey diagram
        df = pd.DataFrame(result, columns=['source', 'target', 'value'])

        # Get unique steps
        all_steps = list(set(df['source'].tolist() + df['target'].tolist()))
        step_indices = {step: i for i, step in enumerate(all_steps)}

        # Prepare data for Sankey
        source_indices = [step_indices[step] for step in df['source']]
        target_indices = [step_indices[step] for step in df['target']]

        fig = go.Figure(data=[go.Sankey(
            node=dict(
                pad=15,
                thickness=20,
                line=dict(color="black", width=0.5),
                label=all_steps,
                color=[self.colors['primary'], self.colors['info'], self.colors['success'],
                      self.colors['warning'], self.colors['danger']][:len(all_steps)]
            ),
            link=dict(
                source=source_indices,
                target=target_indices,
                value=df['value'].tolist()
            )
        )])

        fig.update_layout(
            title="User Journey Flow Analysis",
            font_size=10,
            height=500
        )

        return fig

    def generate_user_analytics_report(self, date_range: Tuple[datetime, datetime] = None) -> Dict[str, Any]:
        """Generate comprehensive user analytics report"""

        if not date_range:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            date_range = (start_date, end_date)

        # Get all metrics
        acquisition_metrics = self.get_user_acquisition_metrics(date_range)
        engagement_metrics = self.get_user_engagement_metrics(date_range)
        retention_data = self.get_user_retention_cohorts()

        # Create visualizations
        charts = {
            'acquisition_funnel': self.create_acquisition_funnel_chart(date_range),
            'engagement_timeline': self.create_user_engagement_timeline(),
            'retention_heatmap': self.create_retention_heatmap(),
            'channel_performance': self.create_acquisition_channel_performance(),
            'user_journey': self.create_user_journey_analysis()
        }

        # Generate insights
        insights = self._generate_user_insights(acquisition_metrics, engagement_metrics, retention_data)

        return {
            'acquisition': acquisition_metrics,
            'engagement': engagement_metrics,
            'retention': retention_data,
            'charts': charts,
            'insights': insights,
            'period': {
                'start': date_range[0],
                'end': date_range[1]
            },
            'generated_at': datetime.now()
        }

    def _generate_user_insights(self, acquisition: Dict, engagement: Dict, retention: Dict) -> List[Dict[str, str]]:
        """Generate actionable user insights"""

        insights = []

        # Acquisition insights
        if acquisition:
            total_users = acquisition.get('total_active_users', 0)
            new_users = acquisition.get('new_users', 0)

            if total_users > 0:
                new_user_ratio = (new_users / total_users) * 100
                if new_user_ratio > 30:
                    insights.append({
                        'type': 'success',
                        'category': 'Acquisition',
                        'title': 'Strong New User Growth',
                        'description': f'{new_user_ratio:.1f}% of active users are new this period.'
                    })

            # Channel insights
            channels = acquisition.get('acquisition_channels', {})
            top_channel = max(channels.keys(), key=lambda k: channels[k]) if channels else None
            if top_channel:
                insights.append({
                    'type': 'info',
                    'category': 'Acquisition',
                    'title': f'Top Acquisition Channel: {top_channel.title()}',
                    'description': f'{channels[top_channel]} users acquired through {top_channel}.'
                })

        # Engagement insights
        if engagement:
            bounce_rate = engagement.get('bounce_rate', 0)
            if bounce_rate > 70:
                insights.append({
                    'type': 'warning',
                    'category': 'Engagement',
                    'title': 'High Bounce Rate',
                    'description': f'Bounce rate is {bounce_rate}%. Consider improving landing page experience.'
                })
            elif bounce_rate < 40:
                insights.append({
                    'type': 'success',
                    'category': 'Engagement',
                    'title': 'Excellent User Engagement',
                    'description': f'Low bounce rate of {bounce_rate}% indicates strong user engagement.'
                })

            # Feature adoption
            feature_eng = engagement.get('feature_engagement', {})
            if feature_eng.get('active_calculators', 0) > 0:
                calc_rate = (feature_eng['active_calculators'] / engagement.get('session_metrics', {}).get('total_sessions', 1)) * 100
                if calc_rate > 25:
                    insights.append({
                        'type': 'success',
                        'category': 'Product',
                        'title': 'High Calculator Engagement',
                        'description': f'{calc_rate:.1f}% of sessions include calculator usage.'
                    })

        # Retention insights
        if retention and retention.get('average_retention_by_period'):
            avg_retention = retention['average_retention_by_period']
            if len(avg_retention) > 0:
                month_1_retention = avg_retention[0] if len(avg_retention) > 0 else 0
                if month_1_retention > 40:
                    insights.append({
                        'type': 'success',
                        'category': 'Retention',
                        'title': 'Strong Month 1 Retention',
                        'description': f'{month_1_retention}% of users return in month 1.'
                    })
                elif month_1_retention < 20:
                    insights.append({
                        'type': 'warning',
                        'category': 'Retention',
                        'title': 'Low Month 1 Retention',
                        'description': f'Only {month_1_retention}% of users return in month 1. Consider onboarding improvements.'
                    })

        return insights
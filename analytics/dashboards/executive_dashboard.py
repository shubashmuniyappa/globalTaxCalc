"""
Executive Dashboard for GlobalTaxCalc Analytics Platform

This module creates comprehensive executive-level dashboards with key business metrics,
KPIs, and strategic insights for leadership decision making.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np

class ExecutiveDashboard:
    """Executive dashboard generator for high-level business metrics"""

    def __init__(self, clickhouse_client):
        self.client = clickhouse_client
        self.colors = {
            'primary': '#667eea',
            'secondary': '#f59e0b',
            'success': '#10b981',
            'danger': '#ef4444',
            'warning': '#f97316',
            'info': '#06b6d4'
        }

    def generate_executive_summary(self, date_range: tuple = None) -> Dict[str, Any]:
        """Generate executive summary with key business metrics"""

        if not date_range:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            date_range = (start_date, end_date)

        # Core business metrics
        user_metrics = self._get_user_metrics(date_range)
        revenue_metrics = self._get_revenue_metrics(date_range)
        product_metrics = self._get_product_metrics(date_range)
        growth_metrics = self._get_growth_metrics(date_range)

        return {
            'users': user_metrics,
            'revenue': revenue_metrics,
            'product': product_metrics,
            'growth': growth_metrics,
            'timestamp': datetime.now(),
            'period': {
                'start': date_range[0],
                'end': date_range[1],
                'days': (date_range[1] - date_range[0]).days
            }
        }

    def _get_user_metrics(self, date_range: tuple) -> Dict[str, Any]:
        """Calculate user-related metrics"""

        query = """
        SELECT
            COUNT(DISTINCT user_id) as total_users,
            COUNT(DISTINCT CASE WHEN event_name = 'signup' THEN user_id END) as new_users,
            COUNT(DISTINCT CASE WHEN user_type = 'premium' THEN user_id END) as premium_users,
            COUNT(DISTINCT session_id) as total_sessions,
            AVG(session_duration_seconds) as avg_session_duration,
            COUNT(DISTINCT CASE WHEN event_name = 'calculation_completed' THEN user_id END) as active_calculators,
            COUNT(*) as total_events,

            -- Geographic distribution
            uniqArray(user_country) as countries_count,

            -- Device breakdown
            COUNT(DISTINCT CASE WHEN device_type = 'mobile' THEN user_id END) as mobile_users,
            COUNT(DISTINCT CASE WHEN device_type = 'desktop' THEN user_id END) as desktop_users,

            -- Engagement metrics
            AVG(page_views) as avg_page_views_per_session,
            AVG(time_on_page) as avg_time_on_page

        FROM user_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d'),
            end_date=date_range[1].strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'total_users': data[0],
                'new_users': data[1],
                'premium_users': data[2],
                'total_sessions': data[3],
                'avg_session_duration': round(data[4], 2) if data[4] else 0,
                'active_calculators': data[5],
                'total_events': data[6],
                'countries_served': data[7],
                'mobile_users': data[8],
                'desktop_users': data[9],
                'avg_page_views': round(data[10], 2) if data[10] else 0,
                'avg_time_on_page': round(data[11], 2) if data[11] else 0
            }

        return {}

    def _get_revenue_metrics(self, date_range: tuple) -> Dict[str, Any]:
        """Calculate revenue-related metrics"""

        query = """
        SELECT
            SUM(revenue_amount_usd) as total_revenue,
            AVG(revenue_amount_usd) as avg_revenue_per_transaction,
            COUNT(DISTINCT user_id) as paying_customers,
            COUNT(*) as total_transactions,

            -- Revenue by type
            SUM(CASE WHEN event_type = 'subscription' THEN revenue_amount_usd ELSE 0 END) as subscription_revenue,
            SUM(CASE WHEN event_type = 'purchase' THEN revenue_amount_usd ELSE 0 END) as one_time_revenue,

            -- Subscription metrics
            COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as new_subscriptions,
            COUNT(CASE WHEN event_type = 'renewal' THEN 1 END) as renewals,
            COUNT(CASE WHEN event_type = 'refund' THEN 1 END) as refunds,

            -- Product mix
            SUM(CASE WHEN product_type = 'premium' THEN revenue_amount_usd ELSE 0 END) as premium_revenue,
            SUM(CASE WHEN product_type = 'professional' THEN revenue_amount_usd ELSE 0 END) as professional_revenue,
            SUM(CASE WHEN product_type = 'enterprise' THEN revenue_amount_usd ELSE 0 END) as enterprise_revenue,

            -- Geographic revenue
            uniqArray(billing_country) as revenue_countries,

            -- Discounts and promotions
            SUM(discount_amount) as total_discounts,
            AVG(discount_percentage) as avg_discount_rate

        FROM revenue_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d'),
            end_date=date_range[1].strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'total_revenue': round(data[0], 2) if data[0] else 0,
                'avg_revenue_per_transaction': round(data[1], 2) if data[1] else 0,
                'paying_customers': data[2],
                'total_transactions': data[3],
                'subscription_revenue': round(data[4], 2) if data[4] else 0,
                'one_time_revenue': round(data[5], 2) if data[5] else 0,
                'new_subscriptions': data[6],
                'renewals': data[7],
                'refunds': data[8],
                'premium_revenue': round(data[9], 2) if data[9] else 0,
                'professional_revenue': round(data[10], 2) if data[10] else 0,
                'enterprise_revenue': round(data[11], 2) if data[11] else 0,
                'revenue_countries': data[12],
                'total_discounts': round(data[13], 2) if data[13] else 0,
                'avg_discount_rate': round(data[14], 2) if data[14] else 0
            }

        return {}

    def _get_product_metrics(self, date_range: tuple) -> Dict[str, Any]:
        """Calculate product usage metrics"""

        query = """
        SELECT
            COUNT(*) as total_calculations,
            COUNT(DISTINCT user_id) as calculating_users,
            AVG(calculation_duration_ms) as avg_calculation_time,

            -- Calculator type breakdown
            COUNT(CASE WHEN calculator_type = 'income_tax' THEN 1 END) as income_tax_calculations,
            COUNT(CASE WHEN calculator_type = 'paycheck' THEN 1 END) as paycheck_calculations,
            COUNT(CASE WHEN calculator_type = 'sales_tax' THEN 1 END) as sales_tax_calculations,
            COUNT(CASE WHEN calculator_type = 'property_tax' THEN 1 END) as property_tax_calculations,
            COUNT(CASE WHEN calculator_type = 'capital_gains' THEN 1 END) as capital_gains_calculations,
            COUNT(CASE WHEN calculator_type = 'retirement' THEN 1 END) as retirement_calculations,

            -- Performance metrics
            COUNT(CASE WHEN error_occurred = 1 THEN 1 END) as calculation_errors,
            COUNT(CASE WHEN cache_hit = 1 THEN 1 END) as cache_hits,
            COUNT(CASE WHEN offline_calculation = 1 THEN 1 END) as offline_calculations,

            -- Value metrics
            SUM(tax_amount_total) as total_tax_calculated,
            AVG(tax_rate_effective) as avg_effective_tax_rate,

            -- Geographic usage
            uniqArray(tax_jurisdiction_country) as tax_jurisdictions,

            -- Interaction patterns
            COUNT(CASE WHEN interaction_type = 'saved' THEN 1 END) as saved_calculations,
            COUNT(CASE WHEN interaction_type = 'shared' THEN 1 END) as shared_calculations,
            COUNT(CASE WHEN interaction_type = 'exported' THEN 1 END) as exported_calculations

        FROM calculator_usage
        WHERE calculation_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d'),
            end_date=date_range[1].strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'total_calculations': data[0],
                'calculating_users': data[1],
                'avg_calculation_time': round(data[2], 2) if data[2] else 0,
                'calculator_breakdown': {
                    'income_tax': data[3],
                    'paycheck': data[4],
                    'sales_tax': data[5],
                    'property_tax': data[6],
                    'capital_gains': data[7],
                    'retirement': data[8]
                },
                'calculation_errors': data[9],
                'cache_hits': data[10],
                'offline_calculations': data[11],
                'total_tax_calculated': round(data[12], 2) if data[12] else 0,
                'avg_effective_tax_rate': round(data[13] * 100, 2) if data[13] else 0,
                'tax_jurisdictions': data[14],
                'saved_calculations': data[15],
                'shared_calculations': data[16],
                'exported_calculations': data[17]
            }

        return {}

    def _get_growth_metrics(self, date_range: tuple) -> Dict[str, Any]:
        """Calculate growth and trend metrics"""

        # Current period metrics
        current_period = self._get_period_comparison_data(date_range)

        # Previous period for comparison
        period_length = (date_range[1] - date_range[0]).days
        prev_start = date_range[0] - timedelta(days=period_length)
        prev_end = date_range[0]
        previous_period = self._get_period_comparison_data((prev_start, prev_end))

        # Calculate growth rates
        growth_metrics = {}

        for metric in ['users', 'revenue', 'calculations', 'sessions']:
            current_val = current_period.get(metric, 0)
            previous_val = previous_period.get(metric, 0)

            if previous_val > 0:
                growth_rate = ((current_val - previous_val) / previous_val) * 100
            else:
                growth_rate = 0 if current_val == 0 else 100

            growth_metrics[f'{metric}_growth'] = round(growth_rate, 2)
            growth_metrics[f'{metric}_current'] = current_val
            growth_metrics[f'{metric}_previous'] = previous_val

        return growth_metrics

    def _get_period_comparison_data(self, date_range: tuple) -> Dict[str, Any]:
        """Get comparison data for a specific period"""

        query = """
        SELECT
            COUNT(DISTINCT ue.user_id) as users,
            COALESCE(SUM(re.revenue_amount_usd), 0) as revenue,
            COUNT(DISTINCT cu.usage_id) as calculations,
            COUNT(DISTINCT ue.session_id) as sessions
        FROM user_events ue
        LEFT JOIN revenue_events re ON ue.user_id = re.user_id
            AND re.event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        LEFT JOIN calculator_usage cu ON ue.user_id = cu.user_id
            AND cu.calculation_timestamp BETWEEN '{start_date}' AND '{end_date}'
        WHERE ue.event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d'),
            end_date=date_range[1].strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'users': data[0],
                'revenue': data[1],
                'calculations': data[2],
                'sessions': data[3]
            }

        return {}

    def create_revenue_trend_chart(self, days: int = 30) -> go.Figure:
        """Create revenue trend chart"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            event_date,
            SUM(revenue_amount_usd) as daily_revenue,
            COUNT(DISTINCT user_id) as daily_customers,
            COUNT(*) as daily_transactions
        FROM revenue_events
        WHERE event_date BETWEEN '{start_date}' AND '{end_date}'
        GROUP BY event_date
        ORDER BY event_date
        """.format(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=['date', 'revenue', 'customers', 'transactions'])
        df['date'] = pd.to_datetime(df['date'])

        # Create subplot with secondary y-axis
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Daily Revenue', 'Daily Customers', 'Daily Transactions', 'Revenue Trend'),
            specs=[[{"secondary_y": True}, {"secondary_y": True}],
                   [{"secondary_y": True}, {"secondary_y": True}]]
        )

        # Daily Revenue
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['revenue'], name='Revenue',
                      line=dict(color=self.colors['primary'], width=3)),
            row=1, col=1
        )

        # Daily Customers
        fig.add_trace(
            go.Bar(x=df['date'], y=df['customers'], name='Customers',
                   marker_color=self.colors['success']),
            row=1, col=2
        )

        # Daily Transactions
        fig.add_trace(
            go.Bar(x=df['date'], y=df['transactions'], name='Transactions',
                   marker_color=self.colors['info']),
            row=2, col=1
        )

        # Revenue Trend with Moving Average
        df['revenue_ma'] = df['revenue'].rolling(window=7).mean()
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['revenue'], name='Daily Revenue',
                      line=dict(color=self.colors['primary'], width=1)),
            row=2, col=2
        )
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['revenue_ma'], name='7-Day Average',
                      line=dict(color=self.colors['danger'], width=3)),
            row=2, col=2
        )

        fig.update_layout(
            title='Revenue Trends - Last 30 Days',
            height=600,
            showlegend=True
        )

        return fig

    def create_user_acquisition_funnel(self, days: int = 30) -> go.Figure:
        """Create user acquisition funnel visualization"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN user_id END) as visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'signup_started' THEN user_id END) as signup_started,
            COUNT(DISTINCT CASE WHEN event_name = 'signup' THEN user_id END) as signups,
            COUNT(DISTINCT CASE WHEN event_name = 'first_calculation' THEN user_id END) as first_calculation,
            COUNT(DISTINCT CASE WHEN event_name = 'subscription' THEN user_id END) as subscriptions
        FROM user_events
        WHERE event_date BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        data = result[0]

        # Funnel data
        stages = ['Visitors', 'Signup Started', 'Signups', 'First Calculation', 'Subscriptions']
        values = [data[0], data[1], data[2], data[3], data[4]]

        # Calculate conversion rates
        conversion_rates = []
        for i in range(1, len(values)):
            if values[i-1] > 0:
                rate = (values[i] / values[i-1]) * 100
            else:
                rate = 0
            conversion_rates.append(f"{rate:.1f}%")

        fig = go.Figure(go.Funnel(
            y=stages,
            x=values,
            textinfo="value+percent initial",
            marker_color=[self.colors['primary'], self.colors['info'],
                         self.colors['success'], self.colors['warning'], self.colors['danger']]
        ))

        fig.update_layout(
            title='User Acquisition Funnel - Last 30 Days',
            height=500
        )

        return fig

    def create_calculator_usage_heatmap(self, days: int = 30) -> go.Figure:
        """Create calculator usage heatmap by hour and day"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            toDayOfWeek(calculation_timestamp) as day_of_week,
            toHour(calculation_timestamp) as hour,
            COUNT(*) as calculation_count
        FROM calculator_usage
        WHERE calculation_date BETWEEN '{start_date}' AND '{end_date}'
        GROUP BY day_of_week, hour
        ORDER BY day_of_week, hour
        """.format(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=['day_of_week', 'hour', 'count'])

        # Create pivot table for heatmap
        heatmap_data = df.pivot(index='day_of_week', columns='hour', values='count').fillna(0)

        # Day labels
        day_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        fig = go.Figure(data=go.Heatmap(
            z=heatmap_data.values,
            x=list(range(24)),
            y=day_labels,
            colorscale='Blues',
            showscale=True
        ))

        fig.update_layout(
            title='Calculator Usage Heatmap - Hour vs Day of Week',
            xaxis_title='Hour of Day',
            yaxis_title='Day of Week',
            height=400
        )

        return fig

    def create_geographic_revenue_map(self, days: int = 30) -> go.Figure:
        """Create geographic revenue distribution map"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            billing_country,
            SUM(revenue_amount_usd) as revenue,
            COUNT(DISTINCT user_id) as customers,
            COUNT(*) as transactions
        FROM revenue_events
        WHERE event_date BETWEEN '{start_date}' AND '{end_date}'
            AND billing_country != ''
        GROUP BY billing_country
        ORDER BY revenue DESC
        LIMIT 20
        """.format(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=['country', 'revenue', 'customers', 'transactions'])

        fig = go.Figure(data=go.Choropleth(
            locations=df['country'],
            z=df['revenue'],
            locationmode='country names',
            colorscale='Blues',
            text=df['country'],
            hovertemplate='<b>%{text}</b><br>Revenue: $%{z:,.2f}<br>Customers: %{customdata[0]}<br>Transactions: %{customdata[1]}<extra></extra>',
            customdata=df[['customers', 'transactions']].values
        ))

        fig.update_layout(
            title='Revenue by Country - Last 30 Days',
            geo=dict(showframe=False, showcoastlines=True),
            height=500
        )

        return fig

    def generate_executive_report(self, date_range: tuple = None) -> Dict[str, Any]:
        """Generate comprehensive executive report"""

        summary = self.generate_executive_summary(date_range)

        # Create visualizations
        charts = {
            'revenue_trend': self.create_revenue_trend_chart(),
            'acquisition_funnel': self.create_user_acquisition_funnel(),
            'usage_heatmap': self.create_calculator_usage_heatmap(),
            'geographic_revenue': self.create_geographic_revenue_map()
        }

        # Key insights and recommendations
        insights = self._generate_insights(summary)

        return {
            'summary': summary,
            'charts': charts,
            'insights': insights,
            'generated_at': datetime.now()
        }

    def _generate_insights(self, summary: Dict[str, Any]) -> List[Dict[str, str]]:
        """Generate actionable insights from the data"""

        insights = []

        # Revenue insights
        revenue = summary.get('revenue', {})
        if revenue.get('total_revenue', 0) > 0:
            avg_revenue = revenue.get('avg_revenue_per_transaction', 0)
            if avg_revenue > 50:
                insights.append({
                    'type': 'success',
                    'category': 'Revenue',
                    'title': 'Strong Revenue Performance',
                    'description': f'Average revenue per transaction is ${avg_revenue:.2f}, indicating healthy pricing strategy.'
                })

        # User engagement insights
        product = summary.get('product', {})
        if product.get('total_calculations', 0) > 0:
            error_rate = (product.get('calculation_errors', 0) / product.get('total_calculations', 1)) * 100
            if error_rate < 1:
                insights.append({
                    'type': 'success',
                    'category': 'Product',
                    'title': 'Excellent Product Reliability',
                    'description': f'Calculation error rate is only {error_rate:.2f}%, showing high product quality.'
                })
            elif error_rate > 5:
                insights.append({
                    'type': 'warning',
                    'category': 'Product',
                    'title': 'High Error Rate Detected',
                    'description': f'Calculation error rate is {error_rate:.2f}%. Consider reviewing calculator algorithms.'
                })

        # Growth insights
        growth = summary.get('growth', {})
        user_growth = growth.get('users_growth', 0)
        if user_growth > 10:
            insights.append({
                'type': 'success',
                'category': 'Growth',
                'title': 'Strong User Growth',
                'description': f'User base grew by {user_growth:.1f}% this period. Consider scaling infrastructure.'
            })
        elif user_growth < -5:
            insights.append({
                'type': 'warning',
                'category': 'Growth',
                'title': 'User Growth Decline',
                'description': f'User base declined by {abs(user_growth):.1f}%. Review marketing and retention strategies.'
            })

        # Mobile usage insights
        users = summary.get('users', {})
        mobile_ratio = users.get('mobile_users', 0) / max(users.get('total_users', 1), 1)
        if mobile_ratio > 0.6:
            insights.append({
                'type': 'info',
                'category': 'Platform',
                'title': 'Mobile-First User Base',
                'description': f'{mobile_ratio*100:.1f}% of users are on mobile. Prioritize mobile experience optimization.'
            })

        return insights
"""
Revenue Analytics Dashboard for GlobalTaxCalc Analytics Platform

This module provides comprehensive revenue analysis, forecasting,
subscription metrics, and financial performance insights.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures

class RevenueDashboard:
    """Comprehensive revenue analytics and forecasting dashboard"""

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

    def get_revenue_overview(self, date_range: Tuple[datetime, datetime]) -> Dict[str, Any]:
        """Get comprehensive revenue overview metrics"""

        query = """
        SELECT
            -- Total revenue metrics
            SUM(revenue_amount_usd) as total_revenue,
            COUNT(*) as total_transactions,
            COUNT(DISTINCT user_id) as paying_customers,
            AVG(revenue_amount_usd) as avg_transaction_value,

            -- Revenue by event type
            SUM(CASE WHEN event_type = 'subscription' THEN revenue_amount_usd ELSE 0 END) as subscription_revenue,
            SUM(CASE WHEN event_type = 'purchase' THEN revenue_amount_usd ELSE 0 END) as one_time_revenue,
            SUM(CASE WHEN event_type = 'upgrade' THEN revenue_amount_usd ELSE 0 END) as upgrade_revenue,
            SUM(CASE WHEN event_type = 'renewal' THEN revenue_amount_usd ELSE 0 END) as renewal_revenue,
            SUM(CASE WHEN event_type = 'refund' THEN revenue_amount_usd ELSE 0 END) as refund_amount,

            -- Transaction counts by type
            COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as new_subscriptions,
            COUNT(CASE WHEN event_type = 'renewal' THEN 1 END) as renewals,
            COUNT(CASE WHEN event_type = 'upgrade' THEN 1 END) as upgrades,
            COUNT(CASE WHEN event_type = 'refund' THEN 1 END) as refunds,

            -- Product mix
            SUM(CASE WHEN product_type = 'premium' THEN revenue_amount_usd ELSE 0 END) as premium_revenue,
            SUM(CASE WHEN product_type = 'professional' THEN revenue_amount_usd ELSE 0 END) as professional_revenue,
            SUM(CASE WHEN product_type = 'enterprise' THEN revenue_amount_usd ELSE 0 END) as enterprise_revenue,
            SUM(CASE WHEN product_type = 'addon' THEN revenue_amount_usd ELSE 0 END) as addon_revenue,

            -- Billing cycles
            SUM(CASE WHEN billing_cycle = 'monthly' THEN revenue_amount_usd ELSE 0 END) as monthly_revenue,
            SUM(CASE WHEN billing_cycle = 'quarterly' THEN revenue_amount_usd ELSE 0 END) as quarterly_revenue,
            SUM(CASE WHEN billing_cycle = 'annual' THEN revenue_amount_usd ELSE 0 END) as annual_revenue,

            -- Geographic revenue
            uniqArray(billing_country) as revenue_countries,

            -- Discounts and promotions
            SUM(discount_amount) as total_discounts,
            AVG(discount_percentage) as avg_discount_rate,
            COUNT(CASE WHEN coupon_code != '' THEN 1 END) as coupon_usage,

            -- Customer metrics
            AVG(cumulative_revenue) as avg_customer_ltv,
            percentile(cumulative_revenue, 0.5) as median_customer_ltv,
            percentile(cumulative_revenue, 0.95) as p95_customer_ltv

        FROM revenue_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d %H:%M:%S'),
            end_date=date_range[1].strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'total_metrics': {
                    'total_revenue': round(data[0], 2) if data[0] else 0,
                    'total_transactions': data[1],
                    'paying_customers': data[2],
                    'avg_transaction_value': round(data[3], 2) if data[3] else 0
                },
                'revenue_by_type': {
                    'subscription': round(data[4], 2) if data[4] else 0,
                    'one_time': round(data[5], 2) if data[5] else 0,
                    'upgrade': round(data[6], 2) if data[6] else 0,
                    'renewal': round(data[7], 2) if data[7] else 0,
                    'refund': round(data[8], 2) if data[8] else 0
                },
                'transaction_counts': {
                    'new_subscriptions': data[9],
                    'renewals': data[10],
                    'upgrades': data[11],
                    'refunds': data[12]
                },
                'product_mix': {
                    'premium': round(data[13], 2) if data[13] else 0,
                    'professional': round(data[14], 2) if data[14] else 0,
                    'enterprise': round(data[15], 2) if data[15] else 0,
                    'addon': round(data[16], 2) if data[16] else 0
                },
                'billing_cycles': {
                    'monthly': round(data[17], 2) if data[17] else 0,
                    'quarterly': round(data[18], 2) if data[18] else 0,
                    'annual': round(data[19], 2) if data[19] else 0
                },
                'geographic': {
                    'revenue_countries': len(data[20]) if data[20] else 0
                },
                'discounts': {
                    'total_discounts': round(data[21], 2) if data[21] else 0,
                    'avg_discount_rate': round(data[22], 2) if data[22] else 0,
                    'coupon_usage': data[23]
                },
                'customer_ltv': {
                    'avg_ltv': round(data[24], 2) if data[24] else 0,
                    'median_ltv': round(data[25], 2) if data[25] else 0,
                    'p95_ltv': round(data[26], 2) if data[26] else 0
                }
            }

        return {}

    def get_subscription_metrics(self, date_range: Tuple[datetime, datetime]) -> Dict[str, Any]:
        """Calculate detailed subscription business metrics"""

        query = """
        WITH subscription_lifecycle AS (
            SELECT
                user_id,
                subscription_id,
                MIN(CASE WHEN event_type = 'subscription' THEN event_timestamp END) as first_subscription,
                MAX(CASE WHEN event_type IN ('subscription', 'renewal') THEN event_timestamp END) as last_payment,
                COUNT(CASE WHEN event_type = 'renewal' THEN 1 END) as renewal_count,
                SUM(CASE WHEN event_type IN ('subscription', 'renewal') THEN revenue_amount_usd ELSE 0 END) as total_subscription_revenue,
                CASE
                    WHEN MAX(CASE WHEN event_type = 'refund' THEN event_timestamp END) IS NOT NULL THEN 'churned'
                    WHEN MAX(CASE WHEN event_type IN ('subscription', 'renewal') THEN event_timestamp END) < now() - INTERVAL 35 DAY THEN 'churned'
                    ELSE 'active'
                END as subscription_status
            FROM revenue_events
            WHERE event_type IN ('subscription', 'renewal', 'refund')
                AND event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id, subscription_id
        )
        SELECT
            -- Active subscription metrics
            COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_subscriptions,
            COUNT(CASE WHEN subscription_status = 'churned' THEN 1 END) as churned_subscriptions,

            -- New vs existing
            COUNT(CASE WHEN renewal_count = 0 THEN 1 END) as new_subscriptions,
            COUNT(CASE WHEN renewal_count > 0 THEN 1 END) as renewed_subscriptions,

            -- Revenue metrics
            SUM(total_subscription_revenue) as total_subscription_revenue,
            AVG(total_subscription_revenue) as avg_subscription_ltv,

            -- Renewal analysis
            AVG(renewal_count) as avg_renewals_per_customer,
            percentile(renewal_count, 0.5) as median_renewals,

            -- Churn calculation
            COUNT(CASE WHEN subscription_status = 'churned' THEN 1 END) * 100.0 / COUNT(*) as churn_rate

        FROM subscription_lifecycle
        """.format(
            start_date=date_range[0].strftime('%Y-%m-%d %H:%M:%S'),
            end_date=date_range[1].strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if result:
            data = result[0]
            return {
                'subscription_counts': {
                    'active_subscriptions': data[0],
                    'churned_subscriptions': data[1],
                    'new_subscriptions': data[2],
                    'renewed_subscriptions': data[3]
                },
                'subscription_revenue': {
                    'total_revenue': round(data[4], 2) if data[4] else 0,
                    'avg_ltv': round(data[5], 2) if data[5] else 0
                },
                'renewal_metrics': {
                    'avg_renewals': round(data[6], 2) if data[6] else 0,
                    'median_renewals': data[7]
                },
                'churn_rate': round(data[8], 2) if data[8] else 0
            }

        return {}

    def create_revenue_trend_chart(self, days: int = 90) -> go.Figure:
        """Create comprehensive revenue trend visualization"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            toDate(event_timestamp) as date,
            SUM(revenue_amount_usd) as daily_revenue,
            SUM(CASE WHEN event_type = 'subscription' THEN revenue_amount_usd ELSE 0 END) as subscription_revenue,
            SUM(CASE WHEN event_type = 'purchase' THEN revenue_amount_usd ELSE 0 END) as one_time_revenue,
            COUNT(DISTINCT user_id) as paying_customers,
            COUNT(*) as transactions,
            SUM(CASE WHEN event_type = 'refund' THEN revenue_amount_usd ELSE 0 END) as refunds
        FROM revenue_events
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
            'date', 'daily_revenue', 'subscription_revenue', 'one_time_revenue',
            'paying_customers', 'transactions', 'refunds'
        ])
        df['date'] = pd.to_datetime(df['date'])

        # Calculate moving averages
        df['revenue_ma_7'] = df['daily_revenue'].rolling(window=7).mean()
        df['revenue_ma_30'] = df['daily_revenue'].rolling(window=30).mean()

        # Create subplots
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Daily Revenue Trend', 'Revenue by Type', 'Paying Customers', 'Refunds'),
            specs=[[{"secondary_y": True}, {"secondary_y": False}],
                   [{"secondary_y": False}, {"secondary_y": False}]]
        )

        # Daily revenue with moving averages
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['daily_revenue'], name='Daily Revenue',
                      line=dict(color=self.colors['primary'], width=1)),
            row=1, col=1
        )
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['revenue_ma_7'], name='7-Day MA',
                      line=dict(color=self.colors['success'], width=2)),
            row=1, col=1
        )
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['revenue_ma_30'], name='30-Day MA',
                      line=dict(color=self.colors['danger'], width=2)),
            row=1, col=1
        )

        # Revenue by type (stacked area)
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['subscription_revenue'], name='Subscription',
                      fill='tonexty', fillcolor=self.colors['primary'],
                      line=dict(color=self.colors['primary'])),
            row=1, col=2
        )
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['one_time_revenue'], name='One-time',
                      fill='tonexty', fillcolor=self.colors['info'],
                      line=dict(color=self.colors['info'])),
            row=1, col=2
        )

        # Paying customers
        fig.add_trace(
            go.Bar(x=df['date'], y=df['paying_customers'], name='Customers',
                   marker_color=self.colors['success']),
            row=2, col=1
        )

        # Refunds
        fig.add_trace(
            go.Bar(x=df['date'], y=df['refunds'], name='Refunds',
                   marker_color=self.colors['danger']),
            row=2, col=2
        )

        fig.update_layout(
            title='Revenue Analytics - Last 90 Days',
            height=700,
            showlegend=True
        )

        return fig

    def create_mrr_analysis(self) -> go.Figure:
        """Create Monthly Recurring Revenue (MRR) analysis"""

        query = """
        WITH monthly_subscriptions AS (
            SELECT
                toStartOfMonth(event_timestamp) as month,
                SUM(CASE WHEN billing_cycle = 'monthly' THEN revenue_amount_usd ELSE 0 END) as monthly_mrr,
                SUM(CASE WHEN billing_cycle = 'quarterly' THEN revenue_amount_usd / 3 ELSE 0 END) as quarterly_mrr,
                SUM(CASE WHEN billing_cycle = 'annual' THEN revenue_amount_usd / 12 ELSE 0 END) as annual_mrr,
                COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as new_mrr_customers,
                COUNT(CASE WHEN event_type = 'upgrade' THEN 1 END) as upgrade_mrr,
                SUM(CASE WHEN event_type = 'refund' THEN revenue_amount_usd ELSE 0 END) as churned_mrr
            FROM revenue_events
            WHERE event_type IN ('subscription', 'renewal', 'upgrade', 'refund')
                AND event_timestamp >= now() - INTERVAL 12 MONTH
            GROUP BY month
            ORDER BY month
        )
        SELECT
            month,
            monthly_mrr + quarterly_mrr + annual_mrr as total_mrr,
            new_mrr_customers,
            upgrade_mrr,
            churned_mrr,
            LAG(monthly_mrr + quarterly_mrr + annual_mrr) OVER (ORDER BY month) as prev_mrr
        FROM monthly_subscriptions
        ORDER BY month
        """

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=[
            'month', 'total_mrr', 'new_customers', 'upgrades', 'churned_mrr', 'prev_mrr'
        ])
        df['month'] = pd.to_datetime(df['month'])

        # Calculate MRR growth
        df['mrr_growth'] = ((df['total_mrr'] - df['prev_mrr']) / df['prev_mrr'] * 100).fillna(0)

        # Create subplots
        fig = make_subplots(
            rows=2, cols=1,
            subplot_titles=('Monthly Recurring Revenue', 'MRR Growth Rate'),
            specs=[[{"secondary_y": True}], [{"secondary_y": False}]]
        )

        # MRR trend
        fig.add_trace(
            go.Scatter(x=df['month'], y=df['total_mrr'], name='Total MRR',
                      line=dict(color=self.colors['primary'], width=3)),
            row=1, col=1
        )

        # MRR components
        fig.add_trace(
            go.Bar(x=df['month'], y=df['new_customers'], name='New Customers',
                   marker_color=self.colors['success'], opacity=0.7),
            row=1, col=1, secondary_y=True
        )

        # MRR growth rate
        fig.add_trace(
            go.Bar(x=df['month'], y=df['mrr_growth'], name='MRR Growth %',
                   marker_color=df['mrr_growth'].apply(lambda x: self.colors['success'] if x > 0 else self.colors['danger'])),
            row=2, col=1
        )

        fig.update_layout(
            title='Monthly Recurring Revenue Analysis',
            height=600
        )

        return fig

    def create_customer_ltv_distribution(self, days: int = 365) -> go.Figure:
        """Create customer lifetime value distribution analysis"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        SELECT
            user_id,
            SUM(revenue_amount_usd) as customer_ltv,
            COUNT(*) as transaction_count,
            MIN(event_timestamp) as first_transaction,
            MAX(event_timestamp) as last_transaction,
            dateDiff('day', MIN(event_timestamp), MAX(event_timestamp)) as customer_lifetime_days
        FROM revenue_events
        WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            AND event_type IN ('subscription', 'purchase', 'renewal', 'upgrade')
        GROUP BY user_id
        HAVING customer_ltv > 0
        ORDER BY customer_ltv DESC
        """.format(
            start_date=start_date.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=end_date.strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        df = pd.DataFrame(result, columns=[
            'user_id', 'ltv', 'transactions', 'first_transaction', 'last_transaction', 'lifetime_days'
        ])

        # Create LTV segments
        df['ltv_segment'] = pd.cut(df['ltv'],
                                  bins=[0, 10, 50, 100, 500, float('inf')],
                                  labels=['$0-10', '$10-50', '$50-100', '$100-500', '$500+'])

        # Create subplots
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('LTV Distribution', 'LTV by Segment', 'LTV vs Transactions', 'LTV vs Lifetime'),
            specs=[[{"type": "histogram"}, {"type": "bar"}],
                   [{"type": "scatter"}, {"type": "scatter"}]]
        )

        # LTV histogram
        fig.add_trace(
            go.Histogram(x=df['ltv'], nbinsx=50, name='LTV Distribution',
                        marker_color=self.colors['primary']),
            row=1, col=1
        )

        # LTV by segment
        segment_counts = df['ltv_segment'].value_counts().sort_index()
        fig.add_trace(
            go.Bar(x=segment_counts.index, y=segment_counts.values, name='Customers by Segment',
                   marker_color=self.colors['success']),
            row=1, col=2
        )

        # LTV vs transaction count
        fig.add_trace(
            go.Scatter(x=df['transactions'], y=df['ltv'], mode='markers', name='LTV vs Transactions',
                      marker=dict(color=self.colors['info'], opacity=0.6)),
            row=2, col=1
        )

        # LTV vs customer lifetime
        fig.add_trace(
            go.Scatter(x=df['lifetime_days'], y=df['ltv'], mode='markers', name='LTV vs Lifetime',
                      marker=dict(color=self.colors['warning'], opacity=0.6)),
            row=2, col=2
        )

        fig.update_layout(
            title='Customer Lifetime Value Analysis',
            height=700
        )

        return fig

    def create_revenue_forecasting(self, days_ahead: int = 90) -> go.Figure:
        """Create revenue forecasting using polynomial regression"""

        # Get historical data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)  # Use 90 days of history

        query = """
        SELECT
            toDate(event_timestamp) as date,
            SUM(revenue_amount_usd) as daily_revenue
        FROM revenue_events
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

        df = pd.DataFrame(result, columns=['date', 'daily_revenue'])
        df['date'] = pd.to_datetime(df['date'])

        # Prepare data for forecasting
        df['day_number'] = (df['date'] - df['date'].min()).dt.days
        X = df['day_number'].values.reshape(-1, 1)
        y = df['daily_revenue'].values

        # Use polynomial features for better fitting
        poly_features = PolynomialFeatures(degree=2)
        X_poly = poly_features.fit_transform(X)

        # Fit the model
        model = LinearRegression()
        model.fit(X_poly, y)

        # Generate future dates
        future_dates = pd.date_range(start=df['date'].max() + timedelta(days=1),
                                   periods=days_ahead, freq='D')
        future_day_numbers = np.arange(len(df), len(df) + days_ahead).reshape(-1, 1)
        future_X_poly = poly_features.transform(future_day_numbers)

        # Make predictions
        future_predictions = model.predict(future_X_poly)

        # Calculate confidence intervals (simple approach)
        residuals = y - model.predict(X_poly)
        residual_std = np.std(residuals)
        confidence_interval = 1.96 * residual_std

        # Create the forecast plot
        fig = go.Figure()

        # Historical data
        fig.add_trace(
            go.Scatter(x=df['date'], y=df['daily_revenue'], name='Historical Revenue',
                      line=dict(color=self.colors['primary'], width=2))
        )

        # Forecasted data
        fig.add_trace(
            go.Scatter(x=future_dates, y=future_predictions, name='Forecast',
                      line=dict(color=self.colors['danger'], width=2, dash='dash'))
        )

        # Confidence interval
        fig.add_trace(
            go.Scatter(x=future_dates, y=future_predictions + confidence_interval,
                      fill=None, mode='lines', line_color='rgba(0,0,0,0)', showlegend=False)
        )
        fig.add_trace(
            go.Scatter(x=future_dates, y=future_predictions - confidence_interval,
                      fill='tonexty', mode='lines', line_color='rgba(0,0,0,0)',
                      name='Confidence Interval', fillcolor='rgba(239, 68, 68, 0.2)')
        )

        # Calculate forecast summary
        forecast_total = np.sum(future_predictions)
        historical_avg = np.mean(df['daily_revenue'])

        fig.update_layout(
            title=f'Revenue Forecast - Next {days_ahead} Days<br>'
                  f'<sub>Predicted Total: ${forecast_total:,.2f} | Daily Avg: ${forecast_total/days_ahead:,.2f}</sub>',
            xaxis_title='Date',
            yaxis_title='Revenue ($)',
            height=500
        )

        return fig

    def create_cohort_revenue_analysis(self) -> go.Figure:
        """Create revenue cohort analysis"""

        query = """
        WITH user_first_purchase AS (
            SELECT
                user_id,
                min(toDate(event_timestamp)) as first_purchase_date,
                toStartOfMonth(min(toDate(event_timestamp))) as cohort_month
            FROM revenue_events
            WHERE event_type IN ('subscription', 'purchase')
                AND event_timestamp >= now() - INTERVAL 12 MONTH
            GROUP BY user_id
        ),
        cohort_revenue AS (
            SELECT
                ufp.cohort_month,
                toStartOfMonth(toDate(re.event_timestamp)) as revenue_month,
                dateDiff('month', ufp.cohort_month, toStartOfMonth(toDate(re.event_timestamp))) as period_number,
                SUM(re.revenue_amount_usd) as period_revenue,
                COUNT(DISTINCT re.user_id) as active_customers
            FROM user_first_purchase ufp
            JOIN revenue_events re ON ufp.user_id = re.user_id
            WHERE re.event_type IN ('subscription', 'purchase', 'renewal', 'upgrade')
                AND period_number <= 11
            GROUP BY ufp.cohort_month, revenue_month, period_number
        )
        SELECT
            cohort_month,
            period_number,
            SUM(period_revenue) as total_revenue,
            COUNT(DISTINCT active_customers) as customers
        FROM cohort_revenue
        GROUP BY cohort_month, period_number
        ORDER BY cohort_month, period_number
        """

        result = self.client.execute(query)

        if not result:
            return go.Figure()

        # Process cohort data
        cohort_data = {}
        for row in result:
            cohort_month = row[0].strftime('%Y-%m')
            period = row[1]
            revenue = row[2]

            if cohort_month not in cohort_data:
                cohort_data[cohort_month] = {}

            cohort_data[cohort_month][period] = revenue

        # Create heatmap data
        cohort_labels = sorted(cohort_data.keys())
        period_labels = [f'Month {i}' for i in range(12)]

        heatmap_data = []
        for cohort in cohort_labels:
            row = []
            for period in range(12):
                revenue = cohort_data[cohort].get(period, 0)
                row.append(revenue)
            heatmap_data.append(row)

        fig = go.Figure(data=go.Heatmap(
            z=heatmap_data,
            x=period_labels,
            y=cohort_labels,
            colorscale='Blues',
            text=[[f'${val:,.0f}' for val in row] for row in heatmap_data],
            texttemplate='%{text}',
            textfont={"size": 10},
            colorbar=dict(title="Revenue ($)")
        ))

        fig.update_layout(
            title='Revenue Cohort Analysis',
            xaxis_title='Period',
            yaxis_title='Cohort Month',
            height=600
        )

        return fig

    def generate_revenue_report(self, date_range: Tuple[datetime, datetime] = None) -> Dict[str, Any]:
        """Generate comprehensive revenue analytics report"""

        if not date_range:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            date_range = (start_date, end_date)

        # Get all revenue metrics
        revenue_overview = self.get_revenue_overview(date_range)
        subscription_metrics = self.get_subscription_metrics(date_range)

        # Create visualizations
        charts = {
            'revenue_trend': self.create_revenue_trend_chart(),
            'mrr_analysis': self.create_mrr_analysis(),
            'ltv_distribution': self.create_customer_ltv_distribution(),
            'revenue_forecast': self.create_revenue_forecasting(),
            'cohort_revenue': self.create_cohort_revenue_analysis()
        }

        # Generate insights
        insights = self._generate_revenue_insights(revenue_overview, subscription_metrics)

        return {
            'overview': revenue_overview,
            'subscriptions': subscription_metrics,
            'charts': charts,
            'insights': insights,
            'period': {
                'start': date_range[0],
                'end': date_range[1]
            },
            'generated_at': datetime.now()
        }

    def _generate_revenue_insights(self, overview: Dict, subscriptions: Dict) -> List[Dict[str, str]]:
        """Generate actionable revenue insights"""

        insights = []

        # Revenue performance insights
        if overview.get('total_metrics', {}).get('total_revenue', 0) > 0:
            total_revenue = overview['total_metrics']['total_revenue']
            avg_transaction = overview['total_metrics']['avg_transaction_value']

            if avg_transaction > 100:
                insights.append({
                    'type': 'success',
                    'category': 'Revenue',
                    'title': 'High Transaction Values',
                    'description': f'Average transaction value is ${avg_transaction:.2f}, indicating strong pricing power.'
                })

            # Product mix insights
            product_mix = overview.get('product_mix', {})
            enterprise_revenue = product_mix.get('enterprise', 0)
            total_revenue = sum(product_mix.values())

            if total_revenue > 0 and (enterprise_revenue / total_revenue) > 0.3:
                insights.append({
                    'type': 'success',
                    'category': 'Product',
                    'title': 'Strong Enterprise Revenue',
                    'description': f'Enterprise accounts contribute {(enterprise_revenue/total_revenue)*100:.1f}% of revenue.'
                })

        # Subscription insights
        if subscriptions:
            churn_rate = subscriptions.get('churn_rate', 0)
            if churn_rate > 15:
                insights.append({
                    'type': 'warning',
                    'category': 'Subscriptions',
                    'title': 'High Churn Rate',
                    'description': f'Subscription churn rate is {churn_rate:.1f}%. Consider retention initiatives.'
                })
            elif churn_rate < 5:
                insights.append({
                    'type': 'success',
                    'category': 'Subscriptions',
                    'title': 'Excellent Retention',
                    'description': f'Low churn rate of {churn_rate:.1f}% indicates strong product-market fit.'
                })

            avg_ltv = subscriptions.get('subscription_revenue', {}).get('avg_ltv', 0)
            if avg_ltv > 500:
                insights.append({
                    'type': 'success',
                    'category': 'LTV',
                    'title': 'High Customer LTV',
                    'description': f'Average customer LTV is ${avg_ltv:.2f}, enabling strong growth investment.'
                })

        # Billing cycle insights
        billing_cycles = overview.get('billing_cycles', {})
        annual_revenue = billing_cycles.get('annual', 0)
        total_billing_revenue = sum(billing_cycles.values())

        if total_billing_revenue > 0 and (annual_revenue / total_billing_revenue) > 0.4:
            insights.append({
                'type': 'success',
                'category': 'Billing',
                'title': 'Strong Annual Billing',
                'description': f'Annual billing represents {(annual_revenue/total_billing_revenue)*100:.1f}% of revenue, improving cash flow.'
            })

        return insights
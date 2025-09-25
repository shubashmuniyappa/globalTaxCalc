"""
Predictive Analytics Dashboard
Real-time analytics and insights dashboard for ML models
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import altair as alt
from datetime import datetime, timedelta
import json
import logging
from typing import Dict, List, Any, Optional
import sqlite3
import redis
from sqlalchemy import create_engine
import sys
import os

# Add the models directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'models'))

from tax_optimization import TaxSavingsPredictor, DeductionRecommendationEngine
from user_behavior import ChurnPredictionModel, LifetimeValuePredictor
from personalization import ContentRecommendationEngine
from anomaly_detection import FraudDetectionEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DashboardDataManager:
    """Manage data sources for the analytics dashboard"""

    def __init__(self, db_connection_string: str = "sqlite:///tax_analytics.db"):
        self.engine = create_engine(db_connection_string)
        self.redis_client = None
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        except:
            logger.warning("Redis connection failed. Using in-memory cache.")

        self.cache = {}

    def get_user_metrics(self, date_range: tuple = None) -> pd.DataFrame:
        """Get user engagement and behavior metrics"""
        cache_key = f"user_metrics_{date_range}"

        if self.redis_client:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                return pd.read_json(cached_data)

        # Generate sample data for demonstration
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)

        if date_range:
            start_date, end_date = date_range

        date_range_list = pd.date_range(start=start_date, end=end_date, freq='D')

        metrics_data = []
        for date in date_range_list:
            metrics_data.append({
                'date': date,
                'active_users': np.random.randint(800, 1200),
                'new_registrations': np.random.randint(20, 80),
                'calculations_completed': np.random.randint(1500, 2500),
                'avg_session_duration': np.random.uniform(8, 15),
                'bounce_rate': np.random.uniform(0.25, 0.45),
                'conversion_rate': np.random.uniform(0.03, 0.08),
                'churn_predictions': np.random.randint(15, 45),
                'fraud_alerts': np.random.randint(0, 5)
            })

        df = pd.DataFrame(metrics_data)

        if self.redis_client:
            self.redis_client.setex(cache_key, 300, df.to_json())  # Cache for 5 minutes

        return df

    def get_model_performance_metrics(self) -> Dict[str, Any]:
        """Get ML model performance metrics"""
        return {
            'tax_optimization': {
                'model_name': 'TaxSavingsPredictor',
                'accuracy': 0.87,
                'mae': 234.56,
                'rmse': 456.78,
                'last_trained': '2024-01-15',
                'predictions_served': 12450,
                'avg_response_time_ms': 45
            },
            'churn_prediction': {
                'model_name': 'ChurnPredictionModel',
                'accuracy': 0.82,
                'precision': 0.79,
                'recall': 0.85,
                'f1_score': 0.82,
                'auc': 0.88,
                'last_trained': '2024-01-14',
                'predictions_served': 8920,
                'avg_response_time_ms': 32
            },
            'ltv_prediction': {
                'model_name': 'LifetimeValuePredictor',
                'mae': 89.45,
                'rmse': 156.78,
                'r2': 0.74,
                'last_trained': '2024-01-13',
                'predictions_served': 6780,
                'avg_response_time_ms': 38
            },
            'fraud_detection': {
                'model_name': 'FraudDetectionEngine',
                'precision': 0.92,
                'recall': 0.76,
                'f1_score': 0.83,
                'false_positive_rate': 0.08,
                'last_trained': '2024-01-12',
                'predictions_served': 15680,
                'avg_response_time_ms': 55
            }
        }

    def get_revenue_analytics(self) -> pd.DataFrame:
        """Get revenue and financial analytics"""
        # Generate sample revenue data
        dates = pd.date_range(start='2024-01-01', end='2024-01-31', freq='D')

        revenue_data = []
        for date in dates:
            revenue_data.append({
                'date': date,
                'subscription_revenue': np.random.uniform(2000, 4000),
                'premium_upgrades': np.random.randint(5, 25),
                'total_tax_savings_delivered': np.random.uniform(50000, 150000),
                'avg_tax_savings_per_user': np.random.uniform(200, 800),
                'user_ltv_predicted': np.random.uniform(45, 85),
                'churn_rate': np.random.uniform(0.02, 0.06)
            })

        return pd.DataFrame(revenue_data)

    def get_feature_usage_stats(self) -> Dict[str, Any]:
        """Get feature usage statistics"""
        return {
            'calculators': {
                'standard_deduction': {'usage_count': 4500, 'avg_completion_time': 3.2, 'satisfaction': 4.6},
                'itemized_deduction': {'usage_count': 2800, 'avg_completion_time': 8.5, 'satisfaction': 4.4},
                'tax_withholding': {'usage_count': 1900, 'avg_completion_time': 6.1, 'satisfaction': 4.3},
                'business_expense': {'usage_count': 1200, 'avg_completion_time': 12.3, 'satisfaction': 4.2},
                'retirement_contribution': {'usage_count': 2100, 'avg_completion_time': 7.8, 'satisfaction': 4.5}
            },
            'recommendations': {
                'total_served': 25000,
                'click_through_rate': 0.34,
                'conversion_rate': 0.12,
                'avg_savings_from_recommendations': 456.78
            },
            'personalization': {
                'content_recommendations_served': 18500,
                'personalized_tips_delivered': 12300,
                'engagement_lift': 0.28,
                'satisfaction_improvement': 0.15
            }
        }


class AnalyticsDashboard:
    """Main analytics dashboard class"""

    def __init__(self):
        self.data_manager = DashboardDataManager()
        self.setup_page_config()

    def setup_page_config(self):
        """Setup Streamlit page configuration"""
        st.set_page_config(
            page_title="GlobalTaxCalc Analytics Dashboard",
            page_icon="📊",
            layout="wide",
            initial_sidebar_state="expanded"
        )

    def render_sidebar(self):
        """Render dashboard sidebar"""
        st.sidebar.title("📊 Analytics Dashboard")

        # Date range selector
        date_range = st.sidebar.date_input(
            "Select Date Range",
            value=(datetime.now() - timedelta(days=30), datetime.now()),
            max_value=datetime.now()
        )

        # Metric selector
        selected_metrics = st.sidebar.multiselect(
            "Select Metrics to Display",
            ["User Engagement", "Model Performance", "Revenue Analytics",
             "Feature Usage", "Fraud Detection", "Personalization"],
            default=["User Engagement", "Model Performance"]
        )

        # Refresh data button
        if st.sidebar.button("🔄 Refresh Data"):
            st.cache_data.clear()
            st.rerun()

        return date_range, selected_metrics

    def render_overview_metrics(self):
        """Render key overview metrics"""
        col1, col2, col3, col4 = st.columns(4)

        # Sample metrics
        with col1:
            st.metric(
                label="Active Users (30d)",
                value="32,456",
                delta="2,341 (7.8%)"
            )

        with col2:
            st.metric(
                label="Total Tax Savings",
                value="$2.4M",
                delta="$345K (16.8%)"
            )

        with col3:
            st.metric(
                label="Model Accuracy",
                value="87.2%",
                delta="1.2%"
            )

        with col4:
            st.metric(
                label="Revenue (MTD)",
                value="$89,234",
                delta="$12,456 (16.2%)"
            )

    def render_user_engagement_dashboard(self, date_range):
        """Render user engagement analytics"""
        st.header("👥 User Engagement Analytics")

        user_metrics = self.data_manager.get_user_metrics(date_range)

        col1, col2 = st.columns(2)

        with col1:
            # Active users over time
            fig_users = px.line(
                user_metrics,
                x='date',
                y='active_users',
                title='Daily Active Users',
                labels={'active_users': 'Active Users', 'date': 'Date'}
            )
            fig_users.update_layout(height=400)
            st.plotly_chart(fig_users, use_container_width=True)

        with col2:
            # Conversion metrics
            fig_conversion = go.Figure()
            fig_conversion.add_trace(go.Scatter(
                x=user_metrics['date'],
                y=user_metrics['conversion_rate'],
                mode='lines+markers',
                name='Conversion Rate',
                line=dict(color='green')
            ))
            fig_conversion.update_layout(
                title='Conversion Rate Over Time',
                xaxis_title='Date',
                yaxis_title='Conversion Rate',
                height=400
            )
            st.plotly_chart(fig_conversion, use_container_width=True)

        # Detailed metrics table
        st.subheader("Detailed Metrics")

        summary_metrics = {
            'Metric': ['Avg Active Users', 'Avg Session Duration', 'Bounce Rate', 'New Registrations'],
            'Value': [
                f"{user_metrics['active_users'].mean():.0f}",
                f"{user_metrics['avg_session_duration'].mean():.1f} min",
                f"{user_metrics['bounce_rate'].mean():.1%}",
                f"{user_metrics['new_registrations'].sum():.0f}"
            ],
            'Trend': ['↗️', '↗️', '↘️', '↗️']
        }

        st.dataframe(pd.DataFrame(summary_metrics), use_container_width=True)

    def render_model_performance_dashboard(self):
        """Render ML model performance dashboard"""
        st.header("🤖 Model Performance Analytics")

        model_metrics = self.data_manager.get_model_performance_metrics()

        # Model accuracy comparison
        models = list(model_metrics.keys())
        accuracies = []
        response_times = []

        for model in models:
            if 'accuracy' in model_metrics[model]:
                accuracies.append(model_metrics[model]['accuracy'])
            elif 'r2' in model_metrics[model]:
                accuracies.append(model_metrics[model]['r2'])
            else:
                accuracies.append(0.8)  # Default

            response_times.append(model_metrics[model]['avg_response_time_ms'])

        col1, col2 = st.columns(2)

        with col1:
            # Model accuracy chart
            fig_accuracy = px.bar(
                x=models,
                y=accuracies,
                title='Model Performance Comparison',
                labels={'x': 'Model', 'y': 'Accuracy/R²'},
                color=accuracies,
                color_continuous_scale='Viridis'
            )
            fig_accuracy.update_layout(height=400)
            st.plotly_chart(fig_accuracy, use_container_width=True)

        with col2:
            # Response time chart
            fig_response = px.scatter(
                x=models,
                y=response_times,
                size=[model_metrics[model]['predictions_served'] for model in models],
                title='Model Response Time vs Usage',
                labels={'x': 'Model', 'y': 'Avg Response Time (ms)'},
                hover_data=['predictions_served']
            )
            fig_response.update_layout(height=400)
            st.plotly_chart(fig_response, use_container_width=True)

        # Detailed model metrics
        st.subheader("Detailed Model Metrics")

        model_details = []
        for model_name, metrics in model_metrics.items():
            model_details.append({
                'Model': model_name.replace('_', ' ').title(),
                'Last Trained': metrics['last_trained'],
                'Predictions Served': f"{metrics['predictions_served']:,}",
                'Avg Response Time': f"{metrics['avg_response_time_ms']}ms",
                'Primary Metric': f"{metrics.get('accuracy', metrics.get('r2', 'N/A')):.3f}"
            })

        st.dataframe(pd.DataFrame(model_details), use_container_width=True)

    def render_revenue_analytics_dashboard(self):
        """Render revenue and financial analytics"""
        st.header("💰 Revenue Analytics")

        revenue_data = self.data_manager.get_revenue_analytics()

        col1, col2 = st.columns(2)

        with col1:
            # Revenue trend
            fig_revenue = px.line(
                revenue_data,
                x='date',
                y='subscription_revenue',
                title='Daily Subscription Revenue',
                labels={'subscription_revenue': 'Revenue ($)', 'date': 'Date'}
            )
            fig_revenue.update_layout(height=400)
            st.plotly_chart(fig_revenue, use_container_width=True)

        with col2:
            # Tax savings delivered
            fig_savings = px.area(
                revenue_data,
                x='date',
                y='total_tax_savings_delivered',
                title='Total Tax Savings Delivered',
                labels={'total_tax_savings_delivered': 'Tax Savings ($)', 'date': 'Date'}
            )
            fig_savings.update_layout(height=400)
            st.plotly_chart(fig_savings, use_container_width=True)

        # Revenue metrics
        col3, col4, col5 = st.columns(3)

        with col3:
            total_revenue = revenue_data['subscription_revenue'].sum()
            st.metric("Total Revenue (30d)", f"${total_revenue:,.0f}")

        with col4:
            avg_ltv = revenue_data['user_ltv_predicted'].mean()
            st.metric("Avg User LTV", f"${avg_ltv:.0f}")

        with col5:
            total_savings = revenue_data['total_tax_savings_delivered'].sum()
            st.metric("Total Tax Savings", f"${total_savings:,.0f}")

    def render_feature_usage_dashboard(self):
        """Render feature usage analytics"""
        st.header("🔧 Feature Usage Analytics")

        usage_stats = self.data_manager.get_feature_usage_stats()

        # Calculator usage
        st.subheader("Calculator Usage")

        calc_data = usage_stats['calculators']
        calc_df = pd.DataFrame([
            {
                'Calculator': name.replace('_', ' ').title(),
                'Usage Count': data['usage_count'],
                'Avg Completion Time': f"{data['avg_completion_time']:.1f} min",
                'Satisfaction': f"{data['satisfaction']:.1f}/5.0"
            }
            for name, data in calc_data.items()
        ])

        col1, col2 = st.columns(2)

        with col1:
            # Usage count chart
            fig_usage = px.pie(
                calc_df,
                values='Usage Count',
                names='Calculator',
                title='Calculator Usage Distribution'
            )
            st.plotly_chart(fig_usage, use_container_width=True)

        with col2:
            # Satisfaction scores
            fig_satisfaction = px.bar(
                calc_df,
                x='Calculator',
                y=[float(x.split('/')[0]) for x in calc_df['Satisfaction']],
                title='Calculator Satisfaction Scores',
                labels={'y': 'Satisfaction Score'}
            )
            fig_satisfaction.update_layout(height=400)
            st.plotly_chart(fig_satisfaction, use_container_width=True)

        # Feature performance table
        st.dataframe(calc_df, use_container_width=True)

    def render_fraud_detection_dashboard(self):
        """Render fraud detection analytics"""
        st.header("🛡️ Fraud Detection Analytics")

        # Generate sample fraud detection data
        fraud_data = {
            'Total Scans': 15680,
            'Fraud Alerts': 156,
            'False Positives': 12,
            'Confirmed Fraud': 144,
            'Detection Rate': 92.3,
            'False Positive Rate': 7.7
        }

        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric("Fraud Detection Rate", f"{fraud_data['Detection Rate']:.1f}%")

        with col2:
            st.metric("False Positive Rate", f"{fraud_data['False Positive Rate']:.1f}%")

        with col3:
            st.metric("Total Alerts", fraud_data['Fraud Alerts'])

        # Fraud pattern analysis
        fraud_patterns = pd.DataFrame({
            'Pattern Type': ['Round Number Abuse', 'Sequential Inputs', 'Location Mismatch',
                           'Speed Anomaly', 'Income Inconsistency'],
            'Frequency': [45, 32, 28, 21, 18],
            'Risk Level': ['High', 'High', 'Medium', 'Medium', 'High']
        })

        fig_patterns = px.bar(
            fraud_patterns,
            x='Pattern Type',
            y='Frequency',
            color='Risk Level',
            title='Fraud Pattern Detection Frequency',
            color_discrete_map={'High': 'red', 'Medium': 'orange', 'Low': 'green'}
        )

        st.plotly_chart(fig_patterns, use_container_width=True)

    def render_personalization_dashboard(self):
        """Render personalization analytics"""
        st.header("🎯 Personalization Analytics")

        usage_stats = self.data_manager.get_feature_usage_stats()
        personalization_data = usage_stats['personalization']

        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric(
                "Content Recommendations",
                f"{personalization_data['content_recommendations_served']:,}"
            )

        with col2:
            st.metric(
                "Engagement Lift",
                f"{personalization_data['engagement_lift']:.1%}"
            )

        with col3:
            st.metric(
                "Satisfaction Improvement",
                f"{personalization_data['satisfaction_improvement']:.1%}"
            )

        # Recommendation performance
        recommendation_metrics = pd.DataFrame({
            'Metric': ['Click-Through Rate', 'Conversion Rate', 'Avg Savings per Rec'],
            'Value': ['34%', '12%', '$456.78'],
            'Benchmark': ['25%', '8%', '$320.00'],
            'Performance': ['↗️ +36%', '↗️ +50%', '↗️ +43%']
        })

        st.subheader("Recommendation Performance")
        st.dataframe(recommendation_metrics, use_container_width=True)

    def run_dashboard(self):
        """Main dashboard runner"""
        st.title("🏛️ GlobalTaxCalc Analytics Dashboard")

        # Render sidebar
        date_range, selected_metrics = self.render_sidebar()

        # Render overview metrics
        self.render_overview_metrics()

        st.divider()

        # Render selected dashboard sections
        if "User Engagement" in selected_metrics:
            self.render_user_engagement_dashboard(date_range)
            st.divider()

        if "Model Performance" in selected_metrics:
            self.render_model_performance_dashboard()
            st.divider()

        if "Revenue Analytics" in selected_metrics:
            self.render_revenue_analytics_dashboard()
            st.divider()

        if "Feature Usage" in selected_metrics:
            self.render_feature_usage_dashboard()
            st.divider()

        if "Fraud Detection" in selected_metrics:
            self.render_fraud_detection_dashboard()
            st.divider()

        if "Personalization" in selected_metrics:
            self.render_personalization_dashboard()


class RealTimeMetricsCollector:
    """Collect real-time metrics for the dashboard"""

    def __init__(self, redis_client=None):
        self.redis_client = redis_client
        self.metrics_buffer = {}

    def collect_user_action(self, user_id: int, action: str, details: Dict = None):
        """Collect user action metrics"""
        timestamp = datetime.now()

        metric = {
            'user_id': user_id,
            'action': action,
            'timestamp': timestamp.isoformat(),
            'details': details or {}
        }

        # Store in Redis for real-time access
        if self.redis_client:
            key = f"user_action:{timestamp.strftime('%Y%m%d')}"
            self.redis_client.lpush(key, json.dumps(metric))
            self.redis_client.expire(key, 86400)  # Expire after 24 hours

    def collect_model_performance(self, model_name: str, prediction_time: float,
                                accuracy_metric: float = None):
        """Collect model performance metrics"""
        timestamp = datetime.now()

        metric = {
            'model_name': model_name,
            'prediction_time': prediction_time,
            'accuracy_metric': accuracy_metric,
            'timestamp': timestamp.isoformat()
        }

        if self.redis_client:
            key = f"model_performance:{model_name}:{timestamp.strftime('%Y%m%d')}"
            self.redis_client.lpush(key, json.dumps(metric))
            self.redis_client.expire(key, 86400)

    def collect_revenue_event(self, event_type: str, amount: float, user_id: int = None):
        """Collect revenue-related events"""
        timestamp = datetime.now()

        metric = {
            'event_type': event_type,
            'amount': amount,
            'user_id': user_id,
            'timestamp': timestamp.isoformat()
        }

        if self.redis_client:
            key = f"revenue_event:{timestamp.strftime('%Y%m%d')}"
            self.redis_client.lpush(key, json.dumps(metric))
            self.redis_client.expire(key, 86400)


if __name__ == "__main__":
    # Initialize and run the dashboard
    dashboard = AnalyticsDashboard()
    dashboard.run_dashboard()
"""
Predictive Analytics Models for GlobalTaxCalc Analytics Platform

This module provides machine learning models for user churn prediction,
lifetime value forecasting, demand prediction, and conversion optimization.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score
import xgboost as xgb
import lightgbm as lgb
from prophet import Prophet
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import joblib
import warnings
warnings.filterwarnings('ignore')

class PredictiveAnalyticsEngine:
    """Advanced predictive analytics with multiple ML models"""

    def __init__(self, clickhouse_client):
        self.client = clickhouse_client
        self.models = {}
        self.scalers = {}
        self.encoders = {}
        self.feature_importance = {}
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

    def prepare_churn_prediction_data(self, lookback_days: int = 90) -> pd.DataFrame:
        """Prepare data for churn prediction model"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days)
        churn_threshold_days = 30  # Define churn as no activity for 30 days

        query = """
        WITH user_activity AS (
            SELECT
                user_id,
                user_country,
                user_type,
                device_type,

                -- Activity metrics
                COUNT(DISTINCT session_id) as total_sessions,
                AVG(session_duration_seconds) as avg_session_duration,
                SUM(page_views) as total_page_views,
                AVG(time_on_page) as avg_time_on_page,
                COUNT(DISTINCT toDate(event_timestamp)) as active_days,

                -- Engagement metrics
                COUNT(CASE WHEN event_name = 'calculation_completed' THEN 1 END) as calculations_completed,
                COUNT(CASE WHEN event_name = 'export' THEN 1 END) as exports_made,
                COUNT(CASE WHEN event_name = 'share' THEN 1 END) as shares_made,
                COUNT(CASE WHEN event_name = 'save_calculation' THEN 1 END) as calculations_saved,

                -- Time patterns
                AVG(CASE WHEN toHour(event_timestamp) BETWEEN 9 AND 17 THEN 1 ELSE 0 END) as business_hours_ratio,
                AVG(CASE WHEN toDayOfWeek(event_timestamp) IN (6, 7) THEN 1 ELSE 0 END) as weekend_ratio,

                -- Recency metrics
                MAX(event_timestamp) as last_activity,
                MIN(event_timestamp) as first_activity,
                dateDiff('day', MIN(event_timestamp), MAX(event_timestamp)) as user_lifetime_days,

                -- Attribution
                any(attribution_channel) as acquisition_channel,
                any(utm_source) as utm_source

            FROM user_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id, user_country, user_type, device_type
        ),
        calculator_features AS (
            SELECT
                user_id,
                COUNT(*) as total_calculations,
                COUNT(DISTINCT calculator_type) as calculator_types_used,
                AVG(calculation_duration_ms) as avg_calculation_time,
                COUNT(CASE WHEN error_occurred = 1 THEN 1 END) as calculation_errors,
                SUM(tax_amount_total) as total_tax_calculated,
                COUNT(CASE WHEN interaction_type = 'saved' THEN 1 END) as saved_calculations,
                COUNT(CASE WHEN offline_calculation = 1 THEN 1 END) as offline_calculations
            FROM calculator_usage
            WHERE calculation_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id
        ),
        revenue_features AS (
            SELECT
                user_id,
                SUM(revenue_amount_usd) as total_revenue,
                COUNT(*) as total_transactions,
                AVG(revenue_amount_usd) as avg_transaction_value,
                COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as subscriptions,
                MAX(event_timestamp) as last_payment
            FROM revenue_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id
        )
        SELECT
            ua.user_id,
            ua.user_country,
            ua.user_type,
            ua.device_type,
            ua.total_sessions,
            ua.avg_session_duration,
            ua.total_page_views,
            ua.avg_time_on_page,
            ua.active_days,
            ua.calculations_completed,
            ua.exports_made,
            ua.shares_made,
            ua.calculations_saved,
            ua.business_hours_ratio,
            ua.weekend_ratio,
            ua.user_lifetime_days,
            ua.acquisition_channel,

            -- Days since last activity (key churn indicator)
            dateDiff('day', ua.last_activity, now()) as days_since_last_activity,

            COALESCE(cf.total_calculations, 0) as calc_total_calculations,
            COALESCE(cf.calculator_types_used, 0) as calc_types_used,
            COALESCE(cf.avg_calculation_time, 0) as calc_avg_time,
            COALESCE(cf.calculation_errors, 0) as calc_errors,
            COALESCE(cf.total_tax_calculated, 0) as calc_total_tax,
            COALESCE(cf.saved_calculations, 0) as calc_saved,
            COALESCE(cf.offline_calculations, 0) as calc_offline,

            COALESCE(rf.total_revenue, 0) as total_revenue,
            COALESCE(rf.total_transactions, 0) as revenue_transactions,
            COALESCE(rf.avg_transaction_value, 0) as avg_transaction_value,
            COALESCE(rf.subscriptions, 0) as subscriptions,

            -- Churn label (1 if churned, 0 if active)
            CASE
                WHEN dateDiff('day', ua.last_activity, now()) > {churn_threshold}
                THEN 1
                ELSE 0
            END as churned

        FROM user_activity ua
        LEFT JOIN calculator_features cf ON ua.user_id = cf.user_id
        LEFT JOIN revenue_features rf ON ua.user_id = rf.user_id
        ORDER BY ua.user_id
        """.format(
            start_date=start_date.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=end_date.strftime('%Y-%m-%d %H:%M:%S'),
            churn_threshold=churn_threshold_days
        )

        result = self.client.execute(query)

        if not result:
            return pd.DataFrame()

        columns = [
            'user_id', 'user_country', 'user_type', 'device_type', 'total_sessions',
            'avg_session_duration', 'total_page_views', 'avg_time_on_page', 'active_days',
            'calculations_completed', 'exports_made', 'shares_made', 'calculations_saved',
            'business_hours_ratio', 'weekend_ratio', 'user_lifetime_days', 'acquisition_channel',
            'days_since_last_activity', 'calc_total_calculations', 'calc_types_used',
            'calc_avg_time', 'calc_errors', 'calc_total_tax', 'calc_saved', 'calc_offline',
            'total_revenue', 'revenue_transactions', 'avg_transaction_value', 'subscriptions', 'churned'
        ]

        df = pd.DataFrame(result, columns=columns)

        # Feature engineering
        df['sessions_per_day'] = df['total_sessions'] / df['active_days'].replace(0, 1)
        df['calculations_per_session'] = df['calculations_completed'] / df['total_sessions'].replace(0, 1)
        df['error_rate'] = df['calc_errors'] / df['calc_total_calculations'].replace(0, 1)
        df['revenue_per_session'] = df['total_revenue'] / df['total_sessions'].replace(0, 1)

        # Engagement score
        df['engagement_score'] = (
            df['calculations_completed'] * 0.3 +
            df['exports_made'] * 0.2 +
            df['shares_made'] * 0.2 +
            df['calculations_saved'] * 0.1 +
            df['total_sessions'] * 0.2
        )

        return df.fillna(0)

    def train_churn_prediction_model(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Train churn prediction model using multiple algorithms"""

        # Prepare features
        categorical_features = ['user_country', 'user_type', 'device_type', 'acquisition_channel']
        numerical_features = [col for col in df.columns if col not in
                            categorical_features + ['user_id', 'churned']]

        # Encode categorical features
        df_encoded = df.copy()
        for cat_col in categorical_features:
            if cat_col not in self.encoders:
                self.encoders[cat_col] = LabelEncoder()
            df_encoded[cat_col] = self.encoders[cat_col].fit_transform(df_encoded[cat_col].astype(str))

        # Prepare feature matrix
        feature_cols = categorical_features + numerical_features
        X = df_encoded[feature_cols]
        y = df_encoded['churned']

        # Scale numerical features
        scaler = StandardScaler()
        X[numerical_features] = scaler.fit_transform(X[numerical_features])
        self.scalers['churn_prediction'] = scaler

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        # Train multiple models
        models = {
            'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'xgboost': xgb.XGBClassifier(random_state=42),
            'logistic_regression': LogisticRegression(random_state=42),
            'gradient_boosting': GradientBoostingClassifier(random_state=42)
        }

        model_results = {}

        for model_name, model in models.items():
            # Train model
            model.fit(X_train, y_train)

            # Make predictions
            y_pred = model.predict(X_test)
            y_pred_proba = model.predict_proba(X_test)[:, 1]

            # Calculate metrics
            metrics = {
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred),
                'recall': recall_score(y_test, y_pred),
                'f1_score': f1_score(y_test, y_pred),
                'roc_auc': roc_auc_score(y_test, y_pred_proba)
            }

            # Feature importance
            if hasattr(model, 'feature_importances_'):
                importance = dict(zip(feature_cols, model.feature_importances_))
                importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
            else:
                importance = {}

            model_results[model_name] = {
                'model': model,
                'metrics': metrics,
                'feature_importance': importance
            }

        # Select best model based on F1 score
        best_model_name = max(model_results.keys(), key=lambda k: model_results[k]['metrics']['f1_score'])
        best_model = model_results[best_model_name]

        # Store best model
        self.models['churn_prediction'] = best_model['model']
        self.feature_importance['churn_prediction'] = best_model['feature_importance']

        return {
            'best_model': best_model_name,
            'best_metrics': best_model['metrics'],
            'all_results': model_results,
            'feature_importance': best_model['feature_importance'],
            'feature_columns': feature_cols
        }

    def prepare_ltv_prediction_data(self, lookback_days: int = 180) -> pd.DataFrame:
        """Prepare data for customer lifetime value prediction"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days)

        query = """
        WITH customer_metrics AS (
            SELECT
                user_id,
                user_country,
                user_type,

                -- Time metrics
                MIN(event_timestamp) as first_activity,
                MAX(event_timestamp) as last_activity,
                dateDiff('day', MIN(event_timestamp), MAX(event_timestamp)) as customer_lifetime_days,

                -- Activity metrics
                COUNT(DISTINCT session_id) as total_sessions,
                AVG(session_duration_seconds) as avg_session_duration,
                COUNT(DISTINCT toDate(event_timestamp)) as active_days,
                COUNT(CASE WHEN event_name = 'calculation_completed' THEN 1 END) as calculations_completed,

                -- Early engagement indicators
                COUNT(CASE WHEN event_name = 'calculation_completed'
                          AND event_timestamp <= MIN(event_timestamp) + INTERVAL 7 DAY THEN 1 END) as early_calculations,
                COUNT(CASE WHEN event_name = 'export'
                          AND event_timestamp <= MIN(event_timestamp) + INTERVAL 7 DAY THEN 1 END) as early_exports,

                -- Attribution
                any(attribution_channel) as acquisition_channel

            FROM user_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id, user_country, user_type
        ),
        revenue_metrics AS (
            SELECT
                user_id,
                SUM(revenue_amount_usd) as total_ltv,
                COUNT(*) as total_transactions,
                AVG(revenue_amount_usd) as avg_transaction_value,
                MIN(event_timestamp) as first_payment,
                MAX(event_timestamp) as last_payment,
                COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as subscriptions,
                COUNT(CASE WHEN event_type = 'renewal' THEN 1 END) as renewals
            FROM revenue_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id
        )
        SELECT
            cm.user_id,
            cm.user_country,
            cm.user_type,
            cm.customer_lifetime_days,
            cm.total_sessions,
            cm.avg_session_duration,
            cm.active_days,
            cm.calculations_completed,
            cm.early_calculations,
            cm.early_exports,
            cm.acquisition_channel,

            -- Calculate engagement rates
            cm.calculations_completed / cm.total_sessions as calc_per_session,
            cm.active_days / cm.customer_lifetime_days as activity_ratio,

            COALESCE(rm.total_ltv, 0) as actual_ltv,
            COALESCE(rm.total_transactions, 0) as total_transactions,
            COALESCE(rm.avg_transaction_value, 0) as avg_transaction_value,
            COALESCE(rm.subscriptions, 0) as subscriptions,
            COALESCE(rm.renewals, 0) as renewals

        FROM customer_metrics cm
        LEFT JOIN revenue_metrics rm ON cm.user_id = rm.user_id
        WHERE cm.customer_lifetime_days >= 30  -- Only include users with sufficient history
        ORDER BY cm.user_id
        """.format(
            start_date=start_date.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=end_date.strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if not result:
            return pd.DataFrame()

        columns = [
            'user_id', 'user_country', 'user_type', 'customer_lifetime_days', 'total_sessions',
            'avg_session_duration', 'active_days', 'calculations_completed', 'early_calculations',
            'early_exports', 'acquisition_channel', 'calc_per_session', 'activity_ratio',
            'actual_ltv', 'total_transactions', 'avg_transaction_value', 'subscriptions', 'renewals'
        ]

        df = pd.DataFrame(result, columns=columns)

        # Additional feature engineering
        df['session_frequency'] = df['total_sessions'] / df['customer_lifetime_days'].replace(0, 1)
        df['early_engagement_score'] = df['early_calculations'] * 0.7 + df['early_exports'] * 0.3
        df['subscription_ratio'] = df['subscriptions'] / df['total_transactions'].replace(0, 1)

        return df.fillna(0)

    def train_ltv_prediction_model(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Train customer lifetime value prediction model"""

        # Prepare features
        categorical_features = ['user_country', 'user_type', 'acquisition_channel']
        numerical_features = [col for col in df.columns if col not in
                            categorical_features + ['user_id', 'actual_ltv']]

        # Encode categorical features
        df_encoded = df.copy()
        for cat_col in categorical_features:
            if cat_col not in self.encoders:
                self.encoders[cat_col] = LabelEncoder()
            df_encoded[cat_col] = self.encoders[cat_col].fit_transform(df_encoded[cat_col].astype(str))

        # Prepare feature matrix
        feature_cols = categorical_features + numerical_features
        X = df_encoded[feature_cols]
        y = df_encoded['actual_ltv']

        # Scale features
        scaler = StandardScaler()
        X[numerical_features] = scaler.fit_transform(X[numerical_features])
        self.scalers['ltv_prediction'] = scaler

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Train multiple models
        models = {
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'xgboost': xgb.XGBRegressor(random_state=42),
            'linear_regression': LinearRegression(),
            'gradient_boosting': RandomForestRegressor(n_estimators=100, random_state=42)
        }

        model_results = {}

        for model_name, model in models.items():
            # Train model
            model.fit(X_train, y_train)

            # Make predictions
            y_pred = model.predict(X_test)

            # Calculate metrics
            metrics = {
                'mse': mean_squared_error(y_test, y_pred),
                'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
                'r2_score': r2_score(y_test, y_pred),
                'mae': np.mean(np.abs(y_test - y_pred))
            }

            # Feature importance
            if hasattr(model, 'feature_importances_'):
                importance = dict(zip(feature_cols, model.feature_importances_))
                importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
            else:
                importance = {}

            model_results[model_name] = {
                'model': model,
                'metrics': metrics,
                'feature_importance': importance,
                'predictions': y_pred
            }

        # Select best model based on R2 score
        best_model_name = max(model_results.keys(), key=lambda k: model_results[k]['metrics']['r2_score'])
        best_model = model_results[best_model_name]

        # Store best model
        self.models['ltv_prediction'] = best_model['model']
        self.feature_importance['ltv_prediction'] = best_model['feature_importance']

        return {
            'best_model': best_model_name,
            'best_metrics': best_model['metrics'],
            'all_results': model_results,
            'feature_importance': best_model['feature_importance'],
            'feature_columns': feature_cols
        }

    def create_demand_forecasting_model(self, days_ahead: int = 30) -> Dict[str, Any]:
        """Create demand forecasting using Prophet"""

        # Get historical usage data
        query = """
        SELECT
            toDate(calculation_timestamp) as ds,
            COUNT(*) as y
        FROM calculator_usage
        WHERE calculation_timestamp >= now() - INTERVAL 6 MONTH
        GROUP BY ds
        ORDER BY ds
        """

        result = self.client.execute(query)

        if not result:
            return {'error': 'No data available for forecasting'}

        df = pd.DataFrame(result, columns=['ds', 'y'])
        df['ds'] = pd.to_datetime(df['ds'])

        # Initialize Prophet model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )

        # Add custom seasonalities
        model.add_seasonality(name='monthly', period=30.5, fourier_order=5)

        # Fit model
        model.fit(df)

        # Make future dataframe
        future = model.make_future_dataframe(periods=days_ahead)

        # Generate forecast
        forecast = model.predict(future)

        # Store model
        self.models['demand_forecasting'] = model

        return {
            'model': model,
            'forecast': forecast,
            'historical_data': df,
            'forecast_period': days_ahead,
            'components': model.predict(future)
        }

    def predict_user_churn_probability(self, user_features: Dict[str, Any]) -> Dict[str, Any]:
        """Predict churn probability for a specific user"""

        if 'churn_prediction' not in self.models:
            return {'error': 'Churn prediction model not trained'}

        model = self.models['churn_prediction']

        # Prepare features (this would need to match training features)
        # Implementation depends on the specific feature format
        # This is a simplified example

        try:
            # Convert user features to proper format
            feature_vector = self._prepare_user_features_for_prediction(user_features, 'churn_prediction')

            # Make prediction
            churn_probability = model.predict_proba([feature_vector])[0][1]
            churn_prediction = model.predict([feature_vector])[0]

            # Determine risk level
            if churn_probability > 0.7:
                risk_level = 'High'
            elif churn_probability > 0.4:
                risk_level = 'Medium'
            else:
                risk_level = 'Low'

            return {
                'churn_probability': float(churn_probability),
                'churn_prediction': bool(churn_prediction),
                'risk_level': risk_level,
                'recommendations': self._generate_churn_recommendations(churn_probability, user_features)
            }

        except Exception as e:
            return {'error': f'Prediction failed: {str(e)}'}

    def predict_user_ltv(self, user_features: Dict[str, Any]) -> Dict[str, Any]:
        """Predict lifetime value for a specific user"""

        if 'ltv_prediction' not in self.models:
            return {'error': 'LTV prediction model not trained'}

        model = self.models['ltv_prediction']

        try:
            # Convert user features to proper format
            feature_vector = self._prepare_user_features_for_prediction(user_features, 'ltv_prediction')

            # Make prediction
            predicted_ltv = model.predict([feature_vector])[0]

            # Categorize LTV
            if predicted_ltv > 500:
                ltv_category = 'High Value'
            elif predicted_ltv > 100:
                ltv_category = 'Medium Value'
            else:
                ltv_category = 'Low Value'

            return {
                'predicted_ltv': float(predicted_ltv),
                'ltv_category': ltv_category,
                'recommendations': self._generate_ltv_recommendations(predicted_ltv, user_features)
            }

        except Exception as e:
            return {'error': f'Prediction failed: {str(e)}'}

    def _prepare_user_features_for_prediction(self, user_features: Dict[str, Any], model_type: str) -> List[float]:
        """Prepare user features for model prediction"""

        # This is a simplified implementation
        # In practice, you'd need to ensure feature order and encoding matches training

        features = []

        # Add categorical features (encoded)
        categorical_features = ['user_country', 'user_type', 'device_type', 'acquisition_channel']
        for cat_feature in categorical_features:
            if cat_feature in user_features and cat_feature in self.encoders:
                encoded_value = self.encoders[cat_feature].transform([str(user_features[cat_feature])])[0]
                features.append(float(encoded_value))
            else:
                features.append(0.0)

        # Add numerical features
        numerical_features = [
            'total_sessions', 'avg_session_duration', 'total_page_views', 'active_days',
            'calculations_completed', 'exports_made', 'shares_made', 'business_hours_ratio'
        ]

        for num_feature in numerical_features:
            features.append(float(user_features.get(num_feature, 0)))

        return features

    def _generate_churn_recommendations(self, churn_probability: float, user_features: Dict[str, Any]) -> List[str]:
        """Generate churn prevention recommendations"""

        recommendations = []

        if churn_probability > 0.7:
            recommendations.extend([
                "Immediate intervention required - contact user directly",
                "Offer special discount or premium trial",
                "Provide personalized onboarding session"
            ])
        elif churn_probability > 0.4:
            recommendations.extend([
                "Send re-engagement email campaign",
                "Highlight unused features",
                "Offer tutorial or help resources"
            ])

        # Feature-specific recommendations
        if user_features.get('calculations_completed', 0) < 2:
            recommendations.append("Encourage first calculation completion")

        if user_features.get('total_sessions', 0) < 3:
            recommendations.append("Focus on increasing session frequency")

        return recommendations

    def _generate_ltv_recommendations(self, predicted_ltv: float, user_features: Dict[str, Any]) -> List[str]:
        """Generate LTV optimization recommendations"""

        recommendations = []

        if predicted_ltv > 500:
            recommendations.extend([
                "Target for enterprise features",
                "Offer priority support",
                "Consider custom solutions"
            ])
        elif predicted_ltv > 100:
            recommendations.extend([
                "Upsell to premium features",
                "Encourage annual billing",
                "Provide advanced tutorials"
            ])
        else:
            recommendations.extend([
                "Focus on engagement improvement",
                "Highlight value proposition",
                "Offer free trial extension"
            ])

        return recommendations

    def create_model_performance_dashboard(self) -> Dict[str, go.Figure]:
        """Create dashboard for model performance visualization"""

        charts = {}

        # Churn model performance
        if 'churn_prediction' in self.feature_importance:
            charts['churn_feature_importance'] = self._create_feature_importance_chart(
                self.feature_importance['churn_prediction'], 'Churn Prediction Feature Importance'
            )

        # LTV model performance
        if 'ltv_prediction' in self.feature_importance:
            charts['ltv_feature_importance'] = self._create_feature_importance_chart(
                self.feature_importance['ltv_prediction'], 'LTV Prediction Feature Importance'
            )

        # Demand forecasting
        if 'demand_forecasting' in self.models:
            charts['demand_forecast'] = self._create_demand_forecast_chart()

        return charts

    def _create_feature_importance_chart(self, importance_dict: Dict[str, float], title: str) -> go.Figure:
        """Create feature importance visualization"""

        # Get top 15 features
        top_features = dict(list(importance_dict.items())[:15])

        fig = go.Figure(data=[
            go.Bar(
                x=list(top_features.values()),
                y=list(top_features.keys()),
                orientation='h',
                marker_color=self.colors['primary']
            )
        ])

        fig.update_layout(
            title=title,
            xaxis_title='Importance',
            yaxis_title='Features',
            height=600
        )

        return fig

    def _create_demand_forecast_chart(self) -> go.Figure:
        """Create demand forecasting visualization"""

        if 'demand_forecasting' not in self.models:
            return go.Figure()

        # This would use the forecast data from the demand forecasting model
        # Simplified implementation
        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=[datetime.now() + timedelta(days=i) for i in range(30)],
            y=np.random.normal(1000, 100, 30),  # Placeholder data
            mode='lines',
            name='Forecast',
            line=dict(color=self.colors['primary'])
        ))

        fig.update_layout(
            title='Calculator Usage Demand Forecast',
            xaxis_title='Date',
            yaxis_title='Daily Usage',
            height=400
        )

        return fig

    def save_model(self, model_name: str, file_path: str) -> bool:
        """Save trained model to disk"""

        if model_name not in self.models:
            return False

        try:
            model_data = {
                'model': self.models[model_name],
                'scaler': self.scalers.get(model_name),
                'encoders': {k: v for k, v in self.encoders.items()},
                'feature_importance': self.feature_importance.get(model_name, {}),
                'created_at': datetime.now()
            }

            joblib.dump(model_data, file_path)
            return True

        except Exception as e:
            print(f"Error saving model: {e}")
            return False

    def load_model(self, model_name: str, file_path: str) -> bool:
        """Load trained model from disk"""

        try:
            model_data = joblib.load(file_path)

            self.models[model_name] = model_data['model']
            if model_data.get('scaler'):
                self.scalers[model_name] = model_data['scaler']

            self.encoders.update(model_data.get('encoders', {}))
            self.feature_importance[model_name] = model_data.get('feature_importance', {})

            return True

        except Exception as e:
            print(f"Error loading model: {e}")
            return False

    def generate_predictive_analytics_report(self) -> Dict[str, Any]:
        """Generate comprehensive predictive analytics report"""

        # Prepare data
        churn_data = self.prepare_churn_prediction_data()
        ltv_data = self.prepare_ltv_prediction_data()

        results = {}

        # Train churn model if data available
        if not churn_data.empty:
            churn_results = self.train_churn_prediction_model(churn_data)
            results['churn_prediction'] = churn_results

        # Train LTV model if data available
        if not ltv_data.empty:
            ltv_results = self.train_ltv_prediction_model(ltv_data)
            results['ltv_prediction'] = ltv_results

        # Create demand forecast
        demand_forecast = self.create_demand_forecasting_model()
        results['demand_forecasting'] = demand_forecast

        # Create performance dashboard
        charts = self.create_model_performance_dashboard()
        results['charts'] = charts

        # Generate insights
        insights = self._generate_predictive_insights(results)
        results['insights'] = insights

        results['generated_at'] = datetime.now()

        return results

    def _generate_predictive_insights(self, results: Dict[str, Any]) -> List[Dict[str, str]]:
        """Generate actionable insights from predictive models"""

        insights = []

        # Churn model insights
        if 'churn_prediction' in results:
            churn_metrics = results['churn_prediction'].get('best_metrics', {})
            f1_score = churn_metrics.get('f1_score', 0)

            if f1_score > 0.8:
                insights.append({
                    'type': 'success',
                    'category': 'Churn Prediction',
                    'title': 'High-Quality Churn Model',
                    'description': f'Churn prediction model achieved F1 score of {f1_score:.2f}, enabling effective retention targeting.'
                })

            # Feature importance insights
            feature_importance = results['churn_prediction'].get('feature_importance', {})
            if feature_importance:
                top_feature = list(feature_importance.keys())[0]
                insights.append({
                    'type': 'info',
                    'category': 'Churn Factors',
                    'title': f'Key Churn Indicator: {top_feature}',
                    'description': f'{top_feature} is the strongest predictor of user churn.'
                })

        # LTV model insights
        if 'ltv_prediction' in results:
            ltv_metrics = results['ltv_prediction'].get('best_metrics', {})
            r2_score = ltv_metrics.get('r2_score', 0)

            if r2_score > 0.7:
                insights.append({
                    'type': 'success',
                    'category': 'LTV Prediction',
                    'title': 'Accurate LTV Predictions',
                    'description': f'LTV model explains {r2_score*100:.1f}% of customer value variance, enabling precise targeting.'
                })

        # Demand forecasting insights
        if 'demand_forecasting' in results and 'error' not in results['demand_forecasting']:
            insights.append({
                'type': 'info',
                'category': 'Demand Forecasting',
                'title': 'Demand Patterns Identified',
                'description': 'Successfully created demand forecasting model for capacity planning.'
            })

        return insights
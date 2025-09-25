"""
Funnel Optimization Module

This module provides advanced funnel optimization capabilities including:
- Bottleneck identification and analysis
- Conversion optimization recommendations
- Multi-variate testing framework
- User journey optimization
- Predictive funnel modeling
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
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
import json
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class OptimizationRecommendation:
    """Represents a funnel optimization recommendation"""
    step_name: str
    issue_type: str
    priority: str  # 'high', 'medium', 'low'
    description: str
    recommended_actions: List[str]
    potential_impact: Dict[str, float]
    confidence_score: float

@dataclass
class BottleneckAnalysis:
    """Results of bottleneck analysis"""
    step_name: str
    drop_off_rate: float
    users_lost: int
    potential_revenue_impact: float
    contributing_factors: Dict[str, Any]
    optimization_opportunities: List[str]

class FunnelOptimizer:
    """
    Advanced funnel optimization engine for identifying bottlenecks and improvement opportunities
    """

    def __init__(self, clickhouse_config: Dict[str, str]):
        """
        Initialize the funnel optimizer

        Args:
            clickhouse_config: ClickHouse connection configuration
        """
        self.clickhouse_config = clickhouse_config
        self.client = None
        self._connect_to_clickhouse()

        # Initialize ML models
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.conversion_model = None

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

    def identify_bottlenecks(self,
                           funnel_steps: List[str],
                           date_range: Tuple[str, str] = None,
                           min_drop_off_threshold: float = 20.0) -> List[BottleneckAnalysis]:
        """
        Identify bottlenecks in the conversion funnel

        Args:
            funnel_steps: List of funnel step names in order
            date_range: Optional date range filter
            min_drop_off_threshold: Minimum drop-off rate to consider as bottleneck

        Returns:
            List of BottleneckAnalysis objects
        """
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"AND timestamp >= '{date_range[0]}' AND timestamp <= '{date_range[1]}'"

            bottlenecks = []

            for i in range(len(funnel_steps) - 1):
                current_step = funnel_steps[i]
                next_step = funnel_steps[i + 1]

                # Get users at current step
                current_query = f"""
                SELECT COUNT(DISTINCT user_id) as users
                FROM user_events
                WHERE event_type = '{current_step}'
                {date_filter}
                """

                current_result = self.client.query(current_query)
                current_users = current_result.result_rows[0][0] if current_result.result_rows else 0

                # Get users at next step
                next_query = f"""
                SELECT COUNT(DISTINCT user_id) as users
                FROM user_events
                WHERE event_type = '{next_step}'
                {date_filter}
                """

                next_result = self.client.query(next_query)
                next_users = next_result.result_rows[0][0] if next_result.result_rows else 0

                # Calculate drop-off rate
                if current_users > 0:
                    drop_off_rate = ((current_users - next_users) / current_users) * 100
                    users_lost = current_users - next_users

                    if drop_off_rate >= min_drop_off_threshold:
                        # Analyze contributing factors
                        contributing_factors = self._analyze_contributing_factors(
                            current_step, next_step, date_range
                        )

                        # Estimate potential revenue impact
                        potential_revenue_impact = self._estimate_revenue_impact(
                            users_lost, next_step, date_range
                        )

                        # Generate optimization opportunities
                        optimization_opportunities = self._generate_optimization_opportunities(
                            current_step, next_step, contributing_factors
                        )

                        bottleneck = BottleneckAnalysis(
                            step_name=f"{current_step} -> {next_step}",
                            drop_off_rate=drop_off_rate,
                            users_lost=users_lost,
                            potential_revenue_impact=potential_revenue_impact,
                            contributing_factors=contributing_factors,
                            optimization_opportunities=optimization_opportunities
                        )

                        bottlenecks.append(bottleneck)

            # Sort by potential impact
            bottlenecks.sort(key=lambda x: x.potential_revenue_impact, reverse=True)

            return bottlenecks

        except Exception as e:
            logger.error(f"Error identifying bottlenecks: {e}")
            raise

    def _analyze_contributing_factors(self,
                                    current_step: str,
                                    next_step: str,
                                    date_range: Tuple[str, str] = None) -> Dict[str, Any]:
        """Analyze factors contributing to drop-off between steps"""
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"AND ue.timestamp >= '{date_range[0]}' AND ue.timestamp <= '{date_range[1]}'"

            # Analyze user characteristics of drop-offs vs conversions
            query = f"""
            WITH step_users AS (
                SELECT
                    user_id,
                    MAX(CASE WHEN event_type = '{current_step}' THEN 1 ELSE 0 END) as reached_current,
                    MAX(CASE WHEN event_type = '{next_step}' THEN 1 ELSE 0 END) as reached_next
                FROM user_events ue
                WHERE event_type IN ('{current_step}', '{next_step}')
                {date_filter}
                GROUP BY user_id
                HAVING reached_current = 1
            ),
            user_characteristics AS (
                SELECT
                    su.user_id,
                    su.reached_next as converted,
                    ue.country,
                    ue.device_type,
                    ue.utm_source,
                    ue.utm_medium,
                    COUNT(DISTINCT ue.session_id) as sessions_count,
                    AVG(ue.session_duration) as avg_session_duration,
                    COUNT(*) as total_events
                FROM step_users su
                JOIN user_events ue ON su.user_id = ue.user_id
                {date_filter.replace('AND ue.', 'WHERE ue.')}
                GROUP BY su.user_id, su.reached_next, ue.country, ue.device_type, ue.utm_source, ue.utm_medium
            )
            SELECT
                converted,
                country,
                device_type,
                utm_source,
                utm_medium,
                AVG(sessions_count) as avg_sessions,
                AVG(avg_session_duration) as avg_duration,
                AVG(total_events) as avg_events,
                COUNT(*) as user_count
            FROM user_characteristics
            GROUP BY converted, country, device_type, utm_source, utm_medium
            ORDER BY converted, user_count DESC
            """

            result = self.client.query(query)
            df = pd.DataFrame(result.result_rows,
                            columns=['converted', 'country', 'device_type', 'utm_source', 'utm_medium',
                                   'avg_sessions', 'avg_duration', 'avg_events', 'user_count'])

            # Analyze differences between converters and non-converters
            converted_df = df[df['converted'] == 1]
            not_converted_df = df[df['converted'] == 0]

            factors = {
                'geographic_patterns': self._analyze_geographic_patterns(converted_df, not_converted_df),
                'device_patterns': self._analyze_device_patterns(converted_df, not_converted_df),
                'traffic_source_patterns': self._analyze_traffic_patterns(converted_df, not_converted_df),
                'behavioral_patterns': self._analyze_behavioral_patterns(converted_df, not_converted_df)
            }

            return factors

        except Exception as e:
            logger.error(f"Error analyzing contributing factors: {e}")
            return {}

    def _analyze_geographic_patterns(self, converted_df: pd.DataFrame, not_converted_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze geographic patterns in conversion"""
        if converted_df.empty or not_converted_df.empty:
            return {}

        converted_countries = converted_df.groupby('country')['user_count'].sum().sort_values(ascending=False)
        not_converted_countries = not_converted_df.groupby('country')['user_count'].sum().sort_values(ascending=False)

        # Calculate conversion rates by country
        total_by_country = converted_countries.add(not_converted_countries, fill_value=0)
        conversion_rates = (converted_countries / total_by_country * 100).fillna(0)

        return {
            'top_converting_countries': conversion_rates.head(5).to_dict(),
            'lowest_converting_countries': conversion_rates.tail(5).to_dict(),
            'geographic_insights': self._generate_geographic_insights(conversion_rates)
        }

    def _analyze_device_patterns(self, converted_df: pd.DataFrame, not_converted_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze device patterns in conversion"""
        if converted_df.empty or not_converted_df.empty:
            return {}

        converted_devices = converted_df.groupby('device_type')['user_count'].sum()
        not_converted_devices = not_converted_df.groupby('device_type')['user_count'].sum()

        total_by_device = converted_devices.add(not_converted_devices, fill_value=0)
        conversion_rates = (converted_devices / total_by_device * 100).fillna(0)

        return {
            'device_conversion_rates': conversion_rates.to_dict(),
            'device_insights': self._generate_device_insights(conversion_rates)
        }

    def _analyze_traffic_patterns(self, converted_df: pd.DataFrame, not_converted_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze traffic source patterns in conversion"""
        if converted_df.empty or not_converted_df.empty:
            return {}

        converted_sources = converted_df.groupby('utm_source')['user_count'].sum()
        not_converted_sources = not_converted_df.groupby('utm_source')['user_count'].sum()

        total_by_source = converted_sources.add(not_converted_sources, fill_value=0)
        conversion_rates = (converted_sources / total_by_source * 100).fillna(0)

        return {
            'source_conversion_rates': conversion_rates.to_dict(),
            'traffic_insights': self._generate_traffic_insights(conversion_rates)
        }

    def _analyze_behavioral_patterns(self, converted_df: pd.DataFrame, not_converted_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze behavioral patterns in conversion"""
        if converted_df.empty or not_converted_df.empty:
            return {}

        converted_behavior = {
            'avg_sessions': converted_df['avg_sessions'].mean(),
            'avg_duration': converted_df['avg_duration'].mean(),
            'avg_events': converted_df['avg_events'].mean()
        }

        not_converted_behavior = {
            'avg_sessions': not_converted_df['avg_sessions'].mean(),
            'avg_duration': not_converted_df['avg_duration'].mean(),
            'avg_events': not_converted_df['avg_events'].mean()
        }

        return {
            'converted_behavior': converted_behavior,
            'not_converted_behavior': not_converted_behavior,
            'behavioral_insights': self._generate_behavioral_insights(converted_behavior, not_converted_behavior)
        }

    def _generate_geographic_insights(self, conversion_rates: pd.Series) -> List[str]:
        """Generate insights about geographic conversion patterns"""
        insights = []

        if len(conversion_rates) > 0:
            best_country = conversion_rates.idxmax()
            worst_country = conversion_rates.idxmin()
            avg_rate = conversion_rates.mean()

            insights.append(f"{best_country} has the highest conversion rate at {conversion_rates[best_country]:.1f}%")
            insights.append(f"{worst_country} has the lowest conversion rate at {conversion_rates[worst_country]:.1f}%")

            if conversion_rates[best_country] > avg_rate * 1.5:
                insights.append(f"Consider targeting marketing efforts more heavily in {best_country}")

            if conversion_rates[worst_country] < avg_rate * 0.5:
                insights.append(f"Investigate UX issues specific to {worst_country} (language, payment methods, etc.)")

        return insights

    def _generate_device_insights(self, conversion_rates: pd.Series) -> List[str]:
        """Generate insights about device conversion patterns"""
        insights = []

        if 'mobile' in conversion_rates and 'desktop' in conversion_rates:
            mobile_rate = conversion_rates.get('mobile', 0)
            desktop_rate = conversion_rates.get('desktop', 0)

            if desktop_rate > mobile_rate * 1.3:
                insights.append("Desktop users convert significantly better - optimize mobile experience")
            elif mobile_rate > desktop_rate * 1.3:
                insights.append("Mobile users convert better - ensure mobile-first design")

        return insights

    def _generate_traffic_insights(self, conversion_rates: pd.Series) -> List[str]:
        """Generate insights about traffic source conversion patterns"""
        insights = []

        if len(conversion_rates) > 0:
            best_source = conversion_rates.idxmax()
            worst_source = conversion_rates.idxmin()

            insights.append(f"{best_source} traffic converts best at {conversion_rates[best_source]:.1f}%")
            insights.append(f"{worst_source} traffic converts worst at {conversion_rates[worst_source]:.1f}%")

            if 'organic' in conversion_rates and conversion_rates['organic'] > conversion_rates.mean():
                insights.append("Organic traffic performs well - invest in SEO")

            if 'paid' in conversion_rates and conversion_rates['paid'] < conversion_rates.mean():
                insights.append("Paid traffic underperforms - review ad targeting and landing pages")

        return insights

    def _generate_behavioral_insights(self, converted: Dict, not_converted: Dict) -> List[str]:
        """Generate insights about behavioral patterns"""
        insights = []

        if converted['avg_sessions'] > not_converted['avg_sessions'] * 1.2:
            insights.append("Users who convert tend to have more sessions - focus on re-engagement")

        if converted['avg_duration'] > not_converted['avg_duration'] * 1.2:
            insights.append("Longer session duration correlates with conversion - improve content engagement")

        if converted['avg_events'] > not_converted['avg_events'] * 1.2:
            insights.append("More engaged users convert better - encourage interaction")

        return insights

    def _estimate_revenue_impact(self,
                               users_lost: int,
                               step_name: str,
                               date_range: Tuple[str, str] = None) -> float:
        """Estimate potential revenue impact of fixing bottleneck"""
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"AND timestamp >= '{date_range[0]}' AND timestamp <= '{date_range[1]}'"

            # Get average revenue per user who completes this step
            query = f"""
            SELECT AVG(event_value) as avg_revenue
            FROM user_events
            WHERE event_type = 'revenue'
            AND user_id IN (
                SELECT DISTINCT user_id
                FROM user_events
                WHERE event_type = '{step_name}'
                {date_filter}
            )
            {date_filter}
            """

            result = self.client.query(query)
            avg_revenue = result.result_rows[0][0] if result.result_rows and result.result_rows[0][0] else 0

            # Estimate potential impact (assume 20% improvement in conversion)
            potential_recovered_users = users_lost * 0.2
            potential_revenue_impact = potential_recovered_users * avg_revenue

            return float(potential_revenue_impact)

        except Exception as e:
            logger.error(f"Error estimating revenue impact: {e}")
            return 0.0

    def _generate_optimization_opportunities(self,
                                          current_step: str,
                                          next_step: str,
                                          contributing_factors: Dict[str, Any]) -> List[str]:
        """Generate specific optimization opportunities"""
        opportunities = []

        # Generic opportunities based on step types
        if 'signup' in next_step.lower():
            opportunities.extend([
                "Simplify signup form (reduce fields)",
                "Add social login options",
                "Implement progressive registration",
                "A/B test different signup incentives"
            ])

        if 'payment' in next_step.lower() or 'subscription' in next_step.lower():
            opportunities.extend([
                "Add more payment method options",
                "Implement trust signals (security badges)",
                "Offer multiple subscription tiers",
                "Add money-back guarantee"
            ])

        if 'calculator' in current_step.lower():
            opportunities.extend([
                "Improve calculator UX/UI",
                "Add progress indicators",
                "Provide input validation and help text",
                "Optimize loading times"
            ])

        # Specific opportunities based on contributing factors
        if contributing_factors:
            device_patterns = contributing_factors.get('device_patterns', {})
            if device_patterns and 'device_insights' in device_patterns:
                opportunities.extend(device_patterns['device_insights'])

            geographic_patterns = contributing_factors.get('geographic_patterns', {})
            if geographic_patterns and 'geographic_insights' in geographic_patterns:
                opportunities.extend(geographic_patterns['geographic_insights'])

        return opportunities

    def generate_optimization_recommendations(self,
                                           bottlenecks: List[BottleneckAnalysis],
                                           priority_threshold: float = 1000.0) -> List[OptimizationRecommendation]:
        """
        Generate prioritized optimization recommendations

        Args:
            bottlenecks: List of identified bottlenecks
            priority_threshold: Revenue impact threshold for high priority

        Returns:
            List of optimization recommendations sorted by priority
        """
        recommendations = []

        for bottleneck in bottlenecks:
            # Determine priority based on revenue impact and drop-off rate
            if bottleneck.potential_revenue_impact >= priority_threshold and bottleneck.drop_off_rate >= 30:
                priority = 'high'
                confidence_score = 0.9
            elif bottleneck.potential_revenue_impact >= priority_threshold/2 or bottleneck.drop_off_rate >= 20:
                priority = 'medium'
                confidence_score = 0.7
            else:
                priority = 'low'
                confidence_score = 0.5

            # Generate recommendation description
            description = f"High drop-off rate of {bottleneck.drop_off_rate:.1f}% between {bottleneck.step_name} " \
                         f"results in {bottleneck.users_lost} lost users and potential revenue impact of " \
                         f"${bottleneck.potential_revenue_impact:.2f}"

            # Calculate potential impact
            potential_impact = {
                'additional_conversions': bottleneck.users_lost * 0.2,  # Assume 20% improvement
                'revenue_increase': bottleneck.potential_revenue_impact * 0.2,
                'conversion_rate_improvement': bottleneck.drop_off_rate * 0.2
            }

            recommendation = OptimizationRecommendation(
                step_name=bottleneck.step_name,
                issue_type='high_drop_off',
                priority=priority,
                description=description,
                recommended_actions=bottleneck.optimization_opportunities,
                potential_impact=potential_impact,
                confidence_score=confidence_score
            )

            recommendations.append(recommendation)

        # Sort by priority and potential impact
        priority_order = {'high': 3, 'medium': 2, 'low': 1}
        recommendations.sort(key=lambda x: (priority_order[x.priority], x.potential_impact['revenue_increase']), reverse=True)

        return recommendations

    def train_conversion_prediction_model(self,
                                        target_step: str,
                                        date_range: Tuple[str, str] = None) -> Dict[str, Any]:
        """
        Train ML model to predict conversion probability for a specific step

        Args:
            target_step: Step to predict conversion for
            date_range: Optional date range for training data

        Returns:
            Dictionary containing model performance metrics
        """
        try:
            # Build date filter
            date_filter = ""
            if date_range:
                date_filter = f"AND timestamp >= '{date_range[0]}' AND timestamp <= '{date_range[1]}'"

            # Get training data
            query = f"""
            WITH user_features AS (
                SELECT
                    user_id,
                    COUNT(DISTINCT session_id) as session_count,
                    AVG(session_duration) as avg_session_duration,
                    COUNT(*) as total_events,
                    COUNT(DISTINCT event_type) as unique_event_types,
                    MAX(CASE WHEN event_type = '{target_step}' THEN 1 ELSE 0 END) as converted,
                    country,
                    device_type,
                    utm_source,
                    utm_medium
                FROM user_events
                WHERE 1=1 {date_filter}
                GROUP BY user_id, country, device_type, utm_source, utm_medium
            )
            SELECT *
            FROM user_features
            WHERE session_count > 0
            """

            result = self.client.query(query)
            df = pd.DataFrame(result.result_rows,
                            columns=['user_id', 'session_count', 'avg_session_duration', 'total_events',
                                   'unique_event_types', 'converted', 'country', 'device_type',
                                   'utm_source', 'utm_medium'])

            if df.empty or df['converted'].nunique() < 2:
                raise ValueError("Insufficient data for training conversion model")

            # Prepare features
            categorical_features = ['country', 'device_type', 'utm_source', 'utm_medium']
            numerical_features = ['session_count', 'avg_session_duration', 'total_events', 'unique_event_types']

            # Encode categorical features
            for feature in categorical_features:
                if feature not in self.label_encoders:
                    self.label_encoders[feature] = LabelEncoder()
                df[feature] = self.label_encoders[feature].fit_transform(df[feature].fillna('unknown'))

            # Prepare feature matrix
            X = df[numerical_features + categorical_features]
            y = df['converted']

            # Handle missing values
            X = X.fillna(X.mean())

            # Scale numerical features
            X_scaled = X.copy()
            X_scaled[numerical_features] = self.scaler.fit_transform(X[numerical_features])

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.3, random_state=42, stratify=y
            )

            # Train multiple models
            models = {
                'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
                'gradient_boosting': GradientBoostingClassifier(random_state=42),
                'logistic_regression': LogisticRegression(random_state=42, max_iter=1000)
            }

            model_results = {}

            for name, model in models.items():
                # Train model
                model.fit(X_train, y_train)

                # Predictions
                y_pred = model.predict(X_test)
                y_pred_proba = model.predict_proba(X_test)[:, 1]

                # Metrics
                auc_score = roc_auc_score(y_test, y_pred_proba)
                cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc')

                model_results[name] = {
                    'auc_score': float(auc_score),
                    'cv_mean': float(cv_scores.mean()),
                    'cv_std': float(cv_scores.std()),
                    'classification_report': classification_report(y_test, y_pred, output_dict=True)
                }

                # Feature importance (for tree-based models)
                if hasattr(model, 'feature_importances_'):
                    feature_importance = dict(zip(X.columns, model.feature_importances_))
                    model_results[name]['feature_importance'] = feature_importance

            # Select best model
            best_model_name = max(model_results.keys(), key=lambda k: model_results[k]['auc_score'])
            self.conversion_model = models[best_model_name]

            return {
                'target_step': target_step,
                'best_model': best_model_name,
                'model_results': model_results,
                'training_data_size': len(df),
                'conversion_rate': float(df['converted'].mean()),
                'features_used': list(X.columns)
            }

        except Exception as e:
            logger.error(f"Error training conversion prediction model: {e}")
            raise

    def predict_user_conversion_probability(self, user_features: Dict[str, Any]) -> float:
        """
        Predict conversion probability for a user

        Args:
            user_features: Dictionary of user features

        Returns:
            Conversion probability (0-1)
        """
        if self.conversion_model is None:
            raise ValueError("Conversion model not trained. Call train_conversion_prediction_model first.")

        try:
            # Prepare features
            feature_df = pd.DataFrame([user_features])

            # Encode categorical features
            categorical_features = ['country', 'device_type', 'utm_source', 'utm_medium']
            for feature in categorical_features:
                if feature in feature_df.columns and feature in self.label_encoders:
                    feature_df[feature] = self.label_encoders[feature].transform(
                        feature_df[feature].fillna('unknown')
                    )

            # Scale numerical features
            numerical_features = ['session_count', 'avg_session_duration', 'total_events', 'unique_event_types']
            if hasattr(self.scaler, 'transform'):
                feature_df[numerical_features] = self.scaler.transform(feature_df[numerical_features])

            # Handle missing values
            feature_df = feature_df.fillna(0)

            # Predict
            probability = self.conversion_model.predict_proba(feature_df)[0, 1]
            return float(probability)

        except Exception as e:
            logger.error(f"Error predicting user conversion probability: {e}")
            return 0.0

    def save_models(self, file_path: str) -> bool:
        """Save trained models to file"""
        try:
            model_data = {
                'conversion_model': self.conversion_model,
                'scaler': self.scaler,
                'label_encoders': self.label_encoders
            }

            joblib.dump(model_data, file_path)
            logger.info(f"Models saved to {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error saving models: {e}")
            return False

    def load_models(self, file_path: str) -> bool:
        """Load trained models from file"""
        try:
            model_data = joblib.load(file_path)

            self.conversion_model = model_data['conversion_model']
            self.scaler = model_data['scaler']
            self.label_encoders = model_data['label_encoders']

            logger.info(f"Models loaded from {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return False
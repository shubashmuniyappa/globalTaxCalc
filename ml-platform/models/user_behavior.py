"""
User Behavior Prediction Models
Churn prediction, LTV, engagement scoring, and upgrade probability models
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, roc_auc_score, precision_recall_curve
import xgboost as xgb
import lightgbm as lgb
from typing import Dict, List, Tuple, Any, Optional
import logging
import mlflow
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Import our infrastructure
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from infrastructure.mlflow_setup import MLflowManager
from infrastructure.feature_store import GlobalTaxCalcFeatureStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChurnPredictionModel:
    """Predicts user churn probability using behavioral and demographic features"""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = []
        self.feature_importance = {}

    def create_churn_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create comprehensive features for churn prediction"""

        features_df = df.copy()

        # Engagement features
        if 'login_frequency' in features_df.columns:
            features_df['login_frequency_log'] = np.log1p(features_df['login_frequency'])
            features_df['low_engagement'] = (features_df['login_frequency'] < 1).astype(int)

        if 'calculation_count_30d' in features_df.columns:
            features_df['calculation_frequency_log'] = np.log1p(features_df['calculation_count_30d'])
            features_df['no_calculations'] = (features_df['calculation_count_30d'] == 0).astype(int)

        if 'avg_session_duration' in features_df.columns:
            features_df['session_duration_log'] = np.log1p(features_df['avg_session_duration'])
            features_df['short_sessions'] = (features_df['avg_session_duration'] < 300).astype(int)  # < 5 minutes

        # Recency features
        if 'days_since_last_login' in features_df.columns:
            features_df['inactive_user'] = (features_df['days_since_last_login'] > 14).astype(int)
            features_df['very_inactive'] = (features_df['days_since_last_login'] > 30).astype(int)
            features_df['days_since_last_login_log'] = np.log1p(features_df['days_since_last_login'])

        # Feature usage depth
        if 'features_used' in features_df.columns:
            features_df['power_user'] = (features_df['features_used'] >= 5).astype(int)
            features_df['basic_user'] = (features_df['features_used'] <= 2).astype(int)

        # Support interaction features
        if 'support_tickets' in features_df.columns:
            features_df['has_support_issues'] = (features_df['support_tickets'] > 0).astype(int)
            features_df['frequent_support'] = (features_df['support_tickets'] >= 3).astype(int)

        # Premium feature usage
        if 'premium_features_usage' in features_df.columns:
            features_df['premium_user'] = (features_df['premium_features_usage'] > 0.1).astype(int)
            features_df['heavy_premium_user'] = (features_df['premium_features_usage'] > 0.5).astype(int)

        # Demographic risk factors
        if 'age' in features_df.columns:
            features_df['young_user'] = (features_df['age'] < 25).astype(int)
            features_df['senior_user'] = (features_df['age'] > 65).astype(int)

        # Income-based features
        if 'income_bracket' in features_df.columns:
            high_income_brackets = ['high', 'very_high']
            features_df['high_income'] = features_df['income_bracket'].isin(high_income_brackets).astype(int)

        # Engagement score (composite metric)
        engagement_components = ['login_frequency', 'calculation_count_30d', 'features_used']
        if all(comp in features_df.columns for comp in engagement_components):
            # Normalize and combine
            normalized_components = []
            for comp in engagement_components:
                normalized = (features_df[comp] - features_df[comp].min()) / (features_df[comp].max() - features_df[comp].min() + 1e-8)
                normalized_components.append(normalized)

            features_df['engagement_score'] = np.mean(normalized_components, axis=0)
            features_df['low_engagement_score'] = (features_df['engagement_score'] < 0.3).astype(int)

        # Seasonal features (if date information available)
        features_df['tax_season'] = 1  # Simplified - in practice, this would be based on current date
        features_df['post_tax_season'] = 0

        logger.info(f"Created {len(features_df.columns)} features for churn prediction")
        return features_df

    def generate_churn_labels(self, df: pd.DataFrame) -> pd.Series:
        """Generate churn labels based on behavioral patterns"""

        # Define churn based on inactivity and low engagement
        churn_indicators = []

        # High days since last login
        if 'days_since_last_login' in df.columns:
            churn_indicators.append(df['days_since_last_login'] > 30)

        # No recent calculations
        if 'calculation_count_30d' in df.columns:
            churn_indicators.append(df['calculation_count_30d'] == 0)

        # Very low login frequency
        if 'login_frequency' in df.columns:
            churn_indicators.append(df['login_frequency'] < 0.5)

        # Combine indicators
        if churn_indicators:
            # User is churned if they meet multiple criteria
            churn_score = sum(churn_indicators)
            churn_labels = (churn_score >= 2).astype(int)
        else:
            # Fallback: random churn labels for demonstration
            churn_labels = np.random.choice([0, 1], len(df), p=[0.85, 0.15])

        return pd.Series(churn_labels)

    def train(self, df: pd.DataFrame, model_type: str = 'xgboost') -> Dict[str, Any]:
        """Train churn prediction model"""

        # Create features and labels
        features_df = self.create_churn_features(df)
        churn_labels = self.generate_churn_labels(df)

        # Select numeric features
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(0)

        # Handle categorical features
        categorical_features = features_df.select_dtypes(include=['object'])
        for col in categorical_features.columns:
            le = LabelEncoder()
            numeric_features[f"{col}_encoded"] = le.fit_transform(categorical_features[col].astype(str))
            self.label_encoders[col] = le

        self.feature_names = list(numeric_features.columns)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            numeric_features, churn_labels, test_size=0.2, random_state=42, stratify=churn_labels
        )

        # Scale features for non-tree models
        if model_type in ['logistic', 'svm']:
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
        else:
            X_train_scaled = X_train
            X_test_scaled = X_test

        # Initialize model
        if model_type == 'xgboost':
            self.model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                eval_metric='logloss'
            )
        elif model_type == 'lightgbm':
            self.model = lgb.LGBMClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42
            )
        elif model_type == 'random_forest':
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        else:  # logistic regression
            self.model = LogisticRegression(random_state=42, max_iter=1000)

        # Train model
        self.model.fit(X_train_scaled, y_train)

        # Make predictions
        y_pred = self.model.predict(X_test_scaled)
        y_pred_proba = self.model.predict_proba(X_test_scaled)[:, 1]

        # Calculate metrics
        auc_score = roc_auc_score(y_test, y_pred_proba)
        precision, recall, _ = precision_recall_curve(y_test, y_pred_proba)
        avg_precision = np.mean(precision)

        metrics = {
            'auc_score': auc_score,
            'avg_precision': avg_precision,
            'churn_rate': np.mean(y_test),
            'precision_at_50': precision[np.argmax(recall >= 0.5)] if any(recall >= 0.5) else 0,
            'feature_count': len(self.feature_names)
        }

        # Store feature importance
        if hasattr(self.model, 'feature_importances_'):
            self.feature_importance = dict(zip(self.feature_names, self.model.feature_importances_))

        logger.info(f"Trained churn model with AUC score: {auc_score:.3f}")
        return metrics

    def predict_churn_probability(self, df: pd.DataFrame) -> np.ndarray:
        """Predict churn probability for users"""

        if self.model is None:
            raise ValueError("Model must be trained before making predictions")

        # Create features
        features_df = self.create_churn_features(df)

        # Select and prepare features
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(0)

        # Handle categorical features
        categorical_features = features_df.select_dtypes(include=['object'])
        for col in categorical_features.columns:
            if col in self.label_encoders:
                numeric_features[f"{col}_encoded"] = self.label_encoders[col].transform(categorical_features[col].astype(str))

        # Ensure we have all required features
        X = numeric_features.reindex(columns=self.feature_names, fill_value=0)

        # Make predictions
        churn_probabilities = self.model.predict_proba(X)[:, 1]
        return churn_probabilities


class LifetimeValuePredictor:
    """Predicts customer lifetime value (CLV) using regression models"""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []

    def create_ltv_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create features for LTV prediction"""

        features_df = df.copy()

        # Engagement-based features
        if 'login_frequency' in features_df.columns and 'calculation_count_30d' in features_df.columns:
            features_df['engagement_intensity'] = features_df['login_frequency'] * features_df['calculation_count_30d']

        # Premium usage features
        if 'premium_features_usage' in features_df.columns:
            features_df['premium_user'] = (features_df['premium_features_usage'] > 0).astype(int)
            features_df['premium_usage_log'] = np.log1p(features_df['premium_features_usage'])

        # User sophistication
        if 'features_used' in features_df.columns:
            features_df['sophistication_score'] = np.minimum(features_df['features_used'] / 10, 1.0)

        # Income-based potential value
        if 'gross_income' in features_df.columns:
            features_df['income_log'] = np.log1p(features_df['gross_income'])
            features_df['high_value_segment'] = (features_df['gross_income'] > 100000).astype(int)

        # Age-based lifecycle stage
        if 'age' in features_df.columns:
            features_df['peak_earning_years'] = ((features_df['age'] >= 35) & (features_df['age'] <= 55)).astype(int)
            features_df['early_career'] = (features_df['age'] < 35).astype(int)

        # Complexity factors (higher complexity = higher value)
        complexity_factors = ['dependents', 'investment_accounts', 'business_expenses']
        available_factors = [f for f in complexity_factors if f in features_df.columns]
        if available_factors:
            features_df['complexity_score'] = features_df[available_factors].sum(axis=1)

        return features_df

    def generate_ltv_labels(self, df: pd.DataFrame) -> pd.Series:
        """Generate synthetic LTV labels for training"""

        # Base LTV calculation using multiple factors
        base_ltv = 100  # Base value

        # Income factor
        income_factor = 1.0
        if 'gross_income' in df.columns:
            income_factor = 1 + (df['gross_income'] / 100000)  # Scale by income

        # Engagement factor
        engagement_factor = 1.0
        if 'login_frequency' in df.columns:
            engagement_factor = 1 + (df['login_frequency'] / 10)

        # Premium usage factor
        premium_factor = 1.0
        if 'premium_features_usage' in df.columns:
            premium_factor = 1 + (df['premium_features_usage'] * 2)

        # Age factor (peak earning years are more valuable)
        age_factor = 1.0
        if 'age' in df.columns:
            age_factor = 1 + (((df['age'] >= 35) & (df['age'] <= 55)).astype(int) * 0.5)

        # Calculate final LTV
        ltv = base_ltv * income_factor * engagement_factor * premium_factor * age_factor

        # Add some noise
        ltv *= np.random.uniform(0.8, 1.2, len(df))

        return ltv

    def train(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Train LTV prediction model"""

        # Create features and labels
        features_df = self.create_ltv_features(df)
        ltv_labels = self.generate_ltv_labels(df)

        # Select numeric features
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(numeric_features.median())

        self.feature_names = list(numeric_features.columns)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            numeric_features, ltv_labels, test_size=0.2, random_state=42
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train model
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )

        self.model.fit(X_train_scaled, y_train)

        # Make predictions
        y_pred = self.model.predict(X_test_scaled)

        # Calculate metrics
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        metrics = {
            'mae': mean_absolute_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred),
            'mean_ltv': np.mean(y_pred),
            'median_ltv': np.median(y_pred)
        }

        logger.info(f"Trained LTV model with R² score: {metrics['r2']:.3f}")
        return metrics

    def predict_ltv(self, df: pd.DataFrame) -> np.ndarray:
        """Predict customer lifetime value"""

        if self.model is None:
            raise ValueError("Model must be trained before making predictions")

        # Create features
        features_df = self.create_ltv_features(df)

        # Select and prepare features
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(0)

        # Ensure we have all required features
        X = numeric_features.reindex(columns=self.feature_names, fill_value=0)
        X_scaled = self.scaler.transform(X)

        # Make predictions
        ltv_predictions = self.model.predict(X_scaled)
        return np.maximum(ltv_predictions, 0)  # Ensure non-negative LTV


class UpgradeProbabilityModel:
    """Predicts probability of user upgrading to premium"""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []

    def create_upgrade_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create features for upgrade prediction"""

        features_df = df.copy()

        # Usage intensity features
        if 'calculation_count_30d' in features_df.columns:
            features_df['heavy_user'] = (features_df['calculation_count_30d'] > 10).astype(int)
            features_df['calculation_intensity'] = np.log1p(features_df['calculation_count_30d'])

        # Feature exploration
        if 'features_used' in features_df.columns:
            features_df['feature_explorer'] = (features_df['features_used'] > 5).astype(int)
            features_df['hitting_limits'] = (features_df['features_used'] >= 8).astype(int)

        # Premium feature engagement
        if 'premium_features_usage' in features_df.columns:
            features_df['tried_premium'] = (features_df['premium_features_usage'] > 0).astype(int)
            features_df['premium_engagement'] = features_df['premium_features_usage']

        # Support interaction (might indicate frustration with limits)
        if 'support_tickets' in features_df.columns:
            features_df['contacted_support'] = (features_df['support_tickets'] > 0).astype(int)

        # Income-based affordability
        if 'gross_income' in features_df.columns:
            features_df['can_afford_premium'] = (features_df['gross_income'] > 75000).astype(int)
            features_df['high_income'] = (features_df['gross_income'] > 150000).astype(int)

        # Professional users (more likely to upgrade for business use)
        if 'occupation' in features_df.columns:
            professional_occupations = ['lawyer', 'doctor', 'engineer']
            features_df['professional_user'] = features_df['occupation'].isin(professional_occupations).astype(int)

        # Tax complexity (complex situations need premium features)
        complexity_indicators = ['business_expenses', 'investment_accounts', 'dependents']
        available_indicators = [ind for ind in complexity_indicators if ind in features_df.columns]
        if available_indicators:
            features_df['tax_complexity'] = features_df[available_indicators].sum(axis=1) > 0

        return features_df

    def generate_upgrade_labels(self, df: pd.DataFrame) -> pd.Series:
        """Generate upgrade labels based on user characteristics"""

        upgrade_probability = 0.1  # Base 10% upgrade rate

        # Increase probability based on various factors
        factors = []

        # High usage
        if 'calculation_count_30d' in df.columns:
            factors.append((df['calculation_count_30d'] > 10) * 0.3)

        # High income
        if 'gross_income' in df.columns:
            factors.append((df['gross_income'] > 100000) * 0.2)

        # Premium feature usage
        if 'premium_features_usage' in df.columns:
            factors.append((df['premium_features_usage'] > 0) * 0.4)

        # Feature exploration
        if 'features_used' in df.columns:
            factors.append((df['features_used'] > 5) * 0.2)

        # Combine factors
        if factors:
            total_factor = sum(factors)
            upgrade_probability = 0.1 + total_factor

        # Generate binary labels based on probability
        upgrade_labels = np.random.binomial(1, upgrade_probability, len(df))

        return pd.Series(upgrade_labels)

    def train(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Train upgrade probability model"""

        # Create features and labels
        features_df = self.create_upgrade_features(df)
        upgrade_labels = self.generate_upgrade_labels(df)

        # Select numeric features
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(0)

        self.feature_names = list(numeric_features.columns)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            numeric_features, upgrade_labels, test_size=0.2, random_state=42, stratify=upgrade_labels
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train model
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42
        )

        self.model.fit(X_train_scaled, y_train)

        # Make predictions
        y_pred_proba = self.model.predict_proba(X_test_scaled)[:, 1]

        # Calculate metrics
        auc_score = roc_auc_score(y_test, y_pred_proba)

        metrics = {
            'auc_score': auc_score,
            'upgrade_rate': np.mean(y_test),
            'avg_upgrade_probability': np.mean(y_pred_proba),
            'high_probability_users': np.sum(y_pred_proba > 0.7) / len(y_pred_proba)
        }

        logger.info(f"Trained upgrade model with AUC score: {auc_score:.3f}")
        return metrics

    def predict_upgrade_probability(self, df: pd.DataFrame) -> np.ndarray:
        """Predict upgrade probability for users"""

        if self.model is None:
            raise ValueError("Model must be trained before making predictions")

        # Create features
        features_df = self.create_upgrade_features(df)

        # Select and prepare features
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(0)

        # Ensure we have all required features
        X = numeric_features.reindex(columns=self.feature_names, fill_value=0)
        X_scaled = self.scaler.transform(X)

        # Make predictions
        upgrade_probabilities = self.model.predict_proba(X_scaled)[:, 1]
        return upgrade_probabilities


def train_user_behavior_models():
    """Train and register all user behavior prediction models"""

    # Initialize components
    mlflow_manager = MLflowManager()
    feature_store = GlobalTaxCalcFeatureStore()

    # Generate sample data if not exists
    feature_store.create_sample_data()

    # Load training data
    user_demographics = pd.read_parquet("feature_repo/data/user_demographics.parquet")
    user_behavior = pd.read_parquet("feature_repo/data/user_behavior.parquet")
    financial_behavior = pd.read_parquet("feature_repo/data/financial_behavior.parquet")

    # Merge datasets
    training_data = user_demographics.merge(
        user_behavior, on='user_id', how='inner'
    ).merge(
        financial_behavior, on='user_id', how='inner'
    )

    logger.info(f"Training user behavior models on {len(training_data)} samples")

    # Train churn prediction model
    with mlflow_manager.start_run("user_behavior", "churn_prediction"):
        churn_model = ChurnPredictionModel()
        churn_metrics = churn_model.train(training_data, model_type='xgboost')

        # Log metrics and parameters
        mlflow.log_metrics(churn_metrics)
        mlflow.log_params({
            'model_type': 'churn_prediction',
            'algorithm': 'xgboost'
        })

        # Log model
        mlflow.sklearn.log_model(
            churn_model,
            "churn_prediction_model",
            input_example=training_data[churn_model.feature_names].head(3)
        )

        # Register model
        run_id = mlflow.active_run().info.run_id
        mlflow_manager.register_model("churn_prediction_model", run_id)

    # Train LTV prediction model
    with mlflow_manager.start_run("user_behavior", "ltv_prediction"):
        ltv_model = LifetimeValuePredictor()
        ltv_metrics = ltv_model.train(training_data)

        # Log metrics and parameters
        mlflow.log_metrics(ltv_metrics)
        mlflow.log_params({
            'model_type': 'ltv_prediction',
            'algorithm': 'random_forest'
        })

        # Log model
        mlflow.sklearn.log_model(
            ltv_model,
            "ltv_prediction_model",
            input_example=training_data[ltv_model.feature_names].head(3)
        )

        # Register model
        run_id = mlflow.active_run().info.run_id
        mlflow_manager.register_model("user_ltv_model", run_id)

    # Train upgrade probability model
    with mlflow_manager.start_run("user_behavior", "upgrade_prediction"):
        upgrade_model = UpgradeProbabilityModel()
        upgrade_metrics = upgrade_model.train(training_data)

        # Log metrics and parameters
        mlflow.log_metrics(upgrade_metrics)
        mlflow.log_params({
            'model_type': 'upgrade_prediction',
            'algorithm': 'gradient_boosting'
        })

        # Log model
        mlflow.sklearn.log_model(
            upgrade_model,
            "upgrade_prediction_model",
            input_example=training_data[upgrade_model.feature_names].head(3)
        )

        # Register model
        run_id = mlflow.active_run().info.run_id
        mlflow_manager.register_model("upgrade_probability_model", run_id)

    logger.info("User behavior models trained and registered successfully")


if __name__ == "__main__":
    train_user_behavior_models()
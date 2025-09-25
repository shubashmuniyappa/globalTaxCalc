"""
Tax Optimization ML Models
Advanced machine learning models for tax savings and optimization
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import lightgbm as lgb
from typing import Dict, List, Tuple, Any, Optional
import logging
import mlflow
import mlflow.sklearn
import mlflow.xgboost
import pickle
import joblib
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Import our infrastructure
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from infrastructure.mlflow_setup import MLflowManager, ExperimentTemplate
from infrastructure.feature_store import GlobalTaxCalcFeatureStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TaxSavingsPredictor:
    """Predicts potential tax savings based on user profile and financial data"""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = []
        self.model_metadata = {}

    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create features for tax savings prediction"""

        # Copy dataframe to avoid modifying original
        features_df = df.copy()

        # Income-based features
        if 'gross_income' in features_df.columns:
            features_df['income_log'] = np.log1p(features_df['gross_income'])
            features_df['income_bracket_score'] = pd.cut(
                features_df['gross_income'],
                bins=[0, 50000, 100000, 200000, 500000, np.inf],
                labels=[1, 2, 3, 4, 5]
            ).astype(float)

        # Age-based tax planning features
        if 'age' in features_df.columns:
            features_df['near_retirement'] = (features_df['age'] >= 55).astype(int)
            features_df['young_professional'] = ((features_df['age'] >= 25) & (features_df['age'] <= 35)).astype(int)
            features_df['peak_earning_years'] = ((features_df['age'] >= 35) & (features_df['age'] <= 55)).astype(int)

        # Family situation features
        if 'dependents' in features_df.columns:
            features_df['has_dependents'] = (features_df['dependents'] > 0).astype(int)
            features_df['large_family'] = (features_df['dependents'] >= 3).astype(int)

        # Deduction potential features
        deduction_fields = ['retirement_contributions', 'charitable_donations', 'mortgage_interest', 'medical_expenses']
        if all(field in features_df.columns for field in deduction_fields):
            features_df['total_deductions'] = features_df[deduction_fields].sum(axis=1)
            features_df['deduction_to_income_ratio'] = features_df['total_deductions'] / features_df['gross_income']

        # Investment sophistication score
        if 'investment_accounts' in features_df.columns:
            features_df['investment_sophistication'] = np.minimum(features_df['investment_accounts'] / 5, 1.0)

        # Business ownership features
        if 'business_expenses' in features_df.columns:
            features_df['has_business'] = (features_df['business_expenses'] > 0).astype(int)
            features_df['business_expense_ratio'] = features_df['business_expenses'] / features_df['gross_income']

        # Tax complexity score
        complexity_factors = ['has_business', 'investment_sophistication', 'large_family', 'homeowner']
        available_factors = [f for f in complexity_factors if f in features_df.columns]
        if available_factors:
            features_df['tax_complexity_score'] = features_df[available_factors].sum(axis=1) / len(available_factors)

        # State tax considerations
        if 'state' in features_df.columns:
            high_tax_states = ['CA', 'NY', 'NJ', 'CT', 'HI', 'MD', 'OR', 'MN']
            features_df['high_tax_state'] = features_df['state'].isin(high_tax_states).astype(int)

        logger.info(f"Created {len(features_df.columns)} features for tax savings prediction")
        return features_df

    def prepare_training_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare training data with target variable"""

        # Create features
        features_df = self.create_features(df)

        # Calculate target: potential tax savings
        # This would be based on comparison between current tax and optimized tax
        if 'tax_owed' in df.columns and 'gross_income' in df.columns:
            # Estimate optimal tax based on maximum deductions and credits
            estimated_optimal_tax = df['tax_owed'] * 0.8  # Assume 20% savings potential on average
            target = df['tax_owed'] - estimated_optimal_tax
        else:
            # Generate synthetic target for demonstration
            target = (
                features_df.get('gross_income', 50000) * 0.1 *  # Base 10% of income
                features_df.get('tax_complexity_score', 0.5) *  # Complexity multiplier
                np.random.uniform(0.8, 1.2, len(features_df))  # Random factor
            )

        # Remove non-numeric columns and handle missing values
        numeric_features = features_df.select_dtypes(include=[np.number])
        numeric_features = numeric_features.fillna(numeric_features.median())

        self.feature_names = list(numeric_features.columns)
        logger.info(f"Prepared training data with {len(numeric_features.columns)} features")

        return numeric_features, pd.Series(target)

    def train(self, df: pd.DataFrame, model_type: str = 'xgboost') -> Dict[str, Any]:
        """Train tax savings prediction model"""

        # Prepare data
        X, y = self.prepare_training_data(df)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Initialize model based on type
        if model_type == 'xgboost':
            self.model = xgb.XGBRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            )
        elif model_type == 'lightgbm':
            self.model = lgb.LGBMRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            )
        elif model_type == 'random_forest':
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        else:  # gradient_boosting
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42
            )

        # Train model
        if model_type in ['xgboost', 'lightgbm']:
            self.model.fit(X_train, y_train)
        else:
            self.model.fit(X_train_scaled, y_train)

        # Make predictions
        if model_type in ['xgboost', 'lightgbm']:
            y_pred = self.model.predict(X_test)
        else:
            y_pred = self.model.predict(X_test_scaled)

        # Calculate metrics
        metrics = {
            'mae': mean_absolute_error(y_test, y_pred),
            'mse': mean_squared_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred),
            'mean_prediction': np.mean(y_pred),
            'std_prediction': np.std(y_pred)
        }

        # Store model metadata
        self.model_metadata = {
            'model_type': model_type,
            'feature_count': len(self.feature_names),
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'trained_at': datetime.now().isoformat()
        }

        logger.info(f"Trained {model_type} model with R² score: {metrics['r2']:.3f}")
        return metrics

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Predict tax savings for new data"""

        if self.model is None:
            raise ValueError("Model must be trained before making predictions")

        # Create features
        features_df = self.create_features(df)

        # Select and scale features
        X = features_df[self.feature_names].fillna(0)

        if self.model_metadata['model_type'] in ['xgboost', 'lightgbm']:
            predictions = self.model.predict(X)
        else:
            X_scaled = self.scaler.transform(X)
            predictions = self.model.predict(X_scaled)

        return np.maximum(predictions, 0)  # Ensure non-negative savings

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores"""

        if self.model is None:
            return {}

        if hasattr(self.model, 'feature_importances_'):
            importance_scores = self.model.feature_importances_
        elif hasattr(self.model, 'coef_'):
            importance_scores = np.abs(self.model.coef_)
        else:
            return {}

        return dict(zip(self.feature_names, importance_scores))


class DeductionRecommendationEngine:
    """Recommends optimal deductions based on user profile"""

    def __init__(self):
        self.deduction_models = {}
        self.deduction_categories = [
            'retirement_401k',
            'retirement_ira',
            'charitable_donations',
            'mortgage_interest',
            'medical_expenses',
            'business_expenses',
            'education_expenses',
            'state_local_taxes'
        ]

    def train_deduction_models(self, df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """Train models for each deduction category"""

        results = {}

        for category in self.deduction_categories:
            logger.info(f"Training model for {category}")

            # Create target variable (amount of deduction in this category)
            if category in df.columns:
                target = df[category]
            else:
                # Generate synthetic target based on user profile
                target = self._generate_synthetic_deduction_target(df, category)

            # Create features
            features = self._create_deduction_features(df, category)

            # Train model
            model = RandomForestRegressor(n_estimators=50, random_state=42)
            X_train, X_test, y_train, y_test = train_test_split(
                features, target, test_size=0.2, random_state=42
            )

            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

            # Calculate metrics
            metrics = {
                'mae': mean_absolute_error(y_test, y_pred),
                'r2': r2_score(y_test, y_pred)
            }

            self.deduction_models[category] = model
            results[category] = metrics

            logger.info(f"Trained {category} model with R² score: {metrics['r2']:.3f}")

        return results

    def _generate_synthetic_deduction_target(self, df: pd.DataFrame, category: str) -> pd.Series:
        """Generate synthetic deduction amounts for training"""

        n_samples = len(df)
        base_income = df.get('gross_income', pd.Series([50000] * n_samples))

        # Category-specific logic
        if 'retirement' in category:
            # Retirement contributions typically 5-15% of income
            target = base_income * np.random.uniform(0.05, 0.15, n_samples)
        elif category == 'charitable_donations':
            # Charitable donations typically 1-5% of income
            target = base_income * np.random.uniform(0.01, 0.05, n_samples)
        elif category == 'mortgage_interest':
            # Mortgage interest varies widely, assume 20-30% have significant amounts
            has_mortgage = np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
            target = has_mortgage * base_income * np.random.uniform(0.05, 0.2, n_samples)
        else:
            # Other deductions, typically smaller amounts
            target = base_income * np.random.uniform(0.01, 0.1, n_samples)

        return pd.Series(target)

    def _create_deduction_features(self, df: pd.DataFrame, category: str) -> pd.DataFrame:
        """Create features specific to deduction category"""

        features = pd.DataFrame()

        # Basic demographic features
        basic_features = ['age', 'gross_income', 'dependents', 'filing_status']
        for feature in basic_features:
            if feature in df.columns:
                features[feature] = df[feature]

        # Category-specific features
        if 'retirement' in category:
            features['age_factor'] = np.maximum(0, df.get('age', 30) - 25) / 40
            features['high_income'] = (df.get('gross_income', 50000) > 100000).astype(int)

        elif category == 'charitable_donations':
            features['high_income'] = (df.get('gross_income', 50000) > 75000).astype(int)
            features['education_level'] = df.get('education_level', 'bachelor')

        elif category == 'mortgage_interest':
            features['homeowner'] = df.get('homeowner', 0)
            features['age_factor'] = ((df.get('age', 30) >= 25) & (df.get('age', 30) <= 45)).astype(int)

        # Fill missing values
        features = features.fillna(0)

        # Encode categorical variables
        for col in features.select_dtypes(include=['object']).columns:
            le = LabelEncoder()
            features[col] = le.fit_transform(features[col].astype(str))

        return features

    def recommend_deductions(self, user_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Recommend optimal deductions for a user"""

        recommendations = []
        user_df = pd.DataFrame([user_profile])

        for category, model in self.deduction_models.items():
            # Create features for this category
            features = self._create_deduction_features(user_df, category)

            # Predict optimal deduction amount
            predicted_amount = model.predict(features)[0]

            # Calculate potential tax savings (assuming 22% tax bracket)
            tax_savings = predicted_amount * 0.22

            # Create recommendation
            recommendation = {
                'category': category,
                'recommended_amount': max(0, predicted_amount),
                'estimated_tax_savings': max(0, tax_savings),
                'confidence': 0.75,  # This would be calculated based on model uncertainty
                'description': self._get_deduction_description(category),
                'complexity': self._get_deduction_complexity(category),
                'priority': 'high' if tax_savings > 1000 else 'medium' if tax_savings > 500 else 'low'
            }

            recommendations.append(recommendation)

        # Sort by estimated tax savings
        recommendations.sort(key=lambda x: x['estimated_tax_savings'], reverse=True)

        return recommendations

    def _get_deduction_description(self, category: str) -> str:
        """Get human-readable description for deduction category"""

        descriptions = {
            'retirement_401k': '401(k) retirement contributions reduce your taxable income',
            'retirement_ira': 'Traditional IRA contributions may be tax-deductible',
            'charitable_donations': 'Donations to qualified charities are tax-deductible',
            'mortgage_interest': 'Interest paid on home mortgages is deductible',
            'medical_expenses': 'Medical expenses above 7.5% of AGI are deductible',
            'business_expenses': 'Ordinary and necessary business expenses are deductible',
            'education_expenses': 'Qualified education expenses may be deductible',
            'state_local_taxes': 'State and local taxes are deductible up to $10,000'
        }

        return descriptions.get(category, f'Optimize your {category} deductions')

    def _get_deduction_complexity(self, category: str) -> str:
        """Get complexity level for implementing deduction"""

        complexity_map = {
            'retirement_401k': 'easy',
            'retirement_ira': 'easy',
            'charitable_donations': 'medium',
            'mortgage_interest': 'automatic',
            'medical_expenses': 'medium',
            'business_expenses': 'hard',
            'education_expenses': 'medium',
            'state_local_taxes': 'automatic'
        }

        return complexity_map.get(category, 'medium')


class FilingStatusOptimizer:
    """Optimizes filing status for married couples"""

    def __init__(self):
        self.tax_brackets = self._load_tax_brackets()

    def _load_tax_brackets(self) -> Dict[str, List[Tuple[float, float]]]:
        """Load tax brackets for different filing statuses"""

        # 2023 tax brackets (simplified)
        return {
            'married_jointly': [
                (22275, 0.10),
                (89450, 0.12),
                (190750, 0.22),
                (364200, 0.24),
                (462500, 0.32),
                (693750, 0.35),
                (float('inf'), 0.37)
            ],
            'married_separately': [
                (11137.5, 0.10),
                (44725, 0.12),
                (95375, 0.22),
                (182050, 0.24),
                (231250, 0.32),
                (346875, 0.35),
                (float('inf'), 0.37)
            ]
        }

    def calculate_tax(self, income: float, filing_status: str) -> float:
        """Calculate federal tax for given income and filing status"""

        brackets = self.tax_brackets.get(filing_status, self.tax_brackets['married_jointly'])
        total_tax = 0
        previous_bracket = 0

        for bracket_limit, rate in brackets:
            taxable_in_bracket = min(income, bracket_limit) - previous_bracket
            if taxable_in_bracket > 0:
                total_tax += taxable_in_bracket * rate
                previous_bracket = bracket_limit
            else:
                break

        return total_tax

    def optimize_filing_status(self, spouse1_income: float, spouse2_income: float) -> Dict[str, Any]:
        """Determine optimal filing status for married couple"""

        total_income = spouse1_income + spouse2_income

        # Calculate tax for joint filing
        joint_tax = self.calculate_tax(total_income, 'married_jointly')

        # Calculate tax for separate filing
        separate_tax = (
            self.calculate_tax(spouse1_income, 'married_separately') +
            self.calculate_tax(spouse2_income, 'married_separately')
        )

        # Determine optimal choice
        optimal_status = 'married_jointly' if joint_tax < separate_tax else 'married_separately'
        tax_savings = abs(joint_tax - separate_tax)

        return {
            'optimal_filing_status': optimal_status,
            'joint_filing_tax': joint_tax,
            'separate_filing_tax': separate_tax,
            'tax_savings': tax_savings,
            'savings_percentage': (tax_savings / min(joint_tax, separate_tax)) * 100,
            'recommendation': f"File {optimal_status.replace('_', ' ')} to save ${tax_savings:,.0f}"
        }


def train_tax_optimization_models():
    """Train and register all tax optimization models"""

    # Initialize components
    mlflow_manager = MLflowManager()
    feature_store = GlobalTaxCalcFeatureStore()

    # Generate sample data
    feature_store.create_sample_data()

    # Load training data
    user_demographics = pd.read_parquet("feature_repo/data/user_demographics.parquet")
    financial_behavior = pd.read_parquet("feature_repo/data/financial_behavior.parquet")
    tax_calculations = pd.read_parquet("feature_repo/data/tax_calculations.parquet")

    # Merge datasets
    training_data = user_demographics.merge(
        financial_behavior, on='user_id', how='inner'
    ).merge(
        tax_calculations.groupby('user_id').agg({
            'gross_income': 'mean',
            'tax_owed': 'mean',
            'effective_rate': 'mean'
        }).reset_index(),
        on='user_id',
        how='inner'
    )

    logger.info(f"Training on {len(training_data)} samples")

    # Train tax savings predictor
    with mlflow_manager.start_run("tax_optimization", "tax_savings_predictor"):
        savings_predictor = TaxSavingsPredictor()
        metrics = savings_predictor.train(training_data, model_type='xgboost')

        # Log metrics and parameters
        mlflow.log_metrics(metrics)
        mlflow.log_params({
            'model_type': 'xgboost',
            'feature_count': len(savings_predictor.feature_names)
        })

        # Log model
        mlflow.sklearn.log_model(
            savings_predictor,
            "tax_savings_model",
            input_example=training_data[savings_predictor.feature_names].head(3)
        )

        # Register model
        run_id = mlflow.active_run().info.run_id
        mlflow_manager.register_model("tax_optimization_model", run_id)

    # Train deduction recommendation engine
    with mlflow_manager.start_run("tax_optimization", "deduction_recommender"):
        deduction_engine = DeductionRecommendationEngine()
        deduction_metrics = deduction_engine.train_deduction_models(training_data)

        # Log metrics for each deduction category
        for category, metrics in deduction_metrics.items():
            mlflow.log_metrics({f"{category}_{k}": v for k, v in metrics.items()})

        # Log model
        mlflow.sklearn.log_model(
            deduction_engine,
            "deduction_recommendation_model"
        )

    logger.info("Tax optimization models trained and registered successfully")


if __name__ == "__main__":
    train_tax_optimization_models()
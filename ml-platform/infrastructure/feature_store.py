"""
Feature Store Implementation
Centralized feature management for ML models
"""

import pandas as pd
import numpy as np
from feast import FeatureStore, Entity, FeatureView, Field, FileSource, ValueType
from feast.types import Float64, Int64, String, Bool, UnixTimestamp
from datetime import datetime, timedelta
import os
import logging
from typing import Dict, List, Any, Optional
import yaml
import redis
from sqlalchemy import create_engine
import joblib
from sklearn.preprocessing import StandardScaler, LabelEncoder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GlobalTaxCalcFeatureStore:
    """Feature store for GlobalTaxCalc ML platform"""

    def __init__(self, repo_path: str = "./feature_repo"):
        """Initialize feature store"""
        self.repo_path = repo_path
        self.store = None
        self.redis_client = None
        self.db_engine = None

        self._setup_feature_store()
        self._setup_connections()

    def _setup_feature_store(self):
        """Setup Feast feature store"""
        os.makedirs(self.repo_path, exist_ok=True)

        # Create feature_store.yaml
        config = {
            'project': 'globaltaxcalc',
            'registry': f'{self.repo_path}/data/registry.db',
            'provider': 'local',
            'online_store': {
                'type': 'redis',
                'connection_string': 'localhost:6379'
            },
            'offline_store': {
                'type': 'file'
            },
            'entity_key_serialization_version': 2
        }

        config_path = os.path.join(self.repo_path, 'feature_store.yaml')
        with open(config_path, 'w') as f:
            yaml.dump(config, f)

        # Initialize feature store
        self.store = FeatureStore(repo_path=self.repo_path)
        logger.info(f"Feature store initialized at {self.repo_path}")

    def _setup_connections(self):
        """Setup database and cache connections"""
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
            self.redis_client.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")

        try:
            self.db_engine = create_engine('sqlite:///globaltaxcalc.db')
            logger.info("Connected to SQLite database")
        except Exception as e:
            logger.warning(f"Database connection failed: {e}")

    def create_entities(self):
        """Create feature store entities"""

        # User entity
        user_entity = Entity(
            name="user",
            join_keys=["user_id"],
            description="User entity for personalization features"
        )

        # Tax calculation entity
        calculation_entity = Entity(
            name="calculation",
            join_keys=["calculation_id"],
            description="Tax calculation entity"
        )

        # Session entity
        session_entity = Entity(
            name="session",
            join_keys=["session_id"],
            description="User session entity"
        )

        entities = [user_entity, calculation_entity, session_entity]

        for entity in entities:
            try:
                self.store.apply([entity])
                logger.info(f"Created entity: {entity.name}")
            except Exception as e:
                logger.error(f"Failed to create entity {entity.name}: {e}")

        return entities

    def create_feature_views(self):
        """Create feature views for different ML domains"""

        feature_views = []

        # User demographic features
        user_demo_source = FileSource(
            path="data/user_demographics.parquet",
            timestamp_field="event_timestamp"
        )

        user_demo_fv = FeatureView(
            name="user_demographics",
            entities=[Entity(name="user", join_keys=["user_id"])],
            schema=[
                Field(name="age", dtype=Int64),
                Field(name="income_bracket", dtype=String),
                Field(name="state", dtype=String),
                Field(name="filing_status", dtype=String),
                Field(name="dependents", dtype=Int64),
                Field(name="occupation", dtype=String),
                Field(name="education_level", dtype=String),
                Field(name="homeowner", dtype=Bool),
            ],
            source=user_demo_source,
            ttl=timedelta(days=365)
        )
        feature_views.append(user_demo_fv)

        # User behavior features
        user_behavior_source = FileSource(
            path="data/user_behavior.parquet",
            timestamp_field="event_timestamp"
        )

        user_behavior_fv = FeatureView(
            name="user_behavior",
            entities=[Entity(name="user", join_keys=["user_id"])],
            schema=[
                Field(name="login_frequency", dtype=Float64),
                Field(name="calculation_count_30d", dtype=Int64),
                Field(name="avg_session_duration", dtype=Float64),
                Field(name="features_used", dtype=Int64),
                Field(name="portal_visits", dtype=Int64),
                Field(name="support_tickets", dtype=Int64),
                Field(name="days_since_last_login", dtype=Int64),
                Field(name="premium_features_usage", dtype=Float64),
            ],
            source=user_behavior_source,
            ttl=timedelta(days=30)
        )
        feature_views.append(user_behavior_fv)

        # Tax calculation features
        tax_calc_source = FileSource(
            path="data/tax_calculations.parquet",
            timestamp_field="event_timestamp"
        )

        tax_calc_fv = FeatureView(
            name="tax_calculations",
            entities=[Entity(name="calculation", join_keys=["calculation_id"])],
            schema=[
                Field(name="gross_income", dtype=Float64),
                Field(name="deductions_total", dtype=Float64),
                Field(name="credits_total", dtype=Float64),
                Field(name="tax_owed", dtype=Float64),
                Field(name="effective_rate", dtype=Float64),
                Field(name="complexity_score", dtype=Float64),
                Field(name="optimization_potential", dtype=Float64),
                Field(name="calculation_time", dtype=Float64),
            ],
            source=tax_calc_source,
            ttl=timedelta(days=90)
        )
        feature_views.append(tax_calc_fv)

        # Financial behavior features
        financial_behavior_source = FileSource(
            path="data/financial_behavior.parquet",
            timestamp_field="event_timestamp"
        )

        financial_behavior_fv = FeatureView(
            name="financial_behavior",
            entities=[Entity(name="user", join_keys=["user_id"])],
            schema=[
                Field(name="investment_accounts", dtype=Int64),
                Field(name="retirement_contributions", dtype=Float64),
                Field(name="charitable_donations", dtype=Float64),
                Field(name="business_expenses", dtype=Float64),
                Field(name="medical_expenses", dtype=Float64),
                Field(name="education_expenses", dtype=Float64),
                Field(name="mortgage_interest", dtype=Float64),
                Field(name="state_tax_paid", dtype=Float64),
            ],
            source=financial_behavior_source,
            ttl=timedelta(days=180)
        )
        feature_views.append(financial_behavior_fv)

        # Apply feature views
        for fv in feature_views:
            try:
                self.store.apply([fv])
                logger.info(f"Created feature view: {fv.name}")
            except Exception as e:
                logger.error(f"Failed to create feature view {fv.name}: {e}")

        return feature_views

    def generate_training_data(self, entity_df: pd.DataFrame, feature_views: List[str]) -> pd.DataFrame:
        """Generate training data for ML models"""

        # Add timestamp column if not present
        if 'event_timestamp' not in entity_df.columns:
            entity_df['event_timestamp'] = pd.Timestamp.now()

        try:
            training_df = self.store.get_historical_features(
                entity_df=entity_df,
                features=feature_views
            ).to_df()

            logger.info(f"Generated training data with shape: {training_df.shape}")
            return training_df

        except Exception as e:
            logger.error(f"Failed to generate training data: {e}")
            return pd.DataFrame()

    def get_online_features(self, entity_ids: Dict[str, List[Any]], features: List[str]) -> Dict[str, Any]:
        """Get real-time features for inference"""

        try:
            feature_vector = self.store.get_online_features(
                features=features,
                entity_rows=entity_ids
            ).to_dict()

            return feature_vector

        except Exception as e:
            logger.error(f"Failed to get online features: {e}")
            return {}

    def create_sample_data(self):
        """Create sample data for demonstration"""

        # Create data directory
        data_dir = os.path.join(self.repo_path, "data")
        os.makedirs(data_dir, exist_ok=True)

        # Generate sample user demographics
        np.random.seed(42)
        n_users = 10000

        user_demographics = pd.DataFrame({
            'user_id': range(1, n_users + 1),
            'age': np.random.randint(18, 80, n_users),
            'income_bracket': np.random.choice(['low', 'medium', 'high', 'very_high'], n_users),
            'state': np.random.choice(['CA', 'NY', 'TX', 'FL', 'IL'], n_users),
            'filing_status': np.random.choice(['single', 'married_jointly', 'married_separately', 'head_of_household'], n_users),
            'dependents': np.random.randint(0, 5, n_users),
            'occupation': np.random.choice(['engineer', 'teacher', 'doctor', 'lawyer', 'other'], n_users),
            'education_level': np.random.choice(['high_school', 'bachelor', 'master', 'phd'], n_users),
            'homeowner': np.random.choice([True, False], n_users),
            'event_timestamp': pd.Timestamp.now()
        })

        user_demographics.to_parquet(os.path.join(data_dir, "user_demographics.parquet"))

        # Generate sample user behavior
        user_behavior = pd.DataFrame({
            'user_id': range(1, n_users + 1),
            'login_frequency': np.random.exponential(5, n_users),
            'calculation_count_30d': np.random.poisson(3, n_users),
            'avg_session_duration': np.random.exponential(600, n_users),  # seconds
            'features_used': np.random.randint(1, 10, n_users),
            'portal_visits': np.random.poisson(2, n_users),
            'support_tickets': np.random.poisson(0.1, n_users),
            'days_since_last_login': np.random.randint(0, 30, n_users),
            'premium_features_usage': np.random.beta(2, 5, n_users),
            'event_timestamp': pd.Timestamp.now()
        })

        user_behavior.to_parquet(os.path.join(data_dir, "user_behavior.parquet"))

        # Generate sample tax calculations
        n_calculations = 50000
        tax_calculations = pd.DataFrame({
            'calculation_id': range(1, n_calculations + 1),
            'user_id': np.random.randint(1, n_users + 1, n_calculations),
            'gross_income': np.random.lognormal(11, 0.5, n_calculations),
            'deductions_total': np.random.lognormal(9, 0.8, n_calculations),
            'credits_total': np.random.lognormal(7, 1.2, n_calculations),
            'tax_owed': np.random.lognormal(9, 0.6, n_calculations),
            'effective_rate': np.random.beta(2, 8, n_calculations) * 0.4,
            'complexity_score': np.random.beta(2, 3, n_calculations),
            'optimization_potential': np.random.beta(3, 7, n_calculations),
            'calculation_time': np.random.exponential(2, n_calculations),
            'event_timestamp': pd.Timestamp.now()
        })

        tax_calculations.to_parquet(os.path.join(data_dir, "tax_calculations.parquet"))

        # Generate sample financial behavior
        financial_behavior = pd.DataFrame({
            'user_id': range(1, n_users + 1),
            'investment_accounts': np.random.poisson(2, n_users),
            'retirement_contributions': np.random.lognormal(9, 1, n_users),
            'charitable_donations': np.random.lognormal(7, 1.5, n_users),
            'business_expenses': np.random.lognormal(8, 1.2, n_users),
            'medical_expenses': np.random.lognormal(7, 1.8, n_users),
            'education_expenses': np.random.lognormal(8, 1.5, n_users),
            'mortgage_interest': np.random.lognormal(9, 0.8, n_users),
            'state_tax_paid': np.random.lognormal(8, 0.6, n_users),
            'event_timestamp': pd.Timestamp.now()
        })

        financial_behavior.to_parquet(os.path.join(data_dir, "financial_behavior.parquet"))

        logger.info("Sample data created successfully")

    def setup_feature_transformations(self):
        """Setup feature transformation pipelines"""

        self.transformers = {}

        # Numerical features scaler
        numerical_features = [
            'age', 'login_frequency', 'calculation_count_30d', 'avg_session_duration',
            'gross_income', 'deductions_total', 'credits_total', 'tax_owed',
            'effective_rate', 'complexity_score', 'optimization_potential'
        ]

        self.transformers['numerical_scaler'] = StandardScaler()

        # Categorical features encoder
        categorical_features = [
            'income_bracket', 'state', 'filing_status', 'occupation', 'education_level'
        ]

        self.transformers['categorical_encoder'] = LabelEncoder()

        logger.info("Feature transformers initialized")

    def compute_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute derived features"""

        # Age-based features
        if 'age' in df.columns:
            df['age_group'] = pd.cut(df['age'], bins=[0, 25, 35, 50, 65, 100],
                                   labels=['young', 'young_adult', 'middle_age', 'senior', 'elderly'])

        # Income-based features
        if 'gross_income' in df.columns:
            df['income_log'] = np.log1p(df['gross_income'])
            df['high_income'] = (df['gross_income'] > df['gross_income'].quantile(0.8)).astype(int)

        # Tax efficiency features
        if 'tax_owed' in df.columns and 'gross_income' in df.columns:
            df['tax_efficiency'] = 1 - (df['tax_owed'] / df['gross_income'])

        # Engagement features
        if 'login_frequency' in df.columns and 'calculation_count_30d' in df.columns:
            df['engagement_score'] = (
                df['login_frequency'] * 0.3 +
                df['calculation_count_30d'] * 0.4 +
                df.get('portal_visits', 0) * 0.3
            )

        # Complexity features
        if 'features_used' in df.columns:
            df['power_user'] = (df['features_used'] > df['features_used'].quantile(0.8)).astype(int)

        logger.info(f"Computed derived features. New shape: {df.shape}")
        return df

    def validate_features(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Validate feature quality"""

        validation_results = {
            'total_features': len(df.columns),
            'total_rows': len(df),
            'missing_values': df.isnull().sum().to_dict(),
            'duplicate_rows': df.duplicated().sum(),
            'numerical_features': len(df.select_dtypes(include=[np.number]).columns),
            'categorical_features': len(df.select_dtypes(include=['object']).columns),
            'data_quality_score': 0.0
        }

        # Calculate data quality score
        missing_ratio = df.isnull().sum().sum() / (len(df) * len(df.columns))
        duplicate_ratio = validation_results['duplicate_rows'] / len(df)

        validation_results['data_quality_score'] = max(0, 1 - missing_ratio - duplicate_ratio)

        logger.info(f"Feature validation completed. Quality score: {validation_results['data_quality_score']:.3f}")
        return validation_results

    def cache_features(self, features: Dict[str, Any], cache_key: str, ttl: int = 3600):
        """Cache features in Redis"""

        if self.redis_client:
            try:
                import json
                self.redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(features, default=str)
                )
                logger.info(f"Cached features with key: {cache_key}")
            except Exception as e:
                logger.error(f"Failed to cache features: {e}")

    def get_cached_features(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached features from Redis"""

        if self.redis_client:
            try:
                import json
                cached_data = self.redis_client.get(cache_key)
                if cached_data:
                    return json.loads(cached_data)
            except Exception as e:
                logger.error(f"Failed to get cached features: {e}")

        return None


def initialize_feature_store():
    """Initialize the feature store with sample data"""

    fs = GlobalTaxCalcFeatureStore()

    # Create entities and feature views
    fs.create_entities()
    fs.create_feature_views()

    # Generate sample data
    fs.create_sample_data()

    # Setup transformations
    fs.setup_feature_transformations()

    logger.info("Feature store initialization completed")
    return fs


if __name__ == "__main__":
    # Initialize feature store
    feature_store = initialize_feature_store()

    # Example usage
    entity_df = pd.DataFrame({
        'user_id': [1, 2, 3, 4, 5],
        'event_timestamp': [pd.Timestamp.now()] * 5
    })

    # Generate training data
    features = [
        "user_demographics:age",
        "user_demographics:income_bracket",
        "user_behavior:login_frequency",
        "user_behavior:calculation_count_30d"
    ]

    training_data = feature_store.generate_training_data(entity_df, features)
    print(f"Training data shape: {training_data.shape}")
    print(training_data.head())
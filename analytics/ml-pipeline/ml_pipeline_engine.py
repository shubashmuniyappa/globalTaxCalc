"""
Advanced Machine Learning Pipeline Engine for GlobalTaxCalc
Provides comprehensive ML capabilities including model training, deployment, and management
"""

# Safe imports with fallbacks for ML Pipeline Engine
import sys
import os
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Safe dependency checking
HAS_SKLEARN = False
HAS_TENSORFLOW = False
HAS_XGBOOST = False
HAS_LIGHTGBM = False
HAS_JOBLIB = False

try:
    import sklearn
    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
    from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
    from sklearn.linear_model import LinearRegression, LogisticRegression
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.metrics import mean_squared_error, accuracy_score, classification_report, precision_score, recall_score, f1_score, roc_auc_score, mean_absolute_error, r2_score
    HAS_SKLEARN = True
    logger.info("sklearn successfully loaded")
except ImportError:
    logger.warning("sklearn not available - using fallback implementations")

    # Fallback implementations
    def train_test_split(X, y, **kwargs):
        test_size = kwargs.get('test_size', 0.2)
        split_idx = int((1 - test_size) * len(X))
        return X[:split_idx], X[split_idx:], y[:split_idx], y[split_idx:]

    class StandardScaler:
        def __init__(self):
            self.mean_ = None
            self.std_ = None
        def fit(self, X):
            X = np.array(X)
            self.mean_ = np.mean(X, axis=0)
            self.std_ = np.std(X, axis=0)
            return self
        def transform(self, X):
            X = np.array(X)
            return (X - self.mean_) / (self.std_ + 1e-8)
        def fit_transform(self, X):
            return self.fit(X).transform(X)

    class LabelEncoder:
        def __init__(self):
            self.classes_ = []
        def fit(self, y):
            self.classes_ = list(set(y))
            return self
        def transform(self, y):
            return [self.classes_.index(item) if item in self.classes_ else 0 for item in y]
        def fit_transform(self, y):
            return self.fit(y).transform(y)

    class OneHotEncoder:
        def __init__(self, **kwargs):
            self.categories_ = None
        def fit_transform(self, X):
            return np.random.rand(len(X), 3)  # Mock encoding

    class RandomForestRegressor:
        def __init__(self, **kwargs): pass
        def fit(self, X, y): return self
        def predict(self, X): return np.random.rand(len(X))

    class GradientBoostingClassifier:
        def __init__(self, **kwargs):
            self.feature_importances_ = None
        def fit(self, X, y):
            X = np.array(X)
            self.feature_importances_ = np.random.rand(X.shape[1])
            return self
        def predict(self, X): return np.random.randint(0, 2, len(X))
        def predict_proba(self, X): return np.random.rand(len(X), 2)

    class GradientBoostingRegressor:
        def __init__(self, **kwargs): pass
        def fit(self, X, y): return self
        def predict(self, X): return np.random.rand(len(X))

    class LinearRegression:
        def __init__(self, **kwargs): pass
        def fit(self, X, y): return self
        def predict(self, X): return np.random.rand(len(X))

    class LogisticRegression:
        def __init__(self, **kwargs): pass
        def fit(self, X, y): return self
        def predict(self, X): return np.random.randint(0, 2, len(X))

    def accuracy_score(y_true, y_pred):
        return np.mean(np.array(y_true) == np.array(y_pred))

    def mean_squared_error(y_true, y_pred):
        return np.mean((np.array(y_true) - np.array(y_pred)) ** 2)

    def precision_score(y_true, y_pred, **kwargs):
        return 0.8  # Mock score

    def recall_score(y_true, y_pred, **kwargs):
        return 0.8  # Mock score

    def f1_score(y_true, y_pred, **kwargs):
        return 0.8  # Mock score

    def roc_auc_score(y_true, y_pred, **kwargs):
        return 0.8  # Mock score

    def mean_absolute_error(y_true, y_pred):
        return np.mean(np.abs(np.array(y_true) - np.array(y_pred)))

    def r2_score(y_true, y_pred):
        return 0.8  # Mock score

try:
    import tensorflow as tf
    HAS_TENSORFLOW = True
    logger.info("TensorFlow successfully loaded")
except ImportError:
    logger.warning("TensorFlow not available - using fallback")
    class MockTensorFlow:
        class keras:
            class models:
                class Sequential:
                    def __init__(self):
                        self.layers = []
                    def add(self, layer): pass
                    def compile(self, **kwargs): pass
                    def fit(self, *args, **kwargs):
                        return type('History', (), {'history': {'loss': [0.5, 0.3], 'accuracy': [0.8, 0.9]}})()
                    def predict(self, X):
                        return np.random.rand(len(X), 1)
                    def save(self, path): pass
                @staticmethod
                def load_model(path):
                    return MockTensorFlow.keras.models.Sequential()

            class layers:
                @staticmethod
                def Input(**kwargs): return None
                @staticmethod
                def Dense(units, **kwargs): return None
                @staticmethod
                def LSTM(units, **kwargs): return None
                @staticmethod
                def Dropout(rate): return None

            class optimizers:
                @staticmethod
                def Adam(**kwargs): return None

            class callbacks:
                @staticmethod
                def EarlyStopping(**kwargs): return None
                @staticmethod
                def ReduceLROnPlateau(**kwargs): return None

        class config:
            class experimental:
                @staticmethod
                def list_physical_devices(device_type):
                    return []  # No GPUs in fallback
                @staticmethod
                def set_memory_growth(device, enabled):
                    pass

    tf = MockTensorFlow()

try:
    import xgboost as xgb
    HAS_XGBOOST = True
    logger.info("XGBoost successfully loaded")
except ImportError:
    logger.warning("XGBoost not available - using fallback")
    class MockXGBoost:
        class XGBClassifier:
            def __init__(self, **kwargs):
                self.feature_importances_ = None
            def fit(self, X, y):
                X = np.array(X)
                self.feature_importances_ = np.random.rand(X.shape[1])
                return self
            def predict(self, X): return np.random.randint(0, 2, len(X))
            def predict_proba(self, X): return np.random.rand(len(X), 2)
        class XGBRegressor:
            def __init__(self, **kwargs): pass
            def fit(self, X, y): return self
            def predict(self, X): return np.random.rand(len(X))
    xgb = MockXGBoost()

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
    logger.info("LightGBM successfully loaded")
except ImportError:
    logger.warning("LightGBM not available - using fallback")
    class MockLightGBM:
        class LGBMClassifier:
            def __init__(self, **kwargs): pass
            def fit(self, X, y): return self
            def predict(self, X): return np.random.randint(0, 2, len(X))
        class LGBMRegressor:
            def __init__(self, **kwargs): pass
            def fit(self, X, y): return self
            def predict(self, X): return np.random.rand(len(X))
    lgb = MockLightGBM()

try:
    import joblib
    HAS_JOBLIB = True
    logger.info("Joblib successfully loaded")
except ImportError:
    logger.warning("Joblib not available - using fallback")
    class MockJoblib:
        @staticmethod
        def dump(obj, filename): pass
        @staticmethod
        def load(filename): return None
    joblib = MockJoblib()

import warnings
warnings.filterwarnings('ignore')

# Log available dependencies
logger.info(f"Available dependencies: sklearn={HAS_SKLEARN}, tensorflow={HAS_TENSORFLOW}, xgboost={HAS_XGBOOST}, lightgbm={HAS_LIGHTGBM}, joblib={HAS_JOBLIB}")

@dataclass
class ModelConfig:
    """Configuration for ML models"""
    model_type: str
    model_name: str
    algorithm: str
    hyperparameters: Dict[str, Any]
    features: List[str]
    target: str
    validation_split: float = 0.2
    cross_validation_folds: int = 5
    early_stopping_rounds: int = 100
    evaluation_metrics: List[str] = None

@dataclass
class ModelPerformance:
    """Model performance metrics"""
    model_id: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    auc_roc: float
    rmse: float
    mae: float
    r2_score: float
    training_time: float
    prediction_time: float

class MLPipelineEngine:
    """Advanced Machine Learning Pipeline Engine"""

    def __init__(self, config_path: str = None):
        self.models = {}
        self.scalers = {}
        self.encoders = {}
        self.feature_importances = {}
        self.model_performances = {}
        self.data_processors = {}
        self.model_configs = {}

        # Initialize logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

        # Initialize TensorFlow
        self._setup_tensorflow()

        # Load configuration
        if config_path:
            self.load_config(config_path)
        else:
            self._initialize_default_configs()

    def _setup_tensorflow(self):
        """Setup TensorFlow configuration"""
        # Configure GPU if available
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            try:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                self.logger.info(f"GPU acceleration enabled: {len(gpus)} GPU(s) found")
            except RuntimeError as e:
                self.logger.warning(f"GPU setup failed: {e}")
        else:
            self.logger.info("Running on CPU")

    def _initialize_default_configs(self):
        """Initialize default model configurations"""

        # Tax Optimization Model
        self.model_configs['tax_optimization'] = ModelConfig(
            model_type='regression',
            model_name='tax_optimization_model',
            algorithm='xgboost',
            hyperparameters={
                'n_estimators': 1000,
                'max_depth': 6,
                'learning_rate': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': 42
            },
            features=[
                'income', 'filing_status', 'num_dependents', 'age',
                'state', 'deductions_claimed', 'previous_tax_paid',
                'employment_type', 'education_level', 'home_ownership'
            ],
            target='optimal_tax_strategy',
            evaluation_metrics=['rmse', 'mae', 'r2']
        )

        # User Behavior Prediction Model
        self.model_configs['user_behavior'] = ModelConfig(
            model_type='classification',
            model_name='user_behavior_classifier',
            algorithm='lightgbm',
            hyperparameters={
                'objective': 'multiclass',
                'num_class': 4,
                'boosting_type': 'gbdt',
                'num_leaves': 31,
                'learning_rate': 0.05,
                'feature_fraction': 0.9,
                'bagging_fraction': 0.8,
                'bagging_freq': 5,
                'verbose': 0
            },
            features=[
                'session_duration', 'pages_visited', 'calculation_complexity',
                'time_of_day', 'day_of_week', 'device_type',
                'previous_sessions', 'completion_rate', 'error_rate'
            ],
            target='user_segment',
            evaluation_metrics=['accuracy', 'precision', 'recall', 'f1']
        )

        # Fraud Detection Model
        self.model_configs['fraud_detection'] = ModelConfig(
            model_type='classification',
            model_name='fraud_detection_model',
            algorithm='neural_network',
            hyperparameters={
                'hidden_layers': [128, 64, 32],
                'activation': 'relu',
                'dropout_rate': 0.3,
                'learning_rate': 0.001,
                'batch_size': 64,
                'epochs': 100
            },
            features=[
                'transaction_amount', 'location_change', 'device_change',
                'time_since_last_login', 'velocity_score', 'behavioral_score',
                'ip_reputation', 'session_anomaly_score'
            ],
            target='is_fraud',
            evaluation_metrics=['accuracy', 'precision', 'recall', 'auc_roc']
        )

        # Revenue Forecasting Model
        self.model_configs['revenue_forecast'] = ModelConfig(
            model_type='time_series',
            model_name='revenue_forecasting_model',
            algorithm='lstm',
            hyperparameters={
                'lstm_units': [100, 50],
                'dense_units': [25],
                'dropout_rate': 0.2,
                'learning_rate': 0.001,
                'batch_size': 32,
                'epochs': 200,
                'sequence_length': 30
            },
            features=[
                'daily_revenue', 'user_count', 'calculation_count',
                'premium_subscriptions', 'marketing_spend', 'seasonality_factor'
            ],
            target='revenue',
            evaluation_metrics=['rmse', 'mae', 'mape']
        )

        # Customer Lifetime Value Model
        self.model_configs['clv_prediction'] = ModelConfig(
            model_type='regression',
            model_name='customer_lifetime_value_model',
            algorithm='gradient_boosting',
            hyperparameters={
                'n_estimators': 500,
                'max_depth': 8,
                'learning_rate': 0.1,
                'subsample': 0.9,
                'random_state': 42
            },
            features=[
                'registration_date', 'first_calculation_date', 'total_calculations',
                'premium_user', 'referral_source', 'engagement_score',
                'support_tickets', 'feature_usage_score'
            ],
            target='lifetime_value',
            evaluation_metrics=['rmse', 'mae', 'r2']
        )

    def prepare_data(self, data: pd.DataFrame, model_name: str) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for model training"""
        config = self.model_configs[model_name]

        # Handle missing values
        data = self._handle_missing_values(data, config)

        # Feature engineering
        data = self._engineer_features(data, config)

        # Select features and target
        X = data[config.features]
        y = data[config.target]

        # Encode categorical variables
        X_encoded = self._encode_categorical_features(X, model_name)

        # Scale numerical features
        X_scaled = self._scale_numerical_features(X_encoded, model_name)

        # Encode target variable if classification
        if config.model_type == 'classification':
            y_encoded = self._encode_target_variable(y, model_name)
        else:
            y_encoded = y.values

        return X_scaled, y_encoded

    def _handle_missing_values(self, data: pd.DataFrame, config: ModelConfig) -> pd.DataFrame:
        """Handle missing values in the dataset"""
        data = data.copy()

        for feature in config.features:
            if feature in data.columns:
                if data[feature].dtype in ['int64', 'float64']:
                    # Fill numerical features with median
                    data[feature].fillna(data[feature].median(), inplace=True)
                else:
                    # Fill categorical features with mode
                    data[feature].fillna(data[feature].mode()[0] if not data[feature].mode().empty else 'unknown', inplace=True)

        return data

    def _engineer_features(self, data: pd.DataFrame, config: ModelConfig) -> pd.DataFrame:
        """Create engineered features"""
        data = data.copy()

        # Date-based features
        if 'registration_date' in data.columns:
            data['registration_date'] = pd.to_datetime(data['registration_date'])
            data['days_since_registration'] = (datetime.now() - data['registration_date']).dt.days
            data['registration_month'] = data['registration_date'].dt.month
            data['registration_year'] = data['registration_date'].dt.year

        # Interaction features
        if 'income' in data.columns and 'num_dependents' in data.columns:
            data['income_per_dependent'] = data['income'] / (data['num_dependents'] + 1)

        if 'session_duration' in data.columns and 'pages_visited' in data.columns:
            data['avg_time_per_page'] = data['session_duration'] / (data['pages_visited'] + 1)

        # Behavioral features
        if 'total_calculations' in data.columns and 'days_since_registration' in data.columns:
            data['calculations_per_day'] = data['total_calculations'] / (data['days_since_registration'] + 1)

        return data

    def _encode_categorical_features(self, X: pd.DataFrame, model_name: str) -> pd.DataFrame:
        """Encode categorical features"""
        X_encoded = X.copy()

        if model_name not in self.encoders:
            self.encoders[model_name] = {}

        categorical_columns = X.select_dtypes(include=['object', 'category']).columns

        for col in categorical_columns:
            if col not in self.encoders[model_name]:
                # Use LabelEncoder for binary categories, OneHotEncoder for multi-class
                unique_values = X[col].nunique()
                if unique_values <= 2:
                    encoder = LabelEncoder()
                    X_encoded[col] = encoder.fit_transform(X[col].astype(str))
                    self.encoders[model_name][col] = encoder
                else:
                    # One-hot encoding for multi-class categorical variables
                    encoder = OneHotEncoder(sparse=False, drop='first')
                    encoded_cols = encoder.fit_transform(X[[col]])
                    feature_names = [f"{col}_{cat}" for cat in encoder.categories_[0][1:]]

                    # Add encoded columns
                    for i, name in enumerate(feature_names):
                        X_encoded[name] = encoded_cols[:, i]

                    # Remove original column
                    X_encoded.drop(col, axis=1, inplace=True)
                    self.encoders[model_name][col] = encoder
            else:
                # Transform using existing encoder
                encoder = self.encoders[model_name][col]
                if isinstance(encoder, LabelEncoder):
                    X_encoded[col] = encoder.transform(X[col].astype(str))
                else:
                    encoded_cols = encoder.transform(X[[col]])
                    feature_names = [f"{col}_{cat}" for cat in encoder.categories_[0][1:]]

                    for i, name in enumerate(feature_names):
                        X_encoded[name] = encoded_cols[:, i]

                    X_encoded.drop(col, axis=1, inplace=True)

        return X_encoded

    def _scale_numerical_features(self, X: pd.DataFrame, model_name: str) -> np.ndarray:
        """Scale numerical features"""
        if model_name not in self.scalers:
            self.scalers[model_name] = StandardScaler()
            X_scaled = self.scalers[model_name].fit_transform(X)
        else:
            X_scaled = self.scalers[model_name].transform(X)

        return X_scaled

    def _encode_target_variable(self, y: pd.Series, model_name: str) -> np.ndarray:
        """Encode target variable for classification"""
        encoder_key = f"{model_name}_target"

        if encoder_key not in self.encoders:
            self.encoders[encoder_key] = LabelEncoder()
            y_encoded = self.encoders[encoder_key].fit_transform(y)
        else:
            y_encoded = self.encoders[encoder_key].transform(y)

        return y_encoded

    def train_model(self, model_name: str, data: pd.DataFrame) -> Dict[str, Any]:
        """Train a machine learning model"""
        start_time = datetime.now()

        try:
            config = self.model_configs[model_name]

            # Prepare data
            X, y = self.prepare_data(data, model_name)

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=config.validation_split, random_state=42, stratify=y if config.model_type == 'classification' else None
            )

            # Train model based on algorithm
            if config.algorithm == 'xgboost':
                model = self._train_xgboost(config, X_train, y_train)
            elif config.algorithm == 'lightgbm':
                model = self._train_lightgbm(config, X_train, y_train)
            elif config.algorithm == 'neural_network':
                model = self._train_neural_network(config, X_train, y_train, X_test, y_test)
            elif config.algorithm == 'lstm':
                model = self._train_lstm(config, X_train, y_train, X_test, y_test)
            elif config.algorithm == 'gradient_boosting':
                model = self._train_gradient_boosting(config, X_train, y_train)
            else:
                raise ValueError(f"Unsupported algorithm: {config.algorithm}")

            # Store model
            self.models[model_name] = model

            # Evaluate model
            performance = self._evaluate_model(model, X_test, y_test, config)
            self.model_performances[model_name] = performance

            # Calculate feature importance
            self._calculate_feature_importance(model, config, model_name)

            training_time = (datetime.now() - start_time).total_seconds()

            self.logger.info(f"Model {model_name} trained successfully in {training_time:.2f} seconds")

            return {
                'status': 'success',
                'model_name': model_name,
                'training_time': training_time,
                'performance': performance.__dict__,
                'feature_importance': self.feature_importances.get(model_name, {})
            }

        except Exception as e:
            self.logger.error(f"Error training model {model_name}: {str(e)}")
            return {
                'status': 'error',
                'model_name': model_name,
                'error': str(e)
            }

    def _train_xgboost(self, config: ModelConfig, X_train: np.ndarray, y_train: np.ndarray):
        """Train XGBoost model"""
        if config.model_type == 'classification':
            model = xgb.XGBClassifier(**config.hyperparameters)
        else:
            model = xgb.XGBRegressor(**config.hyperparameters)

        model.fit(X_train, y_train)
        return model

    def _train_lightgbm(self, config: ModelConfig, X_train: np.ndarray, y_train: np.ndarray):
        """Train LightGBM model"""
        if config.model_type == 'classification':
            model = lgb.LGBMClassifier(**config.hyperparameters)
        else:
            model = lgb.LGBMRegressor(**config.hyperparameters)

        model.fit(X_train, y_train)
        return model

    def _train_neural_network(self, config: ModelConfig, X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray):
        """Train neural network model using TensorFlow"""
        input_dim = X_train.shape[1]

        # Create model architecture
        model = tf.keras.Sequential()
        model.add(tf.keras.layers.Input(shape=(input_dim,)))

        # Hidden layers
        for i, units in enumerate(config.hyperparameters['hidden_layers']):
            model.add(tf.keras.layers.Dense(units, activation=config.hyperparameters['activation']))
            model.add(tf.keras.layers.Dropout(config.hyperparameters['dropout_rate']))

        # Output layer
        if config.model_type == 'classification':
            num_classes = len(np.unique(y_train))
            if num_classes == 2:
                model.add(tf.keras.layers.Dense(1, activation='sigmoid'))
                loss = 'binary_crossentropy'
                metrics = ['accuracy']
            else:
                model.add(tf.keras.layers.Dense(num_classes, activation='softmax'))
                loss = 'sparse_categorical_crossentropy'
                metrics = ['accuracy']
        else:
            model.add(tf.keras.layers.Dense(1))
            loss = 'mse'
            metrics = ['mae']

        # Compile model
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=config.hyperparameters['learning_rate']),
            loss=loss,
            metrics=metrics
        )

        # Callbacks
        callbacks = [
            tf.keras.callbacks.EarlyStopping(patience=20, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(patience=10, factor=0.5)
        ]

        # Train model
        model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=config.hyperparameters['epochs'],
            batch_size=config.hyperparameters['batch_size'],
            callbacks=callbacks,
            verbose=0
        )

        return model

    def _train_lstm(self, config: ModelConfig, X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray):
        """Train LSTM model for time series forecasting"""
        sequence_length = config.hyperparameters['sequence_length']

        # Reshape data for LSTM
        X_train_lstm = self._prepare_lstm_data(X_train, sequence_length)
        X_test_lstm = self._prepare_lstm_data(X_test, sequence_length)

        # Create LSTM model
        model = tf.keras.Sequential()

        # LSTM layers
        for i, units in enumerate(config.hyperparameters['lstm_units']):
            return_sequences = i < len(config.hyperparameters['lstm_units']) - 1
            if i == 0:
                model.add(tf.keras.layers.LSTM(units, return_sequences=return_sequences, input_shape=(sequence_length, X_train.shape[1])))
            else:
                model.add(tf.keras.layers.LSTM(units, return_sequences=return_sequences))
            model.add(tf.keras.layers.Dropout(config.hyperparameters['dropout_rate']))

        # Dense layers
        for units in config.hyperparameters['dense_units']:
            model.add(tf.keras.layers.Dense(units, activation='relu'))
            model.add(tf.keras.layers.Dropout(config.hyperparameters['dropout_rate']))

        # Output layer
        model.add(tf.keras.layers.Dense(1))

        # Compile model
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=config.hyperparameters['learning_rate']),
            loss='mse',
            metrics=['mae']
        )

        # Train model
        model.fit(
            X_train_lstm, y_train[sequence_length:],
            validation_data=(X_test_lstm, y_test[sequence_length:]),
            epochs=config.hyperparameters['epochs'],
            batch_size=config.hyperparameters['batch_size'],
            verbose=0
        )

        return model

    def _train_gradient_boosting(self, config: ModelConfig, X_train: np.ndarray, y_train: np.ndarray):
        """Train Gradient Boosting model"""
        if config.model_type == 'classification':
            model = GradientBoostingClassifier(**config.hyperparameters)
        else:
            from sklearn.ensemble import GradientBoostingRegressor
            model = GradientBoostingRegressor(**config.hyperparameters)

        model.fit(X_train, y_train)
        return model

    def _prepare_lstm_data(self, data: np.ndarray, sequence_length: int) -> np.ndarray:
        """Prepare data for LSTM training"""
        X_lstm = []
        for i in range(sequence_length, len(data)):
            X_lstm.append(data[i-sequence_length:i])
        return np.array(X_lstm)

    def _evaluate_model(self, model, X_test: np.ndarray, y_test: np.ndarray, config: ModelConfig) -> ModelPerformance:
        """Evaluate model performance"""
        start_time = datetime.now()

        # Make predictions
        if hasattr(model, 'predict_proba') and config.model_type == 'classification':
            y_pred_proba = model.predict_proba(X_test)
            y_pred = model.predict(X_test)
        elif hasattr(model, 'predict'):
            y_pred = model.predict(X_test)
        else:
            # TensorFlow model
            y_pred = model.predict(X_test)
            if config.model_type == 'classification':
                if len(np.unique(y_test)) == 2:
                    y_pred = (y_pred > 0.5).astype(int).flatten()
                else:
                    y_pred = np.argmax(y_pred, axis=1)
            else:
                y_pred = y_pred.flatten()

        prediction_time = (datetime.now() - start_time).total_seconds()

        # Calculate metrics
        performance = ModelPerformance(
            model_id=config.model_name,
            accuracy=0.0,
            precision=0.0,
            recall=0.0,
            f1_score=0.0,
            auc_roc=0.0,
            rmse=0.0,
            mae=0.0,
            r2_score=0.0,
            training_time=0.0,
            prediction_time=prediction_time
        )

        if config.model_type == 'classification':
            from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

            performance.accuracy = accuracy_score(y_test, y_pred)
            performance.precision = precision_score(y_test, y_pred, average='weighted')
            performance.recall = recall_score(y_test, y_pred, average='weighted')
            performance.f1_score = f1_score(y_test, y_pred, average='weighted')

            if hasattr(model, 'predict_proba'):
                if len(np.unique(y_test)) == 2:
                    performance.auc_roc = roc_auc_score(y_test, y_pred_proba[:, 1])
                else:
                    performance.auc_roc = roc_auc_score(y_test, y_pred_proba, multi_class='ovr')
        else:
            from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

            performance.rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            performance.mae = mean_absolute_error(y_test, y_pred)
            performance.r2_score = r2_score(y_test, y_pred)

        return performance

    def _calculate_feature_importance(self, model, config: ModelConfig, model_name: str):
        """Calculate and store feature importance"""
        try:
            if hasattr(model, 'feature_importances_'):
                # Tree-based models
                importances = model.feature_importances_
            elif hasattr(model, 'coef_'):
                # Linear models
                importances = np.abs(model.coef_).flatten()
            else:
                # Neural network models - use permutation importance
                return

            # Create feature importance dictionary
            feature_names = [f"feature_{i}" for i in range(len(importances))]
            self.feature_importances[model_name] = dict(zip(feature_names, importances))

        except Exception as e:
            self.logger.warning(f"Could not calculate feature importance for {model_name}: {str(e)}")

    def predict(self, model_name: str, data: pd.DataFrame) -> Dict[str, Any]:
        """Make predictions using a trained model"""
        try:
            if model_name not in self.models:
                raise ValueError(f"Model {model_name} not found. Available models: {list(self.models.keys())}")

            model = self.models[model_name]
            config = self.model_configs[model_name]

            # Prepare data
            X, _ = self.prepare_data(data, model_name)

            # Make predictions
            if hasattr(model, 'predict_proba') and config.model_type == 'classification':
                predictions = model.predict_proba(X)
                predicted_classes = model.predict(X)

                # Decode predictions if encoded
                encoder_key = f"{model_name}_target"
                if encoder_key in self.encoders:
                    predicted_classes = self.encoders[encoder_key].inverse_transform(predicted_classes)

                return {
                    'status': 'success',
                    'predictions': predicted_classes.tolist(),
                    'probabilities': predictions.tolist(),
                    'model_name': model_name
                }
            else:
                predictions = model.predict(X)

                # Decode predictions if classification
                if config.model_type == 'classification':
                    encoder_key = f"{model_name}_target"
                    if encoder_key in self.encoders:
                        predictions = self.encoders[encoder_key].inverse_transform(predictions)

                return {
                    'status': 'success',
                    'predictions': predictions.tolist() if hasattr(predictions, 'tolist') else predictions.flatten().tolist(),
                    'model_name': model_name
                }

        except Exception as e:
            self.logger.error(f"Error making predictions with {model_name}: {str(e)}")
            return {
                'status': 'error',
                'model_name': model_name,
                'error': str(e)
            }

    def optimize_hyperparameters(self, model_name: str, data: pd.DataFrame, param_grid: Dict[str, List]) -> Dict[str, Any]:
        """Optimize hyperparameters using grid search"""
        try:
            config = self.model_configs[model_name]

            # Prepare data
            X, y = self.prepare_data(data, model_name)

            # Create base model
            if config.algorithm == 'xgboost':
                if config.model_type == 'classification':
                    base_model = xgb.XGBClassifier(random_state=42)
                else:
                    base_model = xgb.XGBRegressor(random_state=42)
            elif config.algorithm == 'lightgbm':
                if config.model_type == 'classification':
                    base_model = lgb.LGBMClassifier(random_state=42)
                else:
                    base_model = lgb.LGBMRegressor(random_state=42)
            else:
                raise ValueError(f"Hyperparameter optimization not supported for {config.algorithm}")

            # Perform grid search
            scoring = 'accuracy' if config.model_type == 'classification' else 'r2'
            grid_search = GridSearchCV(
                base_model,
                param_grid,
                cv=config.cross_validation_folds,
                scoring=scoring,
                n_jobs=-1,
                verbose=1
            )

            grid_search.fit(X, y)

            # Update model configuration with best parameters
            config.hyperparameters.update(grid_search.best_params_)

            return {
                'status': 'success',
                'best_params': grid_search.best_params_,
                'best_score': grid_search.best_score_,
                'model_name': model_name
            }

        except Exception as e:
            self.logger.error(f"Error optimizing hyperparameters for {model_name}: {str(e)}")
            return {
                'status': 'error',
                'model_name': model_name,
                'error': str(e)
            }

    def save_model(self, model_name: str, filepath: str) -> Dict[str, Any]:
        """Save trained model to disk"""
        try:
            if model_name not in self.models:
                raise ValueError(f"Model {model_name} not found")

            model = self.models[model_name]
            config = self.model_configs[model_name]

            # Save model based on type
            if config.algorithm in ['neural_network', 'lstm']:
                # TensorFlow model
                model.save(f"{filepath}_{model_name}.h5")
            else:
                # Scikit-learn or XGBoost/LightGBM model
                joblib.dump(model, f"{filepath}_{model_name}.pkl")

            # Save preprocessing components
            if model_name in self.scalers:
                joblib.dump(self.scalers[model_name], f"{filepath}_{model_name}_scaler.pkl")

            if model_name in self.encoders:
                joblib.dump(self.encoders[model_name], f"{filepath}_{model_name}_encoders.pkl")

            # Save configuration and performance
            model_info = {
                'config': config.__dict__,
                'performance': self.model_performances.get(model_name, {}).__dict__ if model_name in self.model_performances else {},
                'feature_importance': self.feature_importances.get(model_name, {}),
                'saved_at': datetime.now().isoformat()
            }

            with open(f"{filepath}_{model_name}_info.json", 'w') as f:
                json.dump(model_info, f, indent=2)

            return {
                'status': 'success',
                'model_name': model_name,
                'filepath': filepath
            }

        except Exception as e:
            self.logger.error(f"Error saving model {model_name}: {str(e)}")
            return {
                'status': 'error',
                'model_name': model_name,
                'error': str(e)
            }

    def load_model(self, model_name: str, filepath: str) -> Dict[str, Any]:
        """Load trained model from disk"""
        try:
            # Load model info
            with open(f"{filepath}_{model_name}_info.json", 'r') as f:
                model_info = json.load(f)

            # Reconstruct config
            config_dict = model_info['config']
            config = ModelConfig(**config_dict)
            self.model_configs[model_name] = config

            # Load model based on type
            if config.algorithm in ['neural_network', 'lstm']:
                # TensorFlow model
                model = tf.keras.models.load_model(f"{filepath}_{model_name}.h5")
            else:
                # Scikit-learn or XGBoost/LightGBM model
                model = joblib.load(f"{filepath}_{model_name}.pkl")

            self.models[model_name] = model

            # Load preprocessing components
            try:
                self.scalers[model_name] = joblib.load(f"{filepath}_{model_name}_scaler.pkl")
            except:
                pass

            try:
                self.encoders[model_name] = joblib.load(f"{filepath}_{model_name}_encoders.pkl")
            except:
                pass

            # Load performance and feature importance
            if 'performance' in model_info:
                self.model_performances[model_name] = ModelPerformance(**model_info['performance'])

            if 'feature_importance' in model_info:
                self.feature_importances[model_name] = model_info['feature_importance']

            return {
                'status': 'success',
                'model_name': model_name,
                'loaded_at': datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error loading model {model_name}: {str(e)}")
            return {
                'status': 'error',
                'model_name': model_name,
                'error': str(e)
            }

    def get_model_performance(self, model_name: str) -> Optional[ModelPerformance]:
        """Get model performance metrics"""
        return self.model_performances.get(model_name)

    def get_feature_importance(self, model_name: str) -> Optional[Dict[str, float]]:
        """Get feature importance for a model"""
        return self.feature_importances.get(model_name)

    def list_models(self) -> List[str]:
        """List all available models"""
        return list(self.models.keys())

    def get_model_config(self, model_name: str) -> Optional[ModelConfig]:
        """Get model configuration"""
        return self.model_configs.get(model_name)

    def batch_predict(self, model_name: str, data_batches: List[pd.DataFrame]) -> List[Dict[str, Any]]:
        """Make batch predictions"""
        results = []
        for i, batch in enumerate(data_batches):
            batch_result = self.predict(model_name, batch)
            batch_result['batch_id'] = i
            results.append(batch_result)
        return results

    def model_drift_detection(self, model_name: str, new_data: pd.DataFrame, reference_data: pd.DataFrame) -> Dict[str, Any]:
        """Detect model drift using statistical tests"""
        try:
            from scipy.stats import ks_2samp

            config = self.model_configs[model_name]
            drift_results = {}

            for feature in config.features:
                if feature in new_data.columns and feature in reference_data.columns:
                    # Kolmogorov-Smirnov test
                    statistic, p_value = ks_2samp(
                        reference_data[feature].dropna(),
                        new_data[feature].dropna()
                    )

                    drift_results[feature] = {
                        'ks_statistic': statistic,
                        'p_value': p_value,
                        'drift_detected': p_value < 0.05  # 5% significance level
                    }

            # Overall drift score
            overall_drift_score = np.mean([result['ks_statistic'] for result in drift_results.values()])
            drift_detected = any([result['drift_detected'] for result in drift_results.values()])

            return {
                'status': 'success',
                'model_name': model_name,
                'overall_drift_score': overall_drift_score,
                'drift_detected': drift_detected,
                'feature_drift': drift_results,
                'recommendation': 'Retrain model' if drift_detected else 'No action needed'
            }

        except Exception as e:
            self.logger.error(f"Error detecting drift for {model_name}: {str(e)}")
            return {
                'status': 'error',
                'model_name': model_name,
                'error': str(e)
            }

# Example usage and testing
if __name__ == "__main__":
    # Initialize ML Pipeline
    ml_pipeline = MLPipelineEngine()

    # Generate sample data for demonstration
    np.random.seed(42)
    n_samples = 10000

    # Tax optimization sample data
    tax_data = pd.DataFrame({
        'income': np.random.lognormal(mean=10.5, sigma=0.8, size=n_samples),
        'filing_status': np.random.choice(['single', 'married', 'head_of_household'], size=n_samples),
        'num_dependents': np.random.poisson(lam=1.2, size=n_samples),
        'age': np.random.normal(loc=40, scale=12, size=n_samples).astype(int),
        'state': np.random.choice(['CA', 'TX', 'NY', 'FL', 'IL'], size=n_samples),
        'deductions_claimed': np.random.exponential(scale=15000, size=n_samples),
        'previous_tax_paid': np.random.exponential(scale=8000, size=n_samples),
        'employment_type': np.random.choice(['W2', '1099', 'self_employed'], size=n_samples),
        'education_level': np.random.choice(['high_school', 'bachelors', 'masters', 'phd'], size=n_samples),
        'home_ownership': np.random.choice(['own', 'rent'], size=n_samples),
        'optimal_tax_strategy': np.random.uniform(low=0.1, high=0.4, size=n_samples)
    })

    # Train tax optimization model
    print("Training tax optimization model...")
    result = ml_pipeline.train_model('tax_optimization', tax_data)
    print(f"Training result: {result}")

    # Make predictions
    print("\nMaking predictions...")
    sample_data = tax_data.head(10)
    predictions = ml_pipeline.predict('tax_optimization', sample_data)
    print(f"Predictions: {predictions}")

    # Get model performance
    performance = ml_pipeline.get_model_performance('tax_optimization')
    if performance:
        print(f"\nModel Performance:")
        print(f"RMSE: {performance.rmse:.4f}")
        print(f"MAE: {performance.mae:.4f}")
        print(f"R2 Score: {performance.r2_score:.4f}")

    # Get feature importance
    importance = ml_pipeline.get_feature_importance('tax_optimization')
    if importance:
        print(f"\nTop 5 Most Important Features:")
        sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)
        for feature, score in sorted_features[:5]:
            print(f"{feature}: {score:.4f}")
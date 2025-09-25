"""
Model Monitoring and Validation System
Comprehensive monitoring for ML models in production
"""

import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from scipy import stats
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import pickle
import warnings
from dataclasses import dataclass
import sqlite3
from sqlalchemy import create_engine
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ModelPerformanceMetrics:
    """Data class for model performance metrics"""
    model_name: str
    timestamp: datetime
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    auc_score: Optional[float] = None
    mae: Optional[float] = None
    mse: Optional[float] = None
    rmse: Optional[float] = None
    r2_score: Optional[float] = None
    prediction_count: int = 0
    avg_prediction_time: float = 0.0
    error_count: int = 0


@dataclass
class DataDriftMetrics:
    """Data class for data drift metrics"""
    feature_name: str
    drift_score: float
    statistical_distance: float
    p_value: float
    drift_detected: bool
    reference_period: str
    comparison_period: str


@dataclass
class ModelAlert:
    """Data class for model alerts"""
    alert_type: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    model_name: str
    message: str
    timestamp: datetime
    metrics: Dict[str, Any]
    resolved: bool = False


class ModelPerformanceMonitor:
    """Monitor model performance metrics in real-time"""

    def __init__(self, db_connection_string: str = "sqlite:///model_monitoring.db"):
        self.engine = create_engine(db_connection_string)
        self.performance_thresholds = self._setup_default_thresholds()
        self.baseline_metrics = {}
        self.alerts = []

        # Create tables if they don't exist
        self._create_monitoring_tables()

    def _setup_default_thresholds(self) -> Dict[str, Dict[str, float]]:
        """Setup default performance thresholds for different models"""
        return {
            'tax_optimization': {
                'min_accuracy': 0.80,
                'min_r2': 0.70,
                'max_mae': 500.0,
                'max_rmse': 750.0,
                'max_prediction_time': 100.0,  # milliseconds
                'max_error_rate': 0.05
            },
            'churn_prediction': {
                'min_accuracy': 0.75,
                'min_precision': 0.70,
                'min_recall': 0.75,
                'min_f1': 0.72,
                'min_auc': 0.80,
                'max_prediction_time': 50.0,
                'max_error_rate': 0.03
            },
            'ltv_prediction': {
                'min_r2': 0.65,
                'max_mae': 150.0,
                'max_rmse': 250.0,
                'max_prediction_time': 75.0,
                'max_error_rate': 0.05
            },
            'fraud_detection': {
                'min_precision': 0.85,
                'min_recall': 0.70,
                'min_f1': 0.75,
                'max_false_positive_rate': 0.10,
                'max_prediction_time': 80.0,
                'max_error_rate': 0.02
            }
        }

    def _create_monitoring_tables(self):
        """Create database tables for monitoring data"""
        create_metrics_table = """
        CREATE TABLE IF NOT EXISTS model_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            metric_type TEXT NOT NULL,
            metric_value REAL,
            metadata TEXT
        )
        """

        create_alerts_table = """
        CREATE TABLE IF NOT EXISTS model_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            model_name TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            metrics TEXT,
            resolved BOOLEAN DEFAULT FALSE
        )
        """

        with self.engine.connect() as conn:
            conn.execute(create_metrics_table)
            conn.execute(create_alerts_table)
            conn.commit()

    def record_prediction_metrics(self, model_name: str, y_true: np.ndarray,
                                y_pred: np.ndarray, prediction_times: List[float],
                                error_count: int = 0):
        """Record prediction metrics for a batch of predictions"""
        timestamp = datetime.now()

        # Calculate metrics based on prediction type
        if self._is_classification_task(y_true):
            metrics = self._calculate_classification_metrics(y_true, y_pred)
        else:
            metrics = self._calculate_regression_metrics(y_true, y_pred)

        # Add performance metrics
        metrics.update({
            'prediction_count': len(y_pred),
            'avg_prediction_time': np.mean(prediction_times),
            'error_count': error_count,
            'error_rate': error_count / len(y_pred) if len(y_pred) > 0 else 0
        })

        # Create performance metrics object
        performance_metrics = ModelPerformanceMetrics(
            model_name=model_name,
            timestamp=timestamp,
            prediction_count=len(y_pred),
            avg_prediction_time=np.mean(prediction_times),
            error_count=error_count,
            **metrics
        )

        # Store metrics
        self._store_performance_metrics(performance_metrics)

        # Check for performance degradation
        self._check_performance_thresholds(performance_metrics)

        return performance_metrics

    def _is_classification_task(self, y_true: np.ndarray) -> bool:
        """Determine if this is a classification task"""
        unique_values = len(np.unique(y_true))
        return unique_values <= 10 and np.all(np.equal(np.mod(y_true, 1), 0))

    def _calculate_classification_metrics(self, y_true: np.ndarray,
                                        y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate classification metrics"""
        return {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_true, y_pred, average='weighted', zero_division=0),
            'f1_score': f1_score(y_true, y_pred, average='weighted', zero_division=0)
        }

    def _calculate_regression_metrics(self, y_true: np.ndarray,
                                    y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate regression metrics"""
        return {
            'mae': mean_absolute_error(y_true, y_pred),
            'mse': mean_squared_error(y_true, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_true, y_pred)),
            'r2_score': r2_score(y_true, y_pred)
        }

    def _store_performance_metrics(self, metrics: ModelPerformanceMetrics):
        """Store performance metrics in database"""
        metrics_data = []

        # Store each metric as a separate record
        metric_values = {
            'accuracy': metrics.accuracy,
            'precision': metrics.precision,
            'recall': metrics.recall,
            'f1_score': metrics.f1_score,
            'mae': metrics.mae,
            'mse': metrics.mse,
            'rmse': metrics.rmse,
            'r2_score': metrics.r2_score,
            'prediction_count': metrics.prediction_count,
            'avg_prediction_time': metrics.avg_prediction_time,
            'error_count': metrics.error_count
        }

        for metric_name, metric_value in metric_values.items():
            if metric_value is not None:
                metrics_data.append({
                    'model_name': metrics.model_name,
                    'timestamp': metrics.timestamp,
                    'metric_type': metric_name,
                    'metric_value': metric_value,
                    'metadata': json.dumps({'batch_size': metrics.prediction_count})
                })

        # Insert into database
        df = pd.DataFrame(metrics_data)
        df.to_sql('model_metrics', self.engine, if_exists='append', index=False)

    def _check_performance_thresholds(self, metrics: ModelPerformanceMetrics):
        """Check if performance metrics meet thresholds"""
        model_thresholds = self.performance_thresholds.get(metrics.model_name, {})

        alerts = []

        # Check accuracy metrics
        if metrics.accuracy and 'min_accuracy' in model_thresholds:
            if metrics.accuracy < model_thresholds['min_accuracy']:
                alerts.append(self._create_alert(
                    'performance_degradation',
                    'high',
                    metrics.model_name,
                    f"Accuracy dropped to {metrics.accuracy:.3f}, below threshold {model_thresholds['min_accuracy']:.3f}",
                    metrics
                ))

        # Check R² score
        if metrics.r2_score and 'min_r2' in model_thresholds:
            if metrics.r2_score < model_thresholds['min_r2']:
                alerts.append(self._create_alert(
                    'performance_degradation',
                    'high',
                    metrics.model_name,
                    f"R² score dropped to {metrics.r2_score:.3f}, below threshold {model_thresholds['min_r2']:.3f}",
                    metrics
                ))

        # Check MAE
        if metrics.mae and 'max_mae' in model_thresholds:
            if metrics.mae > model_thresholds['max_mae']:
                alerts.append(self._create_alert(
                    'performance_degradation',
                    'medium',
                    metrics.model_name,
                    f"MAE increased to {metrics.mae:.2f}, above threshold {model_thresholds['max_mae']:.2f}",
                    metrics
                ))

        # Check prediction time
        if 'max_prediction_time' in model_thresholds:
            if metrics.avg_prediction_time > model_thresholds['max_prediction_time']:
                alerts.append(self._create_alert(
                    'latency_degradation',
                    'medium',
                    metrics.model_name,
                    f"Average prediction time increased to {metrics.avg_prediction_time:.2f}ms, above threshold {model_thresholds['max_prediction_time']:.2f}ms",
                    metrics
                ))

        # Check error rate
        error_rate = metrics.error_count / metrics.prediction_count if metrics.prediction_count > 0 else 0
        if 'max_error_rate' in model_thresholds:
            if error_rate > model_thresholds['max_error_rate']:
                alerts.append(self._create_alert(
                    'error_rate_high',
                    'critical',
                    metrics.model_name,
                    f"Error rate increased to {error_rate:.3f}, above threshold {model_thresholds['max_error_rate']:.3f}",
                    metrics
                ))

        # Store alerts
        for alert in alerts:
            self._store_alert(alert)

    def _create_alert(self, alert_type: str, severity: str, model_name: str,
                     message: str, metrics: ModelPerformanceMetrics) -> ModelAlert:
        """Create a model alert"""
        return ModelAlert(
            alert_type=alert_type,
            severity=severity,
            model_name=model_name,
            message=message,
            timestamp=datetime.now(),
            metrics={
                'accuracy': metrics.accuracy,
                'mae': metrics.mae,
                'prediction_time': metrics.avg_prediction_time,
                'error_count': metrics.error_count
            }
        )

    def _store_alert(self, alert: ModelAlert):
        """Store alert in database"""
        alert_data = {
            'alert_type': alert.alert_type,
            'severity': alert.severity,
            'model_name': alert.model_name,
            'message': alert.message,
            'timestamp': alert.timestamp,
            'metrics': json.dumps(alert.metrics),
            'resolved': alert.resolved
        }

        df = pd.DataFrame([alert_data])
        df.to_sql('model_alerts', self.engine, if_exists='append', index=False)

        # Add to alerts list
        self.alerts.append(alert)

        logger.warning(f"Model Alert: {alert.message}")

    def get_performance_summary(self, model_name: str,
                              time_window: timedelta = timedelta(hours=24)) -> Dict[str, Any]:
        """Get performance summary for a model"""
        end_time = datetime.now()
        start_time = end_time - time_window

        query = """
        SELECT metric_type, AVG(metric_value) as avg_value,
               MIN(metric_value) as min_value, MAX(metric_value) as max_value,
               COUNT(*) as count
        FROM model_metrics
        WHERE model_name = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY metric_type
        """

        with self.engine.connect() as conn:
            df = pd.read_sql_query(query, conn, params=[model_name, start_time, end_time])

        summary = {}
        for _, row in df.iterrows():
            summary[row['metric_type']] = {
                'avg': row['avg_value'],
                'min': row['min_value'],
                'max': row['max_value'],
                'count': row['count']
            }

        return summary

    def get_active_alerts(self, model_name: str = None) -> List[Dict[str, Any]]:
        """Get active alerts"""
        query = "SELECT * FROM model_alerts WHERE resolved = FALSE"
        params = []

        if model_name:
            query += " AND model_name = ?"
            params.append(model_name)

        query += " ORDER BY timestamp DESC"

        with self.engine.connect() as conn:
            df = pd.read_sql_query(query, conn, params=params)

        return df.to_dict('records')


class DataDriftDetector:
    """Detect data drift in model inputs"""

    def __init__(self):
        self.reference_distributions = {}
        self.drift_thresholds = {
            'ks_test_p_value': 0.05,
            'psi_threshold': 0.2,
            'js_divergence_threshold': 0.1
        }

    def set_reference_data(self, model_name: str, reference_data: pd.DataFrame):
        """Set reference data distribution for drift detection"""
        self.reference_distributions[model_name] = {
            'data': reference_data,
            'statistics': self._calculate_distribution_statistics(reference_data)
        }

    def _calculate_distribution_statistics(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate distribution statistics for reference data"""
        statistics = {}

        for column in data.select_dtypes(include=[np.number]).columns:
            col_data = data[column].dropna()
            statistics[column] = {
                'mean': col_data.mean(),
                'std': col_data.std(),
                'min': col_data.min(),
                'max': col_data.max(),
                'quantiles': col_data.quantile([0.25, 0.5, 0.75]).to_dict(),
                'histogram': np.histogram(col_data, bins=20)
            }

        return statistics

    def detect_drift(self, model_name: str, current_data: pd.DataFrame,
                    comparison_period: str = "current") -> List[DataDriftMetrics]:
        """Detect data drift between reference and current data"""
        if model_name not in self.reference_distributions:
            raise ValueError(f"No reference data set for model {model_name}")

        reference_data = self.reference_distributions[model_name]['data']
        drift_metrics = []

        for column in current_data.select_dtypes(include=[np.number]).columns:
            if column in reference_data.columns:
                drift_metric = self._calculate_drift_for_feature(
                    column,
                    reference_data[column].dropna(),
                    current_data[column].dropna(),
                    comparison_period
                )
                drift_metrics.append(drift_metric)

        return drift_metrics

    def _calculate_drift_for_feature(self, feature_name: str,
                                   reference_data: pd.Series,
                                   current_data: pd.Series,
                                   comparison_period: str) -> DataDriftMetrics:
        """Calculate drift metrics for a single feature"""

        # Kolmogorov-Smirnov test
        ks_statistic, ks_p_value = stats.ks_2samp(reference_data, current_data)

        # Population Stability Index (PSI)
        psi_score = self._calculate_psi(reference_data, current_data)

        # Jensen-Shannon divergence
        js_divergence = self._calculate_js_divergence(reference_data, current_data)

        # Determine if drift is detected
        drift_detected = (
            ks_p_value < self.drift_thresholds['ks_test_p_value'] or
            psi_score > self.drift_thresholds['psi_threshold'] or
            js_divergence > self.drift_thresholds['js_divergence_threshold']
        )

        return DataDriftMetrics(
            feature_name=feature_name,
            drift_score=psi_score,
            statistical_distance=js_divergence,
            p_value=ks_p_value,
            drift_detected=drift_detected,
            reference_period="baseline",
            comparison_period=comparison_period
        )

    def _calculate_psi(self, reference: pd.Series, current: pd.Series,
                      n_bins: int = 10) -> float:
        """Calculate Population Stability Index"""
        # Create bins based on reference data
        _, bin_edges = np.histogram(reference, bins=n_bins)

        # Calculate distributions
        ref_hist, _ = np.histogram(reference, bins=bin_edges)
        cur_hist, _ = np.histogram(current, bins=bin_edges)

        # Normalize to percentages
        ref_pct = ref_hist / len(reference)
        cur_pct = cur_hist / len(current)

        # Add small constant to avoid division by zero
        ref_pct = np.where(ref_pct == 0, 0.0001, ref_pct)
        cur_pct = np.where(cur_pct == 0, 0.0001, cur_pct)

        # Calculate PSI
        psi = np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct))

        return psi

    def _calculate_js_divergence(self, reference: pd.Series, current: pd.Series,
                                n_bins: int = 20) -> float:
        """Calculate Jensen-Shannon divergence"""
        # Create histograms
        min_val = min(reference.min(), current.min())
        max_val = max(reference.max(), current.max())
        bins = np.linspace(min_val, max_val, n_bins)

        ref_hist, _ = np.histogram(reference, bins=bins)
        cur_hist, _ = np.histogram(current, bins=bins)

        # Normalize to probabilities
        ref_prob = ref_hist / ref_hist.sum()
        cur_prob = cur_hist / cur_hist.sum()

        # Add small constant to avoid log(0)
        ref_prob = np.where(ref_prob == 0, 1e-10, ref_prob)
        cur_prob = np.where(cur_prob == 0, 1e-10, cur_prob)

        # Calculate Jensen-Shannon divergence
        m = 0.5 * (ref_prob + cur_prob)
        js_div = 0.5 * stats.entropy(ref_prob, m) + 0.5 * stats.entropy(cur_prob, m)

        return js_div


class ModelValidationFramework:
    """Comprehensive model validation framework"""

    def __init__(self):
        self.validation_rules = self._setup_validation_rules()
        self.validation_history = {}

    def _setup_validation_rules(self) -> Dict[str, Dict[str, Any]]:
        """Setup validation rules for different model types"""
        return {
            'data_quality': {
                'max_missing_percentage': 0.05,
                'max_duplicate_percentage': 0.01,
                'required_columns': [],
                'value_ranges': {}
            },
            'model_consistency': {
                'max_prediction_variance': 0.1,
                'min_feature_importance_coverage': 0.8,
                'max_correlation_change': 0.3
            },
            'business_logic': {
                'tax_savings_max_percentage': 0.5,  # Max 50% tax savings
                'ltv_reasonable_range': (0, 1000),  # $0-$1000 LTV
                'churn_probability_range': (0, 1)
            }
        }

    def validate_input_data(self, data: pd.DataFrame, model_name: str) -> Dict[str, Any]:
        """Validate input data quality"""
        validation_results = {
            'passed': True,
            'issues': [],
            'warnings': [],
            'data_quality_score': 1.0
        }

        # Check for missing values
        missing_percentage = data.isnull().sum().sum() / (data.shape[0] * data.shape[1])
        if missing_percentage > self.validation_rules['data_quality']['max_missing_percentage']:
            validation_results['issues'].append(
                f"Missing data percentage ({missing_percentage:.3f}) exceeds threshold"
            )
            validation_results['passed'] = False

        # Check for duplicates
        duplicate_percentage = data.duplicated().sum() / len(data)
        if duplicate_percentage > self.validation_rules['data_quality']['max_duplicate_percentage']:
            validation_results['warnings'].append(
                f"Duplicate rows percentage ({duplicate_percentage:.3f}) is high"
            )

        # Check data types and ranges
        for column in data.select_dtypes(include=[np.number]).columns:
            col_data = data[column].dropna()

            # Check for outliers using IQR method
            Q1 = col_data.quantile(0.25)
            Q3 = col_data.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 3 * IQR
            upper_bound = Q3 + 3 * IQR

            outliers = col_data[(col_data < lower_bound) | (col_data > upper_bound)]
            outlier_percentage = len(outliers) / len(col_data)

            if outlier_percentage > 0.05:  # More than 5% outliers
                validation_results['warnings'].append(
                    f"Column {column} has {outlier_percentage:.3f} outliers"
                )

        # Calculate overall data quality score
        issue_penalty = len(validation_results['issues']) * 0.2
        warning_penalty = len(validation_results['warnings']) * 0.1
        validation_results['data_quality_score'] = max(0, 1.0 - issue_penalty - warning_penalty)

        return validation_results

    def validate_model_predictions(self, model_name: str, predictions: np.ndarray,
                                 input_features: pd.DataFrame) -> Dict[str, Any]:
        """Validate model predictions for business logic compliance"""
        validation_results = {
            'passed': True,
            'issues': [],
            'warnings': []
        }

        # Model-specific validation
        if 'tax_optimization' in model_name.lower():
            validation_results.update(
                self._validate_tax_optimization_predictions(predictions, input_features)
            )
        elif 'churn' in model_name.lower():
            validation_results.update(
                self._validate_churn_predictions(predictions)
            )
        elif 'ltv' in model_name.lower():
            validation_results.update(
                self._validate_ltv_predictions(predictions, input_features)
            )

        return validation_results

    def _validate_tax_optimization_predictions(self, predictions: np.ndarray,
                                             input_features: pd.DataFrame) -> Dict[str, Any]:
        """Validate tax optimization predictions"""
        issues = []
        warnings = []

        # Check if predicted savings are reasonable
        if 'gross_income' in input_features.columns:
            income = input_features['gross_income']
            savings_percentage = predictions / income.replace(0, 1)  # Avoid division by zero

            max_percentage = self.validation_rules['business_logic']['tax_savings_max_percentage']
            excessive_savings = savings_percentage > max_percentage

            if excessive_savings.any():
                issues.append(
                    f"{excessive_savings.sum()} predictions show unrealistic tax savings (>{max_percentage*100}%)"
                )

        # Check for negative savings
        negative_savings = predictions < 0
        if negative_savings.any():
            warnings.append(
                f"{negative_savings.sum()} predictions show negative tax savings"
            )

        return {
            'passed': len(issues) == 0,
            'issues': issues,
            'warnings': warnings
        }

    def _validate_churn_predictions(self, predictions: np.ndarray) -> Dict[str, Any]:
        """Validate churn predictions"""
        issues = []
        warnings = []

        # Check probability range
        min_prob, max_prob = self.validation_rules['business_logic']['churn_probability_range']
        out_of_range = (predictions < min_prob) | (predictions > max_prob)

        if out_of_range.any():
            issues.append(
                f"{out_of_range.sum()} churn predictions are outside valid probability range"
            )

        # Check for extreme predictions
        extreme_high = predictions > 0.95
        extreme_low = predictions < 0.05

        if extreme_high.sum() > len(predictions) * 0.1:  # More than 10% extreme high
            warnings.append("High number of extreme high churn predictions")

        if extreme_low.sum() > len(predictions) * 0.8:  # More than 80% extreme low
            warnings.append("High number of extreme low churn predictions")

        return {
            'passed': len(issues) == 0,
            'issues': issues,
            'warnings': warnings
        }

    def _validate_ltv_predictions(self, predictions: np.ndarray,
                                input_features: pd.DataFrame) -> Dict[str, Any]:
        """Validate LTV predictions"""
        issues = []
        warnings = []

        # Check LTV range
        min_ltv, max_ltv = self.validation_rules['business_logic']['ltv_reasonable_range']
        out_of_range = (predictions < min_ltv) | (predictions > max_ltv)

        if out_of_range.any():
            issues.append(
                f"{out_of_range.sum()} LTV predictions are outside reasonable range (${min_ltv}-${max_ltv})"
            )

        # Check for unrealistic LTV compared to current revenue
        if 'subscription_revenue' in input_features.columns:
            current_revenue = input_features['subscription_revenue']
            ltv_to_revenue_ratio = predictions / current_revenue.replace(0, 1)

            unrealistic_ratio = ltv_to_revenue_ratio > 10  # LTV more than 10x current revenue
            if unrealistic_ratio.any():
                warnings.append(
                    f"{unrealistic_ratio.sum()} LTV predictions seem unrealistically high compared to current revenue"
                )

        return {
            'passed': len(issues) == 0,
            'issues': issues,
            'warnings': warnings
        }

    def run_comprehensive_validation(self, model_name: str, input_data: pd.DataFrame,
                                   predictions: np.ndarray) -> Dict[str, Any]:
        """Run comprehensive validation suite"""
        validation_results = {
            'model_name': model_name,
            'timestamp': datetime.now(),
            'overall_passed': True,
            'data_validation': {},
            'prediction_validation': {},
            'recommendations': []
        }

        # Validate input data
        data_validation = self.validate_input_data(input_data, model_name)
        validation_results['data_validation'] = data_validation

        # Validate predictions
        prediction_validation = self.validate_model_predictions(
            model_name, predictions, input_data
        )
        validation_results['prediction_validation'] = prediction_validation

        # Determine overall pass/fail
        validation_results['overall_passed'] = (
            data_validation['passed'] and prediction_validation['passed']
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            data_validation, prediction_validation
        )
        validation_results['recommendations'] = recommendations

        # Store validation results
        self.validation_history[f"{model_name}_{datetime.now().isoformat()}"] = validation_results

        return validation_results

    def _generate_recommendations(self, data_validation: Dict[str, Any],
                                prediction_validation: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on validation results"""
        recommendations = []

        # Data quality recommendations
        if not data_validation['passed']:
            recommendations.append("Improve data quality by addressing missing values and outliers")

        if data_validation['data_quality_score'] < 0.8:
            recommendations.append("Consider data preprocessing and cleaning pipeline improvements")

        # Prediction validation recommendations
        if not prediction_validation['passed']:
            recommendations.append("Review model logic and constraints to ensure realistic predictions")

        if len(prediction_validation['warnings']) > 0:
            recommendations.append("Monitor prediction distributions for potential model drift")

        return recommendations


class AlertingSystem:
    """Alerting system for model monitoring"""

    def __init__(self, email_config: Dict[str, str] = None):
        self.email_config = email_config or {}
        self.alert_channels = ['email', 'log']
        self.alert_rules = self._setup_alert_rules()

    def _setup_alert_rules(self) -> Dict[str, Dict[str, Any]]:
        """Setup alerting rules"""
        return {
            'performance_degradation': {
                'severity_thresholds': {
                    'low': 0.05,    # 5% performance drop
                    'medium': 0.10, # 10% performance drop
                    'high': 0.20,   # 20% performance drop
                    'critical': 0.30 # 30% performance drop
                },
                'notification_channels': ['email', 'log']
            },
            'data_drift': {
                'severity_thresholds': {
                    'low': 0.1,     # PSI > 0.1
                    'medium': 0.2,  # PSI > 0.2
                    'high': 0.3,    # PSI > 0.3
                    'critical': 0.5 # PSI > 0.5
                },
                'notification_channels': ['email', 'log']
            },
            'error_rate': {
                'severity_thresholds': {
                    'medium': 0.05,  # 5% error rate
                    'high': 0.10,    # 10% error rate
                    'critical': 0.20 # 20% error rate
                },
                'notification_channels': ['email', 'log']
            }
        }

    def send_alert(self, alert: ModelAlert):
        """Send alert through configured channels"""
        if 'email' in self.alert_channels and self.email_config:
            self._send_email_alert(alert)

        if 'log' in self.alert_channels:
            self._log_alert(alert)

    def _send_email_alert(self, alert: ModelAlert):
        """Send email alert"""
        try:
            msg = MimeMultipart()
            msg['From'] = self.email_config.get('sender_email', '')
            msg['To'] = self.email_config.get('recipient_email', '')
            msg['Subject'] = f"Model Alert: {alert.alert_type} - {alert.model_name}"

            body = f"""
            Model Alert Details:

            Model: {alert.model_name}
            Alert Type: {alert.alert_type}
            Severity: {alert.severity}
            Timestamp: {alert.timestamp}

            Message: {alert.message}

            Metrics:
            {json.dumps(alert.metrics, indent=2)}

            Please investigate and take appropriate action.
            """

            msg.attach(MimeText(body, 'plain'))

            server = smtplib.SMTP(
                self.email_config.get('smtp_server', 'localhost'),
                self.email_config.get('smtp_port', 587)
            )

            if self.email_config.get('use_tls', True):
                server.starttls()

            if self.email_config.get('username') and self.email_config.get('password'):
                server.login(
                    self.email_config['username'],
                    self.email_config['password']
                )

            server.send_message(msg)
            server.quit()

            logger.info(f"Email alert sent for {alert.model_name}")

        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")

    def _log_alert(self, alert: ModelAlert):
        """Log alert to console/file"""
        log_level = {
            'low': logging.INFO,
            'medium': logging.WARNING,
            'high': logging.ERROR,
            'critical': logging.CRITICAL
        }.get(alert.severity, logging.WARNING)

        logger.log(
            log_level,
            f"MODEL ALERT [{alert.severity.upper()}] {alert.model_name}: {alert.message}"
        )


if __name__ == "__main__":
    # Example usage
    monitor = ModelPerformanceMonitor()
    drift_detector = DataDriftDetector()
    validator = ModelValidationFramework()
    alerting = AlertingSystem()

    # Example: Monitor model performance
    y_true = np.random.randint(0, 2, 100)
    y_pred = np.random.randint(0, 2, 100)
    prediction_times = np.random.uniform(10, 100, 100)

    metrics = monitor.record_prediction_metrics(
        'churn_prediction',
        y_true,
        y_pred,
        prediction_times
    )

    print(f"Recorded metrics: {metrics}")

    # Example: Check for alerts
    alerts = monitor.get_active_alerts()
    print(f"Active alerts: {len(alerts)}")

    logger.info("Model monitoring system demo completed")
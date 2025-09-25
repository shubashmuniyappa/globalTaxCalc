"""
MLflow Infrastructure Setup
Comprehensive ML lifecycle management system
"""

import os
import mlflow
import mlflow.sklearn
import mlflow.tensorflow
from mlflow.tracking import MlflowClient
from mlflow.entities import ViewType
import boto3
import logging
from typing import Dict, Any, List, Optional
import json
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MLflowManager:
    """Manages MLflow experiments, models, and deployments"""

    def __init__(self, tracking_uri: str = None, registry_uri: str = None):
        """
        Initialize MLflow manager

        Args:
            tracking_uri: MLflow tracking server URI
            registry_uri: MLflow model registry URI
        """
        self.tracking_uri = tracking_uri or os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
        self.registry_uri = registry_uri or os.getenv("MLFLOW_REGISTRY_URI", self.tracking_uri)

        # Set MLflow configuration
        mlflow.set_tracking_uri(self.tracking_uri)
        mlflow.set_registry_uri(self.registry_uri)

        self.client = MlflowClient()

        # Initialize experiments for different domains
        self.experiments = {
            "tax_optimization": self._create_experiment("tax_optimization"),
            "user_behavior": self._create_experiment("user_behavior"),
            "personalization": self._create_experiment("personalization"),
            "anomaly_detection": self._create_experiment("anomaly_detection"),
            "churn_prediction": self._create_experiment("churn_prediction"),
            "recommendation_engine": self._create_experiment("recommendation_engine")
        }

        logger.info(f"MLflow initialized with tracking URI: {self.tracking_uri}")

    def _create_experiment(self, name: str) -> str:
        """Create or get existing experiment"""
        try:
            experiment_id = mlflow.create_experiment(name)
            logger.info(f"Created experiment: {name}")
        except Exception:
            experiment = mlflow.get_experiment_by_name(name)
            experiment_id = experiment.experiment_id
            logger.info(f"Using existing experiment: {name}")

        return experiment_id

    def start_run(self, experiment_name: str, run_name: str = None, tags: Dict[str, Any] = None):
        """Start a new MLflow run"""
        experiment_id = self.experiments.get(experiment_name)
        if not experiment_id:
            raise ValueError(f"Unknown experiment: {experiment_name}")

        return mlflow.start_run(
            experiment_id=experiment_id,
            run_name=run_name or f"{experiment_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            tags=tags or {}
        )

    def log_model(self, model, model_name: str, signature=None, input_example=None, **kwargs):
        """Log model to MLflow"""
        if hasattr(model, 'fit'):  # sklearn-like model
            mlflow.sklearn.log_model(
                model,
                model_name,
                signature=signature,
                input_example=input_example,
                **kwargs
            )
        elif hasattr(model, 'save'):  # TensorFlow/Keras model
            mlflow.tensorflow.log_model(
                model,
                model_name,
                signature=signature,
                input_example=input_example,
                **kwargs
            )
        else:
            # Generic Python model
            mlflow.pyfunc.log_model(
                model_name,
                python_model=model,
                signature=signature,
                input_example=input_example,
                **kwargs
            )

    def register_model(self, model_name: str, run_id: str, version_description: str = None):
        """Register model in MLflow Model Registry"""
        model_uri = f"runs:/{run_id}/{model_name}"

        registered_model = mlflow.register_model(
            model_uri=model_uri,
            name=model_name,
            tags={
                "framework": "scikit-learn",
                "domain": "tax_optimization",
                "created_at": datetime.now().isoformat()
            }
        )

        if version_description:
            self.client.update_model_version(
                name=model_name,
                version=registered_model.version,
                description=version_description
            )

        logger.info(f"Registered model: {model_name} version {registered_model.version}")
        return registered_model

    def promote_model(self, model_name: str, version: str, stage: str):
        """Promote model to different stage (Staging, Production)"""
        self.client.transition_model_version_stage(
            name=model_name,
            version=version,
            stage=stage
        )
        logger.info(f"Promoted {model_name} v{version} to {stage}")

    def load_model(self, model_name: str, stage: str = "Production"):
        """Load model from registry"""
        model_uri = f"models:/{model_name}/{stage}"
        return mlflow.pyfunc.load_model(model_uri)

    def get_model_versions(self, model_name: str) -> List[Dict[str, Any]]:
        """Get all versions of a model"""
        versions = self.client.search_model_versions(f"name='{model_name}'")
        return [
            {
                "version": v.version,
                "stage": v.current_stage,
                "run_id": v.run_id,
                "created_at": v.creation_timestamp,
                "description": v.description
            }
            for v in versions
        ]

    def compare_models(self, model_names: List[str], metric_name: str):
        """Compare models across experiments"""
        results = []

        for model_name in model_names:
            versions = self.client.search_model_versions(f"name='{model_name}'")
            for version in versions:
                run = self.client.get_run(version.run_id)
                metric_value = run.data.metrics.get(metric_name)

                if metric_value:
                    results.append({
                        "model_name": model_name,
                        "version": version.version,
                        "stage": version.current_stage,
                        "metric_name": metric_name,
                        "metric_value": metric_value,
                        "run_id": version.run_id
                    })

        return sorted(results, key=lambda x: x["metric_value"], reverse=True)

    def cleanup_old_runs(self, experiment_name: str, days_to_keep: int = 30):
        """Clean up old runs from experiment"""
        experiment_id = self.experiments.get(experiment_name)
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)

        runs = self.client.search_runs(
            experiment_ids=[experiment_id],
            filter_string="",
            run_view_type=ViewType.ALL
        )

        deleted_count = 0
        for run in runs:
            if datetime.fromtimestamp(run.info.start_time / 1000) < cutoff_date:
                self.client.delete_run(run.info.run_id)
                deleted_count += 1

        logger.info(f"Deleted {deleted_count} old runs from {experiment_name}")

    def get_experiment_stats(self) -> Dict[str, Any]:
        """Get statistics for all experiments"""
        stats = {}

        for name, experiment_id in self.experiments.items():
            runs = self.client.search_runs(
                experiment_ids=[experiment_id],
                run_view_type=ViewType.ACTIVE_ONLY
            )

            stats[name] = {
                "total_runs": len(runs),
                "active_runs": len([r for r in runs if r.info.lifecycle_stage == "active"]),
                "latest_run": max([r.info.start_time for r in runs]) if runs else None
            }

        return stats


class ModelMetrics:
    """Standardized metrics for different model types"""

    @staticmethod
    def regression_metrics(y_true, y_pred) -> Dict[str, float]:
        """Calculate regression metrics"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        import numpy as np

        return {
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "mse": float(mean_squared_error(y_true, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
            "r2": float(r2_score(y_true, y_pred))
        }

    @staticmethod
    def classification_metrics(y_true, y_pred, y_prob=None) -> Dict[str, float]:
        """Calculate classification metrics"""
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "precision": float(precision_score(y_true, y_pred, average='weighted')),
            "recall": float(recall_score(y_true, y_pred, average='weighted')),
            "f1": float(f1_score(y_true, y_pred, average='weighted'))
        }

        if y_prob is not None:
            metrics["auc"] = float(roc_auc_score(y_true, y_prob))

        return metrics

    @staticmethod
    def ranking_metrics(y_true, y_scores, k=10) -> Dict[str, float]:
        """Calculate ranking metrics for recommendation systems"""
        from sklearn.metrics import ndcg_score
        import numpy as np

        # Calculate Precision@K
        top_k_indices = np.argsort(y_scores)[::-1][:k]
        precision_at_k = np.sum(y_true[top_k_indices]) / k

        # Calculate NDCG@K
        ndcg_at_k = ndcg_score([y_true], [y_scores], k=k)

        return {
            f"precision_at_{k}": float(precision_at_k),
            f"ndcg_at_{k}": float(ndcg_at_k)
        }


class ExperimentTemplate:
    """Template for standardized ML experiments"""

    def __init__(self, mlflow_manager: MLflowManager):
        self.mlflow_manager = mlflow_manager
        self.metrics = ModelMetrics()

    def run_experiment(self,
                      experiment_name: str,
                      model,
                      X_train, y_train,
                      X_test, y_test,
                      model_name: str,
                      hyperparameters: Dict[str, Any] = None,
                      tags: Dict[str, Any] = None):
        """Run standardized experiment"""

        with self.mlflow_manager.start_run(experiment_name, tags=tags):
            # Log hyperparameters
            if hyperparameters:
                mlflow.log_params(hyperparameters)

            # Train model
            model.fit(X_train, y_train)

            # Make predictions
            y_pred = model.predict(X_test)

            # Calculate and log metrics
            if hasattr(model, 'predict_proba'):  # Classification with probabilities
                y_prob = model.predict_proba(X_test)[:, 1]
                metrics = self.metrics.classification_metrics(y_test, y_pred, y_prob)
            elif len(set(y_test)) <= 10:  # Classification
                metrics = self.metrics.classification_metrics(y_test, y_pred)
            else:  # Regression
                metrics = self.metrics.regression_metrics(y_test, y_pred)

            mlflow.log_metrics(metrics)

            # Log model
            self.mlflow_manager.log_model(
                model,
                model_name,
                input_example=X_train[:5] if len(X_train) > 5 else X_train
            )

            # Log feature importance if available
            if hasattr(model, 'feature_importances_'):
                feature_importance = {
                    f"feature_{i}": float(importance)
                    for i, importance in enumerate(model.feature_importances_)
                }
                mlflow.log_metrics(feature_importance)

            run_id = mlflow.active_run().info.run_id
            logger.info(f"Experiment completed. Run ID: {run_id}")

            return run_id, metrics


def setup_mlflow_server():
    """Setup MLflow tracking server"""
    import subprocess
    import time

    # Create MLflow directory structure
    os.makedirs("mlruns", exist_ok=True)
    os.makedirs("mlflow-artifacts", exist_ok=True)

    # Start MLflow server
    try:
        process = subprocess.Popen([
            "mlflow", "server",
            "--backend-store-uri", "sqlite:///mlflow.db",
            "--default-artifact-root", "./mlflow-artifacts",
            "--host", "0.0.0.0",
            "--port", "5000"
        ])

        # Wait for server to start
        time.sleep(5)
        logger.info("MLflow server started on http://localhost:5000")
        return process
    except Exception as e:
        logger.error(f"Failed to start MLflow server: {e}")
        return None


if __name__ == "__main__":
    # Initialize MLflow setup
    manager = MLflowManager()

    # Print experiment stats
    stats = manager.get_experiment_stats()
    print("MLflow Experiment Stats:")
    for name, stat in stats.items():
        print(f"  {name}: {stat}")
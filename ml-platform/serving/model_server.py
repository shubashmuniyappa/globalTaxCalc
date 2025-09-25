"""
Model Serving Infrastructure
FastAPI-based model serving with monitoring and A/B testing
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional, Union
import mlflow
import mlflow.pyfunc
import numpy as np
import pandas as pd
import logging
import time
import uuid
from datetime import datetime
import redis
import json
import asyncio
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import uvicorn
from contextlib import asynccontextmanager

# Import our custom modules
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from infrastructure.feature_store import GlobalTaxCalcFeatureStore
from infrastructure.mlflow_setup import MLflowManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
PREDICTION_COUNTER = Counter('ml_predictions_total', 'Total predictions made', ['model_name', 'version'])
PREDICTION_LATENCY = Histogram('ml_prediction_duration_seconds', 'Prediction latency', ['model_name'])
MODEL_LOAD_TIME = Histogram('ml_model_load_duration_seconds', 'Model loading time', ['model_name'])
ACTIVE_MODELS = Gauge('ml_active_models', 'Number of active models')
ERROR_COUNTER = Counter('ml_prediction_errors_total', 'Total prediction errors', ['model_name', 'error_type'])


class ModelRegistry:
    """Registry for managing loaded models"""

    def __init__(self):
        self.models = {}
        self.model_metadata = {}
        self.feature_store = GlobalTaxCalcFeatureStore()
        self.redis_client = None
        self._setup_redis()

    def _setup_redis(self):
        """Setup Redis connection for caching"""
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
            self.redis_client.ping()
            logger.info("Connected to Redis for model caching")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")

    def load_model(self, model_name: str, stage: str = "Production") -> bool:
        """Load model from MLflow registry"""
        try:
            start_time = time.time()

            # Load model
            model_uri = f"models:/{model_name}/{stage}"
            model = mlflow.pyfunc.load_model(model_uri)

            # Get model metadata
            mlflow_client = mlflow.MlflowClient()
            model_versions = mlflow_client.search_model_versions(f"name='{model_name}'")
            latest_version = max(model_versions, key=lambda x: int(x.version))

            # Store model and metadata
            self.models[model_name] = model
            self.model_metadata[model_name] = {
                'version': latest_version.version,
                'stage': latest_version.current_stage,
                'run_id': latest_version.run_id,
                'loaded_at': datetime.now().isoformat(),
                'model_uri': model_uri
            }

            load_time = time.time() - start_time
            MODEL_LOAD_TIME.labels(model_name=model_name).observe(load_time)
            ACTIVE_MODELS.set(len(self.models))

            logger.info(f"Loaded model {model_name} v{latest_version.version} in {load_time:.2f}s")
            return True

        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return False

    def get_model(self, model_name: str):
        """Get loaded model"""
        return self.models.get(model_name)

    def get_model_metadata(self, model_name: str) -> Dict[str, Any]:
        """Get model metadata"""
        return self.model_metadata.get(model_name, {})

    def list_models(self) -> List[str]:
        """List all loaded models"""
        return list(self.models.keys())

    def unload_model(self, model_name: str) -> bool:
        """Unload model from memory"""
        if model_name in self.models:
            del self.models[model_name]
            del self.model_metadata[model_name]
            ACTIVE_MODELS.set(len(self.models))
            logger.info(f"Unloaded model: {model_name}")
            return True
        return False


# Pydantic models for API
class PredictionRequest(BaseModel):
    user_id: Optional[int] = None
    features: Dict[str, Any]
    model_name: str
    use_cache: bool = True
    experiment_id: Optional[str] = None


class TaxOptimizationRequest(BaseModel):
    user_id: int
    income: float
    state: str
    filing_status: str
    current_deductions: Dict[str, float] = {}
    financial_goals: List[str] = []


class ChurnPredictionRequest(BaseModel):
    user_id: int
    include_features: bool = True


class RecommendationRequest(BaseModel):
    user_id: int
    content_type: str = "tax_tips"
    limit: int = 5


class PredictionResponse(BaseModel):
    prediction: Union[float, int, str, List[Any]]
    confidence: Optional[float] = None
    model_name: str
    model_version: str
    prediction_id: str
    timestamp: str
    latency_ms: float
    experiment_id: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    models_loaded: int
    uptime_seconds: float
    redis_connected: bool


# Initialize global registry
model_registry = ModelRegistry()
app_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("Starting Model Serving API...")

    # Load default models
    default_models = [
        "tax_optimization_model",
        "churn_prediction_model",
        "user_ltv_model",
        "recommendation_model"
    ]

    for model_name in default_models:
        success = model_registry.load_model(model_name)
        if success:
            logger.info(f"Loaded default model: {model_name}")

    yield

    # Shutdown
    logger.info("Shutting down Model Serving API...")


# Create FastAPI app
app = FastAPI(
    title="GlobalTaxCalc ML Model Server",
    description="Machine Learning model serving API with monitoring and A/B testing",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ABTestManager:
    """A/B testing manager for model experiments"""

    def __init__(self):
        self.experiments = {}
        self.redis_client = model_registry.redis_client

    def create_experiment(self, experiment_id: str, models: Dict[str, float]):
        """Create A/B test experiment

        Args:
            experiment_id: Unique experiment identifier
            models: Dict of model_name -> traffic_percentage
        """
        self.experiments[experiment_id] = {
            'models': models,
            'created_at': datetime.now().isoformat(),
            'total_requests': 0,
            'model_requests': {model: 0 for model in models.keys()}
        }

        if self.redis_client:
            self.redis_client.set(
                f"experiment:{experiment_id}",
                json.dumps(self.experiments[experiment_id]),
                ex=86400  # 24 hours
            )

        logger.info(f"Created experiment {experiment_id} with models: {models}")

    def get_model_for_request(self, experiment_id: str, user_id: int = None) -> str:
        """Get model to use for request based on A/B test configuration"""
        if experiment_id not in self.experiments:
            return None

        experiment = self.experiments[experiment_id]
        models = experiment['models']

        # Simple hash-based assignment for consistent user experience
        if user_id:
            hash_value = hash(f"{experiment_id}:{user_id}") % 100
        else:
            hash_value = np.random.randint(0, 100)

        cumulative_percentage = 0
        for model_name, percentage in models.items():
            cumulative_percentage += percentage
            if hash_value < cumulative_percentage:
                # Update counters
                experiment['total_requests'] += 1
                experiment['model_requests'][model_name] += 1
                return model_name

        # Fallback to first model
        return list(models.keys())[0]

    def get_experiment_stats(self, experiment_id: str) -> Dict[str, Any]:
        """Get experiment statistics"""
        if experiment_id in self.experiments:
            return self.experiments[experiment_id]
        return {}


# Initialize A/B test manager
ab_test_manager = ABTestManager()


async def get_features_for_user(user_id: int, feature_names: List[str]) -> Dict[str, Any]:
    """Get features for a user from the feature store"""
    try:
        entity_ids = {"user_id": [user_id]}
        features = model_registry.feature_store.get_online_features(
            entity_ids=entity_ids,
            features=feature_names
        )
        return features
    except Exception as e:
        logger.error(f"Failed to get features for user {user_id}: {e}")
        return {}


def cache_prediction(prediction_id: str, response: Dict[str, Any], ttl: int = 3600):
    """Cache prediction result"""
    if model_registry.redis_client:
        try:
            model_registry.redis_client.setex(
                f"prediction:{prediction_id}",
                ttl,
                json.dumps(response, default=str)
            )
        except Exception as e:
            logger.error(f"Failed to cache prediction: {e}")


def get_cached_prediction(prediction_id: str) -> Optional[Dict[str, Any]]:
    """Get cached prediction"""
    if model_registry.redis_client:
        try:
            cached = model_registry.redis_client.get(f"prediction:{prediction_id}")
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Failed to get cached prediction: {e}")
    return None


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    uptime = time.time() - app_start_time
    redis_connected = model_registry.redis_client is not None

    return HealthResponse(
        status="healthy",
        models_loaded=len(model_registry.list_models()),
        uptime_seconds=uptime,
        redis_connected=redis_connected
    )


@app.get("/models")
async def list_models():
    """List all loaded models"""
    models = []
    for model_name in model_registry.list_models():
        metadata = model_registry.get_model_metadata(model_name)
        models.append({
            "name": model_name,
            "version": metadata.get("version"),
            "stage": metadata.get("stage"),
            "loaded_at": metadata.get("loaded_at")
        })
    return {"models": models}


@app.post("/models/{model_name}/load")
async def load_model(model_name: str, stage: str = "Production"):
    """Load a model from MLflow registry"""
    success = model_registry.load_model(model_name, stage)
    if success:
        return {"message": f"Model {model_name} loaded successfully"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to load model {model_name}")


@app.delete("/models/{model_name}")
async def unload_model(model_name: str):
    """Unload a model from memory"""
    success = model_registry.unload_model(model_name)
    if success:
        return {"message": f"Model {model_name} unloaded successfully"}
    else:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest, background_tasks: BackgroundTasks):
    """Make a prediction using specified model"""
    start_time = time.time()
    prediction_id = str(uuid.uuid4())

    try:
        # Handle A/B testing
        model_name = request.model_name
        if request.experiment_id:
            ab_model = ab_test_manager.get_model_for_request(
                request.experiment_id,
                request.user_id
            )
            if ab_model:
                model_name = ab_model

        # Check cache if enabled
        cache_key = f"{model_name}:{hash(str(request.features))}"
        if request.use_cache:
            cached_result = get_cached_prediction(cache_key)
            if cached_result:
                return PredictionResponse(**cached_result)

        # Get model
        model = model_registry.get_model(model_name)
        if not model:
            ERROR_COUNTER.labels(model_name=model_name, error_type="model_not_found").inc()
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

        # Prepare features
        features_df = pd.DataFrame([request.features])

        # Make prediction
        prediction = model.predict(features_df)

        # Handle different prediction types
        if isinstance(prediction, np.ndarray):
            if prediction.ndim > 1:
                prediction = prediction.tolist()
            else:
                prediction = prediction.item() if prediction.size == 1 else prediction.tolist()

        # Calculate confidence if available
        confidence = None
        if hasattr(model, 'predict_proba'):
            try:
                proba = model.predict_proba(features_df)
                confidence = float(np.max(proba))
            except:
                pass

        # Create response
        latency = (time.time() - start_time) * 1000
        metadata = model_registry.get_model_metadata(model_name)

        response = PredictionResponse(
            prediction=prediction,
            confidence=confidence,
            model_name=model_name,
            model_version=metadata.get("version", "unknown"),
            prediction_id=prediction_id,
            timestamp=datetime.now().isoformat(),
            latency_ms=latency,
            experiment_id=request.experiment_id
        )

        # Update metrics
        PREDICTION_COUNTER.labels(model_name=model_name, version=metadata.get("version", "unknown")).inc()
        PREDICTION_LATENCY.labels(model_name=model_name).observe(latency / 1000)

        # Cache result
        if request.use_cache:
            background_tasks.add_task(
                cache_prediction,
                cache_key,
                response.model_dump()
            )

        return response

    except Exception as e:
        ERROR_COUNTER.labels(model_name=model_name, error_type="prediction_error").inc()
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/tax-optimization")
async def predict_tax_optimization(request: TaxOptimizationRequest):
    """Predict tax optimization opportunities"""
    try:
        # Get user features
        features = await get_features_for_user(
            request.user_id,
            [
                "user_demographics:age",
                "user_demographics:income_bracket",
                "user_demographics:filing_status",
                "financial_behavior:retirement_contributions",
                "financial_behavior:charitable_donations"
            ]
        )

        # Add request features
        features.update({
            "income": request.income,
            "state": request.state,
            "filing_status": request.filing_status,
            "current_deductions": sum(request.current_deductions.values())
        })

        # Make prediction
        prediction_request = PredictionRequest(
            user_id=request.user_id,
            features=features,
            model_name="tax_optimization_model"
        )

        response = await predict(prediction_request, BackgroundTasks())

        # Parse optimization recommendations
        optimization_data = {
            "predicted_savings": response.prediction,
            "confidence": response.confidence,
            "recommendations": [
                {
                    "type": "retirement_contribution",
                    "description": "Increase 401(k) contributions",
                    "potential_savings": response.prediction * 0.3,
                    "complexity": "easy"
                },
                {
                    "type": "charitable_donation",
                    "description": "Optimize charitable giving timing",
                    "potential_savings": response.prediction * 0.2,
                    "complexity": "medium"
                }
            ],
            "model_version": response.model_version,
            "prediction_id": response.prediction_id
        }

        return optimization_data

    except Exception as e:
        logger.error(f"Tax optimization prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/churn")
async def predict_churn(request: ChurnPredictionRequest):
    """Predict user churn probability"""
    try:
        # Get comprehensive user features
        features = await get_features_for_user(
            request.user_id,
            [
                "user_behavior:login_frequency",
                "user_behavior:calculation_count_30d",
                "user_behavior:avg_session_duration",
                "user_behavior:days_since_last_login",
                "user_behavior:support_tickets",
                "user_demographics:age",
                "user_demographics:income_bracket"
            ]
        )

        prediction_request = PredictionRequest(
            user_id=request.user_id,
            features=features,
            model_name="churn_prediction_model"
        )

        response = await predict(prediction_request, BackgroundTasks())

        churn_data = {
            "churn_probability": response.prediction,
            "risk_level": "high" if response.prediction > 0.7 else "medium" if response.prediction > 0.4 else "low",
            "key_factors": [
                {"factor": "login_frequency", "impact": "high"},
                {"factor": "days_since_last_login", "impact": "high"},
                {"factor": "calculation_count_30d", "impact": "medium"}
            ],
            "retention_recommendations": [
                "Send personalized tax tips",
                "Offer customer success call",
                "Provide premium trial"
            ],
            "model_version": response.model_version,
            "prediction_id": response.prediction_id
        }

        if request.include_features:
            churn_data["features_used"] = features

        return churn_data

    except Exception as e:
        logger.error(f"Churn prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/recommendations")
async def predict_recommendations(request: RecommendationRequest):
    """Get personalized content recommendations"""
    try:
        # Get user features for personalization
        features = await get_features_for_user(
            request.user_id,
            [
                "user_demographics:age",
                "user_demographics:income_bracket",
                "user_demographics:occupation",
                "user_behavior:features_used",
                "financial_behavior:investment_accounts"
            ]
        )

        features["content_type"] = request.content_type

        prediction_request = PredictionRequest(
            user_id=request.user_id,
            features=features,
            model_name="recommendation_model"
        )

        response = await predict(prediction_request, BackgroundTasks())

        # Generate recommendations based on prediction
        recommendations = [
            {
                "id": f"rec_{i}",
                "title": f"Tax Tip #{i+1}",
                "content_type": request.content_type,
                "relevance_score": float(np.random.beta(5, 2)),
                "category": np.random.choice(["deductions", "credits", "planning", "compliance"])
            }
            for i in range(request.limit)
        ]

        return {
            "recommendations": recommendations,
            "personalization_score": response.confidence,
            "model_version": response.model_version,
            "prediction_id": response.prediction_id
        }

    except Exception as e:
        logger.error(f"Recommendation prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/experiments/{experiment_id}")
async def create_experiment(experiment_id: str, models: Dict[str, float]):
    """Create A/B test experiment"""
    # Validate percentages sum to 100
    if sum(models.values()) != 100:
        raise HTTPException(status_code=400, detail="Model percentages must sum to 100")

    # Validate models exist
    for model_name in models.keys():
        if not model_registry.get_model(model_name):
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

    ab_test_manager.create_experiment(experiment_id, models)
    return {"message": f"Experiment {experiment_id} created successfully"}


@app.get("/experiments/{experiment_id}/stats")
async def get_experiment_stats(experiment_id: str):
    """Get A/B test experiment statistics"""
    stats = ab_test_manager.get_experiment_stats(experiment_id)
    if not stats:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return stats


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()


if __name__ == "__main__":
    uvicorn.run(
        "model_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        access_log=True
    )
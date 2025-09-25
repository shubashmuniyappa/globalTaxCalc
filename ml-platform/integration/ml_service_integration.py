"""
ML Service Integration Layer
Integration layer connecting ML models to the main GlobalTaxCalc application
"""

import sys
import os
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
import asyncio
import logging
from datetime import datetime, timedelta
import json
import redis
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
import uvicorn

# Add model directories to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'models'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'infrastructure'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'monitoring'))

from tax_optimization import TaxSavingsPredictor, DeductionRecommendationEngine
from user_behavior import ChurnPredictionModel, LifetimeValuePredictor
from personalization import ContentRecommendationEngine, PersonalizedTipsEngine, CalculatorSuggestionEngine
from anomaly_detection import FraudDetectionEngine, UnusualPatternDetector, TaxLawComplianceMonitor
from feature_store import GlobalTaxCalcFeatureStore
from model_monitor import ModelPerformanceMonitor, DataDriftDetector, ModelValidationFramework

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Pydantic models for API requests/responses
class UserProfile(BaseModel):
    user_id: int
    income: float
    age: int
    filing_status: str
    state: str
    has_dependents: bool = False
    is_business_owner: bool = False
    tax_experience_level: str = "beginner"
    owns_home: bool = False
    has_investments: bool = False


class TaxCalculationInput(BaseModel):
    user_id: int
    gross_income: float
    deductions: Dict[str, float] = Field(default_factory=dict)
    filing_status: str
    state: str
    dependents: int = 0
    business_income: float = 0
    investment_income: float = 0


class MLPredictionResponse(BaseModel):
    prediction: Any
    confidence: float
    explanation: str
    model_version: str
    timestamp: datetime


class RecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    personalization_score: float
    reasoning: List[str]


class FraudDetectionResponse(BaseModel):
    fraud_probability: float
    risk_level: str
    indicators: List[str]
    recommended_actions: List[str]


class MLServiceOrchestrator:
    """Central orchestrator for all ML services"""

    def __init__(self):
        self.models = {}
        self.feature_store = GlobalTaxCalcFeatureStore()
        self.performance_monitor = ModelPerformanceMonitor()
        self.drift_detector = DataDriftDetector()
        self.validator = ModelValidationFramework()

        # Redis for caching
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        except:
            logger.warning("Redis not available. Using in-memory cache.")
            self.redis_client = None

        self.cache = {}
        self._initialize_models()

    def _initialize_models(self):
        """Initialize all ML models"""
        try:
            # Tax optimization models
            self.models['tax_savings'] = TaxSavingsPredictor()
            self.models['deduction_engine'] = DeductionRecommendationEngine()

            # User behavior models
            self.models['churn_prediction'] = ChurnPredictionModel()
            self.models['ltv_prediction'] = LifetimeValuePredictor()

            # Personalization models
            self.models['content_recommendations'] = ContentRecommendationEngine()
            self.models['personalized_tips'] = PersonalizedTipsEngine()
            self.models['calculator_suggestions'] = CalculatorSuggestionEngine()

            # Anomaly detection models
            self.models['fraud_detection'] = FraudDetectionEngine()
            self.models['pattern_detector'] = UnusualPatternDetector()
            self.models['compliance_monitor'] = TaxLawComplianceMonitor()

            logger.info("All ML models initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing models: {e}")
            raise

    async def predict_tax_savings(self, calculation_input: TaxCalculationInput) -> MLPredictionResponse:
        """Predict potential tax savings"""
        try:
            start_time = datetime.now()

            # Prepare features
            features = await self._prepare_tax_features(calculation_input)

            # Get prediction
            model = self.models['tax_savings']
            prediction = model.predict_tax_savings(features)

            # Calculate confidence
            confidence = self._calculate_prediction_confidence(model, features, 'regression')

            # Generate explanation
            explanation = self._generate_tax_savings_explanation(features, prediction)

            # Record performance metrics
            prediction_time = (datetime.now() - start_time).total_seconds() * 1000
            await self._record_prediction_metrics('tax_savings', prediction_time)

            return MLPredictionResponse(
                prediction=float(prediction),
                confidence=confidence,
                explanation=explanation,
                model_version="1.0.0",
                timestamp=datetime.now()
            )

        except Exception as e:
            logger.error(f"Error in tax savings prediction: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_deduction_recommendations(self, calculation_input: TaxCalculationInput) -> RecommendationResponse:
        """Get personalized deduction recommendations"""
        try:
            # Prepare features
            features = await self._prepare_tax_features(calculation_input)

            # Get recommendations
            model = self.models['deduction_engine']
            recommendations = model.recommend_deductions(features)

            # Calculate personalization score
            personalization_score = self._calculate_personalization_score(features, recommendations)

            # Generate reasoning
            reasoning = self._generate_deduction_reasoning(features, recommendations)

            return RecommendationResponse(
                recommendations=recommendations,
                personalization_score=personalization_score,
                reasoning=reasoning
            )

        except Exception as e:
            logger.error(f"Error in deduction recommendations: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def predict_user_churn(self, user_profile: UserProfile) -> MLPredictionResponse:
        """Predict user churn probability"""
        try:
            start_time = datetime.now()

            # Get user features
            features = await self._get_user_behavior_features(user_profile.user_id)

            # Get prediction
            model = self.models['churn_prediction']
            churn_probability = model.predict_churn_probability(features)

            # Calculate confidence
            confidence = self._calculate_prediction_confidence(model, features, 'classification')

            # Generate explanation
            explanation = self._generate_churn_explanation(features, churn_probability)

            prediction_time = (datetime.now() - start_time).total_seconds() * 1000
            await self._record_prediction_metrics('churn_prediction', prediction_time)

            return MLPredictionResponse(
                prediction=float(churn_probability),
                confidence=confidence,
                explanation=explanation,
                model_version="1.0.0",
                timestamp=datetime.now()
            )

        except Exception as e:
            logger.error(f"Error in churn prediction: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def predict_lifetime_value(self, user_profile: UserProfile) -> MLPredictionResponse:
        """Predict customer lifetime value"""
        try:
            start_time = datetime.now()

            # Get user features
            features = await self._get_user_behavior_features(user_profile.user_id)

            # Get prediction
            model = self.models['ltv_prediction']
            ltv_prediction = model.predict_ltv(features)

            # Calculate confidence
            confidence = self._calculate_prediction_confidence(model, features, 'regression')

            # Generate explanation
            explanation = self._generate_ltv_explanation(features, ltv_prediction)

            prediction_time = (datetime.now() - start_time).total_seconds() * 1000
            await self._record_prediction_metrics('ltv_prediction', prediction_time)

            return MLPredictionResponse(
                prediction=float(ltv_prediction),
                confidence=confidence,
                explanation=explanation,
                model_version="1.0.0",
                timestamp=datetime.now()
            )

        except Exception as e:
            logger.error(f"Error in LTV prediction: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_content_recommendations(self, user_profile: UserProfile,
                                        context: Dict[str, Any] = None) -> RecommendationResponse:
        """Get personalized content recommendations"""
        try:
            # Convert user profile to dict
            profile_dict = user_profile.dict()

            # Get recommendations
            model = self.models['content_recommendations']
            recommendations = model.get_content_recommendations(
                user_profile.user_id,
                user_profile=profile_dict
            )

            # Calculate personalization score
            personalization_score = self._calculate_content_personalization_score(
                profile_dict, recommendations
            )

            # Generate reasoning
            reasoning = [rec.get('reason', 'Recommended based on your profile')
                        for rec in recommendations]

            return RecommendationResponse(
                recommendations=recommendations,
                personalization_score=personalization_score,
                reasoning=reasoning
            )

        except Exception as e:
            logger.error(f"Error in content recommendations: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_personalized_tips(self, user_profile: UserProfile) -> RecommendationResponse:
        """Get personalized tax tips"""
        try:
            # Get sample tips data (in production, this would come from a database)
            tips_data = self._get_sample_tips_data()

            # Convert user profile to dict
            profile_dict = user_profile.dict()

            # Get personalized tips
            model = self.models['personalized_tips']
            tips = model.get_personalized_tips(profile_dict, tips_data)

            # Calculate personalization score
            personalization_score = sum(tip['personalization_score'] for tip in tips) / len(tips)

            # Generate reasoning
            reasoning = [tip.get('reason', 'Personalized for your situation') for tip in tips]

            return RecommendationResponse(
                recommendations=tips,
                personalization_score=personalization_score,
                reasoning=reasoning
            )

        except Exception as e:
            logger.error(f"Error in personalized tips: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_calculator_suggestions(self, user_profile: UserProfile,
                                       context: Dict[str, Any] = None) -> RecommendationResponse:
        """Get calculator suggestions"""
        try:
            # Convert user profile to dict
            profile_dict = user_profile.dict()

            # Get calculator suggestions
            model = self.models['calculator_suggestions']
            suggestions = model.get_calculator_suggestions(profile_dict, context)

            # Calculate personalization score
            personalization_score = sum(sug['relevance_score'] for sug in suggestions) / len(suggestions)

            # Generate reasoning
            reasoning = [sug.get('reason', 'Relevant for your tax situation') for sug in suggestions]

            return RecommendationResponse(
                recommendations=suggestions,
                personalization_score=personalization_score,
                reasoning=reasoning
            )

        except Exception as e:
            logger.error(f"Error in calculator suggestions: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def detect_fraud(self, calculation_input: TaxCalculationInput) -> FraudDetectionResponse:
        """Detect potential fraud in tax calculation"""
        try:
            # Prepare features
            features = await self._prepare_fraud_detection_features(calculation_input)

            # Get fraud prediction
            model = self.models['fraud_detection']
            fraud_probability = model.predict_fraud_probability(features)

            # Get explanation
            explanation = model.get_fraud_explanation(calculation_input.dict())

            # Determine risk level
            if fraud_probability > 0.8:
                risk_level = "high"
            elif fraud_probability > 0.5:
                risk_level = "medium"
            else:
                risk_level = "low"

            # Generate recommended actions
            recommended_actions = self._generate_fraud_actions(risk_level, explanation)

            return FraudDetectionResponse(
                fraud_probability=float(fraud_probability[0]),
                risk_level=risk_level,
                indicators=explanation.get('fraud_indicators', []),
                recommended_actions=recommended_actions
            )

        except Exception as e:
            logger.error(f"Error in fraud detection: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def check_compliance(self, calculation_input: TaxCalculationInput) -> Dict[str, Any]:
        """Check tax law compliance"""
        try:
            # Convert to format expected by compliance monitor
            tax_data = self._convert_to_tax_data(calculation_input)

            # Check compliance
            model = self.models['compliance_monitor']
            compliance_result = model.check_compliance(tax_data)

            return compliance_result

        except Exception as e:
            logger.error(f"Error in compliance check: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # Helper methods
    async def _prepare_tax_features(self, calculation_input: TaxCalculationInput) -> pd.DataFrame:
        """Prepare features for tax optimization models"""
        features = {
            'gross_income': calculation_input.gross_income,
            'business_income': calculation_input.business_income,
            'investment_income': calculation_input.investment_income,
            'total_deductions': sum(calculation_input.deductions.values()),
            'filing_status': calculation_input.filing_status,
            'state': calculation_input.state,
            'dependents': calculation_input.dependents
        }

        # Add individual deduction types
        for deduction_type, amount in calculation_input.deductions.items():
            features[f'deduction_{deduction_type}'] = amount

        return pd.DataFrame([features])

    async def _get_user_behavior_features(self, user_id: int) -> pd.DataFrame:
        """Get user behavior features from feature store"""
        # In production, this would fetch from the feature store
        # For now, return sample features
        features = {
            'user_id': user_id,
            'days_since_last_login': np.random.randint(1, 30),
            'total_sessions': np.random.randint(10, 100),
            'avg_session_duration': np.random.uniform(5, 30),
            'calculations_completed': np.random.randint(1, 50),
            'premium_user': np.random.choice([0, 1]),
            'support_tickets': np.random.randint(0, 5),
            'feature_usage_diversity': np.random.uniform(0.1, 1.0)
        }

        return pd.DataFrame([features])

    async def _prepare_fraud_detection_features(self, calculation_input: TaxCalculationInput) -> pd.DataFrame:
        """Prepare features for fraud detection"""
        features = {
            'user_id': calculation_input.user_id,
            'gross_income': calculation_input.gross_income,
            'total_deductions': sum(calculation_input.deductions.values()),
            'business_income': calculation_input.business_income,
            'investment_income': calculation_input.investment_income,
            'filing_status': calculation_input.filing_status,
            'state': calculation_input.state,
            'dependents': calculation_input.dependents
        }

        return pd.DataFrame([features])

    def _calculate_prediction_confidence(self, model, features: pd.DataFrame, task_type: str) -> float:
        """Calculate prediction confidence"""
        # Simplified confidence calculation
        # In production, this would use model-specific uncertainty quantification
        base_confidence = 0.8

        # Adjust based on feature completeness
        feature_completeness = 1 - features.isnull().sum().sum() / (features.shape[0] * features.shape[1])
        confidence = base_confidence * feature_completeness

        return min(confidence, 0.95)

    def _calculate_personalization_score(self, features: pd.DataFrame, recommendations: List[Dict]) -> float:
        """Calculate personalization score for recommendations"""
        # Simplified scoring based on number of recommendations and feature matching
        base_score = 0.7
        rec_count_bonus = min(len(recommendations) * 0.05, 0.2)

        return min(base_score + rec_count_bonus, 1.0)

    def _calculate_content_personalization_score(self, profile: Dict, recommendations: List[Dict]) -> float:
        """Calculate content personalization score"""
        if not recommendations:
            return 0.0

        total_score = sum(rec.get('score', 0.5) for rec in recommendations)
        return total_score / len(recommendations)

    def _generate_tax_savings_explanation(self, features: pd.DataFrame, prediction: float) -> str:
        """Generate explanation for tax savings prediction"""
        income = features.iloc[0]['gross_income']
        deductions = features.iloc[0]['total_deductions']

        explanation = f"Based on your income of ${income:,.0f} and deductions of ${deductions:,.0f}, "
        explanation += f"we predict potential tax savings of ${prediction:,.0f}. "

        if prediction > income * 0.1:
            explanation += "This represents significant savings opportunity."
        else:
            explanation += "This represents moderate savings opportunity."

        return explanation

    def _generate_churn_explanation(self, features: pd.DataFrame, churn_prob: float) -> str:
        """Generate explanation for churn prediction"""
        days_since_login = features.iloc[0]['days_since_last_login']
        sessions = features.iloc[0]['total_sessions']

        explanation = f"Churn probability is {churn_prob:.1%}. "

        if days_since_login > 14:
            explanation += "Recent low activity is a risk factor. "
        if sessions < 20:
            explanation += "Limited engagement history increases risk. "

        return explanation

    def _generate_ltv_explanation(self, features: pd.DataFrame, ltv: float) -> str:
        """Generate explanation for LTV prediction"""
        premium_user = features.iloc[0]['premium_user']
        usage_diversity = features.iloc[0]['feature_usage_diversity']

        explanation = f"Predicted lifetime value is ${ltv:.0f}. "

        if premium_user:
            explanation += "Premium subscription indicates higher value potential. "
        if usage_diversity > 0.7:
            explanation += "High feature usage suggests strong engagement. "

        return explanation

    def _generate_deduction_reasoning(self, features: pd.DataFrame, recommendations: List[Dict]) -> List[str]:
        """Generate reasoning for deduction recommendations"""
        reasoning = []

        for rec in recommendations:
            deduction_type = rec.get('deduction_type', 'unknown')
            potential_savings = rec.get('potential_savings', 0)

            reasoning.append(
                f"{deduction_type.replace('_', ' ').title()} could save you ${potential_savings:.0f}"
            )

        return reasoning

    def _generate_fraud_actions(self, risk_level: str, explanation: Dict) -> List[str]:
        """Generate recommended actions for fraud detection"""
        actions = []

        if risk_level == "high":
            actions.extend([
                "Flag for manual review",
                "Request additional documentation",
                "Verify identity through secondary channels"
            ])
        elif risk_level == "medium":
            actions.extend([
                "Apply additional validation checks",
                "Monitor subsequent activity closely"
            ])
        else:
            actions.append("No immediate action required")

        return actions

    def _convert_to_tax_data(self, calculation_input: TaxCalculationInput) -> Dict[str, Any]:
        """Convert calculation input to tax data format for compliance checking"""
        return {
            'gross_income': calculation_input.gross_income,
            'adjusted_gross_income': calculation_input.gross_income - sum(calculation_input.deductions.values()),
            'total_deductions': sum(calculation_input.deductions.values()),
            'business_income': calculation_input.business_income,
            'investment_income': calculation_input.investment_income,
            'filing_status': calculation_input.filing_status,
            'number_of_dependents': calculation_input.dependents
        }

    def _get_sample_tips_data(self) -> pd.DataFrame:
        """Get sample tips data (in production, this would come from database)"""
        tips_data = [
            {
                'tip_id': 1,
                'title': 'Maximize Your 401(k) Contributions',
                'content': 'Contributing to your 401(k) can significantly reduce your taxable income...',
                'category': 'retirement',
                'complexity_level': 'beginner',
                'avg_savings_amount': 2000,
                'applicable_income_ranges': '30000-150000',
                'applicable_filing_statuses': 'all',
                'general_applicability': 0.8
            },
            {
                'tip_id': 2,
                'title': 'Home Office Deduction for Remote Workers',
                'content': 'If you work from home, you may be eligible for home office deductions...',
                'category': 'business',
                'complexity_level': 'intermediate',
                'avg_savings_amount': 1200,
                'applicable_income_ranges': '25000-100000',
                'applicable_filing_statuses': 'all',
                'general_applicability': 0.6
            }
        ]

        return pd.DataFrame(tips_data)

    async def _record_prediction_metrics(self, model_name: str, prediction_time: float):
        """Record prediction metrics for monitoring"""
        try:
            # This would integrate with the monitoring system
            metric_data = {
                'model_name': model_name,
                'prediction_time': prediction_time,
                'timestamp': datetime.now().isoformat()
            }

            if self.redis_client:
                key = f"prediction_metrics:{model_name}:{datetime.now().strftime('%Y%m%d')}"
                self.redis_client.lpush(key, json.dumps(metric_data))
                self.redis_client.expire(key, 86400)  # Expire after 24 hours

        except Exception as e:
            logger.error(f"Error recording prediction metrics: {e}")


# FastAPI application
app = FastAPI(title="GlobalTaxCalc ML Service", version="1.0.0")

# Initialize ML orchestrator
ml_orchestrator = MLServiceOrchestrator()


@app.post("/predict/tax-savings", response_model=MLPredictionResponse)
async def predict_tax_savings(calculation_input: TaxCalculationInput):
    """Predict potential tax savings"""
    return await ml_orchestrator.predict_tax_savings(calculation_input)


@app.post("/recommend/deductions", response_model=RecommendationResponse)
async def recommend_deductions(calculation_input: TaxCalculationInput):
    """Get deduction recommendations"""
    return await ml_orchestrator.get_deduction_recommendations(calculation_input)


@app.post("/predict/churn", response_model=MLPredictionResponse)
async def predict_churn(user_profile: UserProfile):
    """Predict user churn probability"""
    return await ml_orchestrator.predict_user_churn(user_profile)


@app.post("/predict/ltv", response_model=MLPredictionResponse)
async def predict_ltv(user_profile: UserProfile):
    """Predict customer lifetime value"""
    return await ml_orchestrator.predict_lifetime_value(user_profile)


@app.post("/recommend/content", response_model=RecommendationResponse)
async def recommend_content(user_profile: UserProfile, context: Optional[Dict[str, Any]] = None):
    """Get content recommendations"""
    return await ml_orchestrator.get_content_recommendations(user_profile, context)


@app.post("/recommend/tips", response_model=RecommendationResponse)
async def recommend_tips(user_profile: UserProfile):
    """Get personalized tax tips"""
    return await ml_orchestrator.get_personalized_tips(user_profile)


@app.post("/recommend/calculators", response_model=RecommendationResponse)
async def recommend_calculators(user_profile: UserProfile, context: Optional[Dict[str, Any]] = None):
    """Get calculator suggestions"""
    return await ml_orchestrator.get_calculator_suggestions(user_profile, context)


@app.post("/detect/fraud", response_model=FraudDetectionResponse)
async def detect_fraud(calculation_input: TaxCalculationInput):
    """Detect potential fraud"""
    return await ml_orchestrator.detect_fraud(calculation_input)


@app.post("/check/compliance")
async def check_compliance(calculation_input: TaxCalculationInput):
    """Check tax law compliance"""
    return await ml_orchestrator.check_compliance(calculation_input)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now()}


@app.get("/models/status")
async def models_status():
    """Get status of all ML models"""
    status = {}
    for model_name, model in ml_orchestrator.models.items():
        status[model_name] = {
            "loaded": True,
            "type": type(model).__name__,
            "last_update": datetime.now().isoformat()
        }
    return status


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
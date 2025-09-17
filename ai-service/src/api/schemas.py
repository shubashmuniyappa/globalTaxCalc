from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from datetime import datetime


class FilingStatusEnum(str, Enum):
    single = "single"
    married_filing_jointly = "marriedFilingJointly"
    married_filing_separately = "marriedFilingSeparately"
    head_of_household = "headOfHousehold"


class OptimizationCategoryEnum(str, Enum):
    deductions = "deductions"
    retirement = "retirement"
    tax_credits = "tax_credits"
    income_timing = "income_timing"
    business_expenses = "business_expenses"
    education = "education"
    healthcare = "healthcare"
    charitable_giving = "charitable_giving"


class QuestionCategoryEnum(str, Enum):
    deductions = "deductions"
    credits = "credits"
    filing_status = "filing_status"
    income = "income"
    retirement = "retirement"
    business = "business"
    education = "education"
    healthcare = "healthcare"
    investment = "investment"
    general = "general"


# Request Schemas
class ParseTextRequest(BaseModel):
    text: str = Field(..., description="Natural language text to parse", min_length=1, max_length=1000)
    enhance_with_ai: bool = Field(True, description="Use AI to enhance parsing results")

    @validator('text')
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError("Text cannot be empty")
        return v.strip()


class VoiceToTextRequest(BaseModel):
    language: str = Field("en", description="Language code for transcription")
    enhance_audio: bool = Field(True, description="Apply audio enhancement")

    @validator('language')
    def validate_language(cls, v):
        allowed_languages = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko"]
        if v not in allowed_languages:
            raise ValueError(f"Language must be one of: {', '.join(allowed_languages)}")
        return v


class OptimizationRequest(BaseModel):
    income: Optional[float] = Field(None, description="Annual income", ge=0, le=10000000)
    filing_status: Optional[FilingStatusEnum] = Field(None, description="Tax filing status")
    dependents: int = Field(0, description="Number of dependents", ge=0, le=20)
    state: Optional[str] = Field(None, description="US state code", min_length=2, max_length=2)
    country: str = Field("US", description="Country code")
    age: Optional[int] = Field(None, description="Age", ge=18, le=100)
    spouse_income: Optional[float] = Field(None, description="Spouse income", ge=0, le=10000000)
    deductions: List[Dict[str, Any]] = Field(default_factory=list, description="Current deductions")
    retirement_contributions: Optional[float] = Field(None, description="Current retirement contributions", ge=0)
    student_loan_interest: Optional[float] = Field(None, description="Student loan interest paid", ge=0)
    mortgage_interest: Optional[float] = Field(None, description="Mortgage interest paid", ge=0)
    charitable_donations: Optional[float] = Field(None, description="Charitable donations", ge=0)
    medical_expenses: Optional[float] = Field(None, description="Medical expenses", ge=0)
    business_income: Optional[float] = Field(None, description="Business income", ge=0)
    preferences: Dict[str, Any] = Field(default_factory=dict, description="User preferences for optimization")


class TaxQuestionRequest(BaseModel):
    question: str = Field(..., description="Tax question to answer", min_length=3, max_length=500)
    user_context: Optional[OptimizationRequest] = Field(None, description="User context for personalization")
    conversation_history: List[Dict[str, str]] = Field(default_factory=list, description="Previous conversation")

    @validator('question')
    def validate_question(cls, v):
        if not v.strip():
            raise ValueError("Question cannot be empty")
        return v.strip()

    @validator('conversation_history')
    def validate_conversation_history(cls, v):
        if len(v) > 10:  # Limit conversation history
            return v[-10:]  # Keep only last 10 exchanges
        return v


# Response Schemas
class ParsedTaxInfoResponse(BaseModel):
    income: Optional[float] = Field(None, description="Extracted annual income")
    filing_status: Optional[FilingStatusEnum] = Field(None, description="Extracted filing status")
    dependents: int = Field(0, description="Number of dependents")
    state: Optional[str] = Field(None, description="US state code")
    country: str = Field("US", description="Country code")
    age: Optional[int] = Field(None, description="Age")
    spouse_income: Optional[float] = Field(None, description="Spouse income")
    deductions: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted deductions")
    retirement_contributions: Optional[float] = Field(None, description="Retirement contributions")
    student_loan_interest: Optional[float] = Field(None, description="Student loan interest")
    mortgage_interest: Optional[float] = Field(None, description="Mortgage interest")
    charitable_donations: Optional[float] = Field(None, description="Charitable donations")
    medical_expenses: Optional[float] = Field(None, description="Medical expenses")
    business_income: Optional[float] = Field(None, description="Business income")
    confidence_score: float = Field(..., description="Confidence in parsing results", ge=0.0, le=1.0)
    raw_text: str = Field(..., description="Original input text")
    extracted_entities: List[Dict[str, Any]] = Field(default_factory=list, description="NLP entities")
    validation: Dict[str, Any] = Field(default_factory=dict, description="Validation results")


class VoiceTranscriptionResponse(BaseModel):
    text: str = Field(..., description="Transcribed text")
    confidence_score: float = Field(..., description="Transcription confidence", ge=0.0, le=1.0)
    language: str = Field(..., description="Detected/specified language")
    cleaned_text: str = Field(..., description="Cleaned and improved text")
    segments: List[Dict[str, Any]] = Field(default_factory=list, description="Transcription segments")
    duration: Optional[float] = Field(None, description="Audio duration in seconds")
    processing_time: Optional[float] = Field(None, description="Processing time in seconds")
    no_speech_detected: bool = Field(False, description="Whether speech was detected")
    error: Optional[str] = Field(None, description="Error message if transcription failed")


class OptimizationSuggestionResponse(BaseModel):
    id: str = Field(..., description="Unique suggestion ID")
    category: OptimizationCategoryEnum = Field(..., description="Suggestion category")
    title: str = Field(..., description="Suggestion title")
    description: str = Field(..., description="Detailed description")
    potential_savings: float = Field(..., description="Estimated tax savings", ge=0)
    confidence: float = Field(..., description="Confidence in suggestion", ge=0.0, le=1.0)
    priority: int = Field(..., description="Priority level (1-5)", ge=1, le=5)
    required_actions: List[str] = Field(..., description="Required actions to implement")
    deadlines: List[str] = Field(default_factory=list, description="Important deadlines")
    applicable_tax_years: List[int] = Field(..., description="Applicable tax years")
    legal_references: List[str] = Field(default_factory=list, description="Tax code references")
    estimated_effort: str = Field(..., description="Implementation effort level")
    eligibility_requirements: List[str] = Field(default_factory=list, description="Eligibility requirements")
    risks: List[str] = Field(default_factory=list, description="Potential risks")
    additional_info: Dict[str, Any] = Field(default_factory=dict, description="Additional information")


class OptimizationResponse(BaseModel):
    suggestions: List[OptimizationSuggestionResponse] = Field(..., description="Optimization suggestions")
    total_potential_savings: float = Field(..., description="Total potential savings", ge=0)
    analysis_summary: str = Field(..., description="Summary of analysis")
    user_profile_summary: str = Field(..., description="Summary of user profile")
    generated_at: datetime = Field(default_factory=datetime.now, description="Generation timestamp")
    processing_time: float = Field(..., description="Processing time in seconds")


class QAResponse(BaseModel):
    answer: str = Field(..., description="Answer to the question")
    confidence: float = Field(..., description="Confidence in answer", ge=0.0, le=1.0)
    category: QuestionCategoryEnum = Field(..., description="Question category")
    sources: List[str] = Field(default_factory=list, description="Information sources")
    related_questions: List[str] = Field(default_factory=list, description="Related questions")
    tax_code_references: List[str] = Field(default_factory=list, description="Tax code references")
    disclaimer: str = Field(..., description="Legal disclaimer")
    follow_up_suggestions: List[str] = Field(default_factory=list, description="Follow-up suggestions")
    personalized: bool = Field(False, description="Whether answer was personalized")
    processing_time: float = Field(..., description="Processing time in seconds")


class ServiceHealthResponse(BaseModel):
    status: str = Field(..., description="Service status")
    model_status: Dict[str, Any] = Field(..., description="AI model status")
    services: Dict[str, Dict[str, Any]] = Field(..., description="Individual service status")
    uptime: float = Field(..., description="Service uptime in seconds")
    version: str = Field(..., description="Service version")
    last_updated: datetime = Field(default_factory=datetime.now, description="Last health check")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    error_code: str = Field(..., description="Error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.now, description="Error timestamp")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")


class SuccessResponse(BaseModel):
    success: bool = Field(True, description="Success status")
    message: str = Field(..., description="Success message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")


# Additional utility schemas
class ModelInfoResponse(BaseModel):
    loaded_models: List[str] = Field(..., description="Currently loaded models")
    device: str = Field(..., description="Device being used (CPU/GPU)")
    memory_usage: Dict[str, Any] = Field(..., description="Memory usage information")
    model_count: int = Field(..., description="Number of loaded models")
    cuda_available: bool = Field(..., description="CUDA availability")


class SupportedFormatsResponse(BaseModel):
    audio_formats: List[str] = Field(..., description="Supported audio formats")
    max_duration_seconds: int = Field(..., description="Maximum audio duration")
    max_file_size_mb: int = Field(..., description="Maximum file size")
    recommended_format: str = Field(..., description="Recommended audio format")
    recommended_sample_rate: int = Field(..., description="Recommended sample rate")


class QuestionSuggestionsResponse(BaseModel):
    suggestions: List[str] = Field(..., description="Suggested questions")
    categories: List[str] = Field(..., description="Available question categories")
    personalized: bool = Field(False, description="Whether suggestions are personalized")
    user_context_used: bool = Field(False, description="Whether user context was used")
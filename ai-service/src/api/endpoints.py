import asyncio
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
import uuid

from src.api.schemas import (
    ParseTextRequest, ParsedTaxInfoResponse,
    VoiceToTextRequest, VoiceTranscriptionResponse,
    OptimizationRequest, OptimizationResponse,
    TaxQuestionRequest, QAResponse,
    ServiceHealthResponse, ErrorResponse, SuccessResponse,
    ModelInfoResponse, SupportedFormatsResponse, QuestionSuggestionsResponse
)
from src.services import (
    nlp_service, voice_service, optimization_service, qa_service, ParsedTaxInfo
)
from src.models import get_model_manager
from src.core import api_logger
from src.config import settings

router = APIRouter()


# Helper functions
def create_error_response(message: str, error_code: str = "INTERNAL_ERROR", details: Optional[Dict[str, Any]] = None):
    """Create standardized error response."""
    return JSONResponse(
        status_code=400 if error_code.startswith("VALIDATION") else 500,
        content=ErrorResponse(
            error=message,
            error_code=error_code,
            details=details,
            request_id=str(uuid.uuid4())
        ).dict()
    )


def convert_parsed_info_to_optimization_request(parsed_info: ParsedTaxInfo) -> OptimizationRequest:
    """Convert ParsedTaxInfo to OptimizationRequest for optimization service."""
    return OptimizationRequest(
        income=parsed_info.income,
        filing_status=parsed_info.filing_status.value if parsed_info.filing_status else None,
        dependents=parsed_info.dependents,
        state=parsed_info.state,
        country=parsed_info.country or "US",
        spouse_income=parsed_info.spouse_income,
        deductions=parsed_info.deductions or [],
        retirement_contributions=parsed_info.retirement_contributions,
        student_loan_interest=parsed_info.student_loan_interest,
        mortgage_interest=parsed_info.mortgage_interest,
        charitable_donations=parsed_info.charitable_donations,
        medical_expenses=parsed_info.medical_expenses,
        business_income=parsed_info.business_income
    )


# Parse Text Endpoint
@router.post("/parse-text", response_model=ParsedTaxInfoResponse)
async def parse_text(request: ParseTextRequest):
    """Parse natural language text to extract tax information."""
    try:
        start_time = time.time()
        api_logger.info("Parse text request received", text_length=len(request.text))

        # Parse the text using NLP service
        parsed_info = await nlp_service.parse_tax_input(request.text)

        # Validate the parsing results
        validation = await nlp_service.validate_parsing_result(parsed_info)

        # Convert to response format
        response = ParsedTaxInfoResponse(
            income=parsed_info.income,
            filing_status=parsed_info.filing_status.value if parsed_info.filing_status else None,
            dependents=parsed_info.dependents,
            state=parsed_info.state,
            country=parsed_info.country or "US",
            age=parsed_info.age,
            spouse_income=parsed_info.spouse_income,
            deductions=parsed_info.deductions or [],
            retirement_contributions=parsed_info.retirement_contributions,
            student_loan_interest=parsed_info.student_loan_interest,
            mortgage_interest=parsed_info.mortgage_interest,
            charitable_donations=parsed_info.charitable_donations,
            medical_expenses=parsed_info.medical_expenses,
            business_income=parsed_info.business_income,
            confidence_score=parsed_info.confidence_score,
            raw_text=parsed_info.raw_text,
            extracted_entities=parsed_info.extracted_entities or [],
            validation=validation
        )

        processing_time = time.time() - start_time
        api_logger.info("Parse text completed", processing_time=processing_time, confidence=response.confidence_score)

        return response

    except Exception as e:
        api_logger.error("Parse text failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to parse text: {str(e)}")


# Voice to Text Endpoint
@router.post("/voice-to-text", response_model=VoiceTranscriptionResponse)
async def voice_to_text(
    audio_file: UploadFile = File(...),
    language: str = "en",
    enhance_audio: bool = True
):
    """Convert voice audio to text."""
    try:
        start_time = time.time()
        api_logger.info("Voice to text request received", filename=audio_file.filename, language=language)

        # Validate file
        if not audio_file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        # Check file size (100MB limit)
        content = await audio_file.read()
        if len(content) > 100 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 100MB)")

        await audio_file.seek(0)  # Reset file pointer

        # Transcribe audio
        result = await voice_service.transcribe_audio_file(
            audio_file.file,
            audio_file.filename,
            language=language
        )

        processing_time = time.time() - start_time

        response = VoiceTranscriptionResponse(
            text=result.get("text", ""),
            confidence_score=result.get("confidence_score", 0.0),
            language=result.get("language", language),
            cleaned_text=result.get("cleaned_text", result.get("text", "")),
            segments=result.get("segments", []),
            duration=result.get("duration"),
            processing_time=processing_time,
            no_speech_detected=result.get("no_speech_detected", False),
            error=result.get("error")
        )

        api_logger.info("Voice to text completed",
                       processing_time=processing_time,
                       confidence=response.confidence_score,
                       text_length=len(response.text))

        return response

    except HTTPException:
        raise
    except Exception as e:
        api_logger.error("Voice to text failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")


# Tax Optimization Endpoint
@router.post("/optimize", response_model=OptimizationResponse)
async def get_optimization_suggestions(request: OptimizationRequest):
    """Get personalized tax optimization suggestions."""
    try:
        start_time = time.time()
        api_logger.info("Optimization request received", income=request.income, filing_status=request.filing_status)

        # Convert request to ParsedTaxInfo
        parsed_info = ParsedTaxInfo(
            income=request.income,
            filing_status=request.filing_status,
            dependents=request.dependents,
            state=request.state,
            country=request.country,
            age=request.age,
            spouse_income=request.spouse_income,
            deductions=request.deductions,
            retirement_contributions=request.retirement_contributions,
            student_loan_interest=request.student_loan_interest,
            mortgage_interest=request.mortgage_interest,
            charitable_donations=request.charitable_donations,
            medical_expenses=request.medical_expenses,
            business_income=request.business_income,
            confidence_score=0.95  # High confidence for direct input
        )

        # Generate optimization suggestions
        suggestions = await optimization_service.generate_optimization_suggestions(
            parsed_info,
            user_preferences=request.preferences
        )

        # Calculate total potential savings
        total_savings = sum(s.potential_savings for s in suggestions)

        # Create user profile summary
        profile_parts = []
        if request.income:
            profile_parts.append(f"Income: ${request.income:,.0f}")
        if request.filing_status:
            profile_parts.append(f"Filing Status: {request.filing_status}")
        if request.dependents > 0:
            profile_parts.append(f"Dependents: {request.dependents}")
        if request.state:
            profile_parts.append(f"State: {request.state}")

        user_profile_summary = ", ".join(profile_parts) if profile_parts else "Basic profile"

        # Create analysis summary
        analysis_summary = f"Generated {len(suggestions)} optimization suggestions with potential savings of ${total_savings:,.0f}."
        if suggestions:
            top_category = max(set(s.category for s in suggestions), key=lambda cat: len([s for s in suggestions if s.category == cat]))
            analysis_summary += f" Primary focus area: {top_category.value.replace('_', ' ').title()}."

        processing_time = time.time() - start_time

        response = OptimizationResponse(
            suggestions=[
                OptimizationSuggestionResponse(
                    id=s.id,
                    category=s.category.value,
                    title=s.title,
                    description=s.description,
                    potential_savings=s.potential_savings,
                    confidence=s.confidence,
                    priority=s.priority,
                    required_actions=s.required_actions,
                    deadlines=s.deadlines,
                    applicable_tax_years=s.applicable_tax_years,
                    legal_references=s.legal_references,
                    estimated_effort=s.estimated_effort,
                    eligibility_requirements=s.eligibility_requirements,
                    risks=s.risks,
                    additional_info=s.additional_info
                ) for s in suggestions
            ],
            total_potential_savings=total_savings,
            analysis_summary=analysis_summary,
            user_profile_summary=user_profile_summary,
            processing_time=processing_time
        )

        api_logger.info("Optimization completed",
                       processing_time=processing_time,
                       suggestions_count=len(suggestions),
                       total_savings=total_savings)

        return response

    except Exception as e:
        api_logger.error("Optimization failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to generate optimization suggestions: {str(e)}")


# Tax Q&A Endpoint
@router.post("/ask", response_model=QAResponse)
async def ask_tax_question(request: TaxQuestionRequest):
    """Answer tax questions with AI assistance."""
    try:
        start_time = time.time()
        api_logger.info("Tax question received", question_length=len(request.question))

        # Convert user context if provided
        user_context = None
        if request.user_context:
            user_context = ParsedTaxInfo(
                income=request.user_context.income,
                filing_status=request.user_context.filing_status,
                dependents=request.user_context.dependents,
                state=request.user_context.state,
                country=request.user_context.country,
                age=request.user_context.age,
                spouse_income=request.user_context.spouse_income,
                deductions=request.user_context.deductions,
                retirement_contributions=request.user_context.retirement_contributions,
                student_loan_interest=request.user_context.student_loan_interest,
                mortgage_interest=request.user_context.mortgage_interest,
                charitable_donations=request.user_context.charitable_donations,
                medical_expenses=request.user_context.medical_expenses,
                business_income=request.user_context.business_income,
                confidence_score=0.95
            )

        # Get answer from Q&A service
        qa_response = await qa_service.answer_tax_question(
            request.question,
            user_context=user_context,
            conversation_history=request.conversation_history
        )

        processing_time = time.time() - start_time

        response = QAResponse(
            answer=qa_response.answer,
            confidence=qa_response.confidence,
            category=qa_response.category.value,
            sources=qa_response.sources,
            related_questions=qa_response.related_questions,
            tax_code_references=qa_response.tax_code_references,
            disclaimer=qa_response.disclaimer,
            follow_up_suggestions=qa_response.follow_up_suggestions,
            personalized=user_context is not None,
            processing_time=processing_time
        )

        api_logger.info("Tax question answered",
                       processing_time=processing_time,
                       confidence=response.confidence,
                       category=response.category)

        return response

    except Exception as e:
        api_logger.error("Tax Q&A failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")


# Health Check Endpoint
@router.get("/health", response_model=ServiceHealthResponse)
async def health_check():
    """Check the health of the AI service and its components."""
    try:
        start_time = time.time()

        # Check model manager status
        model_manager = get_model_manager()
        model_info = model_manager.get_model_info()

        # Check individual services
        services_status = {}

        # Check NLP service
        try:
            if nlp_service.nlp is not None:
                services_status["nlp"] = {"status": "healthy", "initialized": True}
            else:
                services_status["nlp"] = {"status": "degraded", "initialized": False}
        except Exception as e:
            services_status["nlp"] = {"status": "unhealthy", "error": str(e)}

        # Check voice service
        services_status["voice"] = await voice_service.health_check()

        # Check optimization service
        services_status["optimization"] = {"status": "healthy", "ready": True}

        # Check Q&A service
        services_status["qa"] = {"status": "healthy", "ready": True}

        # Determine overall status
        all_healthy = all(
            service.get("status") == "healthy"
            for service in services_status.values()
        )
        overall_status = "healthy" if all_healthy else "degraded"

        uptime = time.time() - start_time  # Simplified uptime

        response = ServiceHealthResponse(
            status=overall_status,
            model_status=model_info,
            services=services_status,
            uptime=uptime,
            version=settings.app_version
        )

        return response

    except Exception as e:
        api_logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


# Model Information Endpoint
@router.get("/model-info", response_model=ModelInfoResponse)
async def get_model_info():
    """Get information about loaded AI models."""
    try:
        model_manager = get_model_manager()
        info = model_manager.get_model_info()

        return ModelInfoResponse(
            loaded_models=info["loaded_models"],
            device=info["device"],
            memory_usage=info["memory_usage"],
            model_count=info["model_count"],
            cuda_available=info["cuda_available"]
        )

    except Exception as e:
        api_logger.error("Model info request failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


# Supported Formats Endpoint
@router.get("/supported-formats", response_model=SupportedFormatsResponse)
async def get_supported_formats():
    """Get information about supported audio formats for voice processing."""
    try:
        formats_info = await voice_service.get_supported_formats()

        return SupportedFormatsResponse(
            audio_formats=formats_info["supported_formats"],
            max_duration_seconds=formats_info["max_duration_seconds"],
            max_file_size_mb=formats_info["max_file_size_mb"],
            recommended_format=formats_info["recommended_format"],
            recommended_sample_rate=formats_info["recommended_sample_rate"]
        )

    except Exception as e:
        api_logger.error("Supported formats request failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get supported formats: {str(e)}")


# Question Suggestions Endpoint
@router.get("/question-suggestions", response_model=QuestionSuggestionsResponse)
async def get_question_suggestions(
    income: Optional[float] = None,
    filing_status: Optional[str] = None,
    dependents: Optional[int] = None,
    state: Optional[str] = None
):
    """Get suggested tax questions based on user context."""
    try:
        # Create user context if parameters provided
        user_context = None
        if any([income, filing_status, dependents, state]):
            user_context = ParsedTaxInfo(
                income=income,
                filing_status=filing_status,
                dependents=dependents or 0,
                state=state,
                confidence_score=0.8
            )

        # Get suggestions
        suggestions = await qa_service.get_question_suggestions(user_context)

        return QuestionSuggestionsResponse(
            suggestions=suggestions,
            categories=[cat.value for cat in qa_service.classification_patterns.keys()],
            personalized=user_context is not None,
            user_context_used=user_context is not None
        )

    except Exception as e:
        api_logger.error("Question suggestions request failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get question suggestions: {str(e)}")


# Initialize Services Endpoint
@router.post("/initialize", response_model=SuccessResponse)
async def initialize_services(background_tasks: BackgroundTasks):
    """Initialize AI services (can be called on startup)."""
    try:
        api_logger.info("Initializing AI services")

        # Initialize services in background
        async def init_services():
            try:
                await nlp_service.initialize()
                await voice_service.initialize()
                api_logger.info("AI services initialized successfully")
            except Exception as e:
                api_logger.error("Failed to initialize AI services", error=str(e))

        background_tasks.add_task(init_services)

        return SuccessResponse(
            message="AI services initialization started",
            data={"status": "initializing"}
        )

    except Exception as e:
        api_logger.error("Service initialization request failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to start initialization: {str(e)}")
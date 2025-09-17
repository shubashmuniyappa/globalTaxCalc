import asyncio
import time
import re
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import json
import hashlib

from src.core import ai_logger
from src.config import settings


class ResponseQuality(Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    POOR = "poor"
    UNACCEPTABLE = "unacceptable"


class ValidationRule(Enum):
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    CONFIDENCE_THRESHOLD = "confidence_threshold"
    CONTAINS_REQUIRED_INFO = "contains_required_info"
    NO_HARMFUL_CONTENT = "no_harmful_content"
    TAX_ACCURACY = "tax_accuracy"
    RESPONSE_TIME = "response_time"


@dataclass
class QualityMetrics:
    """Quality metrics for AI responses."""
    confidence: float
    accuracy_score: float
    completeness_score: float
    relevance_score: float
    response_time: float
    text_quality_score: float
    overall_quality: ResponseQuality
    validation_results: Dict[ValidationRule, bool]
    warnings: List[str]
    suggestions: List[str]


class ResponseQualityController:
    """Controls and validates the quality of AI responses."""

    def __init__(self):
        self.validation_rules = self._initialize_validation_rules()
        self.quality_history = []
        self.response_cache = {}

        # Harmful content patterns (basic)
        self.harmful_patterns = [
            r'\btax\s+evasion\b',
            r'\bavoid\s+paying\s+taxes\b',
            r'\bhide\s+income\b',
            r'\bfake\s+deductions?\b',
            r'\billegal\s+tax\s+shelter\b',
            r'\bfraud(?:ulent)?\s+(?:claim|deduction)\b'
        ]

        # Quality indicators
        self.quality_indicators = {
            'positive': [
                r'\bIRC\s+Section\s+\d+',  # Tax code references
                r'\b(?:consult|contact)\s+(?:a\s+)?(?:tax\s+)?professional\b',  # Professional advice
                r'\bfor\s+\d{4}\s+tax\s+year\b',  # Year-specific info
                r'\b(?:generally|typically|usually)\b',  # Appropriate hedging
                r'\b(?:may|might|could)\s+be\s+eligible\b'  # Cautious language
            ],
            'negative': [
                r'\bI\s+(?:think|believe|guess)\b',  # Uncertain language
                r'\b(?:always|never)\s+(?:deductible|eligible)\b',  # Absolute statements
                r'\byou\s+should\s+definitely\b',  # Overly definitive
                r'\b(?:guaranteed|certain|100%)\b',  # False certainty
                r'\bI\s+am\s+not\s+sure\b'  # Uncertainty admission
            ]
        }

    def _initialize_validation_rules(self) -> Dict[ValidationRule, Dict[str, Any]]:
        """Initialize validation rules for different response types."""
        return {
            ValidationRule.MIN_LENGTH: {
                "threshold": 10,
                "description": "Response must have minimum length"
            },
            ValidationRule.MAX_LENGTH: {
                "threshold": 2000,
                "description": "Response must not exceed maximum length"
            },
            ValidationRule.CONFIDENCE_THRESHOLD: {
                "threshold": 0.3,
                "description": "Response confidence must meet minimum threshold"
            },
            ValidationRule.RESPONSE_TIME: {
                "threshold": settings.max_response_time,
                "description": "Response time must be within acceptable limits"
            },
            ValidationRule.NO_HARMFUL_CONTENT: {
                "enabled": True,
                "description": "Response must not contain harmful tax advice"
            },
            ValidationRule.TAX_ACCURACY: {
                "enabled": True,
                "description": "Response must contain accurate tax information"
            }
        }

    async def validate_response(
        self,
        response: str,
        response_type: str,
        confidence: float,
        processing_time: float,
        context: Optional[Dict[str, Any]] = None
    ) -> QualityMetrics:
        """Validate and score the quality of an AI response."""
        try:
            ai_logger.info("Validating response quality",
                         response_type=response_type,
                         response_length=len(response),
                         confidence=confidence)

            # Initialize validation results
            validation_results = {}
            warnings = []
            suggestions = []

            # Run validation rules
            validation_results[ValidationRule.MIN_LENGTH] = len(response.strip()) >= self.validation_rules[ValidationRule.MIN_LENGTH]["threshold"]
            if not validation_results[ValidationRule.MIN_LENGTH]:
                warnings.append("Response is too short")

            validation_results[ValidationRule.MAX_LENGTH] = len(response) <= self.validation_rules[ValidationRule.MAX_LENGTH]["threshold"]
            if not validation_results[ValidationRule.MAX_LENGTH]:
                warnings.append("Response is too long")

            validation_results[ValidationRule.CONFIDENCE_THRESHOLD] = confidence >= self.validation_rules[ValidationRule.CONFIDENCE_THRESHOLD]["threshold"]
            if not validation_results[ValidationRule.CONFIDENCE_THRESHOLD]:
                warnings.append(f"Low confidence score: {confidence:.2f}")

            validation_results[ValidationRule.RESPONSE_TIME] = processing_time <= self.validation_rules[ValidationRule.RESPONSE_TIME]["threshold"]
            if not validation_results[ValidationRule.RESPONSE_TIME]:
                warnings.append(f"Slow response time: {processing_time:.2f}s")

            # Check for harmful content
            validation_results[ValidationRule.NO_HARMFUL_CONTENT] = not self._contains_harmful_content(response)
            if not validation_results[ValidationRule.NO_HARMFUL_CONTENT]:
                warnings.append("Response may contain inappropriate tax advice")

            # Check tax accuracy indicators
            validation_results[ValidationRule.TAX_ACCURACY] = self._check_tax_accuracy(response)
            if not validation_results[ValidationRule.TAX_ACCURACY]:
                suggestions.append("Consider adding tax code references or professional advice disclaimer")

            # Calculate quality scores
            accuracy_score = self._calculate_accuracy_score(response, response_type)
            completeness_score = self._calculate_completeness_score(response, context)
            relevance_score = self._calculate_relevance_score(response, context)
            text_quality_score = self._calculate_text_quality_score(response)

            # Calculate overall quality
            overall_quality = self._calculate_overall_quality(
                confidence, accuracy_score, completeness_score,
                relevance_score, text_quality_score, validation_results
            )

            # Generate additional suggestions
            suggestions.extend(self._generate_improvement_suggestions(response, validation_results))

            # Create quality metrics
            metrics = QualityMetrics(
                confidence=confidence,
                accuracy_score=accuracy_score,
                completeness_score=completeness_score,
                relevance_score=relevance_score,
                response_time=processing_time,
                text_quality_score=text_quality_score,
                overall_quality=overall_quality,
                validation_results=validation_results,
                warnings=warnings,
                suggestions=suggestions
            )

            # Log quality metrics
            self._log_quality_metrics(metrics, response_type)

            # Store in history
            self.quality_history.append({
                "timestamp": time.time(),
                "response_type": response_type,
                "metrics": metrics,
                "response_length": len(response)
            })

            # Limit history size
            if len(self.quality_history) > 1000:
                self.quality_history = self.quality_history[-1000:]

            return metrics

        except Exception as e:
            ai_logger.error("Response validation failed", error=str(e))
            # Return default metrics on error
            return QualityMetrics(
                confidence=confidence,
                accuracy_score=0.5,
                completeness_score=0.5,
                relevance_score=0.5,
                response_time=processing_time,
                text_quality_score=0.5,
                overall_quality=ResponseQuality.POOR,
                validation_results={rule: False for rule in ValidationRule},
                warnings=["Validation failed"],
                suggestions=["Manual review recommended"]
            )

    def _contains_harmful_content(self, response: str) -> bool:
        """Check if response contains potentially harmful tax advice."""
        response_lower = response.lower()

        for pattern in self.harmful_patterns:
            if re.search(pattern, response_lower, re.IGNORECASE):
                return True

        return False

    def _check_tax_accuracy(self, response: str) -> bool:
        """Check indicators of tax accuracy in response."""
        # Look for positive indicators
        positive_indicators = 0
        for pattern in self.quality_indicators['positive']:
            if re.search(pattern, response, re.IGNORECASE):
                positive_indicators += 1

        # Look for negative indicators
        negative_indicators = 0
        for pattern in self.quality_indicators['negative']:
            if re.search(pattern, response, re.IGNORECASE):
                negative_indicators += 1

        # Basic scoring: more positive indicators and fewer negative indicators = better
        return positive_indicators > negative_indicators

    def _calculate_accuracy_score(self, response: str, response_type: str) -> float:
        """Calculate accuracy score based on response content."""
        score = 0.5  # Base score

        # Check for tax code references
        if re.search(r'\bIRC\s+Section\s+\d+', response, re.IGNORECASE):
            score += 0.2

        # Check for year-specific information
        if re.search(r'\b20\d{2}\b', response):
            score += 0.1

        # Check for appropriate disclaimers
        disclaimer_patterns = [
            r'consult.*professional',
            r'tax.*professional',
            r'this.*not.*professional.*advice',
            r'for.*specific.*situation'
        ]
        for pattern in disclaimer_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                score += 0.1
                break

        # Check for specific dollar amounts (good for optimization suggestions)
        if response_type == "optimization" and re.search(r'\$[\d,]+', response):
            score += 0.1

        return min(1.0, score)

    def _calculate_completeness_score(self, response: str, context: Optional[Dict[str, Any]]) -> float:
        """Calculate how complete the response is."""
        score = 0.5  # Base score

        # Length-based scoring
        if len(response) > 100:
            score += 0.2
        if len(response) > 200:
            score += 0.1

        # Check if response addresses the context
        if context:
            context_keywords = []
            if 'question' in context:
                # Extract keywords from question
                question_words = re.findall(r'\b\w{4,}\b', context['question'].lower())
                context_keywords.extend(question_words)

            # Check how many context keywords are addressed
            if context_keywords:
                addressed_keywords = sum(1 for keyword in context_keywords if keyword in response.lower())
                score += (addressed_keywords / len(context_keywords)) * 0.2

        return min(1.0, score)

    def _calculate_relevance_score(self, response: str, context: Optional[Dict[str, Any]]) -> float:
        """Calculate how relevant the response is to the query."""
        score = 0.7  # Base score for tax-related responses

        if not context:
            return score

        # Check relevance to question type
        if 'question' in context:
            question = context['question'].lower()
            response_lower = response.lower()

            # Deduction-related
            if any(word in question for word in ['deduct', 'deduction', 'itemize']):
                if any(word in response_lower for word in ['deduct', 'deduction', 'itemize', 'standard']):
                    score += 0.2

            # Credit-related
            elif any(word in question for word in ['credit', 'eitc', 'child tax']):
                if any(word in response_lower for word in ['credit', 'eligible', 'qualify']):
                    score += 0.2

            # Filing status
            elif any(word in question for word in ['filing', 'married', 'single', 'status']):
                if any(word in response_lower for word in ['filing', 'status', 'married', 'single']):
                    score += 0.2

        return min(1.0, score)

    def _calculate_text_quality_score(self, response: str) -> float:
        """Calculate text quality score."""
        score = 0.5  # Base score

        # Check for proper capitalization
        sentences = re.split(r'[.!?]+', response)
        if sentences:
            properly_capitalized = sum(1 for s in sentences if s.strip() and s.strip()[0].isupper())
            score += (properly_capitalized / len(sentences)) * 0.2

        # Check for excessive repetition
        words = response.lower().split()
        if words:
            unique_words = len(set(words))
            repetition_ratio = unique_words / len(words)
            if repetition_ratio > 0.7:
                score += 0.2

        # Check for reasonable sentence length
        avg_sentence_length = len(response.split()) / max(1, len(sentences))
        if 5 <= avg_sentence_length <= 25:  # Reasonable range
            score += 0.1

        return min(1.0, score)

    def _calculate_overall_quality(
        self,
        confidence: float,
        accuracy_score: float,
        completeness_score: float,
        relevance_score: float,
        text_quality_score: float,
        validation_results: Dict[ValidationRule, bool]
    ) -> ResponseQuality:
        """Calculate overall quality rating."""

        # Calculate weighted score
        weighted_score = (
            confidence * 0.25 +
            accuracy_score * 0.25 +
            completeness_score * 0.2 +
            relevance_score * 0.2 +
            text_quality_score * 0.1
        )

        # Check critical validation failures
        critical_failures = [
            ValidationRule.NO_HARMFUL_CONTENT,
            ValidationRule.MIN_LENGTH
        ]

        for rule in critical_failures:
            if not validation_results.get(rule, False):
                return ResponseQuality.UNACCEPTABLE

        # Determine quality based on score
        if weighted_score >= 0.85:
            return ResponseQuality.EXCELLENT
        elif weighted_score >= 0.7:
            return ResponseQuality.GOOD
        elif weighted_score >= 0.5:
            return ResponseQuality.ACCEPTABLE
        elif weighted_score >= 0.3:
            return ResponseQuality.POOR
        else:
            return ResponseQuality.UNACCEPTABLE

    def _generate_improvement_suggestions(
        self,
        response: str,
        validation_results: Dict[ValidationRule, bool]
    ) -> List[str]:
        """Generate suggestions for improving response quality."""
        suggestions = []

        # Length-based suggestions
        if not validation_results.get(ValidationRule.MIN_LENGTH, True):
            suggestions.append("Provide more detailed explanation")

        if not validation_results.get(ValidationRule.MAX_LENGTH, True):
            suggestions.append("Make response more concise")

        # Content-based suggestions
        if not re.search(r'\bIRC\s+Section\s+\d+', response, re.IGNORECASE):
            suggestions.append("Consider adding relevant tax code references")

        if not re.search(r'consult.*professional', response, re.IGNORECASE):
            suggestions.append("Add disclaimer to consult tax professional")

        if not re.search(r'\b20\d{2}\b', response):
            suggestions.append("Specify applicable tax year")

        # Check for overly absolute language
        absolute_patterns = [r'\balways\b', r'\bnever\b', r'\bguaranteed\b']
        if any(re.search(pattern, response, re.IGNORECASE) for pattern in absolute_patterns):
            suggestions.append("Use more cautious language to avoid absolute statements")

        return suggestions

    def _log_quality_metrics(self, metrics: QualityMetrics, response_type: str) -> None:
        """Log quality metrics for monitoring."""
        ai_logger.info("Response quality metrics",
                      response_type=response_type,
                      overall_quality=metrics.overall_quality.value,
                      confidence=metrics.confidence,
                      accuracy_score=metrics.accuracy_score,
                      warnings_count=len(metrics.warnings),
                      suggestions_count=len(metrics.suggestions))

    async def filter_response(self, response: str, quality_metrics: QualityMetrics) -> Tuple[str, bool]:
        """Filter response based on quality metrics. Returns (filtered_response, should_use)."""

        # Block unacceptable responses
        if quality_metrics.overall_quality == ResponseQuality.UNACCEPTABLE:
            fallback_response = ("I apologize, but I'm unable to provide a reliable answer to your question. "
                               "For accurate tax information, please consult the IRS website or a qualified tax professional.")
            return fallback_response, False

        # Add disclaimers to poor quality responses
        if quality_metrics.overall_quality == ResponseQuality.POOR:
            if not re.search(r'consult.*professional', response, re.IGNORECASE):
                response += ("\n\nPlease note: This information may not be complete. "
                           "For your specific situation, consult a qualified tax professional.")

        # Add tax year clarification if missing
        if not re.search(r'\b20\d{2}\b', response):
            current_year = time.strftime("%Y")
            response += f"\n\n(This information applies to tax year {current_year}.)"

        return response, True

    def get_quality_statistics(self) -> Dict[str, Any]:
        """Get quality statistics from history."""
        if not self.quality_history:
            return {"message": "No quality data available"}

        # Calculate statistics
        recent_history = self.quality_history[-100:]  # Last 100 responses

        quality_counts = {}
        for record in recent_history:
            quality = record["metrics"].overall_quality.value
            quality_counts[quality] = quality_counts.get(quality, 0) + 1

        avg_confidence = sum(record["metrics"].confidence for record in recent_history) / len(recent_history)
        avg_response_time = sum(record["metrics"].response_time for record in recent_history) / len(recent_history)

        # Common warnings
        all_warnings = []
        for record in recent_history:
            all_warnings.extend(record["metrics"].warnings)

        warning_counts = {}
        for warning in all_warnings:
            warning_counts[warning] = warning_counts.get(warning, 0) + 1

        return {
            "total_responses": len(self.quality_history),
            "recent_responses": len(recent_history),
            "quality_distribution": quality_counts,
            "average_confidence": avg_confidence,
            "average_response_time": avg_response_time,
            "common_warnings": dict(sorted(warning_counts.items(), key=lambda x: x[1], reverse=True)[:5])
        }

    async def cache_response(self, query_hash: str, response: str, quality_metrics: QualityMetrics) -> None:
        """Cache high-quality responses for future use."""
        if quality_metrics.overall_quality in [ResponseQuality.EXCELLENT, ResponseQuality.GOOD]:
            self.response_cache[query_hash] = {
                "response": response,
                "quality": quality_metrics.overall_quality.value,
                "timestamp": time.time(),
                "confidence": quality_metrics.confidence
            }

            # Limit cache size
            if len(self.response_cache) > 1000:
                # Remove oldest entries
                oldest_keys = sorted(self.response_cache.keys(),
                                   key=lambda k: self.response_cache[k]["timestamp"])[:100]
                for key in oldest_keys:
                    del self.response_cache[key]

    def get_cached_response(self, query_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached response if available and not expired."""
        if query_hash in self.response_cache:
            cached = self.response_cache[query_hash]
            # Check if cache is not too old (24 hours)
            if time.time() - cached["timestamp"] < 86400:
                return cached
            else:
                # Remove expired cache
                del self.response_cache[query_hash]

        return None


# Global quality controller instance
quality_controller = ResponseQualityController()
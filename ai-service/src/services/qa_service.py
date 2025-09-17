import asyncio
import json
import re
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

from src.core import ai_logger
from src.models import get_model_manager
from src.services.nlp_service import ParsedTaxInfo


class QuestionCategory(Enum):
    DEDUCTIONS = "deductions"
    CREDITS = "credits"
    FILING_STATUS = "filing_status"
    INCOME = "income"
    RETIREMENT = "retirement"
    BUSINESS = "business"
    EDUCATION = "education"
    HEALTHCARE = "healthcare"
    INVESTMENT = "investment"
    GENERAL = "general"


@dataclass
class QAResponse:
    """Structure for Q&A response."""
    answer: str
    confidence: float
    category: QuestionCategory
    sources: List[str]
    related_questions: List[str]
    tax_code_references: List[str]
    disclaimer: str
    follow_up_suggestions: List[str]


class TaxQAService:
    """Intelligent tax Q&A service using AI and rule-based responses."""

    def __init__(self):
        self.model_manager = get_model_manager()

        # Common tax questions and their answers
        self.knowledge_base = {
            "what is the standard deduction": {
                "answer": "The standard deduction for 2024 is $14,600 for single filers, $29,200 for married filing jointly, $21,900 for head of household, and $14,600 for married filing separately.",
                "category": QuestionCategory.DEDUCTIONS,
                "confidence": 0.95,
                "sources": ["IRS Publication 501"],
                "tax_code": ["IRC Section 63"]
            },
            "when is tax filing deadline": {
                "answer": "The federal tax filing deadline for 2024 returns is April 15, 2025. If April 15 falls on a weekend or holiday, the deadline is extended to the next business day.",
                "category": QuestionCategory.GENERAL,
                "confidence": 0.98,
                "sources": ["IRS"],
                "tax_code": ["IRC Section 6072"]
            },
            "what is earned income tax credit": {
                "answer": "The Earned Income Tax Credit (EITC) is a refundable tax credit for low-to-moderate income working individuals and families. For 2024, the maximum credit ranges from $632 (no children) to $7,830 (3+ children).",
                "category": QuestionCategory.CREDITS,
                "confidence": 0.92,
                "sources": ["IRS Publication 596"],
                "tax_code": ["IRC Section 32"]
            },
            "how much can i contribute to 401k": {
                "answer": "For 2024, you can contribute up to $23,000 to a 401(k) plan. If you're 50 or older, you can make an additional catch-up contribution of $7,500, for a total of $30,500.",
                "category": QuestionCategory.RETIREMENT,
                "confidence": 0.96,
                "sources": ["IRS Publication 560"],
                "tax_code": ["IRC Section 402(g)"]
            }
        }

        # Question classification patterns
        self.classification_patterns = {
            QuestionCategory.DEDUCTIONS: [
                r'\b(?:deduct|deduction|itemize|standard deduction|medical expenses|charitable|mortgage)\b',
                r'\b(?:write off|business expense|home office)\b'
            ],
            QuestionCategory.CREDITS: [
                r'\b(?:credit|child tax credit|earned income|education credit|eitc)\b',
                r'\b(?:refundable|non-refundable)\b'
            ],
            QuestionCategory.FILING_STATUS: [
                r'\b(?:filing status|single|married|head of household|mfs|mfj)\b',
                r'\b(?:should i file|how to file)\b'
            ],
            QuestionCategory.RETIREMENT: [
                r'\b(?:401k|ira|roth|retirement|pension|contribution limit)\b',
                r'\b(?:early withdrawal|rollover)\b'
            ],
            QuestionCategory.BUSINESS: [
                r'\b(?:business|self employed|1099|schedule c|llc)\b',
                r'\b(?:business expense|contractor)\b'
            ],
            QuestionCategory.EDUCATION: [
                r'\b(?:education|student loan|529|tuition|american opportunity)\b',
                r'\b(?:scholarship|grant)\b'
            ],
            QuestionCategory.HEALTHCARE: [
                r'\b(?:health|medical|hsa|insurance|cobra)\b',
                r'\b(?:premium|aca|obamacare)\b'
            ],
            QuestionCategory.INVESTMENT: [
                r'\b(?:capital gains|dividend|investment|stock|bond)\b',
                r'\b(?:crypto|bitcoin|wash sale)\b'
            ]
        }

        # Related questions database
        self.related_questions = {
            QuestionCategory.DEDUCTIONS: [
                "Should I itemize or take the standard deduction?",
                "What medical expenses are deductible?",
                "How much can I deduct for charitable donations?",
                "Can I deduct home office expenses?"
            ],
            QuestionCategory.CREDITS: [
                "What's the difference between credits and deductions?",
                "Am I eligible for the Child Tax Credit?",
                "How does the Earned Income Tax Credit work?",
                "What education credits are available?"
            ],
            QuestionCategory.RETIREMENT: [
                "Should I contribute to a traditional or Roth IRA?",
                "What are the 401(k) contribution limits?",
                "Can I withdraw from my retirement account early?",
                "How do retirement account rollovers work?"
            ]
        }

    async def answer_tax_question(
        self,
        question: str,
        user_context: Optional[ParsedTaxInfo] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> QAResponse:
        """Answer a tax question using AI and knowledge base."""
        try:
            ai_logger.info("Processing tax question", question_length=len(question))

            # Clean and normalize question
            normalized_question = self._normalize_question(question)

            # Classify question category
            category = self._classify_question(normalized_question)

            # Check knowledge base first
            kb_response = self._check_knowledge_base(normalized_question)

            if kb_response and kb_response["confidence"] > 0.8:
                # Use knowledge base response
                response = self._create_response_from_kb(kb_response, category)
            else:
                # Use AI to generate response
                response = await self._generate_ai_response(
                    question,
                    category,
                    user_context,
                    conversation_history
                )

            # Add personalization based on user context
            if user_context:
                response = self._personalize_response(response, user_context)

            # Add related questions and follow-ups
            response.related_questions = self._get_related_questions(category)
            response.follow_up_suggestions = self._get_follow_up_suggestions(response, user_context)

            # Add disclaimer
            response.disclaimer = self._get_disclaimer()

            ai_logger.info("Tax question answered",
                         category=category.value,
                         confidence=response.confidence,
                         answer_length=len(response.answer))

            return response

        except Exception as e:
            ai_logger.error("Failed to answer tax question", error=str(e))
            return self._create_fallback_response(question)

    def _normalize_question(self, question: str) -> str:
        """Normalize and clean the question."""
        # Convert to lowercase
        question = question.lower().strip()

        # Remove extra whitespace
        question = re.sub(r'\s+', ' ', question)

        # Remove question marks and periods at the end
        question = re.sub(r'[?.]$', '', question)

        return question

    def _classify_question(self, question: str) -> QuestionCategory:
        """Classify the question into a category."""
        for category, patterns in self.classification_patterns.items():
            for pattern in patterns:
                if re.search(pattern, question, re.IGNORECASE):
                    return category

        return QuestionCategory.GENERAL

    def _check_knowledge_base(self, question: str) -> Optional[Dict[str, Any]]:
        """Check if question matches knowledge base."""
        for kb_question, kb_data in self.knowledge_base.items():
            # Simple keyword matching - in production, use semantic similarity
            if self._calculate_similarity(question, kb_question) > 0.7:
                return kb_data

        return None

    def _calculate_similarity(self, question1: str, question2: str) -> float:
        """Calculate similarity between two questions (simplified)."""
        words1 = set(question1.lower().split())
        words2 = set(question2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1.intersection(words2)
        union = words1.union(words2)

        return len(intersection) / len(union) if union else 0.0

    def _create_response_from_kb(self, kb_data: Dict[str, Any], category: QuestionCategory) -> QAResponse:
        """Create response from knowledge base data."""
        return QAResponse(
            answer=kb_data["answer"],
            confidence=kb_data["confidence"],
            category=category,
            sources=kb_data.get("sources", []),
            related_questions=[],
            tax_code_references=kb_data.get("tax_code", []),
            disclaimer="",
            follow_up_suggestions=[]
        )

    async def _generate_ai_response(
        self,
        question: str,
        category: QuestionCategory,
        user_context: Optional[ParsedTaxInfo],
        conversation_history: Optional[List[Dict[str, str]]]
    ) -> QAResponse:
        """Generate AI response for tax question."""
        try:
            # Build context
            context_info = ""
            if user_context:
                context_info = f"""
User context:
- Income: ${user_context.income:,.0f} if user_context.income else 'Not provided'
- Filing Status: {user_context.filing_status.value if user_context.filing_status else 'Not provided'}
- Dependents: {user_context.dependents}
- State: {user_context.state or 'Not provided'}
"""

            # Build conversation context
            conversation_context = ""
            if conversation_history and len(conversation_history) > 0:
                recent_history = conversation_history[-3:]  # Last 3 exchanges
                conversation_context = "\nRecent conversation:\n"
                for exchange in recent_history:
                    conversation_context += f"Q: {exchange.get('question', '')}\nA: {exchange.get('answer', '')}\n"

            # Create prompt
            prompt = f"""
You are a tax expert assistant. Answer this tax question accurately and helpfully:

Question: {question}

{context_info}
{conversation_context}

Provide a clear, accurate answer that:
1. Directly answers the question
2. Is appropriate for the user's situation
3. Includes relevant tax code references when applicable
4. Mentions any important limitations or exceptions
5. Uses plain language that non-experts can understand

Answer:"""

            # Generate response
            ai_response = await self.model_manager.generate_text(
                prompt,
                max_new_tokens=300,
                temperature=0.3
            )

            if not ai_response:
                raise Exception("AI model returned empty response")

            # Parse and validate response
            answer = self._clean_ai_response(ai_response)
            confidence = self._calculate_ai_confidence(answer, question)

            # Extract tax code references
            tax_codes = self._extract_tax_code_references(answer)

            return QAResponse(
                answer=answer,
                confidence=confidence,
                category=category,
                sources=["AI Assistant"],
                related_questions=[],
                tax_code_references=tax_codes,
                disclaimer="",
                follow_up_suggestions=[]
            )

        except Exception as e:
            ai_logger.error("AI response generation failed", error=str(e))
            return self._create_fallback_response(question)

    def _clean_ai_response(self, response: str) -> str:
        """Clean and improve AI response."""
        # Remove any prompt artifacts
        response = re.sub(r'^(answer:|response:)', '', response, flags=re.IGNORECASE)

        # Clean up formatting
        response = response.strip()

        # Ensure proper capitalization
        if response and not response[0].isupper():
            response = response[0].upper() + response[1:]

        return response

    def _calculate_ai_confidence(self, answer: str, question: str) -> float:
        """Calculate confidence in AI response."""
        confidence = 0.6  # Base confidence for AI responses

        # Boost confidence for longer, more detailed answers
        if len(answer) > 100:
            confidence += 0.1

        # Boost confidence if answer contains tax code references
        if re.search(r'\b(?:IRC|Section|Code)\b', answer):
            confidence += 0.1

        # Reduce confidence for very generic answers
        generic_phrases = ['it depends', 'consult a professional', 'may vary']
        for phrase in generic_phrases:
            if phrase.lower() in answer.lower():
                confidence -= 0.1

        return max(0.1, min(0.9, confidence))

    def _extract_tax_code_references(self, text: str) -> List[str]:
        """Extract tax code references from text."""
        patterns = [
            r'\bIRC\s+Section\s+(\d+[a-z]*(?:\([a-z0-9]+\))*)',
            r'\bSection\s+(\d+[a-z]*(?:\([a-z0-9]+\))*)',
            r'\b(\d{3,4}[a-z]*(?:\([a-z0-9]+\))*)\s+of\s+the\s+(?:Internal\s+Revenue\s+)?Code'
        ]

        references = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            references.extend(matches)

        return list(set(references))  # Remove duplicates

    def _personalize_response(self, response: QAResponse, user_context: ParsedTaxInfo) -> QAResponse:
        """Personalize response based on user context."""
        if not user_context.income:
            return response

        # Add personalized notes based on income level
        income = user_context.income
        filing_status = user_context.filing_status

        personalization = ""

        if income < 30000:
            personalization = " Given your income level, you may also want to look into the Earned Income Tax Credit and other credits for lower-income taxpayers."
        elif income > 200000:
            personalization = " With your higher income, consider additional tax planning strategies and be aware of potential additional taxes like Net Investment Income Tax."

        if filing_status and filing_status.value == "marriedFilingJointly" and user_context.dependents > 0:
            personalization += f" As a married taxpayer with {user_context.dependents} dependent(s), make sure you're maximizing family-related tax benefits."

        if personalization:
            response.answer += personalization

        return response

    def _get_related_questions(self, category: QuestionCategory) -> List[str]:
        """Get related questions for the category."""
        return self.related_questions.get(category, [])[:4]  # Return up to 4 related questions

    def _get_follow_up_suggestions(self, response: QAResponse, user_context: Optional[ParsedTaxInfo]) -> List[str]:
        """Generate follow-up suggestions."""
        suggestions = []

        if response.category == QuestionCategory.DEDUCTIONS:
            suggestions.append("Would you like to know about other available deductions?")
            suggestions.append("Should I help you compare itemizing vs. standard deduction?")

        elif response.category == QuestionCategory.RETIREMENT:
            suggestions.append("Do you want to explore other retirement savings options?")
            suggestions.append("Would you like help optimizing your retirement contributions?")

        elif response.category == QuestionCategory.CREDITS:
            suggestions.append("Are there other tax credits you might qualify for?")
            suggestions.append("Would you like to know the difference between credits and deductions?")

        # Add user-specific suggestions
        if user_context:
            if user_context.dependents > 0:
                suggestions.append("Do you have questions about child-related tax benefits?")

            if user_context.income and user_context.income > 100000:
                suggestions.append("Would you like tax planning strategies for higher incomes?")

        return suggestions[:3]  # Return up to 3 suggestions

    def _get_disclaimer(self) -> str:
        """Get standard disclaimer for tax advice."""
        return ("This information is for educational purposes only and should not be considered "
                "professional tax advice. Tax laws are complex and change frequently. For specific "
                "tax situations, please consult a qualified tax professional or the IRS directly.")

    def _create_fallback_response(self, question: str) -> QAResponse:
        """Create fallback response when AI fails."""
        return QAResponse(
            answer=("I apologize, but I'm having trouble processing your question right now. "
                   "For reliable tax information, please visit IRS.gov or consult with a "
                   "qualified tax professional."),
            confidence=0.3,
            category=QuestionCategory.GENERAL,
            sources=["Fallback Response"],
            related_questions=[
                "What is the standard deduction?",
                "When is the tax filing deadline?",
                "How do I know if I should itemize deductions?"
            ],
            tax_code_references=[],
            disclaimer=self._get_disclaimer(),
            follow_up_suggestions=[
                "Try rephrasing your question",
                "Visit IRS.gov for official information",
                "Consider consulting a tax professional"
            ]
        )

    async def get_question_suggestions(self, user_context: Optional[ParsedTaxInfo] = None) -> List[str]:
        """Get suggested questions based on user context."""
        suggestions = [
            "What is the standard deduction for 2024?",
            "How much can I contribute to my 401(k)?",
            "What tax credits am I eligible for?",
            "Should I itemize or take the standard deduction?",
            "When is the tax filing deadline?",
            "What is the Earned Income Tax Credit?",
            "How do I claim the Child Tax Credit?",
            "What business expenses can I deduct?"
        ]

        if user_context:
            # Add personalized suggestions
            if user_context.dependents > 0:
                suggestions.insert(0, "What child-related tax benefits am I eligible for?")

            if user_context.state:
                suggestions.insert(1, f"What are the tax implications of living in {user_context.state}?")

            if user_context.income and user_context.income > 100000:
                suggestions.insert(2, "What tax planning strategies should I consider for higher incomes?")

        return suggestions[:8]  # Return top 8 suggestions


# Global service instance
qa_service = TaxQAService()
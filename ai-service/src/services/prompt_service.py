import json
import re
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime

from src.core import ai_logger
from src.services.nlp_service import ParsedTaxInfo, FilingStatus


class PromptType(Enum):
    NLP_PARSING = "nlp_parsing"
    TAX_QA = "tax_qa"
    OPTIMIZATION = "optimization"
    EXPLANATION = "explanation"
    CALCULATION_REVIEW = "calculation_review"
    GENERAL_ASSISTANCE = "general_assistance"


@dataclass
class PromptTemplate:
    """Template for AI prompts."""
    name: str
    type: PromptType
    template: str
    variables: List[str]
    max_tokens: int
    temperature: float
    description: str
    version: str
    examples: List[Dict[str, str]]


class PromptEngineeringService:
    """Service for managing and optimizing AI prompts."""

    def __init__(self):
        self.templates = self._initialize_templates()
        self.prompt_history = []
        self.performance_metrics = {}

    def _initialize_templates(self) -> Dict[str, PromptTemplate]:
        """Initialize prompt templates."""
        templates = {}

        # NLP Parsing Template
        templates["tax_info_extraction"] = PromptTemplate(
            name="tax_info_extraction",
            type=PromptType.NLP_PARSING,
            template="""
Extract tax information from this user input: "{user_input}"

Extract the following information and return as JSON:
{{
    "income": <annual income as number or null>,
    "filing_status": "<single|marriedFilingJointly|marriedFilingSeparately|headOfHousehold or null>",
    "dependents": <number of dependents as integer>,
    "state": "<US state code like CA or null>",
    "spouse_income": <spouse income as number or null>,
    "retirement_contributions": <401k/IRA contributions as number or null>,
    "deductions": [
        {{"type": "mortgage_interest", "amount": <amount>}},
        {{"type": "charitable_donations", "amount": <amount>}}
    ],
    "confidence": <confidence score from 0.0 to 1.0>
}}

Examples:
Input: "I make 75k, married with 2 kids in California"
Output: {{"income": 75000, "filing_status": "marriedFilingJointly", "dependents": 2, "state": "CA", "confidence": 0.9}}

Input: "Single person earning $50,000 in Texas"
Output: {{"income": 50000, "filing_status": "single", "dependents": 0, "state": "TX", "confidence": 0.8}}

Now extract from: "{user_input}"

JSON:""",
            variables=["user_input"],
            max_tokens=200,
            temperature=0.1,
            description="Extract structured tax information from natural language",
            version="1.0",
            examples=[
                {
                    "input": "I make 75k, married with 2 kids in California",
                    "output": '{"income": 75000, "filing_status": "marriedFilingJointly", "dependents": 2, "state": "CA", "confidence": 0.9}'
                }
            ]
        )

        # Tax Q&A Template
        templates["tax_question_answer"] = PromptTemplate(
            name="tax_question_answer",
            type=PromptType.TAX_QA,
            template="""
You are a knowledgeable tax assistant. Answer this tax question accurately and helpfully.

{context_section}

Question: {question}

Guidelines:
1. Provide accurate, up-to-date tax information for {tax_year}
2. Use clear, non-technical language
3. Include relevant tax code references when applicable
4. Mention important limitations or exceptions
5. Personalize for the user's situation when context is provided

{personalization_section}

Answer:""",
            variables=["question", "context_section", "personalization_section", "tax_year"],
            max_tokens=300,
            temperature=0.3,
            description="Answer tax questions with context awareness",
            version="1.0",
            examples=[
                {
                    "input": "What is the standard deduction?",
                    "output": "The standard deduction for 2024 is $14,600 for single filers, $29,200 for married filing jointly..."
                }
            ]
        )

        # Optimization Template
        templates["tax_optimization"] = PromptTemplate(
            name="tax_optimization",
            type=PromptType.OPTIMIZATION,
            template="""
Analyze this taxpayer's situation and suggest tax optimization strategies:

Taxpayer Profile:
- Income: ${income:,.0f}
- Filing Status: {filing_status}
- Dependents: {dependents}
- State: {state}
- Current Deductions: {current_deductions}
- Retirement Contributions: ${retirement_contributions:,.0f}

Current Tax Calculation:
{tax_calculation}

Provide 3-5 specific, actionable tax optimization suggestions. For each suggestion:
1. Strategy name and description
2. Estimated tax savings
3. Implementation steps
4. Deadlines and requirements
5. Risk assessment

Focus on the highest-impact opportunities for this taxpayer's income level and situation.

Optimization Suggestions:""",
            variables=["income", "filing_status", "dependents", "state", "current_deductions",
                      "retirement_contributions", "tax_calculation"],
            max_tokens=400,
            temperature=0.4,
            description="Generate personalized tax optimization strategies",
            version="1.0",
            examples=[]
        )

        # Explanation Template
        templates["tax_concept_explanation"] = PromptTemplate(
            name="tax_concept_explanation",
            type=PromptType.EXPLANATION,
            template="""
Explain this tax concept in simple terms: {concept}

{context_section}

Make the explanation:
1. Easy to understand for non-experts
2. Include a practical example
3. Mention how it applies to different income levels or situations
4. Note any recent changes or common misconceptions

{personalization_section}

Explanation:""",
            variables=["concept", "context_section", "personalization_section"],
            max_tokens=250,
            temperature=0.4,
            description="Explain tax concepts in plain language",
            version="1.0",
            examples=[]
        )

        # Calculation Review Template
        templates["calculation_review"] = PromptTemplate(
            name="calculation_review",
            type=PromptType.CALCULATION_REVIEW,
            template="""
Review this tax calculation for accuracy and optimization opportunities:

Input Data:
{input_data}

Calculated Results:
{calculation_results}

Please:
1. Verify the calculation logic appears correct
2. Identify any potential errors or red flags
3. Suggest optimizations or missed opportunities
4. Note any unusual results that need explanation
5. Recommend additional considerations

Analysis:""",
            variables=["input_data", "calculation_results"],
            max_tokens=300,
            temperature=0.2,
            description="Review tax calculations for accuracy and optimization",
            version="1.0",
            examples=[]
        )

        # General Assistance Template
        templates["general_tax_assistance"] = PromptTemplate(
            name="general_tax_assistance",
            type=PromptType.GENERAL_ASSISTANCE,
            template="""
Help this user with their tax-related request: "{user_request}"

{context_section}

Provide helpful guidance that:
1. Directly addresses their request
2. Offers practical next steps
3. Includes relevant resources or tools
4. Warns about potential pitfalls
5. Suggests professional help when appropriate

{personalization_section}

Response:""",
            variables=["user_request", "context_section", "personalization_section"],
            max_tokens=250,
            temperature=0.5,
            description="Provide general tax assistance and guidance",
            version="1.0",
            examples=[]
        )

        return templates

    def build_prompt(
        self,
        template_name: str,
        variables: Dict[str, Any],
        user_context: Optional[ParsedTaxInfo] = None
    ) -> Dict[str, Any]:
        """Build a prompt from template with variables."""
        try:
            if template_name not in self.templates:
                raise ValueError(f"Template '{template_name}' not found")

            template = self.templates[template_name]

            # Prepare context sections
            context_section = self._build_context_section(user_context) if user_context else ""
            personalization_section = self._build_personalization_section(user_context) if user_context else ""

            # Add common variables
            all_variables = {
                **variables,
                "context_section": context_section,
                "personalization_section": personalization_section,
                "tax_year": datetime.now().year
            }

            # Replace variables in template
            prompt = template.template
            for var_name, var_value in all_variables.items():
                if f"{{{var_name}}}" in prompt:
                    prompt = prompt.replace(f"{{{var_name}}}", str(var_value))

            # Handle conditional sections
            prompt = self._process_conditional_sections(prompt, all_variables)

            # Log prompt usage
            self._log_prompt_usage(template_name, all_variables)

            return {
                "prompt": prompt.strip(),
                "max_tokens": template.max_tokens,
                "temperature": template.temperature,
                "template_name": template_name,
                "variables_used": list(all_variables.keys())
            }

        except Exception as e:
            ai_logger.error("Failed to build prompt", template=template_name, error=str(e))
            raise

    def _build_context_section(self, user_context: ParsedTaxInfo) -> str:
        """Build context section from user information."""
        if not user_context:
            return ""

        context_parts = []

        if user_context.income:
            context_parts.append(f"User's annual income: ${user_context.income:,.0f}")

        if user_context.filing_status:
            context_parts.append(f"Filing status: {user_context.filing_status.value}")

        if user_context.dependents > 0:
            context_parts.append(f"Number of dependents: {user_context.dependents}")

        if user_context.state:
            context_parts.append(f"State: {user_context.state}")

        if user_context.deductions:
            total_deductions = sum(d.get("amount", 0) for d in user_context.deductions)
            context_parts.append(f"Current itemized deductions: ${total_deductions:,.0f}")

        if context_parts:
            return "User Context:\n" + "\n".join(f"- {part}" for part in context_parts) + "\n"

        return ""

    def _build_personalization_section(self, user_context: ParsedTaxInfo) -> str:
        """Build personalization guidance based on user context."""
        if not user_context or not user_context.income:
            return ""

        personalizations = []

        # Income-based personalization
        if user_context.income < 30000:
            personalizations.append("Focus on credits and benefits for lower-income taxpayers")
        elif user_context.income > 200000:
            personalizations.append("Consider advanced tax strategies and potential additional taxes")

        # Family-based personalization
        if user_context.dependents > 0:
            personalizations.append("Include family-related tax benefits and credits")

        # State-based personalization
        if user_context.state in ['TX', 'FL', 'NV', 'TN', 'WA', 'WY', 'SD', 'AK', 'NH']:
            personalizations.append("Consider state income tax advantages")
        elif user_context.state in ['CA', 'NY', 'NJ', 'CT']:
            personalizations.append("Address high-tax state considerations")

        if personalizations:
            return "Personalization Notes:\n" + "\n".join(f"- {p}" for p in personalizations) + "\n"

        return ""

    def _process_conditional_sections(self, prompt: str, variables: Dict[str, Any]) -> str:
        """Process conditional sections in prompts."""
        # Remove empty context sections
        if variables.get("context_section", "").strip() == "":
            prompt = re.sub(r'\{context_section\}\s*\n?', '', prompt)

        if variables.get("personalization_section", "").strip() == "":
            prompt = re.sub(r'\{personalization_section\}\s*\n?', '', prompt)

        # Clean up extra newlines
        prompt = re.sub(r'\n{3,}', '\n\n', prompt)

        return prompt

    def _log_prompt_usage(self, template_name: str, variables: Dict[str, Any]) -> None:
        """Log prompt usage for analytics and optimization."""
        usage_record = {
            "timestamp": datetime.now().isoformat(),
            "template": template_name,
            "variables_count": len(variables),
            "has_context": bool(variables.get("context_section")),
            "has_personalization": bool(variables.get("personalization_section"))
        }

        self.prompt_history.append(usage_record)

        # Keep only last 1000 records
        if len(self.prompt_history) > 1000:
            self.prompt_history = self.prompt_history[-1000:]

    def get_template_suggestions(self, user_input: str, user_context: Optional[ParsedTaxInfo] = None) -> List[str]:
        """Suggest appropriate templates based on user input."""
        suggestions = []

        user_input_lower = user_input.lower()

        # Question detection
        if any(word in user_input_lower for word in ['what', 'how', 'when', 'why', 'where', '?']):
            suggestions.append("tax_question_answer")

        # Optimization detection
        if any(word in user_input_lower for word in ['optimize', 'save', 'reduce', 'lower', 'strategy']):
            suggestions.append("tax_optimization")

        # Explanation detection
        if any(word in user_input_lower for word in ['explain', 'understand', 'mean', 'definition']):
            suggestions.append("tax_concept_explanation")

        # Parsing detection
        if any(word in user_input_lower for word in ['make', 'earn', 'income', 'married', 'single', 'kids', 'children']):
            suggestions.append("tax_info_extraction")

        # Default to general assistance if no specific pattern
        if not suggestions:
            suggestions.append("general_tax_assistance")

        return suggestions

    def optimize_prompt_for_model(self, prompt_data: Dict[str, Any], model_type: str = "llama") -> Dict[str, Any]:
        """Optimize prompt for specific model type."""
        optimized = prompt_data.copy()

        if model_type.lower() == "llama":
            # Llama-specific optimizations
            optimized["max_tokens"] = min(optimized["max_tokens"], 512)  # Llama context limit
            optimized["temperature"] = min(optimized["temperature"], 0.9)  # Prevent too much randomness

            # Add instruction formatting for better Llama performance
            prompt = optimized["prompt"]
            if not prompt.startswith("###"):
                prompt = f"### Instruction:\n{prompt}\n\n### Response:"
                optimized["prompt"] = prompt

        elif model_type.lower() == "openai":
            # OpenAI-specific optimizations
            optimized["max_tokens"] = min(optimized["max_tokens"], 1000)
            # OpenAI models handle higher temperatures better
            optimized["temperature"] = max(optimized["temperature"], 0.1)

        return optimized

    def get_template_performance(self) -> Dict[str, Any]:
        """Get performance metrics for templates."""
        if not self.prompt_history:
            return {"message": "No usage data available"}

        # Calculate usage statistics
        template_usage = {}
        for record in self.prompt_history:
            template = record["template"]
            if template not in template_usage:
                template_usage[template] = 0
            template_usage[template] += 1

        # Calculate success rates (would need actual success data in production)
        total_usage = len(self.prompt_history)
        recent_usage = len([r for r in self.prompt_history[-100:]])  # Last 100 prompts

        return {
            "total_prompts": total_usage,
            "recent_usage": recent_usage,
            "template_usage": template_usage,
            "most_used_template": max(template_usage.items(), key=lambda x: x[1])[0] if template_usage else None,
            "available_templates": list(self.templates.keys())
        }

    def create_custom_template(
        self,
        name: str,
        prompt_type: PromptType,
        template: str,
        variables: List[str],
        max_tokens: int = 200,
        temperature: float = 0.5,
        description: str = ""
    ) -> bool:
        """Create a custom prompt template."""
        try:
            custom_template = PromptTemplate(
                name=name,
                type=prompt_type,
                template=template,
                variables=variables,
                max_tokens=max_tokens,
                temperature=temperature,
                description=description,
                version="custom",
                examples=[]
            )

            self.templates[name] = custom_template
            ai_logger.info("Custom template created", name=name, type=prompt_type.value)
            return True

        except Exception as e:
            ai_logger.error("Failed to create custom template", name=name, error=str(e))
            return False

    def list_templates(self) -> Dict[str, Dict[str, Any]]:
        """List all available templates with their metadata."""
        return {
            name: {
                "type": template.type.value,
                "description": template.description,
                "variables": template.variables,
                "max_tokens": template.max_tokens,
                "temperature": template.temperature,
                "version": template.version
            }
            for name, template in self.templates.items()
        }


# Global service instance
prompt_service = PromptEngineeringService()
import re
import asyncio
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
import spacy
from textblob import TextBlob
import json

from src.core import nlp_logger
from src.models import get_model_manager


class FilingStatus(Enum):
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "marriedFilingJointly"
    MARRIED_FILING_SEPARATELY = "marriedFilingSeparately"
    HEAD_OF_HOUSEHOLD = "headOfHousehold"


@dataclass
class ParsedTaxInfo:
    """Structured representation of parsed tax information."""
    income: Optional[float] = None
    filing_status: Optional[FilingStatus] = None
    dependents: int = 0
    state: Optional[str] = None
    country: Optional[str] = None
    age: Optional[int] = None
    spouse_income: Optional[float] = None
    deductions: List[Dict[str, Any]] = None
    retirement_contributions: Optional[float] = None
    student_loan_interest: Optional[float] = None
    mortgage_interest: Optional[float] = None
    charitable_donations: Optional[float] = None
    medical_expenses: Optional[float] = None
    business_income: Optional[float] = None
    confidence_score: float = 0.0
    raw_text: str = ""
    extracted_entities: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.deductions is None:
            self.deductions = []
        if self.extracted_entities is None:
            self.extracted_entities = []


class TaxNLPService:
    """Natural Language Processing service for tax-related queries."""

    def __init__(self):
        self.nlp = None
        self.model_manager = get_model_manager()
        self._income_patterns = [
            r'(?:make|earn|income|salary|wage).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)[k\s]?(?:thousand|per year|annually|yearly)?',
            r'[\$](\d{1,3}(?:,\d{3})*(?:\.\d{2})?)[k\s]?(?:income|salary|per year|annually)',
            r'(\d{1,3}(?:,\d{3})*)[k\s](?:income|salary|per year|annually)',
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)?\s*(?:income|salary|per year|annually)'
        ]

        self._filing_status_patterns = {
            FilingStatus.SINGLE: [
                r'\b(?:single|unmarried|not married|filing single)\b',
                r'\b(?:i am|i\'m)\s+(?:single|unmarried)\b'
            ],
            FilingStatus.MARRIED_FILING_JOINTLY: [
                r'\b(?:married|spouse|husband|wife|filing jointly|married filing jointly)\b',
                r'\b(?:my spouse|my husband|my wife)\b',
                r'\b(?:we are married|married couple)\b'
            ],
            FilingStatus.MARRIED_FILING_SEPARATELY: [
                r'\b(?:married filing separately|filing separately)\b',
                r'\b(?:married but filing separately)\b'
            ],
            FilingStatus.HEAD_OF_HOUSEHOLD: [
                r'\b(?:head of household|hoh)\b',
                r'\b(?:single parent|single mother|single father)\b'
            ]
        }

        self._dependent_patterns = [
            r'(\d+)\s*(?:kids?|children?|dependents?)',
            r'(?:have|with)\s*(\d+)\s*(?:kids?|children?|dependents?)',
            r'(\d+)\s*(?:year|years)\s*old\s*(?:child|kid|son|daughter)',
            r'(?:children?|kids?|dependents?).*?(\d+)'
        ]

        self._state_patterns = [
            r'\b(?:in|from|live in|residing in|state of)\s+([A-Z]{2}|[A-Za-z\s]+(?:state|State))\b',
            r'\b([A-Z]{2})\s+(?:state|resident)\b',
            r'\b(?:california|texas|florida|new york|pennsylvania|illinois|ohio|georgia|north carolina|michigan)\b'
        ]

    async def initialize(self):
        """Initialize spaCy model and other NLP components."""
        try:
            # Load spaCy model
            self.nlp = spacy.load("en_core_web_sm")
            nlp_logger.info("SpaCy model loaded successfully")

            # Initialize the LLM model
            await self.model_manager.load_llama_model()
            nlp_logger.info("NLP service initialized successfully")

        except Exception as e:
            nlp_logger.error("Failed to initialize NLP service", error=str(e))
            raise

    async def parse_tax_input(self, text: str) -> ParsedTaxInfo:
        """Parse natural language tax input into structured data."""
        try:
            nlp_logger.info("Parsing tax input", text_length=len(text))

            # Initialize result
            result = ParsedTaxInfo(raw_text=text)

            # Clean and normalize text
            cleaned_text = self._clean_text(text)

            # Extract basic entities using spaCy
            if self.nlp:
                doc = self.nlp(cleaned_text)
                result.extracted_entities = self._extract_spacy_entities(doc)

            # Extract income information
            result.income = await self._extract_income(cleaned_text)

            # Extract filing status
            result.filing_status = self._extract_filing_status(cleaned_text)

            # Extract dependents
            result.dependents = self._extract_dependents(cleaned_text)

            # Extract location
            result.state, result.country = self._extract_location(cleaned_text)

            # Extract other financial information
            result.spouse_income = await self._extract_spouse_income(cleaned_text)
            result.deductions = self._extract_deductions(cleaned_text)
            result.retirement_contributions = self._extract_retirement_contributions(cleaned_text)

            # Calculate confidence score
            result.confidence_score = self._calculate_confidence(result)

            # Enhanced parsing with LLM if available
            if result.confidence_score < 0.7:
                enhanced_result = await self._enhance_with_llm(text, result)
                if enhanced_result:
                    result = enhanced_result

            nlp_logger.info("Tax input parsed",
                          income=result.income,
                          filing_status=result.filing_status,
                          confidence=result.confidence_score)

            return result

        except Exception as e:
            nlp_logger.error("Failed to parse tax input", error=str(e))
            return ParsedTaxInfo(raw_text=text, confidence_score=0.0)

    def _clean_text(self, text: str) -> str:
        """Clean and normalize input text."""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())

        # Normalize currency symbols
        text = re.sub(r'[$]', '$', text)

        # Normalize numbers with k suffix
        text = re.sub(r'(\d+)k\b', r'\1000', text, flags=re.IGNORECASE)

        return text

    def _extract_spacy_entities(self, doc) -> List[Dict[str, Any]]:
        """Extract entities using spaCy NER."""
        entities = []
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char,
                "confidence": 1.0  # spaCy doesn't provide confidence scores
            })
        return entities

    async def _extract_income(self, text: str) -> Optional[float]:
        """Extract income information from text."""
        text_lower = text.lower()

        for pattern in self._income_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    # Clean the match
                    income_str = re.sub(r'[,$]', '', match)
                    income = float(income_str)

                    # Handle 'k' suffix
                    if 'k' in text_lower[text_lower.find(match):text_lower.find(match) + 20]:
                        income *= 1000

                    # Validate reasonable income range
                    if 1000 <= income <= 10000000:
                        return income

                except (ValueError, AttributeError):
                    continue

        return None

    def _extract_filing_status(self, text: str) -> Optional[FilingStatus]:
        """Extract filing status from text."""
        text_lower = text.lower()

        for status, patterns in self._filing_status_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    return status

        return None

    def _extract_dependents(self, text: str) -> int:
        """Extract number of dependents from text."""
        text_lower = text.lower()

        for pattern in self._dependent_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    dependents = int(match)
                    if 0 <= dependents <= 20:  # Reasonable range
                        return dependents
                except ValueError:
                    continue

        return 0

    def _extract_location(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Extract state and country information."""
        text_lower = text.lower()
        state = None
        country = "US"  # Default assumption

        # State mapping for common abbreviations and full names
        state_mapping = {
            'california': 'CA', 'texas': 'TX', 'florida': 'FL', 'new york': 'NY',
            'pennsylvania': 'PA', 'illinois': 'IL', 'ohio': 'OH', 'georgia': 'GA',
            'north carolina': 'NC', 'michigan': 'MI', 'new jersey': 'NJ',
            'virginia': 'VA', 'washington': 'WA', 'arizona': 'AZ', 'massachusetts': 'MA',
            'tennessee': 'TN', 'indiana': 'IN', 'missouri': 'MO', 'maryland': 'MD',
            'wisconsin': 'WI', 'colorado': 'CO', 'minnesota': 'MN', 'south carolina': 'SC',
            'alabama': 'AL', 'louisiana': 'LA', 'kentucky': 'KY', 'oregon': 'OR',
            'oklahoma': 'OK', 'connecticut': 'CT', 'utah': 'UT', 'iowa': 'IA',
            'nevada': 'NV', 'arkansas': 'AR', 'mississippi': 'MS', 'kansas': 'KS',
            'new mexico': 'NM', 'nebraska': 'NE', 'west virginia': 'WV',
            'idaho': 'ID', 'hawaii': 'HI', 'new hampshire': 'NH', 'maine': 'ME',
            'montana': 'MT', 'rhode island': 'RI', 'delaware': 'DE',
            'south dakota': 'SD', 'north dakota': 'ND', 'alaska': 'AK',
            'vermont': 'VT', 'wyoming': 'WY'
        }

        for pattern in self._state_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                match = match.strip().lower()
                if match in state_mapping:
                    state = state_mapping[match]
                    break
                elif len(match) == 2 and match.upper() in state_mapping.values():
                    state = match.upper()
                    break

        # Check for other countries
        if any(country_name in text_lower for country_name in ['canada', 'canadian', 'uk', 'britain', 'australia']):
            if 'canada' in text_lower or 'canadian' in text_lower:
                country = 'CA'
            elif 'uk' in text_lower or 'britain' in text_lower:
                country = 'GB'
            elif 'australia' in text_lower:
                country = 'AU'

        return state, country

    async def _extract_spouse_income(self, text: str) -> Optional[float]:
        """Extract spouse income information."""
        text_lower = text.lower()
        spouse_patterns = [
            r'(?:spouse|husband|wife|partner).*?(?:makes?|earns?|income).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:spouse|husband|wife|partner).*?[\$](\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'[\$](\d{1,3}(?:,\d{3})*(?:\.\d{2})?).*?(?:spouse|husband|wife|partner)'
        ]

        for pattern in spouse_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    income_str = re.sub(r'[,$]', '', match)
                    income = float(income_str)

                    if 'k' in text_lower:
                        income *= 1000

                    if 1000 <= income <= 10000000:
                        return income
                except ValueError:
                    continue

        return None

    def _extract_deductions(self, text: str) -> List[Dict[str, Any]]:
        """Extract deduction information."""
        deductions = []
        text_lower = text.lower()

        deduction_patterns = {
            'mortgage_interest': r'(?:mortgage|home loan).*?interest.*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            'charitable_donations': r'(?:charity|donation|charitable).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            'medical_expenses': r'(?:medical|health).*?(?:expenses?|costs?).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            'student_loan_interest': r'(?:student loan).*?interest.*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            'state_taxes': r'(?:state tax|property tax).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
        }

        for deduction_type, pattern in deduction_patterns.items():
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    amount_str = re.sub(r'[,$]', '', match)
                    amount = float(amount_str)
                    if 0 < amount <= 1000000:  # Reasonable range
                        deductions.append({
                            'type': deduction_type,
                            'amount': amount,
                            'description': f'{deduction_type.replace("_", " ").title()}'
                        })
                except ValueError:
                    continue

        return deductions

    def _extract_retirement_contributions(self, text: str) -> Optional[float]:
        """Extract retirement contribution information."""
        text_lower = text.lower()
        retirement_patterns = [
            r'(?:401k|401\(k\)|ira|retirement).*?(?:contribution|contribute).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:contribute|contributing).*?[\$]?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?).*?(?:401k|401\(k\)|ira|retirement)',
            r'[\$](\d{1,3}(?:,\d{3})*(?:\.\d{2})?).*?(?:401k|401\(k\)|ira|retirement)'
        ]

        for pattern in retirement_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                try:
                    amount_str = re.sub(r'[,$]', '', match)
                    amount = float(amount_str)
                    if 0 < amount <= 100000:  # Reasonable range
                        return amount
                except ValueError:
                    continue

        return None

    def _calculate_confidence(self, result: ParsedTaxInfo) -> float:
        """Calculate confidence score based on extracted information."""
        score = 0.0
        total_fields = 6

        if result.income is not None:
            score += 0.3  # Income is most important
        if result.filing_status is not None:
            score += 0.2
        if result.state is not None:
            score += 0.15
        if result.dependents > 0:
            score += 0.1
        if result.deductions:
            score += 0.15
        if result.extracted_entities:
            score += 0.1

        return min(score, 1.0)

    async def _enhance_with_llm(self, text: str, current_result: ParsedTaxInfo) -> Optional[ParsedTaxInfo]:
        """Use LLM to enhance parsing for complex queries."""
        try:
            prompt = f"""
Extract tax information from this text: "{text}"

Return a JSON object with these fields:
- income: annual income as a number (or null)
- filing_status: one of "single", "marriedFilingJointly", "marriedFilingSeparately", "headOfHousehold" (or null)
- dependents: number of dependents as integer
- state: US state code like "CA" (or null)
- confidence: confidence score from 0.0 to 1.0

Example: {{"income": 75000, "filing_status": "marriedFilingJointly", "dependents": 2, "state": "CA", "confidence": 0.9}}

JSON:"""

            response = await self.model_manager.generate_text(
                prompt,
                max_new_tokens=100,
                temperature=0.3
            )

            if response:
                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    try:
                        parsed_data = json.loads(json_match.group())

                        # Update result with LLM findings
                        if parsed_data.get('income') and not current_result.income:
                            current_result.income = float(parsed_data['income'])

                        if parsed_data.get('filing_status') and not current_result.filing_status:
                            try:
                                current_result.filing_status = FilingStatus(parsed_data['filing_status'])
                            except ValueError:
                                pass

                        if parsed_data.get('dependents') and current_result.dependents == 0:
                            current_result.dependents = int(parsed_data['dependents'])

                        if parsed_data.get('state') and not current_result.state:
                            current_result.state = parsed_data['state']

                        # Update confidence score
                        llm_confidence = float(parsed_data.get('confidence', 0.5))
                        current_result.confidence_score = max(current_result.confidence_score, llm_confidence)

                        return current_result

                    except (json.JSONDecodeError, ValueError, KeyError) as e:
                        nlp_logger.warning("Failed to parse LLM JSON response", error=str(e))

        except Exception as e:
            nlp_logger.error("LLM enhancement failed", error=str(e))

        return None

    async def validate_parsing_result(self, result: ParsedTaxInfo) -> Dict[str, Any]:
        """Validate and provide feedback on parsing results."""
        validation = {
            "is_valid": True,
            "warnings": [],
            "suggestions": [],
            "confidence": result.confidence_score
        }

        # Income validation
        if result.income is None:
            validation["warnings"].append("No income information found")
            validation["suggestions"].append("Please specify your annual income")
        elif result.income < 1000:
            validation["warnings"].append("Income seems unusually low")
        elif result.income > 10000000:
            validation["warnings"].append("Income seems unusually high")

        # Filing status validation
        if result.filing_status is None:
            validation["warnings"].append("No filing status specified")
            validation["suggestions"].append("Please specify if you're single, married, etc.")

        # State validation
        if result.state is None:
            validation["suggestions"].append("Specify your state for more accurate calculations")

        # Overall confidence check
        if result.confidence_score < 0.5:
            validation["is_valid"] = False
            validation["suggestions"].append("Please provide more specific information for better accuracy")

        return validation


# Global service instance
nlp_service = TaxNLPService()
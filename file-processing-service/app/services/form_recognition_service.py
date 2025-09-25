"""
Form recognition service for identifying tax document types
"""
import re
import difflib
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from collections import Counter

from app.config import settings, FORM_CONFIGS
from app.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class FormPattern:
    """Pattern for form recognition"""
    form_type: str
    country: str
    patterns: List[str]
    keywords: List[str]
    exclusion_patterns: List[str]
    confidence_weight: float


class FormRecognitionService:
    """Service for recognizing tax form types from OCR text"""

    def __init__(self):
        self.confidence_threshold = settings.form_confidence_threshold
        self.form_patterns = self._load_form_patterns()

    def _load_form_patterns(self) -> List[FormPattern]:
        """Load form recognition patterns"""
        patterns = []

        # US Forms
        patterns.extend([
            FormPattern(
                form_type="W-2",
                country="US",
                patterns=[
                    r"w-?2\s+wage\s+and\s+tax\s+statement",
                    r"form\s+w-?2",
                    r"wage\s+and\s+tax\s+statement",
                    r"copy\s+[abc]\s+for\s+employee",
                    r"department\s+of\s+the\s+treasury",
                    r"internal\s+revenue\s+service"
                ],
                keywords=[
                    "w2", "w-2", "wage", "tax", "statement", "employee", "employer",
                    "social security", "medicare", "federal", "withholding",
                    "ein", "ssn", "wages", "tips", "compensation"
                ],
                exclusion_patterns=[
                    r"1099", r"1040", r"schedule", r"amendment"
                ],
                confidence_weight=1.0
            ),
            FormPattern(
                form_type="1099-MISC",
                country="US",
                patterns=[
                    r"1099-?misc",
                    r"form\s+1099-?misc",
                    r"miscellaneous\s+income",
                    r"nonemployee\s+compensation",
                    r"payer\s+made\s+direct\s+sales"
                ],
                keywords=[
                    "1099", "misc", "miscellaneous", "income", "nonemployee",
                    "compensation", "payer", "recipient", "rents", "royalties",
                    "other income", "federal income tax withheld"
                ],
                exclusion_patterns=[
                    r"w-?2", r"1040", r"schedule"
                ],
                confidence_weight=1.0
            ),
            FormPattern(
                form_type="1099-INT",
                country="US",
                patterns=[
                    r"1099-?int",
                    r"form\s+1099-?int",
                    r"interest\s+income"
                ],
                keywords=[
                    "1099", "int", "interest", "income", "payer", "recipient",
                    "interest income", "federal income tax withheld"
                ],
                exclusion_patterns=[
                    r"w-?2", r"1040", r"misc", r"div"
                ],
                confidence_weight=1.0
            ),
            FormPattern(
                form_type="1099-DIV",
                country="US",
                patterns=[
                    r"1099-?div",
                    r"form\s+1099-?div",
                    r"dividends\s+and\s+distributions"
                ],
                keywords=[
                    "1099", "div", "dividends", "distributions", "ordinary dividends",
                    "qualified dividends", "capital gain distributions"
                ],
                exclusion_patterns=[
                    r"w-?2", r"1040", r"misc", r"int"
                ],
                confidence_weight=1.0
            )
        ])

        # Canadian Forms
        patterns.extend([
            FormPattern(
                form_type="T4",
                country="CA",
                patterns=[
                    r"t4\s+statement\s+of\s+remuneration\s+paid",
                    r"form\s+t4",
                    r"statement\s+of\s+remuneration\s+paid",
                    r"canada\s+revenue\s+agency"
                ],
                keywords=[
                    "t4", "statement", "remuneration", "paid", "canada", "revenue",
                    "agency", "employment", "income", "cpp", "ei", "income tax",
                    "sin", "social insurance number"
                ],
                exclusion_patterns=[
                    r"t5", r"t3", r"t1", r"t4a"
                ],
                confidence_weight=1.0
            ),
            FormPattern(
                form_type="T4A",
                country="CA",
                patterns=[
                    r"t4a\s+statement\s+of\s+pension",
                    r"form\s+t4a",
                    r"statement\s+of\s+pension",
                    r"retirement\s+income"
                ],
                keywords=[
                    "t4a", "pension", "retirement", "income", "annuity",
                    "rrsp", "rrif", "lif"
                ],
                exclusion_patterns=[
                    r"t4\s", r"t5", r"t3", r"t1"
                ],
                confidence_weight=1.0
            )
        ])

        # UK Forms
        patterns.extend([
            FormPattern(
                form_type="P60",
                country="UK",
                patterns=[
                    r"p60\s+end\s+of\s+year\s+certificate",
                    r"form\s+p60",
                    r"end\s+of\s+year\s+certificate",
                    r"hmrc\s+pay\s+as\s+you\s+earn"
                ],
                keywords=[
                    "p60", "end", "year", "certificate", "hmrc", "paye",
                    "pay as you earn", "national insurance", "tax code",
                    "total pay", "total tax", "ni number"
                ],
                exclusion_patterns=[
                    r"p45", r"p11d", r"sa100"
                ],
                confidence_weight=1.0
            ),
            FormPattern(
                form_type="P45",
                country="UK",
                patterns=[
                    r"p45\s+details\s+of\s+employee\s+leaving\s+work",
                    r"form\s+p45",
                    r"details\s+of\s+employee\s+leaving\s+work"
                ],
                keywords=[
                    "p45", "employee", "leaving", "work", "hmrc", "paye",
                    "tax code", "pay", "tax", "ni number"
                ],
                exclusion_patterns=[
                    r"p60", r"p11d", r"sa100"
                ],
                confidence_weight=1.0
            )
        ])

        return patterns

    async def identify_form_type(self, ocr_text: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Identify the type of tax form from OCR text

        Args:
            ocr_text: Text extracted from the document via OCR
            filename: Original filename (optional, for additional context)

        Returns:
            Dictionary containing form identification results
        """
        try:
            logger.info("Starting form type identification")

            if not ocr_text or len(ocr_text.strip()) < 10:
                return {
                    "form_type": "unknown",
                    "country": "unknown",
                    "confidence": 0.0,
                    "details": "Insufficient text for form identification"
                }

            # Normalize text for processing
            normalized_text = self._normalize_text(ocr_text)

            # Score each form pattern
            form_scores = []
            for pattern in self.form_patterns:
                score = await self._calculate_form_score(pattern, normalized_text, filename)
                if score > 0:
                    form_scores.append({
                        "form_type": pattern.form_type,
                        "country": pattern.country,
                        "score": score,
                        "confidence": min(score, 1.0)
                    })

            # Sort by score (highest first)
            form_scores.sort(key=lambda x: x["score"], reverse=True)

            if not form_scores:
                return {
                    "form_type": "unknown",
                    "country": "unknown",
                    "confidence": 0.0,
                    "details": "No matching form patterns found",
                    "alternatives": []
                }

            # Get the best match
            best_match = form_scores[0]

            # Check if confidence meets threshold
            if best_match["confidence"] < self.confidence_threshold:
                return {
                    "form_type": "unknown",
                    "country": "unknown",
                    "confidence": best_match["confidence"],
                    "details": f"Best match confidence ({best_match['confidence']:.2f}) below threshold ({self.confidence_threshold})",
                    "alternatives": form_scores[:3]
                }

            result = {
                "form_type": best_match["form_type"],
                "country": best_match["country"],
                "confidence": best_match["confidence"],
                "details": f"Identified as {best_match['form_type']} with {best_match['confidence']:.2f} confidence",
                "alternatives": form_scores[1:3] if len(form_scores) > 1 else []
            }

            # Extract tax year if possible
            tax_year = await self._extract_tax_year(normalized_text)
            if tax_year:
                result["tax_year"] = tax_year

            logger.info(
                f"Form identification completed",
                extra={
                    "form_type": result["form_type"],
                    "confidence": result["confidence"],
                    "country": result["country"]
                }
            )

            return result

        except Exception as e:
            logger.error(f"Error in form identification: {str(e)}", exc_info=True)
            return {
                "form_type": "unknown",
                "country": "unknown",
                "confidence": 0.0,
                "details": f"Error during identification: {str(e)}",
                "error": str(e)
            }

    async def _calculate_form_score(
        self,
        pattern: FormPattern,
        text: str,
        filename: Optional[str] = None
    ) -> float:
        """Calculate confidence score for a form pattern"""
        try:
            score = 0.0

            # Check for exclusion patterns first
            for exclusion in pattern.exclusion_patterns:
                if re.search(exclusion, text, re.IGNORECASE):
                    return 0.0  # Exclude this form type

            # Pattern matching
            pattern_matches = 0
            for pattern_regex in pattern.patterns:
                if re.search(pattern_regex, text, re.IGNORECASE):
                    pattern_matches += 1

            if pattern_matches > 0:
                score += (pattern_matches / len(pattern.patterns)) * 0.5

            # Keyword matching
            keyword_matches = 0
            text_words = set(re.findall(r'\b\w+\b', text.lower()))

            for keyword in pattern.keywords:
                keyword_words = set(keyword.lower().split())
                if keyword_words.issubset(text_words):
                    keyword_matches += 1

            if keyword_matches > 0:
                keyword_score = keyword_matches / len(pattern.keywords)
                score += keyword_score * 0.4

            # Filename bonus
            if filename:
                filename_lower = filename.lower()
                form_type_lower = pattern.form_type.lower().replace("-", "")
                if form_type_lower in filename_lower:
                    score += 0.1

            # Apply confidence weight
            score *= pattern.confidence_weight

            return score

        except Exception as e:
            logger.error(f"Error calculating form score: {str(e)}")
            return 0.0

    def _normalize_text(self, text: str) -> str:
        """Normalize text for better pattern matching"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove special characters but keep hyphens and periods
        text = re.sub(r'[^\w\s\-\.]', ' ', text)

        # Convert to lowercase
        text = text.lower()

        return text.strip()

    async def _extract_tax_year(self, text: str) -> Optional[int]:
        """Extract tax year from document text"""
        try:
            # Look for year patterns
            year_patterns = [
                r'tax\s+year\s+(\d{4})',
                r'for\s+the\s+year\s+(\d{4})',
                r'(\d{4})\s+tax\s+year',
                r'form\s+year\s+(\d{4})',
                r'calendar\s+year\s+(\d{4})'
            ]

            for pattern in year_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                for match in matches:
                    year = int(match)
                    # Validate reasonable tax year range
                    if settings.date_min_year <= year <= settings.date_max_year:
                        return year

            # Look for standalone 4-digit years (be more conservative)
            year_matches = re.findall(r'\b(20\d{2})\b', text)
            year_counts = Counter(year_matches)

            if year_counts:
                # Get the most common year
                most_common_year = int(year_counts.most_common(1)[0][0])
                if settings.date_min_year <= most_common_year <= settings.date_max_year:
                    return most_common_year

            return None

        except Exception as e:
            logger.error(f"Error extracting tax year: {str(e)}")
            return None

    async def get_form_fields(self, form_type: str, country: str) -> Dict[str, Any]:
        """
        Get expected fields for a form type

        Args:
            form_type: Type of the form (e.g., "W-2", "T4")
            country: Country code (e.g., "US", "CA")

        Returns:
            Dictionary containing form field definitions
        """
        try:
            form_config = FORM_CONFIGS.get(country, {}).get(form_type)

            if not form_config:
                return {
                    "form_type": form_type,
                    "country": country,
                    "fields": {},
                    "error": f"No configuration found for {form_type} in {country}"
                }

            return {
                "form_type": form_type,
                "country": country,
                "fields": form_config.get("fields", {}),
                "requirements": form_config.get("requirements", {}),
                "validation_rules": form_config.get("validation", {})
            }

        except Exception as e:
            logger.error(f"Error getting form fields: {str(e)}")
            return {
                "form_type": form_type,
                "country": country,
                "fields": {},
                "error": str(e)
            }

    async def validate_form_completeness(
        self,
        form_type: str,
        country: str,
        extracted_fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate if all required fields are present for a form

        Args:
            form_type: Type of the form
            country: Country code
            extracted_fields: Fields extracted from the document

        Returns:
            Validation results
        """
        try:
            form_config = FORM_CONFIGS.get(country, {}).get(form_type)

            if not form_config:
                return {
                    "valid": False,
                    "error": f"No configuration found for {form_type}",
                    "missing_fields": [],
                    "completeness": 0.0
                }

            expected_fields = form_config.get("fields", {})
            required_fields = [
                field_name for field_name, field_config in expected_fields.items()
                if field_config.get("required", False)
            ]

            # Check for missing required fields
            missing_fields = []
            present_fields = []

            for field_name in required_fields:
                if field_name not in extracted_fields or not extracted_fields[field_name]:
                    missing_fields.append(field_name)
                else:
                    present_fields.append(field_name)

            # Calculate completeness percentage
            total_fields = len(expected_fields)
            present_count = len([f for f in extracted_fields if f in expected_fields])
            completeness = present_count / total_fields if total_fields > 0 else 0.0

            # Calculate required field completeness
            required_completeness = len(present_fields) / len(required_fields) if required_fields else 1.0

            return {
                "valid": len(missing_fields) == 0,
                "missing_required_fields": missing_fields,
                "present_required_fields": present_fields,
                "completeness": completeness,
                "required_completeness": required_completeness,
                "total_fields": total_fields,
                "present_fields": present_count,
                "summary": f"{present_count}/{total_fields} fields present, {len(present_fields)}/{len(required_fields)} required fields present"
            }

        except Exception as e:
            logger.error(f"Error validating form completeness: {str(e)}")
            return {
                "valid": False,
                "error": str(e),
                "missing_fields": [],
                "completeness": 0.0
            }

    def get_supported_forms(self) -> Dict[str, List[str]]:
        """Get list of supported form types by country"""
        supported = {}

        for pattern in self.form_patterns:
            country = pattern.country
            if country not in supported:
                supported[country] = []

            if pattern.form_type not in supported[country]:
                supported[country].append(pattern.form_type)

        return supported
"""
Data extraction service for parsing tax form fields
"""
import re
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from app.config import settings, FORM_CONFIGS
from app.models.database import FieldExtraction, ExtractedData, ConfidenceLevel
from app.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class FieldMatch:
    """Represents a field match with its metadata"""
    field_name: str
    raw_value: str
    cleaned_value: str
    formatted_value: str
    confidence: float
    bbox: Optional[Dict[str, int]]
    validation_errors: List[str]


class DataExtractionService:
    """Service for extracting structured data from tax forms"""

    def __init__(self):
        self.field_confidence_threshold = settings.field_confidence_threshold
        self.min_text_length = settings.min_text_length
        self.max_text_length = settings.max_text_length

    async def extract_form_data(
        self,
        form_type: str,
        country: str,
        ocr_text: str,
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Extract structured data from a tax form

        Args:
            form_type: Type of tax form (e.g., "W-2", "T4")
            country: Country code (e.g., "US", "CA")
            ocr_text: Raw OCR text from the document
            word_positions: Optional word position data from OCR

        Returns:
            Dictionary containing extracted field data
        """
        try:
            logger.info(f"Starting data extraction for {form_type} ({country})")

            # Get form configuration
            form_config = FORM_CONFIGS.get(country, {}).get(form_type)
            if not form_config:
                return {
                    "success": False,
                    "error": f"No configuration found for {form_type} in {country}",
                    "extracted_fields": {},
                    "field_matches": []
                }

            # Normalize text for processing
            normalized_text = self._normalize_text(ocr_text)

            # Extract fields based on form type
            field_matches = []
            if form_type == "W-2":
                field_matches = await self._extract_w2_fields(normalized_text, word_positions)
            elif form_type == "1099-MISC":
                field_matches = await self._extract_1099_misc_fields(normalized_text, word_positions)
            elif form_type == "T4":
                field_matches = await self._extract_t4_fields(normalized_text, word_positions)
            elif form_type == "P60":
                field_matches = await self._extract_p60_fields(normalized_text, word_positions)
            else:
                # Generic extraction based on configuration
                field_matches = await self._extract_generic_fields(
                    form_config, normalized_text, word_positions
                )

            # Validate and format extracted data
            validated_fields = {}
            field_confidences = {}
            field_locations = {}
            validation_errors = {}

            for match in field_matches:
                # Validate field value
                field_config = form_config.get("fields", {}).get(match.field_name, {})
                validation_result = await self._validate_field_value(
                    match.cleaned_value,
                    field_config,
                    match.field_name
                )

                validated_fields[match.field_name] = match.formatted_value
                field_confidences[match.field_name] = match.confidence
                field_locations[match.field_name] = match.bbox

                if validation_result["errors"]:
                    validation_errors[match.field_name] = validation_result["errors"]

            # Calculate overall confidence
            overall_confidence = await self._calculate_overall_confidence(
                field_matches, form_config
            )

            # Determine if manual review is needed
            requires_manual_review = (
                overall_confidence < self.field_confidence_threshold or
                len(validation_errors) > 0 or
                len(validated_fields) < len([f for f, c in form_config.get("fields", {}).items() if c.get("required")])
            )

            result = {
                "success": True,
                "form_type": form_type,
                "country": country,
                "extracted_fields": validated_fields,
                "field_confidences": field_confidences,
                "field_locations": field_locations,
                "validation_errors": validation_errors,
                "overall_confidence": overall_confidence,
                "confidence_level": self._get_confidence_level(overall_confidence),
                "requires_manual_review": requires_manual_review,
                "field_matches": [self._field_match_to_dict(match) for match in field_matches],
                "extraction_summary": {
                    "total_fields_expected": len(form_config.get("fields", {})),
                    "fields_extracted": len(validated_fields),
                    "required_fields_missing": len([
                        f for f, c in form_config.get("fields", {}).items()
                        if c.get("required") and f not in validated_fields
                    ]),
                    "fields_with_errors": len(validation_errors)
                }
            }

            logger.info(
                f"Data extraction completed",
                extra={
                    "form_type": form_type,
                    "fields_extracted": len(validated_fields),
                    "overall_confidence": overall_confidence,
                    "requires_manual_review": requires_manual_review
                }
            )

            return result

        except Exception as e:
            logger.error(f"Error in data extraction: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "extracted_fields": {},
                "field_matches": []
            }

    async def _extract_w2_fields(
        self,
        text: str,
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> List[FieldMatch]:
        """Extract fields specific to W-2 forms"""
        matches = []

        # Box 1: Wages, tips, other compensation
        wages_match = await self._extract_currency_field(
            text, "wages",
            patterns=[
                r"box\s*1.*?wages.*?(\$?[\d,]+\.?\d*)",
                r"wages.*?tips.*?compensation.*?(\$?[\d,]+\.?\d*)",
                r"1\s*wages.*?(\$?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if wages_match:
            matches.append(wages_match)

        # Box 2: Federal income tax withheld
        federal_tax_match = await self._extract_currency_field(
            text, "federal_tax",
            patterns=[
                r"box\s*2.*?federal.*?tax.*?(\$?[\d,]+\.?\d*)",
                r"federal.*?income.*?tax.*?withheld.*?(\$?[\d,]+\.?\d*)",
                r"2\s*federal.*?(\$?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if federal_tax_match:
            matches.append(federal_tax_match)

        # Employee name
        name_match = await self._extract_text_field(
            text, "employee_name",
            patterns=[
                r"employee.*?name.*?([a-z]+(?:\s+[a-z]+)*)",
                r"name.*?([a-z]+(?:\s+[a-z]+)*)"
            ],
            word_positions
        )
        if name_match:
            matches.append(name_match)

        # SSN
        ssn_match = await self._extract_ssn_field(
            text, "employee_ssn",
            patterns=[
                r"social.*?security.*?number.*?(\d{3}-?\d{2}-?\d{4})",
                r"ssn.*?(\d{3}-?\d{2}-?\d{4})",
                r"(\d{3}-?\d{2}-?\d{4})"
            ],
            word_positions
        )
        if ssn_match:
            matches.append(ssn_match)

        # Employer name
        employer_match = await self._extract_text_field(
            text, "employer_name",
            patterns=[
                r"employer.*?name.*?([a-z]+(?:\s+[a-z]+)*)",
                r"company.*?name.*?([a-z]+(?:\s+[a-z]+)*)"
            ],
            word_positions
        )
        if employer_match:
            matches.append(employer_match)

        # EIN
        ein_match = await self._extract_ein_field(
            text, "employer_ein",
            patterns=[
                r"employer.*?identification.*?number.*?(\d{2}-?\d{7})",
                r"ein.*?(\d{2}-?\d{7})",
                r"(\d{2}-?\d{7})"
            ],
            word_positions
        )
        if ein_match:
            matches.append(ein_match)

        return matches

    async def _extract_1099_misc_fields(
        self,
        text: str,
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> List[FieldMatch]:
        """Extract fields specific to 1099-MISC forms"""
        matches = []

        # Nonemployee compensation
        nonemployee_match = await self._extract_currency_field(
            text, "nonemployee_compensation",
            patterns=[
                r"nonemployee.*?compensation.*?(\$?[\d,]+\.?\d*)",
                r"box\s*1.*?nonemployee.*?(\$?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if nonemployee_match:
            matches.append(nonemployee_match)

        # Rents
        rents_match = await self._extract_currency_field(
            text, "rents",
            patterns=[
                r"rents.*?(\$?[\d,]+\.?\d*)",
                r"box\s*1.*?rents.*?(\$?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if rents_match:
            matches.append(rents_match)

        # Payer name
        payer_match = await self._extract_text_field(
            text, "payer_name",
            patterns=[
                r"payer.*?name.*?([a-z]+(?:\s+[a-z]+)*)",
                r"payor.*?([a-z]+(?:\s+[a-z]+)*)"
            ],
            word_positions
        )
        if payer_match:
            matches.append(payer_match)

        return matches

    async def _extract_t4_fields(
        self,
        text: str,
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> List[FieldMatch]:
        """Extract fields specific to T4 forms"""
        matches = []

        # Employment income
        income_match = await self._extract_currency_field(
            text, "employment_income",
            patterns=[
                r"employment.*?income.*?(\$?[\d,]+\.?\d*)",
                r"box\s*14.*?(\$?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if income_match:
            matches.append(income_match)

        # Income tax deducted
        tax_match = await self._extract_currency_field(
            text, "income_tax",
            patterns=[
                r"income.*?tax.*?deducted.*?(\$?[\d,]+\.?\d*)",
                r"box\s*22.*?(\$?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if tax_match:
            matches.append(tax_match)

        # SIN
        sin_match = await self._extract_sin_field(
            text, "employee_sin",
            patterns=[
                r"social.*?insurance.*?number.*?(\d{3}\s?\d{3}\s?\d{3})",
                r"sin.*?(\d{3}\s?\d{3}\s?\d{3})",
                r"(\d{3}\s?\d{3}\s?\d{3})"
            ],
            word_positions
        )
        if sin_match:
            matches.append(sin_match)

        return matches

    async def _extract_p60_fields(
        self,
        text: str,
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> List[FieldMatch]:
        """Extract fields specific to P60 forms"""
        matches = []

        # Total pay
        pay_match = await self._extract_currency_field(
            text, "total_pay",
            patterns=[
                r"total.*?pay.*?(\£?[\d,]+\.?\d*)",
                r"pay.*?and.*?allowances.*?(\£?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if pay_match:
            matches.append(pay_match)

        # Total tax
        tax_match = await self._extract_currency_field(
            text, "total_tax",
            patterns=[
                r"total.*?tax.*?(\£?[\d,]+\.?\d*)",
                r"income.*?tax.*?(\£?[\d,]+\.?\d*)"
            ],
            word_positions
        )
        if tax_match:
            matches.append(tax_match)

        # National Insurance Number
        nino_match = await self._extract_nino_field(
            text, "employee_nino",
            patterns=[
                r"national.*?insurance.*?number.*?([a-z]{2}\d{6}[a-z])",
                r"ni.*?number.*?([a-z]{2}\d{6}[a-z])",
                r"([a-z]{2}\d{6}[a-z])"
            ],
            word_positions
        )
        if nino_match:
            matches.append(nino_match)

        return matches

    async def _extract_generic_fields(
        self,
        form_config: Dict[str, Any],
        text: str,
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> List[FieldMatch]:
        """Extract fields using generic patterns based on form configuration"""
        matches = []

        fields_config = form_config.get("fields", {})

        for field_name, field_config in fields_config.items():
            field_type = field_config.get("type", "text")

            if field_type == "amount":
                match = await self._extract_currency_field(
                    text, field_name,
                    patterns=[
                        rf"{field_name}.*?(\$?[\d,]+\.?\d*)",
                        rf"box.*?{field_config.get('box', '')}.*?(\$?[\d,]+\.?\d*)"
                    ],
                    word_positions
                )
            elif field_type == "date":
                match = await self._extract_date_field(
                    text, field_name,
                    patterns=[
                        rf"{field_name}.*?(\d{{1,2}}/\d{{1,2}}/\d{{4}})",
                        rf"{field_name}.*?(\d{{1,2}}-\d{{1,2}}-\d{{4}})"
                    ],
                    word_positions
                )
            else:
                match = await self._extract_text_field(
                    text, field_name,
                    patterns=[
                        rf"{field_name}.*?([a-z]+(?:\s+[a-z]+)*)"
                    ],
                    word_positions
                )

            if match:
                matches.append(match)

        return matches

    async def _extract_currency_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract a currency field"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw_value = match.group(1)
                cleaned_value = self._clean_currency_value(raw_value)
                formatted_value = self._format_currency_value(cleaned_value)

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.8,  # Base confidence for currency fields
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    async def _extract_text_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract a text field"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw_value = match.group(1)
                cleaned_value = self._clean_text_value(raw_value)
                formatted_value = cleaned_value.title()

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.7,  # Base confidence for text fields
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    async def _extract_ssn_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract a Social Security Number field"""
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                raw_value = match.group(1)
                cleaned_value = re.sub(r'[^\d]', '', raw_value)
                formatted_value = f"{cleaned_value[:3]}-{cleaned_value[3:5]}-{cleaned_value[5:]}"

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.9,  # High confidence for SSN pattern matching
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    async def _extract_ein_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract an Employer Identification Number field"""
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                raw_value = match.group(1)
                cleaned_value = re.sub(r'[^\d]', '', raw_value)
                formatted_value = f"{cleaned_value[:2]}-{cleaned_value[2:]}"

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.9,
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    async def _extract_sin_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract a Social Insurance Number field (Canada)"""
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                raw_value = match.group(1)
                cleaned_value = re.sub(r'[^\d]', '', raw_value)
                formatted_value = f"{cleaned_value[:3]} {cleaned_value[3:6]} {cleaned_value[6:]}"

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.9,
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    async def _extract_nino_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract a National Insurance Number field (UK)"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw_value = match.group(1)
                cleaned_value = raw_value.upper().replace(" ", "")
                formatted_value = f"{cleaned_value[:2]} {cleaned_value[2:8]} {cleaned_value[8:]}"

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.9,
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    async def _extract_date_field(
        self,
        text: str,
        field_name: str,
        patterns: List[str],
        word_positions: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[FieldMatch]:
        """Extract a date field"""
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                raw_value = match.group(1)
                cleaned_value = raw_value
                formatted_value = self._format_date_value(raw_value)

                bbox = self._find_bbox_for_text(raw_value, word_positions) if word_positions else None

                return FieldMatch(
                    field_name=field_name,
                    raw_value=raw_value,
                    cleaned_value=cleaned_value,
                    formatted_value=formatted_value,
                    confidence=0.8,
                    bbox=bbox,
                    validation_errors=[]
                )

        return None

    def _clean_currency_value(self, value: str) -> str:
        """Clean and normalize currency values"""
        # Remove currency symbols and spaces
        cleaned = re.sub(r'[$£€,\s]', '', value)
        return cleaned

    def _format_currency_value(self, value: str) -> str:
        """Format currency value"""
        try:
            amount = Decimal(value)
            return f"{amount:.2f}"
        except (InvalidOperation, ValueError):
            return value

    def _clean_text_value(self, value: str) -> str:
        """Clean and normalize text values"""
        # Remove extra whitespace and clean up
        cleaned = re.sub(r'\s+', ' ', value.strip())
        return cleaned

    def _format_date_value(self, value: str) -> str:
        """Format date value"""
        # Try to parse and reformat date
        try:
            # Handle various date formats
            if '/' in value:
                parts = value.split('/')
                if len(parts) == 3:
                    month, day, year = parts
                    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            elif '-' in value:
                parts = value.split('-')
                if len(parts) == 3:
                    return value  # Already in YYYY-MM-DD format
        except:
            pass

        return value

    def _normalize_text(self, text: str) -> str:
        """Normalize text for extraction"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Convert to lowercase for pattern matching
        return text.lower().strip()

    def _find_bbox_for_text(
        self,
        text: str,
        word_positions: Optional[List[Dict[str, Any]]]
    ) -> Optional[Dict[str, int]]:
        """Find bounding box for extracted text"""
        if not word_positions:
            return None

        text_lower = text.lower()
        for word_data in word_positions:
            if word_data.get('word', '').lower() == text_lower:
                return word_data.get('bbox')

        return None

    async def _validate_field_value(
        self,
        value: str,
        field_config: Dict[str, Any],
        field_name: str
    ) -> Dict[str, Any]:
        """Validate extracted field value"""
        errors = []

        field_type = field_config.get("type", "text")

        if field_type == "amount":
            try:
                amount = Decimal(value)
                if amount < settings.amount_min or amount > settings.amount_max:
                    errors.append(f"Amount {amount} outside valid range")
            except (InvalidOperation, ValueError):
                errors.append(f"Invalid amount format: {value}")

        elif field_type == "date":
            # Basic date validation
            if not re.match(r'\d{4}-\d{2}-\d{2}', value):
                errors.append(f"Invalid date format: {value}")

        elif field_type == "text":
            if len(value) < self.min_text_length:
                errors.append(f"Text too short: {value}")
            elif len(value) > self.max_text_length:
                errors.append(f"Text too long: {value}")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    async def _calculate_overall_confidence(
        self,
        field_matches: List[FieldMatch],
        form_config: Dict[str, Any]
    ) -> float:
        """Calculate overall confidence for extracted data"""
        if not field_matches:
            return 0.0

        # Weight by field importance (required fields have higher weight)
        total_weight = 0
        weighted_confidence = 0

        fields_config = form_config.get("fields", {})

        for match in field_matches:
            field_config = fields_config.get(match.field_name, {})
            weight = 2.0 if field_config.get("required", False) else 1.0

            weighted_confidence += match.confidence * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return weighted_confidence / total_weight

    def _get_confidence_level(self, confidence: float) -> str:
        """Get confidence level string"""
        if confidence >= 0.9:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.7:
            return ConfidenceLevel.MEDIUM
        elif confidence >= 0.5:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.MANUAL_REVIEW

    def _field_match_to_dict(self, match: FieldMatch) -> Dict[str, Any]:
        """Convert FieldMatch to dictionary"""
        return {
            "field_name": match.field_name,
            "raw_value": match.raw_value,
            "cleaned_value": match.cleaned_value,
            "formatted_value": match.formatted_value,
            "confidence": match.confidence,
            "bbox": match.bbox,
            "validation_errors": match.validation_errors
        }
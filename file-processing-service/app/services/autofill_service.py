"""
Auto-fill integration service for tax calculators
"""
import uuid
from typing import Dict, Any, List, Optional
from decimal import Decimal
import httpx

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AutoFillService:
    """Service for integrating extracted data with tax calculators"""

    def __init__(self):
        self.tax_calculator_api_url = settings.tax_calculator_api_url
        self.field_mapping = self._load_field_mappings()

    def _load_field_mappings(self) -> Dict[str, Dict[str, str]]:
        """Load field mappings between extracted data and calculator fields"""
        return {
            "US": {
                "W-2": {
                    "wages": "income.w2_wages",
                    "federal_tax": "withholding.federal_income_tax",
                    "social_security_wages": "income.social_security_wages",
                    "social_security_tax": "withholding.social_security_tax",
                    "medicare_wages": "income.medicare_wages",
                    "medicare_tax": "withholding.medicare_tax",
                    "state_wages": "income.state_wages",
                    "state_tax": "withholding.state_income_tax",
                    "employee_name": "personal.full_name",
                    "employee_ssn": "personal.ssn",
                    "employer_name": "employment.employer_name",
                    "employer_ein": "employment.employer_ein"
                },
                "1099-MISC": {
                    "nonemployee_compensation": "income.misc_income",
                    "rents": "income.rental_income",
                    "royalties": "income.royalty_income",
                    "other_income": "income.other_misc_income",
                    "federal_tax": "withholding.federal_income_tax",
                    "payer_name": "misc_income.payer_name",
                    "payer_tin": "misc_income.payer_tin"
                },
                "1099-INT": {
                    "interest_income": "income.interest_income",
                    "federal_tax": "withholding.federal_income_tax"
                },
                "1099-DIV": {
                    "ordinary_dividends": "income.ordinary_dividends",
                    "qualified_dividends": "income.qualified_dividends",
                    "capital_gain_distributions": "income.capital_gain_distributions"
                }
            },
            "CA": {
                "T4": {
                    "employment_income": "income.employment_income",
                    "income_tax": "withholding.income_tax_deducted",
                    "cpp_pensionable": "income.cpp_pensionable_earnings",
                    "cpp_contributions": "deductions.cpp_contributions",
                    "ei_insurable": "income.ei_insurable_earnings",
                    "ei_premiums": "deductions.ei_premiums",
                    "employee_name": "personal.full_name",
                    "employee_sin": "personal.sin",
                    "employer_name": "employment.employer_name"
                },
                "T4A": {
                    "pension_income": "income.pension_income",
                    "income_tax": "withholding.income_tax_deducted"
                }
            },
            "UK": {
                "P60": {
                    "total_pay": "income.total_pay",
                    "total_tax": "withholding.total_tax",
                    "student_loan": "deductions.student_loan",
                    "employee_name": "personal.full_name",
                    "employee_nino": "personal.ni_number",
                    "employer_name": "employment.employer_name"
                },
                "P45": {
                    "total_pay": "income.total_pay_to_date",
                    "total_tax": "withholding.total_tax_to_date"
                }
            }
        }

    async def prepare_autofill_data(
        self,
        extracted_data: Dict[str, Any],
        form_type: str,
        country: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Prepare extracted data for auto-filling tax calculators

        Args:
            extracted_data: Data extracted from the tax document
            form_type: Type of tax form
            country: Country code
            user_id: ID of the user

        Returns:
            Dictionary containing auto-fill data and metadata
        """
        try:
            logger.info(f"Preparing auto-fill data for {form_type} ({country})")

            # Get field mappings for this form type
            mappings = self.field_mapping.get(country, {}).get(form_type, {})

            if not mappings:
                return {
                    "success": False,
                    "error": f"No field mappings available for {form_type} in {country}",
                    "autofill_data": {},
                    "field_mappings": {}
                }

            # Map extracted fields to calculator fields
            autofill_data = {}
            field_mappings = {}
            confidence_scores = {}
            validation_notes = {}

            extracted_fields = extracted_data.get("extracted_fields", {})
            field_confidences = extracted_data.get("field_confidences", {})
            validation_errors = extracted_data.get("validation_errors", {})

            for source_field, target_field in mappings.items():
                if source_field in extracted_fields:
                    value = extracted_fields[source_field]
                    confidence = field_confidences.get(source_field, 0.0)
                    errors = validation_errors.get(source_field, [])

                    # Transform value based on target field type
                    transformed_value = await self._transform_field_value(
                        value, target_field, source_field
                    )

                    if transformed_value is not None:
                        autofill_data[target_field] = transformed_value
                        field_mappings[source_field] = target_field
                        confidence_scores[target_field] = confidence

                        if errors:
                            validation_notes[target_field] = {
                                "errors": errors,
                                "requires_review": True
                            }

            # Add metadata
            metadata = {
                "form_type": form_type,
                "country": country,
                "extraction_date": extracted_data.get("created_at"),
                "overall_confidence": extracted_data.get("overall_confidence", 0.0),
                "requires_manual_review": extracted_data.get("requires_manual_review", False),
                "total_fields_mapped": len(autofill_data),
                "fields_with_errors": len(validation_notes)
            }

            # Calculate auto-fill completeness
            completeness = await self._calculate_autofill_completeness(
                autofill_data, form_type, country
            )

            result = {
                "success": True,
                "autofill_data": autofill_data,
                "field_mappings": field_mappings,
                "confidence_scores": confidence_scores,
                "validation_notes": validation_notes,
                "metadata": metadata,
                "completeness": completeness,
                "recommendations": await self._generate_recommendations(
                    autofill_data, validation_notes, completeness
                )
            }

            logger.info(
                f"Auto-fill data prepared successfully",
                extra={
                    "form_type": form_type,
                    "fields_mapped": len(autofill_data),
                    "completeness": completeness["percentage"]
                }
            )

            return result

        except Exception as e:
            logger.error(f"Error preparing auto-fill data: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "autofill_data": {},
                "field_mappings": {}
            }

    async def send_to_calculator(
        self,
        autofill_data: Dict[str, Any],
        user_id: str,
        calculator_type: str
    ) -> Dict[str, Any]:
        """
        Send auto-fill data to the tax calculator service

        Args:
            autofill_data: Prepared auto-fill data
            user_id: ID of the user
            calculator_type: Type of calculator to use

        Returns:
            Response from the calculator service
        """
        try:
            logger.info(f"Sending auto-fill data to {calculator_type} calculator")

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.tax_calculator_api_url}/autofill/{calculator_type}",
                    json={
                        "user_id": user_id,
                        "autofill_data": autofill_data["autofill_data"],
                        "metadata": autofill_data["metadata"],
                        "confidence_scores": autofill_data["confidence_scores"]
                    },
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "FileProcessingService/1.0"
                    },
                    timeout=30.0
                )

                if response.status_code == 200:
                    result = response.json()
                    logger.info("Auto-fill data sent successfully to calculator")
                    return {
                        "success": True,
                        "calculator_response": result,
                        "calculator_url": result.get("calculator_url"),
                        "session_id": result.get("session_id")
                    }
                else:
                    logger.error(f"Calculator API returned status {response.status_code}")
                    return {
                        "success": False,
                        "error": f"Calculator API error: {response.status_code}",
                        "details": response.text
                    }

        except httpx.TimeoutException:
            logger.error("Timeout sending data to calculator service")
            return {
                "success": False,
                "error": "Timeout connecting to calculator service"
            }
        except Exception as e:
            logger.error(f"Error sending data to calculator: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

    async def validate_autofill_data(
        self,
        autofill_data: Dict[str, Any],
        form_type: str,
        country: str
    ) -> Dict[str, Any]:
        """
        Validate auto-fill data against tax rules

        Args:
            autofill_data: Auto-fill data to validate
            form_type: Type of tax form
            country: Country code

        Returns:
            Validation results
        """
        try:
            validation_results = {
                "valid": True,
                "errors": [],
                "warnings": [],
                "field_validations": {}
            }

            # Country-specific validation rules
            if country == "US":
                validation_results = await self._validate_us_data(
                    autofill_data, form_type, validation_results
                )
            elif country == "CA":
                validation_results = await self._validate_ca_data(
                    autofill_data, form_type, validation_results
                )
            elif country == "UK":
                validation_results = await self._validate_uk_data(
                    autofill_data, form_type, validation_results
                )

            # Cross-field validation
            validation_results = await self._validate_cross_fields(
                autofill_data, validation_results
            )

            validation_results["valid"] = len(validation_results["errors"]) == 0

            return validation_results

        except Exception as e:
            logger.error(f"Error validating auto-fill data: {str(e)}", exc_info=True)
            return {
                "valid": False,
                "errors": [f"Validation error: {str(e)}"],
                "warnings": [],
                "field_validations": {}
            }

    async def _transform_field_value(
        self,
        value: str,
        target_field: str,
        source_field: str
    ) -> Any:
        """Transform field value based on target field requirements"""
        try:
            # Determine target field type from field name
            if any(keyword in target_field.lower() for keyword in ["income", "wage", "tax", "deduction"]):
                # Currency field
                if isinstance(value, str):
                    # Remove currency symbols and convert to decimal
                    cleaned_value = value.replace("$", "").replace("£", "").replace("€", "").replace(",", "")
                    return float(Decimal(cleaned_value))
                return float(value)

            elif "date" in target_field.lower():
                # Date field - return as ISO format string
                return value

            elif target_field.endswith("_name"):
                # Name field - title case
                return value.title() if isinstance(value, str) else str(value)

            elif any(keyword in target_field.lower() for keyword in ["ssn", "sin", "ein", "tin"]):
                # ID fields - return as formatted string
                return value

            else:
                # Default: return as string
                return str(value)

        except Exception as e:
            logger.error(f"Error transforming field value: {str(e)}")
            return None

    async def _calculate_autofill_completeness(
        self,
        autofill_data: Dict[str, Any],
        form_type: str,
        country: str
    ) -> Dict[str, Any]:
        """Calculate how complete the auto-fill data is"""
        try:
            # Get expected fields for this form type
            mappings = self.field_mapping.get(country, {}).get(form_type, {})
            expected_fields = list(mappings.values())

            # Count how many expected fields have data
            present_fields = [field for field in expected_fields if field in autofill_data]

            percentage = len(present_fields) / len(expected_fields) * 100 if expected_fields else 0

            return {
                "percentage": round(percentage, 1),
                "present_fields": len(present_fields),
                "total_expected": len(expected_fields),
                "missing_fields": [field for field in expected_fields if field not in autofill_data],
                "status": self._get_completeness_status(percentage)
            }

        except Exception as e:
            logger.error(f"Error calculating completeness: {str(e)}")
            return {
                "percentage": 0.0,
                "present_fields": 0,
                "total_expected": 0,
                "missing_fields": [],
                "status": "unknown"
            }

    def _get_completeness_status(self, percentage: float) -> str:
        """Get completeness status string"""
        if percentage >= 90:
            return "excellent"
        elif percentage >= 75:
            return "good"
        elif percentage >= 50:
            return "fair"
        else:
            return "poor"

    async def _generate_recommendations(
        self,
        autofill_data: Dict[str, Any],
        validation_notes: Dict[str, Any],
        completeness: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations for the user"""
        recommendations = []

        # Completeness recommendations
        if completeness["percentage"] < 75:
            recommendations.append(
                f"Only {completeness['percentage']:.1f}% of expected fields were auto-filled. "
                "Please review and manually enter missing information."
            )

        # Validation recommendations
        if validation_notes:
            error_count = len(validation_notes)
            recommendations.append(
                f"{error_count} field(s) require manual review due to extraction errors or low confidence."
            )

        # Field-specific recommendations
        if "income.w2_wages" in autofill_data and "withholding.federal_income_tax" in autofill_data:
            wages = float(autofill_data["income.w2_wages"])
            withholding = float(autofill_data["withholding.federal_income_tax"])
            if withholding > wages * 0.4:  # Sanity check
                recommendations.append(
                    "Federal tax withholding seems unusually high compared to wages. Please verify."
                )

        if not recommendations:
            recommendations.append("Auto-fill data looks good! Please review before submitting.")

        return recommendations

    async def _validate_us_data(
        self,
        autofill_data: Dict[str, Any],
        form_type: str,
        validation_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate US tax data"""
        if form_type == "W-2":
            # Validate wages vs withholding
            wages = autofill_data.get("income.w2_wages")
            federal_tax = autofill_data.get("withholding.federal_income_tax")

            if wages and federal_tax:
                if float(federal_tax) > float(wages):
                    validation_results["errors"].append(
                        "Federal tax withheld cannot exceed total wages"
                    )

                if float(federal_tax) > float(wages) * 0.5:
                    validation_results["warnings"].append(
                        "Federal tax withholding is more than 50% of wages - please verify"
                    )

        return validation_results

    async def _validate_ca_data(
        self,
        autofill_data: Dict[str, Any],
        form_type: str,
        validation_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate Canadian tax data"""
        if form_type == "T4":
            # Validate employment income vs deductions
            income = autofill_data.get("income.employment_income")
            cpp = autofill_data.get("deductions.cpp_contributions")

            if income and cpp:
                # CPP max contribution validation (simplified)
                max_cpp = float(income) * 0.0545  # Approximate max CPP rate
                if float(cpp) > max_cpp:
                    validation_results["warnings"].append(
                        "CPP contributions seem high for the income level"
                    )

        return validation_results

    async def _validate_uk_data(
        self,
        autofill_data: Dict[str, Any],
        form_type: str,
        validation_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate UK tax data"""
        if form_type == "P60":
            # Validate pay vs tax
            total_pay = autofill_data.get("income.total_pay")
            total_tax = autofill_data.get("withholding.total_tax")

            if total_pay and total_tax:
                if float(total_tax) > float(total_pay):
                    validation_results["errors"].append(
                        "Total tax cannot exceed total pay"
                    )

        return validation_results

    async def _validate_cross_fields(
        self,
        autofill_data: Dict[str, Any],
        validation_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate relationships between fields"""
        # Generic cross-field validations

        # Check for negative values in income/tax fields
        for field, value in autofill_data.items():
            if "income" in field or "tax" in field or "withholding" in field:
                try:
                    if float(value) < 0:
                        validation_results["errors"].append(
                            f"{field} cannot be negative"
                        )
                except (ValueError, TypeError):
                    validation_results["errors"].append(
                        f"Invalid numeric value for {field}: {value}"
                    )

        return validation_results

    async def consolidate_multiple_documents(
        self,
        document_data_list: List[Dict[str, Any]],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Consolidate data from multiple documents for the same user

        Args:
            document_data_list: List of auto-fill data from multiple documents
            user_id: ID of the user

        Returns:
            Consolidated auto-fill data
        """
        try:
            logger.info(f"Consolidating data from {len(document_data_list)} documents")

            consolidated = {
                "autofill_data": {},
                "source_documents": [],
                "field_sources": {},
                "confidence_scores": {},
                "validation_notes": {},
                "consolidation_summary": {}
            }

            # Group by form type and country
            document_groups = {}
            for doc_data in document_data_list:
                form_type = doc_data["metadata"]["form_type"]
                country = doc_data["metadata"]["country"]
                key = f"{country}_{form_type}"

                if key not in document_groups:
                    document_groups[key] = []
                document_groups[key].append(doc_data)

            # Consolidate each group
            for group_key, group_docs in document_groups.items():
                for doc_data in group_docs:
                    for field, value in doc_data["autofill_data"].items():
                        if field not in consolidated["autofill_data"]:
                            # First occurrence of this field
                            consolidated["autofill_data"][field] = value
                            consolidated["field_sources"][field] = group_key
                            consolidated["confidence_scores"][field] = doc_data["confidence_scores"].get(field, 0.0)
                        else:
                            # Field already exists - keep higher confidence value
                            existing_confidence = consolidated["confidence_scores"].get(field, 0.0)
                            new_confidence = doc_data["confidence_scores"].get(field, 0.0)

                            if new_confidence > existing_confidence:
                                consolidated["autofill_data"][field] = value
                                consolidated["field_sources"][field] = group_key
                                consolidated["confidence_scores"][field] = new_confidence

                    # Collect source document info
                    consolidated["source_documents"].append({
                        "form_type": doc_data["metadata"]["form_type"],
                        "country": doc_data["metadata"]["country"],
                        "extraction_date": doc_data["metadata"]["extraction_date"],
                        "confidence": doc_data["metadata"]["overall_confidence"]
                    })

                    # Merge validation notes
                    for field, notes in doc_data["validation_notes"].items():
                        if field not in consolidated["validation_notes"]:
                            consolidated["validation_notes"][field] = notes

            # Generate consolidation summary
            consolidated["consolidation_summary"] = {
                "total_documents": len(document_data_list),
                "document_types": len(document_groups),
                "total_fields": len(consolidated["autofill_data"]),
                "average_confidence": sum(consolidated["confidence_scores"].values()) / len(consolidated["confidence_scores"]) if consolidated["confidence_scores"] else 0.0
            }

            logger.info(
                f"Document consolidation completed",
                extra={
                    "total_documents": len(document_data_list),
                    "consolidated_fields": len(consolidated["autofill_data"])
                }
            )

            return {
                "success": True,
                **consolidated
            }

        except Exception as e:
            logger.error(f"Error consolidating documents: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "autofill_data": {}
            }
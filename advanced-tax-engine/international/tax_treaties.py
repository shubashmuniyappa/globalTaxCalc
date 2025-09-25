"""
Tax Treaty Calculator
Handles international tax treaty calculations including:
- Treaty withholding rate reductions
- Tie-breaker rules for dual residents
- Permanent establishment determinations
- Treaty shopping prevention (LOB clauses)
- Mutual agreement procedures
- Treaty-specific provisions and limitations
- OECD Model Treaty conventions
"""

from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import date, datetime
from enum import Enum
import logging


class TreatyIncomeType(Enum):
    DIVIDENDS = "dividends"
    INTEREST = "interest"
    ROYALTIES = "royalties"
    CAPITAL_GAINS = "capital_gains"
    BUSINESS_PROFITS = "business_profits"
    EMPLOYMENT_INCOME = "employment_income"
    DIRECTOR_FEES = "director_fees"
    PENSIONS = "pensions"
    GOVERNMENT_SERVICE = "government_service"
    STUDENTS_TRAINEES = "students_trainees"
    OTHER_INCOME = "other_income"


class ResidencyTest(Enum):
    DOMESTIC_LAW = "domestic_law"
    TREATY_TIEBREAKER = "treaty_tiebreaker"
    PLACE_OF_MANAGEMENT = "place_of_management"
    PLACE_OF_INCORPORATION = "place_of_incorporation"


@dataclass
class TaxTreaty:
    """Tax treaty information"""
    treaty_id: str
    country_1: str  # Usually US
    country_2: str  # Treaty partner
    effective_date: date
    treaty_article_provisions: Dict[str, Any] = field(default_factory=dict)
    withholding_rates: Dict[str, Decimal] = field(default_factory=dict)
    has_limitation_on_benefits: bool = True
    has_mutual_agreement_procedure: bool = True
    has_exchange_of_information: bool = True
    treaty_override_provisions: List[str] = field(default_factory=list)


@dataclass
class TreatyBenefit:
    """Treaty benefit claim"""
    benefit_id: str
    treaty_id: str
    income_type: TreatyIncomeType
    gross_income: Decimal
    domestic_withholding_rate: Decimal
    treaty_withholding_rate: Decimal
    benefit_amount: Decimal
    qualification_test_met: bool = False
    lob_test_met: bool = False
    pe_threshold_met: bool = False


@dataclass
class DualResident:
    """Dual resident entity information"""
    entity_name: str
    incorporation_country: str
    management_country: str
    tax_residence_claimed: List[str]
    place_of_effective_management: str
    principal_business_location: str
    tie_breaker_result: str


@dataclass
class PermanentEstablishment:
    """Permanent establishment analysis"""
    pe_id: str
    country: str
    business_description: str
    location: str
    duration_months: int
    fixed_place_of_business: bool = False
    dependent_agent: bool = False
    construction_project: bool = False
    service_pe: bool = False
    deemed_pe: bool = False
    pe_threshold_days: int = 183


@dataclass
class LimitationOnBenefits:
    """Limitation on Benefits (LOB) analysis"""
    lob_id: str
    treaty_id: str
    entity_type: str  # individual, company, partnership, etc.
    ownership_test_met: bool = False
    base_erosion_test_met: bool = False
    active_trade_business_test_met: bool = False
    derivative_benefits_test_met: bool = False
    headquarters_company_test_met: bool = False
    competent_authority_relief: bool = False
    overall_lob_qualification: bool = False


@dataclass
class TreatyCalculationResult:
    """Comprehensive treaty calculation results"""
    # Treaty benefits
    total_treaty_benefits: Decimal = Decimal('0')
    withholding_tax_reduced: Decimal = Decimal('0')
    domestic_tax_saved: Decimal = Decimal('0')

    # Treaty benefits by income type
    dividend_treaty_benefits: Decimal = Decimal('0')
    interest_treaty_benefits: Decimal = Decimal('0')
    royalty_treaty_benefits: Decimal = Decimal('0')
    capital_gains_treaty_benefits: Decimal = Decimal('0')

    # Residency determinations
    residency_determinations: List[Dict[str, Any]] = field(default_factory=list)

    # PE determinations
    pe_determinations: List[Dict[str, Any]] = field(default_factory=list)

    # LOB analysis results
    lob_qualifications: List[Dict[str, Any]] = field(default_factory=list)

    # Treaty shopping issues
    treaty_shopping_concerns: List[str] = field(default_factory=list)

    # Detailed benefit calculations
    benefit_details: List[Dict[str, Any]] = field(default_factory=list)

    # Compliance and reporting
    required_forms: List[str] = field(default_factory=list)
    competent_authority_issues: List[str] = field(default_factory=list)

    # Audit trail
    calculation_notes: List[str] = field(default_factory=list)
    compliance_issues: List[str] = field(default_factory=list)


class TaxTreatyCalculator:
    """Advanced Tax Treaty Calculator"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Common withholding rates (simplified - actual rates vary by treaty)
        self.default_withholding_rates = {
            'dividends_portfolio': Decimal('0.30'),  # 30% default
            'dividends_substantial': Decimal('0.30'),
            'interest': Decimal('0.30'),
            'royalties': Decimal('0.30'),
            'capital_gains': Decimal('0.00')  # Generally no withholding
        }

        # Common treaty reduced rates (examples)
        self.common_treaty_rates = {
            'dividends_portfolio': Decimal('0.15'),  # 15% common treaty rate
            'dividends_substantial': Decimal('0.05'),  # 5% for substantial ownership
            'interest': Decimal('0.00'),  # Often eliminated
            'royalties': Decimal('0.00'),  # Often eliminated
        }

    def calculate_treaty_benefits(
        self,
        treaties: List[TaxTreaty],
        benefit_claims: List[TreatyBenefit],
        dual_residents: Optional[List[DualResident]] = None,
        pe_analyses: Optional[List[PermanentEstablishment]] = None,
        lob_analyses: Optional[List[LimitationOnBenefits]] = None,
        tax_year: int = 2024
    ) -> TreatyCalculationResult:
        """
        Calculate comprehensive tax treaty benefits and compliance
        """
        result = TreatyCalculationResult()

        try:
            # Create treaty lookup
            treaty_lookup = {treaty.treaty_id: treaty for treaty in treaties}

            # Process dual resident tie-breaker rules
            if dual_residents:
                self._apply_tie_breaker_rules(result, dual_residents)

            # Analyze permanent establishment thresholds
            if pe_analyses:
                self._analyze_permanent_establishments(result, pe_analyses, treaty_lookup)

            # Process limitation on benefits
            if lob_analyses:
                self._process_limitation_on_benefits(result, lob_analyses, treaty_lookup)

            # Calculate treaty benefits
            self._calculate_treaty_benefits(result, benefit_claims, treaty_lookup)

            # Identify required forms and reporting
            self._identify_required_forms(result, benefit_claims, pe_analyses, lob_analyses)

            # Detect treaty shopping concerns
            self._detect_treaty_shopping(result, benefit_claims, treaty_lookup)

            # Validate treaty positions
            self._validate_treaty_positions(result)

            self.logger.info(f"Treaty calculation completed for {len(benefit_claims)} benefit claims")

        except Exception as e:
            self.logger.error(f"Treaty calculation failed: {str(e)}")
            result.compliance_issues.append(f"Calculation error: {str(e)}")

        return result

    def _apply_tie_breaker_rules(self, result: TreatyCalculationResult, dual_residents: List[DualResident]):
        """Apply treaty tie-breaker rules for dual residents"""

        for dual_resident in dual_residents:
            tie_breaker_analysis = {
                'entity_name': dual_resident.entity_name,
                'claimed_residences': dual_resident.tax_residence_claimed,
                'incorporation_country': dual_resident.incorporation_country,
                'management_country': dual_resident.management_country,
                'place_of_effective_management': dual_resident.place_of_effective_management,
                'tie_breaker_result': '',
                'reasoning': []
            }

            # Apply tie-breaker hierarchy for individuals
            if len(dual_resident.tax_residence_claimed) == 2:
                # For individuals (simplified):
                # 1. Permanent home
                # 2. Center of vital interests
                # 3. Habitual abode
                # 4. Nationality
                # 5. Competent authority determination

                # For entities (simplified):
                # Place of effective management test
                if dual_resident.place_of_effective_management:
                    tie_breaker_analysis['tie_breaker_result'] = dual_resident.place_of_effective_management
                    tie_breaker_analysis['reasoning'].append("Place of effective management test applied")
                else:
                    tie_breaker_analysis['tie_breaker_result'] = "Competent authority determination required"
                    tie_breaker_analysis['reasoning'].append("Unable to determine - competent authority procedure needed")

            result.residency_determinations.append(tie_breaker_analysis)

            result.calculation_notes.append(
                f"Dual resident {dual_resident.entity_name}: "
                f"Treaty residence determined as {tie_breaker_analysis['tie_breaker_result']}"
            )

    def _analyze_permanent_establishments(
        self,
        result: TreatyCalculationResult,
        pe_analyses: List[PermanentEstablishment],
        treaty_lookup: Dict[str, TaxTreaty]
    ):
        """Analyze permanent establishment determinations"""

        for pe_analysis in pe_analyses:
            pe_determination = {
                'pe_id': pe_analysis.pe_id,
                'country': pe_analysis.country,
                'business_description': pe_analysis.business_description,
                'duration_months': pe_analysis.duration_months,
                'pe_exists': False,
                'pe_type': '',
                'attribution_required': False
            }

            # Fixed place of business PE
            if pe_analysis.fixed_place_of_business and pe_analysis.duration_months >= 12:
                pe_determination['pe_exists'] = True
                pe_determination['pe_type'] = 'Fixed place of business'

            # Construction PE
            elif pe_analysis.construction_project and pe_analysis.duration_months >= 12:
                pe_determination['pe_exists'] = True
                pe_determination['pe_type'] = 'Construction project'

            # Service PE
            elif pe_analysis.service_pe and pe_analysis.duration_months >= 6:
                pe_determination['pe_exists'] = True
                pe_determination['pe_type'] = 'Service PE'

            # Dependent agent PE
            elif pe_analysis.dependent_agent:
                pe_determination['pe_exists'] = True
                pe_determination['pe_type'] = 'Dependent agent'

            # If PE exists, attribution of profits is required
            if pe_determination['pe_exists']:
                pe_determination['attribution_required'] = True
                result.required_forms.append("Form 8865 (if partnership PE)")
                result.required_forms.append("Form 5472 (if corporate PE)")

            result.pe_determinations.append(pe_determination)

            result.calculation_notes.append(
                f"PE analysis for {pe_analysis.country}: "
                f"{'PE exists' if pe_determination['pe_exists'] else 'No PE'}"
                f"{' (' + pe_determination['pe_type'] + ')' if pe_determination['pe_type'] else ''}"
            )

    def _process_limitation_on_benefits(
        self,
        result: TreatyCalculationResult,
        lob_analyses: List[LimitationOnBenefits],
        treaty_lookup: Dict[str, TaxTreaty]
    ):
        """Process Limitation on Benefits (LOB) analysis"""

        for lob_analysis in lob_analyses:
            treaty = treaty_lookup.get(lob_analysis.treaty_id)

            lob_qualification = {
                'lob_id': lob_analysis.lob_id,
                'treaty_id': lob_analysis.treaty_id,
                'entity_type': lob_analysis.entity_type,
                'tests_passed': [],
                'tests_failed': [],
                'qualified_for_benefits': False
            }

            # Check various LOB tests
            if lob_analysis.ownership_test_met:
                lob_qualification['tests_passed'].append('Ownership test')
            else:
                lob_qualification['tests_failed'].append('Ownership test')

            if lob_analysis.base_erosion_test_met:
                lob_qualification['tests_passed'].append('Base erosion test')
            else:
                lob_qualification['tests_failed'].append('Base erosion test')

            if lob_analysis.active_trade_business_test_met:
                lob_qualification['tests_passed'].append('Active trade or business test')
            else:
                lob_qualification['tests_failed'].append('Active trade or business test')

            if lob_analysis.derivative_benefits_test_met:
                lob_qualification['tests_passed'].append('Derivative benefits test')

            if lob_analysis.headquarters_company_test_met:
                lob_qualification['tests_passed'].append('Headquarters company test')

            # Determine overall qualification
            if (lob_analysis.ownership_test_met and lob_analysis.base_erosion_test_met) or \
               lob_analysis.active_trade_business_test_met or \
               lob_analysis.derivative_benefits_test_met or \
               lob_analysis.headquarters_company_test_met or \
               lob_analysis.competent_authority_relief:
                lob_qualification['qualified_for_benefits'] = True

            result.lob_qualifications.append(lob_qualification)

            if not lob_qualification['qualified_for_benefits']:
                result.compliance_issues.append(
                    f"LOB tests failed for {lob_analysis.entity_type} - treaty benefits may be denied"
                )

    def _calculate_treaty_benefits(
        self,
        result: TreatyCalculationResult,
        benefit_claims: List[TreatyBenefit],
        treaty_lookup: Dict[str, TaxTreaty]
    ):
        """Calculate actual treaty benefits"""

        for claim in benefit_claims:
            treaty = treaty_lookup.get(claim.treaty_id)

            if not treaty:
                result.compliance_issues.append(f"Treaty not found for claim {claim.benefit_id}")
                continue

            # Calculate benefit amount
            domestic_tax = claim.gross_income * claim.domestic_withholding_rate
            treaty_tax = claim.gross_income * claim.treaty_withholding_rate
            benefit_amount = domestic_tax - treaty_tax

            # Check qualification requirements
            qualified = claim.qualification_test_met and claim.lob_test_met

            if not qualified:
                benefit_amount = Decimal('0')
                result.compliance_issues.append(
                    f"Treaty benefit denied for claim {claim.benefit_id} - qualification tests not met"
                )

            # Apply PE threshold test if applicable
            if claim.pe_threshold_met and claim.income_type == TreatyIncomeType.BUSINESS_PROFITS:
                # Business profits attributable to PE are not eligible for treaty benefits
                benefit_amount = Decimal('0')
                result.calculation_notes.append(
                    f"Business profits attributed to PE - no treaty benefit available"
                )

            # Categorize benefits by income type
            if claim.income_type == TreatyIncomeType.DIVIDENDS:
                result.dividend_treaty_benefits += benefit_amount
            elif claim.income_type == TreatyIncomeType.INTEREST:
                result.interest_treaty_benefits += benefit_amount
            elif claim.income_type == TreatyIncomeType.ROYALTIES:
                result.royalty_treaty_benefits += benefit_amount
            elif claim.income_type == TreatyIncomeType.CAPITAL_GAINS:
                result.capital_gains_treaty_benefits += benefit_amount

            result.total_treaty_benefits += benefit_amount
            result.withholding_tax_reduced += benefit_amount

            # Track benefit details
            benefit_detail = {
                'benefit_id': claim.benefit_id,
                'treaty_id': claim.treaty_id,
                'income_type': claim.income_type.value,
                'gross_income': claim.gross_income,
                'domestic_rate': claim.domestic_withholding_rate,
                'treaty_rate': claim.treaty_withholding_rate,
                'benefit_amount': benefit_amount,
                'qualified': qualified
            }

            result.benefit_details.append(benefit_detail)

    def _identify_required_forms(
        self,
        result: TreatyCalculationResult,
        benefit_claims: List[TreatyBenefit],
        pe_analyses: Optional[List[PermanentEstablishment]],
        lob_analyses: Optional[List[LimitationOnBenefits]]
    ):
        """Identify required tax forms and reporting"""

        forms_needed = set()

        # Treaty benefit claims generally require Form 8833
        if benefit_claims:
            forms_needed.add("Form 8833 (Treaty-Based Return Position Disclosure)")

        # Foreign corporations may need Form 5472
        if pe_analyses:
            forms_needed.add("Form 5472 (Information Return of a 25% Foreign-Owned US Corporation)")

        # Partnerships with foreign activities may need Form 8865
        if pe_analyses:
            forms_needed.add("Form 8865 (Return of US Persons With Respect to Certain Foreign Partnerships)")

        # Foreign financial accounts require FBAR
        forms_needed.add("FinCEN Form 114 (FBAR) if applicable")

        # Form 8938 for specified foreign financial assets
        forms_needed.add("Form 8938 (FATCA) if applicable")

        result.required_forms = list(forms_needed)

    def _detect_treaty_shopping(
        self,
        result: TreatyCalculationResult,
        benefit_claims: List[TreatyBenefit],
        treaty_lookup: Dict[str, TaxTreaty]
    ):
        """Detect potential treaty shopping arrangements"""

        # Look for patterns that might indicate treaty shopping
        treaty_countries = set()
        for claim in benefit_claims:
            treaty = treaty_lookup.get(claim.treaty_id)
            if treaty:
                treaty_countries.add(treaty.country_2)

        # Multiple treaties claimed might indicate treaty shopping
        if len(treaty_countries) > 2:
            result.treaty_shopping_concerns.append(
                f"Multiple treaty countries involved ({len(treaty_countries)}) - "
                f"review for potential treaty shopping"
            )

        # Check for conduit arrangements (simplified detection)
        for claim in benefit_claims:
            if claim.treaty_withholding_rate == Decimal('0') and claim.gross_income > Decimal('1000000'):
                result.treaty_shopping_concerns.append(
                    f"Large income ({claim.gross_income:,.0f}) with zero withholding - "
                    f"review for conduit arrangement"
                )

    def _validate_treaty_positions(self, result: TreatyCalculationResult):
        """Validate treaty positions and identify potential issues"""

        # Check for consistency in LOB qualifications
        failed_lob_tests = [lob for lob in result.lob_qualifications if not lob['qualified_for_benefits']]

        if failed_lob_tests:
            result.compliance_issues.append(
                f"{len(failed_lob_tests)} entities failed LOB tests - treaty benefits may be denied"
            )

        # Check for PE issues
        pe_exists_count = len([pe for pe in result.pe_determinations if pe['pe_exists']])

        if pe_exists_count > 0:
            result.calculation_notes.append(
                f"{pe_exists_count} permanent establishments identified - "
                f"ensure proper profit attribution and reporting"
            )

        # Validate total benefits claimed
        if result.total_treaty_benefits > Decimal('10000000'):  # $10M threshold
            result.compliance_issues.append(
                "Large treaty benefits claimed - ensure proper documentation and substance requirements"
            )

        # Check for competent authority procedure needs
        unresolved_issues = len([dr for dr in result.residency_determinations
                               if 'competent authority' in dr.get('tie_breaker_result', '').lower()])

        if unresolved_issues > 0:
            result.competent_authority_issues.append(
                f"{unresolved_issues} dual residency issues require competent authority determination"
            )
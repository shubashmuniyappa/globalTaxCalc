"""
Tax Optimization Service
Provides tax optimization suggestions and analysis
"""

import time
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal
from dataclasses import dataclass

from app.core.exceptions import TaxCalculationError, CountryNotSupportedException
from app.core.logging import LoggingMixin
from app.core.cache import TaxOptimizationCacheManager
from app.models.tax_calculation import TaxCalculationRequest, TaxCalculationResponse, IncomeItem, DeductionItem
from app.models.tax_optimization import (
    TaxOptimizationRequest,
    TaxOptimizationResponse,
    OptimizationSuggestion,
    SuggestionType,
    OptimizationCategory
)
from app.services.tax_calculation import TaxCalculationService


@dataclass
class OptimizationScenario:
    """Represents a tax optimization scenario"""
    name: str
    description: str
    modified_request: TaxCalculationRequest
    estimated_savings: Decimal
    implementation_difficulty: str  # "easy", "moderate", "complex"
    requirements: List[str]


class TaxOptimizationService(LoggingMixin):
    """Service for tax optimization analysis and suggestions"""

    def __init__(self,
                 tax_calculation_service: TaxCalculationService,
                 cache_manager: Optional[TaxOptimizationCacheManager] = None):
        super().__init__()
        self.tax_calculation_service = tax_calculation_service
        self.cache_manager = cache_manager

    async def optimize_tax(self, request: TaxOptimizationRequest) -> TaxOptimizationResponse:
        """Generate tax optimization suggestions"""
        start_time = time.time()

        try:
            # Check cache first
            if self.cache_manager:
                cached_result = await self.cache_manager.get_tax_optimization(request)
                if cached_result:
                    self.logger.info(f"Retrieved cached optimization for {request.base_calculation.country.value}")
                    return cached_result

            # Calculate baseline tax
            baseline_response = await self.tax_calculation_service.calculate_tax(request.base_calculation)
            baseline_tax = baseline_response.tax_breakdown.total_tax

            # Generate optimization scenarios
            scenarios = await self._generate_optimization_scenarios(request)

            # Analyze each scenario
            suggestions = []
            total_potential_savings = Decimal('0')

            for scenario in scenarios:
                try:
                    optimized_response = await self.tax_calculation_service.calculate_tax(scenario.modified_request)
                    optimized_tax = optimized_response.tax_breakdown.total_tax

                    actual_savings = baseline_tax - optimized_tax
                    if actual_savings > 0:
                        suggestion = OptimizationSuggestion(
                            suggestion_type=self._determine_suggestion_type(scenario.name),
                            category=self._determine_category(scenario.name),
                            title=scenario.name,
                            description=scenario.description,
                            potential_savings=actual_savings,
                            implementation_difficulty=scenario.implementation_difficulty,
                            requirements=scenario.requirements,
                            confidence_level=self._calculate_confidence_level(scenario, request),
                            tax_year_applicable=request.base_calculation.tax_year
                        )
                        suggestions.append(suggestion)
                        total_potential_savings += actual_savings

                except Exception as e:
                    self.logger.warning(f"Failed to analyze scenario {scenario.name}: {str(e)}")

            # Sort suggestions by potential savings
            suggestions.sort(key=lambda x: x.potential_savings, reverse=True)

            # Limit to top suggestions based on request
            max_suggestions = getattr(request, 'max_suggestions', 10)
            suggestions = suggestions[:max_suggestions]

            # Create response
            response = TaxOptimizationResponse(
                baseline_tax=baseline_tax,
                optimized_scenarios=suggestions,
                total_potential_savings=total_potential_savings,
                analysis_summary=self._generate_analysis_summary(baseline_response, suggestions),
                optimization_date=time.time(),
                country=request.base_calculation.country,
                tax_year=request.base_calculation.tax_year
            )

            # Cache the result
            if self.cache_manager:
                await self.cache_manager.set_tax_optimization(request, response)

            calculation_duration = (time.time() - start_time) * 1000

            self.logger.info(
                f"Completed tax optimization analysis",
                extra={
                    "country": request.base_calculation.country.value,
                    "baseline_tax": float(baseline_tax),
                    "potential_savings": float(total_potential_savings),
                    "suggestions_count": len(suggestions),
                    "duration_ms": calculation_duration
                }
            )

            return response

        except Exception as e:
            self.logger.error(f"Tax optimization failed: {str(e)}")
            if isinstance(e, (TaxCalculationError, CountryNotSupportedException)):
                raise
            raise TaxCalculationError(f"Tax optimization failed: {str(e)}")

    async def _generate_optimization_scenarios(self, request: TaxOptimizationRequest) -> List[OptimizationScenario]:
        """Generate optimization scenarios based on the request"""
        scenarios = []
        base_calc = request.base_calculation
        country_code = base_calc.country.value.upper()

        # Income optimization scenarios
        scenarios.extend(await self._generate_income_scenarios(base_calc))

        # Deduction optimization scenarios
        scenarios.extend(await self._generate_deduction_scenarios(base_calc))

        # Country-specific scenarios
        if country_code == "US":
            scenarios.extend(await self._generate_us_scenarios(base_calc))
        elif country_code == "CA":
            scenarios.extend(await self._generate_canada_scenarios(base_calc))
        elif country_code == "UK":
            scenarios.extend(await self._generate_uk_scenarios(base_calc))
        elif country_code == "AU":
            scenarios.extend(await self._generate_australia_scenarios(base_calc))
        elif country_code == "DE":
            scenarios.extend(await self._generate_germany_scenarios(base_calc))

        # Retirement planning scenarios
        scenarios.extend(await self._generate_retirement_scenarios(base_calc))

        # Filing status optimization (if applicable)
        scenarios.extend(await self._generate_filing_status_scenarios(base_calc))

        return scenarios

    async def _generate_income_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate income-related optimization scenarios"""
        scenarios = []

        # Income timing scenario
        if base_calc.total_income > Decimal('100000'):
            modified_request = self._copy_request(base_calc)
            # Simulate deferring 10% of income to next year
            defer_amount = base_calc.total_income * Decimal('0.1')

            # Reduce current year income
            for item in modified_request.income_items:
                if item.income_type.value in ['salary', 'wages']:
                    item.amount -= defer_amount
                    break

            modified_request.total_income -= defer_amount

            scenarios.append(OptimizationScenario(
                name="Income Deferral Strategy",
                description=f"Defer ${defer_amount:,.2f} of income to next tax year to potentially reduce current year tax burden",
                modified_request=modified_request,
                estimated_savings=defer_amount * Decimal('0.25'),  # Rough estimate
                implementation_difficulty="moderate",
                requirements=[
                    "Ability to defer income (bonuses, consulting fees)",
                    "Consider next year's tax situation",
                    "Employer cooperation for salary deferrals"
                ]
            ))

        return scenarios

    async def _generate_deduction_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate deduction-related optimization scenarios"""
        scenarios = []

        # Maximize charitable deductions
        current_charitable = sum(
            item.amount for item in base_calc.deduction_items
            if item.deduction_type.value == 'charitable'
        )

        if current_charitable < base_calc.total_income * Decimal('0.05'):  # Less than 5% of income
            additional_charitable = min(
                base_calc.total_income * Decimal('0.05') - current_charitable,
                Decimal('10000')
            )

            modified_request = self._copy_request(base_calc)
            modified_request.deduction_items.append(
                DeductionItem(
                    deduction_type="charitable",
                    amount=additional_charitable,
                    description=f"Additional charitable contributions"
                )
            )

            scenarios.append(OptimizationScenario(
                name="Charitable Giving Optimization",
                description=f"Increase charitable contributions by ${additional_charitable:,.2f}",
                modified_request=modified_request,
                estimated_savings=additional_charitable * Decimal('0.25'),
                implementation_difficulty="easy",
                requirements=[
                    "Make additional charitable donations",
                    "Keep proper documentation",
                    "Verify charity qualifications"
                ]
            ))

        return scenarios

    async def _generate_us_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate US-specific optimization scenarios"""
        scenarios = []

        # 401(k) maximization
        current_retirement = sum(
            item.amount for item in base_calc.deduction_items
            if item.deduction_type.value == 'retirement' and item.is_above_line
        )

        contribution_limit = Decimal('23000')  # 2024 401(k) limit
        if base_calc.age and base_calc.age >= 50:
            contribution_limit += Decimal('7500')  # Catch-up contribution

        if current_retirement < contribution_limit:
            additional_contribution = min(
                contribution_limit - current_retirement,
                base_calc.total_income * Decimal('0.2')  # Max 20% of income
            )

            modified_request = self._copy_request(base_calc)
            modified_request.deduction_items.append(
                DeductionItem(
                    deduction_type="retirement",
                    amount=additional_contribution,
                    description="Additional 401(k) contribution",
                    is_above_line=True
                )
            )

            scenarios.append(OptimizationScenario(
                name="401(k) Contribution Maximization",
                description=f"Increase 401(k) contributions by ${additional_contribution:,.2f}",
                modified_request=modified_request,
                estimated_savings=additional_contribution * Decimal('0.22'),  # Estimated tax savings
                implementation_difficulty="easy",
                requirements=[
                    "Employer 401(k) plan available",
                    "Sufficient cash flow for higher contributions",
                    "Payroll deduction setup"
                ]
            ))

        # HSA maximization (if applicable)
        if base_calc.total_income < Decimal('200000'):  # HSA income limits
            hsa_limit = Decimal('4150')  # 2024 individual limit
            modified_request = self._copy_request(base_calc)
            modified_request.deduction_items.append(
                DeductionItem(
                    deduction_type="medical",
                    amount=hsa_limit,
                    description="HSA contribution",
                    is_above_line=True
                )
            )

            scenarios.append(OptimizationScenario(
                name="HSA Contribution Strategy",
                description=f"Maximize HSA contributions (${hsa_limit:,.2f})",
                modified_request=modified_request,
                estimated_savings=hsa_limit * Decimal('0.22'),
                implementation_difficulty="easy",
                requirements=[
                    "High-deductible health plan enrollment",
                    "HSA account setup",
                    "Track medical expenses"
                ]
            ))

        return scenarios

    async def _generate_canada_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate Canada-specific optimization scenarios"""
        scenarios = []

        # RRSP maximization
        rrsp_limit = min(base_calc.total_income * Decimal('0.18'), Decimal('31560'))  # 2024 limits

        current_rrsp = sum(
            item.amount for item in base_calc.deduction_items
            if item.deduction_type.value == 'retirement' and item.is_above_line
        )

        if current_rrsp < rrsp_limit:
            additional_rrsp = rrsp_limit - current_rrsp

            modified_request = self._copy_request(base_calc)
            modified_request.deduction_items.append(
                DeductionItem(
                    deduction_type="retirement",
                    amount=additional_rrsp,
                    description="Additional RRSP contribution",
                    is_above_line=True
                )
            )

            scenarios.append(OptimizationScenario(
                name="RRSP Contribution Maximization",
                description=f"Maximize RRSP contributions by ${additional_rrsp:,.2f}",
                modified_request=modified_request,
                estimated_savings=additional_rrsp * Decimal('0.30'),
                implementation_difficulty="easy",
                requirements=[
                    "RRSP account setup",
                    "Available contribution room",
                    "Sufficient funds for contribution"
                ]
            ))

        return scenarios

    async def _generate_uk_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate UK-specific optimization scenarios"""
        scenarios = []

        # Pension contribution optimization
        annual_allowance = Decimal('40000')  # Standard annual allowance

        current_pension = sum(
            item.amount for item in base_calc.deduction_items
            if item.deduction_type.value == 'retirement'
        )

        if current_pension < annual_allowance and base_calc.total_income > Decimal('50000'):
            additional_pension = min(
                annual_allowance - current_pension,
                base_calc.total_income * Decimal('0.15')
            )

            modified_request = self._copy_request(base_calc)
            modified_request.deduction_items.append(
                DeductionItem(
                    deduction_type="retirement",
                    amount=additional_pension,
                    description="Additional pension contribution"
                )
            )

            scenarios.append(OptimizationScenario(
                name="Pension Contribution Optimization",
                description=f"Increase pension contributions by £{additional_pension:,.2f}",
                modified_request=modified_request,
                estimated_savings=additional_pension * Decimal('0.20'),
                implementation_difficulty="easy",
                requirements=[
                    "Workplace or personal pension scheme",
                    "Available annual allowance",
                    "Sufficient disposable income"
                ]
            ))

        return scenarios

    async def _generate_australia_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate Australia-specific optimization scenarios"""
        scenarios = []

        # Superannuation contribution optimization
        concessional_cap = Decimal('30000')  # 2024 concessional cap

        current_super = sum(
            item.amount for item in base_calc.deduction_items
            if item.deduction_type.value == 'retirement'
        )

        if current_super < concessional_cap:
            additional_super = min(
                concessional_cap - current_super,
                base_calc.total_income * Decimal('0.10')
            )

            modified_request = self._copy_request(base_calc)
            modified_request.deduction_items.append(
                DeductionItem(
                    deduction_type="retirement",
                    amount=additional_super,
                    description="Additional superannuation contribution"
                )
            )

            scenarios.append(OptimizationScenario(
                name="Superannuation Salary Sacrifice",
                description=f"Salary sacrifice ${additional_super:,.2f} to superannuation",
                modified_request=modified_request,
                estimated_savings=additional_super * Decimal('0.15'),
                implementation_difficulty="easy",
                requirements=[
                    "Employer salary sacrifice arrangement",
                    "Superannuation fund account",
                    "Stay within concessional caps"
                ]
            ))

        return scenarios

    async def _generate_germany_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate Germany-specific optimization scenarios"""
        scenarios = []

        # Riester pension optimization
        riester_max = min(base_calc.total_income * Decimal('0.04'), Decimal('2100'))

        modified_request = self._copy_request(base_calc)
        modified_request.deduction_items.append(
            DeductionItem(
                deduction_type="retirement",
                amount=riester_max,
                description="Riester pension contribution"
            )
        )

        scenarios.append(OptimizationScenario(
            name="Riester Pension Optimization",
            description=f"Maximize Riester pension contributions (€{riester_max:,.2f})",
            modified_request=modified_request,
            estimated_savings=riester_max * Decimal('0.25'),
            implementation_difficulty="moderate",
            requirements=[
                "Riester pension contract",
                "Eligible employment status",
                "German tax residency"
            ]
        ))

        return scenarios

    async def _generate_retirement_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate retirement-related optimization scenarios"""
        # This is handled in country-specific scenarios
        return []

    async def _generate_filing_status_scenarios(self, base_calc: TaxCalculationRequest) -> List[OptimizationScenario]:
        """Generate filing status optimization scenarios"""
        scenarios = []

        # For married couples, compare joint vs separate filing
        if hasattr(base_calc, 'spouse_income') and base_calc.spouse_income:
            # This would require more complex logic to model spouse's tax situation
            pass

        return scenarios

    def _copy_request(self, request: TaxCalculationRequest) -> TaxCalculationRequest:
        """Create a deep copy of the tax calculation request"""
        return TaxCalculationRequest(
            country=request.country,
            tax_year=request.tax_year,
            filing_status=request.filing_status,
            income_items=[
                IncomeItem(
                    income_type=item.income_type,
                    amount=item.amount,
                    description=item.description,
                    is_taxable=item.is_taxable
                ) for item in request.income_items
            ],
            deduction_items=[
                DeductionItem(
                    deduction_type=item.deduction_type,
                    amount=item.amount,
                    description=item.description,
                    is_above_line=item.is_above_line
                ) for item in request.deduction_items
            ],
            total_income=request.total_income,
            age=request.age,
            spouse_age=request.spouse_age,
            is_blind=request.is_blind,
            spouse_is_blind=request.spouse_is_blind,
            include_state_tax=request.include_state_tax,
            state_province=request.state_province,
            calculate_quarterly=request.calculate_quarterly
        )

    def _determine_suggestion_type(self, scenario_name: str) -> SuggestionType:
        """Determine the suggestion type based on scenario name"""
        if "retirement" in scenario_name.lower() or "401k" in scenario_name.lower() or "rrsp" in scenario_name.lower():
            return SuggestionType.RETIREMENT_CONTRIBUTION
        elif "deduction" in scenario_name.lower() or "charitable" in scenario_name.lower():
            return SuggestionType.DEDUCTION_OPTIMIZATION
        elif "income" in scenario_name.lower():
            return SuggestionType.INCOME_TIMING
        elif "filing" in scenario_name.lower():
            return SuggestionType.FILING_STATUS
        else:
            return SuggestionType.OTHER

    def _determine_category(self, scenario_name: str) -> OptimizationCategory:
        """Determine the optimization category"""
        if "retirement" in scenario_name.lower():
            return OptimizationCategory.RETIREMENT_PLANNING
        elif "deduction" in scenario_name.lower():
            return OptimizationCategory.DEDUCTION_MAXIMIZATION
        elif "income" in scenario_name.lower():
            return OptimizationCategory.INCOME_MANAGEMENT
        else:
            return OptimizationCategory.TAX_STRATEGY

    def _calculate_confidence_level(self, scenario: OptimizationScenario, request: TaxOptimizationRequest) -> float:
        """Calculate confidence level for the optimization suggestion"""
        # Base confidence on implementation difficulty and data quality
        if scenario.implementation_difficulty == "easy":
            return 0.9
        elif scenario.implementation_difficulty == "moderate":
            return 0.75
        else:
            return 0.6

    def _generate_analysis_summary(self, baseline_response: TaxCalculationResponse,
                                 suggestions: List[OptimizationSuggestion]) -> str:
        """Generate analysis summary"""
        if not suggestions:
            return "No significant tax optimization opportunities identified for your current situation."

        total_savings = sum(s.potential_savings for s in suggestions)
        top_suggestion = suggestions[0]

        summary = f"Analysis identified {len(suggestions)} optimization opportunities with potential savings of ${total_savings:,.2f}. "
        summary += f"Top recommendation: {top_suggestion.title} with potential savings of ${top_suggestion.potential_savings:,.2f}. "
        summary += f"Current effective tax rate: {float(baseline_response.tax_breakdown.effective_tax_rate):.2%}."

        return summary


# Global instance
_tax_optimization_service: Optional[TaxOptimizationService] = None


def get_tax_optimization_service() -> TaxOptimizationService:
    """Get the global tax optimization service instance"""
    global _tax_optimization_service
    if _tax_optimization_service is None:
        from app.services.tax_calculation import get_tax_calculation_service
        _tax_optimization_service = TaxOptimizationService(get_tax_calculation_service())
    return _tax_optimization_service


def init_tax_optimization_service(tax_calculation_service: TaxCalculationService,
                                cache_manager: Optional[TaxOptimizationCacheManager] = None) -> TaxOptimizationService:
    """Initialize the global tax optimization service"""
    global _tax_optimization_service
    _tax_optimization_service = TaxOptimizationService(tax_calculation_service, cache_manager)
    return _tax_optimization_service
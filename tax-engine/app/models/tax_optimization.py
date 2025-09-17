"""
Pydantic models for tax optimization requests and responses
"""

from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator

from .tax_calculation import CountryCode, FilingStatus, IncomeItem, DeductionItem


class OptimizationType(str, Enum):
    """Types of tax optimization suggestions"""
    DEDUCTION_MAXIMIZATION = "deduction_maximization"
    FILING_STATUS_OPTIMIZATION = "filing_status_optimization"
    RETIREMENT_CONTRIBUTION = "retirement_contribution"
    TAX_LOSS_HARVESTING = "tax_loss_harvesting"
    TIMING_OPTIMIZATION = "timing_optimization"
    CHARITABLE_GIVING = "charitable_giving"
    BUSINESS_EXPENSE = "business_expense"
    EDUCATION_CREDIT = "education_credit"
    CHILD_TAX_CREDIT = "child_tax_credit"
    STATE_TAX_OPTIMIZATION = "state_tax_optimization"


class SuggestionPriority(str, Enum):
    """Priority levels for optimization suggestions"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class OptimizationGoal(str, Enum):
    """Tax optimization goals"""
    MINIMIZE_CURRENT_TAX = "minimize_current_tax"
    MAXIMIZE_REFUND = "maximize_refund"
    OPTIMIZE_LONG_TERM = "optimize_long_term"
    BALANCE_CURRENT_FUTURE = "balance_current_future"


class TaxOptimizationRequest(BaseModel):
    """Tax optimization request model"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., ge=2020, le=2025, description="Tax year")
    filing_status: FilingStatus = Field(..., description="Filing status")

    # Current tax situation
    current_income_items: List[IncomeItem] = Field(..., min_items=1, description="Current income items")
    current_deduction_items: List[DeductionItem] = Field(default=[], description="Current deduction items")

    # Personal information
    age: Optional[int] = Field(None, ge=0, le=120, description="Taxpayer age")
    spouse_age: Optional[int] = Field(None, ge=0, le=120, description="Spouse age")
    dependents: int = Field(0, ge=0, le=20, description="Number of dependents")
    state_province: Optional[str] = Field(None, max_length=10, description="State or province code")

    # Optimization parameters
    optimization_goals: List[OptimizationGoal] = Field(
        default=[OptimizationGoal.MINIMIZE_CURRENT_TAX],
        description="Optimization goals"
    )
    risk_tolerance: str = Field(default="medium", description="Risk tolerance (low, medium, high)")
    time_horizon_years: int = Field(default=1, ge=1, le=30, description="Time horizon for optimization")

    # Available options for optimization
    max_retirement_contribution: Optional[Decimal] = Field(None, ge=0, description="Maximum retirement contribution available")
    has_hsa_eligibility: bool = Field(False, description="Whether eligible for HSA contributions")
    has_dependent_care_expenses: bool = Field(False, description="Whether has dependent care expenses")
    has_education_expenses: bool = Field(False, description="Whether has education expenses")
    has_charitable_giving_capacity: bool = Field(False, description="Whether able to make charitable contributions")

    # Business information
    has_business_income: bool = Field(False, description="Whether has business income")
    business_type: Optional[str] = Field(None, description="Type of business (sole_proprietorship, llc, etc.)")

    # Investment information
    has_investment_income: bool = Field(False, description="Whether has investment income")
    has_capital_gains: bool = Field(False, description="Whether has capital gains")
    has_capital_losses: bool = Field(False, description="Whether has capital losses")

    @validator('optimization_goals')
    def validate_optimization_goals(cls, v):
        if not v:
            raise ValueError("At least one optimization goal must be specified")
        return v

    @property
    def total_current_income(self) -> Decimal:
        """Calculate total current income"""
        return sum(item.amount for item in self.current_income_items if item.is_taxable)


class OptimizationSuggestion(BaseModel):
    """Individual tax optimization suggestion"""
    suggestion_id: str = Field(..., description="Unique suggestion identifier")
    optimization_type: OptimizationType = Field(..., description="Type of optimization")
    priority: SuggestionPriority = Field(..., description="Priority level")

    title: str = Field(..., max_length=100, description="Suggestion title")
    description: str = Field(..., max_length=500, description="Detailed description")

    # Financial impact
    potential_tax_savings: Decimal = Field(..., ge=0, description="Potential tax savings")
    cost_to_implement: Decimal = Field(default=Decimal('0'), ge=0, description="Cost to implement suggestion")
    net_benefit: Decimal = Field(..., description="Net benefit after implementation costs")

    # Implementation details
    action_required: str = Field(..., description="Action required to implement")
    deadline: Optional[str] = Field(None, description="Deadline for implementation")
    complexity: str = Field(..., description="Implementation complexity (low, medium, high)")

    # Supporting information
    tax_code_reference: Optional[str] = Field(None, description="Relevant tax code reference")
    documentation_needed: List[str] = Field(default=[], description="Documentation required")
    professional_help_recommended: bool = Field(False, description="Whether professional help is recommended")

    # Risk assessment
    audit_risk_increase: str = Field(default="none", description="Increase in audit risk (none, low, medium, high)")
    regulatory_risk: str = Field(default="low", description="Regulatory risk level")

    # Additional details
    long_term_benefits: Optional[str] = Field(None, description="Long-term benefits")
    considerations: List[str] = Field(default=[], description="Important considerations")

    @validator('net_benefit')
    def validate_net_benefit(cls, v, values):
        if 'potential_tax_savings' in values and 'cost_to_implement' in values:
            expected = values['potential_tax_savings'] - values['cost_to_implement']
            if abs(v - expected) > Decimal('0.01'):  # Allow for rounding differences
                raise ValueError("Net benefit should equal potential savings minus implementation cost")
        return v


class ScenarioComparison(BaseModel):
    """Comparison between current and optimized scenarios"""
    scenario_name: str = Field(..., description="Name of the scenario")
    total_tax: Decimal = Field(..., description="Total tax liability")
    after_tax_income: Decimal = Field(..., description="After-tax income")
    effective_tax_rate: Decimal = Field(..., description="Effective tax rate")
    marginal_tax_rate: Decimal = Field(..., description="Marginal tax rate")

    # Changes from current scenario
    tax_savings: Optional[Decimal] = Field(None, description="Tax savings compared to current")
    income_increase: Optional[Decimal] = Field(None, description="Income increase compared to current")


class TaxOptimizationResponse(BaseModel):
    """Tax optimization response model"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., description="Tax year")
    filing_status: FilingStatus = Field(..., description="Filing status")

    # Current scenario
    current_scenario: ScenarioComparison = Field(..., description="Current tax scenario")

    # Optimization suggestions
    suggestions: List[OptimizationSuggestion] = Field(..., description="Optimization suggestions")
    total_potential_savings: Decimal = Field(..., description="Total potential tax savings")

    # Optimized scenarios
    optimized_scenarios: List[ScenarioComparison] = Field(..., description="Optimized tax scenarios")
    best_scenario: ScenarioComparison = Field(..., description="Best optimized scenario")

    # Summary statistics
    total_suggestions: int = Field(..., description="Total number of suggestions")
    high_priority_suggestions: int = Field(..., description="Number of high-priority suggestions")
    implementable_savings: Decimal = Field(..., description="Savings from easily implementable suggestions")

    # Analysis metadata
    analysis_date: str = Field(..., description="When analysis was performed")
    analysis_duration_ms: float = Field(..., description="Analysis time in milliseconds")
    cached_result: bool = Field(False, description="Whether result was retrieved from cache")

    # Recommendations
    next_steps: List[str] = Field(..., description="Recommended next steps")
    professional_consultation_recommended: bool = Field(False, description="Whether professional consultation is recommended")

    @property
    def optimization_effectiveness(self) -> Decimal:
        """Calculate optimization effectiveness as percentage"""
        if self.current_scenario.total_tax == 0:
            return Decimal('0')
        return (self.total_potential_savings / self.current_scenario.total_tax) * 100


class DeductionOpportunity(BaseModel):
    """Potential deduction opportunity"""
    deduction_type: str = Field(..., description="Type of deduction")
    description: str = Field(..., description="Description of the opportunity")
    estimated_amount: Decimal = Field(..., ge=0, description="Estimated deduction amount")
    confidence_level: str = Field(..., description="Confidence level (low, medium, high)")
    requirements: List[str] = Field(..., description="Requirements to claim this deduction")


class FilingStatusAnalysis(BaseModel):
    """Analysis of different filing status options"""
    filing_status: FilingStatus = Field(..., description="Filing status option")
    total_tax: Decimal = Field(..., description="Total tax with this filing status")
    tax_savings: Decimal = Field(..., description="Tax savings compared to current status")
    pros: List[str] = Field(..., description="Advantages of this filing status")
    cons: List[str] = Field(..., description="Disadvantages of this filing status")
    eligibility_met: bool = Field(..., description="Whether eligibility requirements are met")


class RetirementContributionAnalysis(BaseModel):
    """Analysis of retirement contribution optimization"""
    account_type: str = Field(..., description="Type of retirement account")
    current_contribution: Decimal = Field(..., ge=0, description="Current contribution amount")
    recommended_contribution: Decimal = Field(..., ge=0, description="Recommended contribution amount")
    additional_contribution: Decimal = Field(..., ge=0, description="Additional contribution suggested")
    tax_savings: Decimal = Field(..., ge=0, description="Tax savings from additional contribution")
    contribution_limit: Decimal = Field(..., ge=0, description="Maximum contribution allowed")


class TaxOptimizationSummary(BaseModel):
    """Summary of tax optimization analysis"""
    total_current_tax: Decimal = Field(..., description="Current total tax liability")
    total_optimized_tax: Decimal = Field(..., description="Optimized total tax liability")
    total_savings: Decimal = Field(..., description="Total potential savings")
    savings_percentage: Decimal = Field(..., description="Savings as percentage of current tax")

    # Breakdown by optimization type
    deduction_savings: Decimal = Field(default=Decimal('0'), description="Savings from deduction optimization")
    retirement_savings: Decimal = Field(default=Decimal('0'), description="Savings from retirement contributions")
    filing_status_savings: Decimal = Field(default=Decimal('0'), description="Savings from filing status optimization")
    timing_savings: Decimal = Field(default=Decimal('0'), description="Savings from timing optimization")
    other_savings: Decimal = Field(default=Decimal('0'), description="Savings from other optimizations")

    # Implementation timeline
    immediate_actions: List[str] = Field(default=[], description="Actions that can be taken immediately")
    year_end_actions: List[str] = Field(default=[], description="Actions to take before year-end")
    future_planning: List[str] = Field(default=[], description="Actions for future tax years")
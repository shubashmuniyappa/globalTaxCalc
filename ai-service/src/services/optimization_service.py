import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json
from datetime import datetime, date

from src.core import optimization_logger
from src.models import get_model_manager
from src.services.nlp_service import ParsedTaxInfo, FilingStatus


class OptimizationCategory(Enum):
    DEDUCTIONS = "deductions"
    RETIREMENT = "retirement"
    TAX_CREDITS = "tax_credits"
    INCOME_TIMING = "income_timing"
    BUSINESS_EXPENSES = "business_expenses"
    EDUCATION = "education"
    HEALTHCARE = "healthcare"
    CHARITABLE_GIVING = "charitable_giving"


@dataclass
class OptimizationSuggestion:
    """A tax optimization suggestion."""
    id: str
    category: OptimizationCategory
    title: str
    description: str
    potential_savings: float
    confidence: float
    priority: int  # 1-5, where 1 is highest priority
    required_actions: List[str]
    deadlines: List[str]
    applicable_tax_years: List[int]
    legal_references: List[str]
    estimated_effort: str  # "low", "medium", "high"
    eligibility_requirements: List[str]
    risks: List[str]
    additional_info: Dict[str, Any]


class TaxOptimizationService:
    """Service for generating intelligent tax optimization suggestions."""

    def __init__(self):
        self.model_manager = get_model_manager()

        # Current tax year limits and thresholds (2024)
        self.tax_limits = {
            "401k_contribution_limit": 23000,
            "401k_catchup_limit": 7500,  # Additional for 50+
            "ira_contribution_limit": 7000,
            "ira_catchup_limit": 1000,  # Additional for 50+
            "hsa_individual_limit": 4150,
            "hsa_family_limit": 8300,
            "hsa_catchup_limit": 1000,  # Additional for 55+
            "dependent_care_fsa_limit": 5000,
            "charitable_deduction_limit_agi_percentage": 60,
            "student_loan_interest_deduction_max": 2500,
            "state_local_tax_deduction_cap": 10000,
            "mortgage_interest_debt_limit": 750000
        }

        # Income thresholds for various benefits
        self.income_thresholds = {
            "roth_ira_phaseout_single": (138000, 153000),
            "roth_ira_phaseout_married": (218000, 228000),
            "eitc_max_income_no_children": 17640,
            "eitc_max_income_1_child": 46560,
            "eitc_max_income_2_children": 52918,
            "eitc_max_income_3_plus_children": 56838,
            "child_tax_credit_phaseout_single": 200000,
            "child_tax_credit_phaseout_married": 400000
        }

    async def generate_optimization_suggestions(
        self,
        tax_info: ParsedTaxInfo,
        current_tax_calculation: Optional[Dict[str, Any]] = None,
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> List[OptimizationSuggestion]:
        """Generate personalized tax optimization suggestions."""
        try:
            optimization_logger.info("Generating optimization suggestions",
                                   income=tax_info.income,
                                   filing_status=tax_info.filing_status)

            suggestions = []

            # Generate different types of suggestions
            suggestions.extend(await self._generate_retirement_suggestions(tax_info))
            suggestions.extend(await self._generate_deduction_suggestions(tax_info))
            suggestions.extend(await self._generate_credit_suggestions(tax_info))
            suggestions.extend(await self._generate_income_timing_suggestions(tax_info))
            suggestions.extend(await self._generate_education_suggestions(tax_info))
            suggestions.extend(await self._generate_healthcare_suggestions(tax_info))
            suggestions.extend(await self._generate_charitable_suggestions(tax_info))

            # Use AI to enhance suggestions if available
            enhanced_suggestions = await self._enhance_suggestions_with_ai(tax_info, suggestions)

            # Sort by priority and potential savings
            final_suggestions = self._prioritize_suggestions(enhanced_suggestions or suggestions)

            optimization_logger.info("Optimization suggestions generated",
                                   total_suggestions=len(final_suggestions),
                                   total_potential_savings=sum(s.potential_savings for s in final_suggestions))

            return final_suggestions[:10]  # Return top 10 suggestions

        except Exception as e:
            optimization_logger.error("Failed to generate optimization suggestions", error=str(e))
            return []

    async def _generate_retirement_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate retirement-related optimization suggestions."""
        suggestions = []

        if not tax_info.income:
            return suggestions

        # 401(k) contribution suggestion
        current_401k = tax_info.retirement_contributions or 0
        max_401k = self.tax_limits["401k_contribution_limit"]

        if current_401k < max_401k:
            additional_contribution = max_401k - current_401k
            # Estimate tax savings (assume marginal tax rate based on income)
            marginal_rate = self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status)
            potential_savings = additional_contribution * marginal_rate

            suggestions.append(OptimizationSuggestion(
                id="401k_maximize",
                category=OptimizationCategory.RETIREMENT,
                title="Maximize 401(k) Contributions",
                description=f"Increase your 401(k) contribution by ${additional_contribution:,.0f} to reach the annual limit.",
                potential_savings=potential_savings,
                confidence=0.9,
                priority=1,
                required_actions=[
                    "Contact your HR department or 401(k) provider",
                    f"Increase contribution by ${additional_contribution:,.0f}",
                    "Ensure contributions don't exceed annual limit"
                ],
                deadlines=["December 31st for current tax year"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 402(g)"],
                estimated_effort="low",
                eligibility_requirements=["Must have access to employer 401(k) plan"],
                risks=["Reduced take-home pay"],
                additional_info={
                    "current_contribution": current_401k,
                    "recommended_contribution": max_401k,
                    "monthly_increase": additional_contribution / 12
                }
            ))

        # IRA contribution suggestion
        ira_limit = self.tax_limits["ira_contribution_limit"]
        if self._is_eligible_for_ira_deduction(tax_info.income, tax_info.filing_status):
            potential_savings = ira_limit * self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status)

            suggestions.append(OptimizationSuggestion(
                id="ira_contribute",
                category=OptimizationCategory.RETIREMENT,
                title="Contribute to Traditional IRA",
                description=f"Contribute ${ira_limit:,.0f} to a traditional IRA for immediate tax deduction.",
                potential_savings=potential_savings,
                confidence=0.85,
                priority=2,
                required_actions=[
                    "Open IRA account if needed",
                    f"Contribute ${ira_limit:,.0f} before deadline",
                    "Keep records for tax filing"
                ],
                deadlines=["April 15th of following year"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 219"],
                estimated_effort="low",
                eligibility_requirements=[
                    "Must have earned income",
                    "Income limits apply for deductibility"
                ],
                risks=["Early withdrawal penalties before age 59½"],
                additional_info={
                    "contribution_limit": ira_limit,
                    "deductible": True
                }
            ))

        # Roth IRA suggestion for younger/lower income individuals
        elif self._is_eligible_for_roth_ira(tax_info.income, tax_info.filing_status):
            suggestions.append(OptimizationSuggestion(
                id="roth_ira_contribute",
                category=OptimizationCategory.RETIREMENT,
                title="Consider Roth IRA Contribution",
                description=f"Contribute ${ira_limit:,.0f} to a Roth IRA for tax-free growth and withdrawals in retirement.",
                potential_savings=0,  # No immediate tax benefit, but long-term value
                confidence=0.75,
                priority=3,
                required_actions=[
                    "Open Roth IRA account if needed",
                    f"Contribute ${ira_limit:,.0f} before deadline",
                    "Consider conversion strategies"
                ],
                deadlines=["April 15th of following year"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 408A"],
                estimated_effort="low",
                eligibility_requirements=["Income limits apply"],
                risks=["No immediate tax deduction"],
                additional_info={
                    "contribution_limit": ira_limit,
                    "tax_free_growth": True,
                    "long_term_benefit": True
                }
            ))

        return suggestions

    async def _generate_deduction_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate deduction optimization suggestions."""
        suggestions = []

        if not tax_info.income:
            return suggestions

        # Calculate standard deduction
        standard_deduction = self._get_standard_deduction(tax_info.filing_status)
        current_itemized = sum(d.get("amount", 0) for d in tax_info.deductions)

        # Suggest itemizing if close to standard deduction
        if current_itemized > standard_deduction * 0.8:
            additional_needed = standard_deduction - current_itemized + 1000  # Buffer

            suggestions.append(OptimizationSuggestion(
                id="itemize_deductions",
                category=OptimizationCategory.DEDUCTIONS,
                title="Consider Additional Itemized Deductions",
                description=f"You're close to exceeding the standard deduction. Look for additional deductions worth ${additional_needed:,.0f}.",
                potential_savings=additional_needed * self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status),
                confidence=0.7,
                priority=2,
                required_actions=[
                    "Review all potential deductions",
                    "Gather documentation",
                    "Consider timing deductions"
                ],
                deadlines=["December 31st"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 63"],
                estimated_effort="medium",
                eligibility_requirements=["Must exceed standard deduction"],
                risks=["Increased audit risk with itemizing"],
                additional_info={
                    "standard_deduction": standard_deduction,
                    "current_itemized": current_itemized,
                    "additional_needed": additional_needed
                }
            ))

        # State and local tax optimization
        if tax_info.state and tax_info.state not in ['TX', 'FL', 'NV', 'TN', 'WA', 'WY', 'SD', 'AK', 'NH']:
            salt_cap = self.tax_limits["state_local_tax_deduction_cap"]
            suggestions.append(OptimizationSuggestion(
                id="salt_timing",
                category=OptimizationCategory.DEDUCTIONS,
                title="Optimize State and Local Tax Timing",
                description=f"Consider timing state tax payments to maximize deduction within the ${salt_cap:,.0f} SALT cap.",
                potential_savings=salt_cap * self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status) * 0.1,
                confidence=0.6,
                priority=3,
                required_actions=[
                    "Review state tax payment schedule",
                    "Consider prepaying or deferring payments",
                    "Track total SALT deductions"
                ],
                deadlines=["December 31st"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 164"],
                estimated_effort="medium",
                eligibility_requirements=["Must itemize deductions"],
                risks=["SALT deduction cap limitations"],
                additional_info={
                    "salt_cap": salt_cap,
                    "affected_states": "Most states except TX, FL, NV, etc."
                }
            ))

        return suggestions

    async def _generate_credit_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate tax credit optimization suggestions."""
        suggestions = []

        if not tax_info.income:
            return suggestions

        # Child Tax Credit optimization
        if tax_info.dependents > 0:
            child_credit = min(tax_info.dependents * 2000,
                             self._calculate_child_tax_credit(tax_info.income, tax_info.filing_status, tax_info.dependents))

            if child_credit > 0:
                suggestions.append(OptimizationSuggestion(
                    id="child_tax_credit",
                    category=OptimizationCategory.TAX_CREDITS,
                    title="Claim Child Tax Credit",
                    description=f"Ensure you're claiming the full Child Tax Credit of ${child_credit:,.0f}.",
                    potential_savings=child_credit,
                    confidence=0.95,
                    priority=1,
                    required_actions=[
                        "Ensure children qualify (under 17, etc.)",
                        "Provide SSN for each child",
                        "Check income limits"
                    ],
                    deadlines=["Tax filing deadline"],
                    applicable_tax_years=[2024],
                    legal_references=["IRC Section 24"],
                    estimated_effort="low",
                    eligibility_requirements=[
                        "Child must be under 17",
                        "Child must be your dependent",
                        "Income limits apply"
                    ],
                    risks=["Credit phases out at higher incomes"],
                    additional_info={
                        "credit_per_child": 2000,
                        "total_children": tax_info.dependents,
                        "total_credit": child_credit
                    }
                ))

        # Earned Income Tax Credit for lower incomes
        if self._is_eligible_for_eitc(tax_info.income, tax_info.filing_status, tax_info.dependents):
            max_eitc = self._calculate_max_eitc(tax_info.dependents)

            suggestions.append(OptimizationSuggestion(
                id="earned_income_credit",
                category=OptimizationCategory.TAX_CREDITS,
                title="Claim Earned Income Tax Credit",
                description=f"You may be eligible for the Earned Income Tax Credit worth up to ${max_eitc:,.0f}.",
                potential_savings=max_eitc,
                confidence=0.8,
                priority=1,
                required_actions=[
                    "Verify income limits",
                    "Ensure all dependents qualify",
                    "File tax return to claim"
                ],
                deadlines=["Tax filing deadline"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 32"],
                estimated_effort="low",
                eligibility_requirements=[
                    "Must have earned income",
                    "Income limits apply",
                    "Must file tax return"
                ],
                risks=["Strict income and dependent requirements"],
                additional_info={
                    "max_credit": max_eitc,
                    "refundable": True,
                    "children_count": tax_info.dependents
                }
            ))

        return suggestions

    async def _generate_income_timing_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate income timing optimization suggestions."""
        suggestions = []

        if not tax_info.income:
            return suggestions

        # Year-end bonus timing
        if tax_info.income > 100000:  # Likely to have bonus opportunities
            marginal_rate = self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status)

            suggestions.append(OptimizationSuggestion(
                id="bonus_timing",
                category=OptimizationCategory.INCOME_TIMING,
                title="Consider Year-End Bonus Timing",
                description="If you have control over bonus timing, consider deferring to the next year if beneficial.",
                potential_savings=5000 * marginal_rate * 0.1,  # Estimated benefit
                confidence=0.6,
                priority=4,
                required_actions=[
                    "Consult with employer about bonus timing",
                    "Compare current vs. next year tax rates",
                    "Consider deferred compensation plans"
                ],
                deadlines=["Before bonus payment"],
                applicable_tax_years=[2024, 2025],
                legal_references=["IRC Section 451"],
                estimated_effort="medium",
                eligibility_requirements=["Must have control over income timing"],
                risks=["Future tax rate uncertainty"],
                additional_info={
                    "strategy": "income_smoothing",
                    "complexity": "requires planning"
                }
            ))

        return suggestions

    async def _generate_education_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate education-related optimization suggestions."""
        suggestions = []

        # Student loan interest deduction
        if tax_info.student_loan_interest and tax_info.student_loan_interest > 0:
            max_deduction = min(tax_info.student_loan_interest, self.tax_limits["student_loan_interest_deduction_max"])
            potential_savings = max_deduction * self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status)

            suggestions.append(OptimizationSuggestion(
                id="student_loan_interest",
                category=OptimizationCategory.EDUCATION,
                title="Claim Student Loan Interest Deduction",
                description=f"Deduct up to ${max_deduction:,.0f} in student loan interest paid.",
                potential_savings=potential_savings,
                confidence=0.9,
                priority=2,
                required_actions=[
                    "Obtain Form 1098-E from lender",
                    "Verify income limits",
                    "Include in tax return"
                ],
                deadlines=["Tax filing deadline"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 221"],
                estimated_effort="low",
                eligibility_requirements=[
                    "Must have paid student loan interest",
                    "Income limits apply",
                    "Cannot be claimed as dependent"
                ],
                risks=["Income phaseout applies"],
                additional_info={
                    "max_deduction": self.tax_limits["student_loan_interest_deduction_max"],
                    "current_interest": tax_info.student_loan_interest
                }
            ))

        return suggestions

    async def _generate_healthcare_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate healthcare-related optimization suggestions."""
        suggestions = []

        # HSA contribution suggestion
        if tax_info.income and tax_info.income < 200000:  # Likely eligible for HDHP
            hsa_limit = self.tax_limits["hsa_individual_limit"]  # Assume individual for now
            potential_savings = hsa_limit * self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status)

            suggestions.append(OptimizationSuggestion(
                id="hsa_contribute",
                category=OptimizationCategory.HEALTHCARE,
                title="Maximize HSA Contributions",
                description=f"Contribute ${hsa_limit:,.0f} to an HSA for triple tax advantage.",
                potential_savings=potential_savings,
                confidence=0.8,
                priority=2,
                required_actions=[
                    "Enroll in High Deductible Health Plan",
                    "Open HSA account",
                    f"Contribute ${hsa_limit:,.0f} annually"
                ],
                deadlines=["December 31st for contributions"],
                applicable_tax_years=[2024],
                legal_references=["IRC Section 223"],
                estimated_effort="medium",
                eligibility_requirements=[
                    "Must have High Deductible Health Plan",
                    "Cannot have other health coverage",
                    "Cannot be claimed as dependent"
                ],
                risks=["Must qualify for HDHP"],
                additional_info={
                    "triple_tax_advantage": "Deductible, grows tax-free, tax-free withdrawals for medical",
                    "individual_limit": hsa_limit,
                    "family_limit": self.tax_limits["hsa_family_limit"]
                }
            ))

        return suggestions

    async def _generate_charitable_suggestions(self, tax_info: ParsedTaxInfo) -> List[OptimizationSuggestion]:
        """Generate charitable giving optimization suggestions."""
        suggestions = []

        if not tax_info.income:
            return suggestions

        # Charitable deduction optimization
        if tax_info.charitable_donations and tax_info.charitable_donations > 0:
            max_deductible = tax_info.income * (self.tax_limits["charitable_deduction_limit_agi_percentage"] / 100)
            if tax_info.charitable_donations < max_deductible:
                additional_room = max_deductible - tax_info.charitable_donations
                potential_savings = min(additional_room, 5000) * self._estimate_marginal_tax_rate(tax_info.income, tax_info.filing_status)

                suggestions.append(OptimizationSuggestion(
                    id="charitable_bunching",
                    category=OptimizationCategory.CHARITABLE_GIVING,
                    title="Consider Charitable Bunching Strategy",
                    description=f"You have ${additional_room:,.0f} in additional charitable deduction capacity.",
                    potential_savings=potential_savings,
                    confidence=0.7,
                    priority=3,
                    required_actions=[
                        "Plan charitable giving strategy",
                        "Consider bunching donations in one year",
                        "Use donor-advised funds for timing flexibility"
                    ],
                    deadlines=["December 31st"],
                    applicable_tax_years=[2024],
                    legal_references=["IRC Section 170"],
                    estimated_effort="medium",
                    eligibility_requirements=[
                        "Must itemize deductions",
                        "Donations to qualified organizations only"
                    ],
                    risks=["Must exceed standard deduction"],
                    additional_info={
                        "current_donations": tax_info.charitable_donations,
                        "max_deductible": max_deductible,
                        "additional_capacity": additional_room
                    }
                ))

        return suggestions

    async def _enhance_suggestions_with_ai(
        self,
        tax_info: ParsedTaxInfo,
        suggestions: List[OptimizationSuggestion]
    ) -> Optional[List[OptimizationSuggestion]]:
        """Use AI to enhance and personalize suggestions."""
        try:
            if not suggestions:
                return suggestions

            # Create context for AI
            context = {
                "income": tax_info.income,
                "filing_status": tax_info.filing_status.value if tax_info.filing_status else "unknown",
                "dependents": tax_info.dependents,
                "state": tax_info.state,
                "current_suggestions": len(suggestions)
            }

            prompt = f"""
Based on this taxpayer profile:
- Income: ${tax_info.income:,.0f} if tax_info.income else 'Unknown'
- Filing Status: {context['filing_status']}
- Dependents: {tax_info.dependents}
- State: {tax_info.state or 'Unknown'}

Review these tax optimization suggestions and provide:
1. Priority ranking (1-5)
2. Additional considerations
3. Risk assessment
4. Implementation difficulty

Focus on the top 3 most impactful suggestions for this taxpayer's situation.

Keep response concise and practical.
"""

            response = await self.model_manager.generate_text(
                prompt,
                max_new_tokens=200,
                temperature=0.3
            )

            if response:
                # Use AI insights to adjust suggestion priorities and confidence
                optimization_logger.info("AI enhancement completed", response_length=len(response))
                # Note: In production, you would parse the AI response and update suggestions
                # For now, return original suggestions

            return suggestions

        except Exception as e:
            optimization_logger.warning("AI enhancement failed", error=str(e))
            return suggestions

    def _prioritize_suggestions(self, suggestions: List[OptimizationSuggestion]) -> List[OptimizationSuggestion]:
        """Sort suggestions by priority and potential savings."""
        return sorted(
            suggestions,
            key=lambda x: (x.priority, -x.potential_savings, -x.confidence)
        )

    def _estimate_marginal_tax_rate(self, income: float, filing_status: Optional[FilingStatus]) -> float:
        """Estimate marginal tax rate based on income and filing status."""
        # Simplified federal tax brackets for 2024
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            if income <= 22000:
                return 0.10
            elif income <= 89450:
                return 0.12
            elif income <= 190750:
                return 0.22
            elif income <= 364200:
                return 0.24
            elif income <= 462500:
                return 0.32
            elif income <= 693750:
                return 0.35
            else:
                return 0.37
        else:  # Single, MFS, HOH (simplified)
            if income <= 11000:
                return 0.10
            elif income <= 44725:
                return 0.12
            elif income <= 95375:
                return 0.22
            elif income <= 182050:
                return 0.24
            elif income <= 231250:
                return 0.32
            elif income <= 578125:
                return 0.35
            else:
                return 0.37

    def _get_standard_deduction(self, filing_status: Optional[FilingStatus]) -> float:
        """Get standard deduction amount for 2024."""
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            return 29200
        elif filing_status == FilingStatus.MARRIED_FILING_SEPARATELY:
            return 14600
        elif filing_status == FilingStatus.HEAD_OF_HOUSEHOLD:
            return 21900
        else:  # Single
            return 14600

    def _is_eligible_for_ira_deduction(self, income: float, filing_status: Optional[FilingStatus]) -> bool:
        """Check if eligible for traditional IRA deduction."""
        # Simplified - assumes no workplace retirement plan
        return True  # Most people are eligible for some IRA deduction

    def _is_eligible_for_roth_ira(self, income: float, filing_status: Optional[FilingStatus]) -> bool:
        """Check if eligible for Roth IRA contribution."""
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            return income < self.income_thresholds["roth_ira_phaseout_married"][1]
        else:
            return income < self.income_thresholds["roth_ira_phaseout_single"][1]

    def _is_eligible_for_eitc(self, income: float, filing_status: Optional[FilingStatus], dependents: int) -> bool:
        """Check if eligible for Earned Income Tax Credit."""
        if dependents == 0:
            return income <= self.income_thresholds["eitc_max_income_no_children"]
        elif dependents == 1:
            return income <= self.income_thresholds["eitc_max_income_1_child"]
        elif dependents == 2:
            return income <= self.income_thresholds["eitc_max_income_2_children"]
        else:
            return income <= self.income_thresholds["eitc_max_income_3_plus_children"]

    def _calculate_child_tax_credit(self, income: float, filing_status: Optional[FilingStatus], dependents: int) -> float:
        """Calculate Child Tax Credit amount."""
        base_credit = dependents * 2000

        # Apply income limits
        if filing_status == FilingStatus.MARRIED_FILING_JOINTLY:
            phaseout_start = self.income_thresholds["child_tax_credit_phaseout_married"]
        else:
            phaseout_start = self.income_thresholds["child_tax_credit_phaseout_single"]

        if income > phaseout_start:
            reduction = ((income - phaseout_start) // 1000) * 50
            return max(0, base_credit - reduction)

        return base_credit

    def _calculate_max_eitc(self, dependents: int) -> float:
        """Calculate maximum EITC for number of dependents."""
        # 2024 maximum EITC amounts
        if dependents == 0:
            return 632
        elif dependents == 1:
            return 4213
        elif dependents == 2:
            return 6960
        else:  # 3 or more
            return 7830


# Global service instance
optimization_service = TaxOptimizationService()
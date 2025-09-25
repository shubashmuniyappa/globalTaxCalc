"""
Base Tax Calculator Abstract Class

This module provides the abstract base class that all country-specific
tax calculators must inherit from. It defines the common interface and
shared functionality for tax calculations across different countries.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
import json
import logging

logger = logging.getLogger(__name__)

@dataclass
class TaxBracket:
    """Represents a tax bracket with rate and thresholds"""
    min_income: Decimal
    max_income: Optional[Decimal]
    rate: Decimal
    description: str = ""

@dataclass
class Deduction:
    """Represents a tax deduction"""
    name: str
    amount: Decimal
    category: str
    description: str = ""
    is_percentage: bool = False
    max_amount: Optional[Decimal] = None

@dataclass
class TaxCredit:
    """Represents a tax credit"""
    name: str
    amount: Decimal
    is_refundable: bool = False
    description: str = ""

@dataclass
class SocialContribution:
    """Represents social security/pension contributions"""
    name: str
    rate: Decimal
    min_income: Decimal = Decimal('0')
    max_income: Optional[Decimal] = None
    employer_rate: Optional[Decimal] = None
    description: str = ""

@dataclass
class TaxResult:
    """Comprehensive tax calculation result"""
    # Basic calculation
    gross_income: Decimal
    taxable_income: Decimal
    income_tax: Decimal
    social_contributions: Decimal
    total_tax: Decimal
    net_income: Decimal

    # Detailed breakdown
    tax_brackets_applied: List[Dict[str, Any]]
    deductions_applied: List[Dict[str, Any]]
    credits_applied: List[Dict[str, Any]]
    social_contributions_breakdown: List[Dict[str, Any]]

    # Metadata
    country_code: str
    tax_year: int
    currency: str
    calculation_date: date

    # Rates and percentages
    effective_tax_rate: Decimal
    marginal_tax_rate: Decimal
    social_contribution_rate: Decimal

    # Additional information
    warnings: List[str]
    notes: List[str]

class BaseTaxCalculator(ABC):
    """
    Abstract base class for all country-specific tax calculators.

    Each country implementation must inherit from this class and implement
    the required abstract methods while optionally overriding default methods.
    """

    def __init__(self, country_code: str, currency: str, tax_year: int = 2024):
        self.country_code = country_code.upper()
        self.currency = currency.upper()
        self.tax_year = tax_year
        self.tax_rules = self._load_tax_rules()
        self.exchange_rates = {}

    @abstractmethod
    def _load_tax_rules(self) -> Dict[str, Any]:
        """Load country-specific tax rules from configuration"""
        pass

    @abstractmethod
    def calculate_income_tax(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate income tax based on country-specific rules"""
        pass

    @abstractmethod
    def calculate_social_contributions(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate social security and pension contributions"""
        pass

    @abstractmethod
    def get_tax_brackets(self) -> List[TaxBracket]:
        """Get income tax brackets for the country"""
        pass

    @abstractmethod
    def get_standard_deductions(self) -> List[Deduction]:
        """Get standard deductions available in the country"""
        pass

    def calculate_comprehensive_tax(
        self,
        gross_income: Decimal,
        deductions: Optional[List[Deduction]] = None,
        credits: Optional[List[TaxCredit]] = None,
        **kwargs
    ) -> TaxResult:
        """
        Perform comprehensive tax calculation including all components.

        Args:
            gross_income: Annual gross income
            deductions: List of applicable deductions
            credits: List of applicable tax credits
            **kwargs: Country-specific parameters

        Returns:
            TaxResult: Comprehensive calculation result
        """
        try:
            # Initialize
            warnings = []
            notes = []
            deductions = deductions or []
            credits = credits or []

            # Validate inputs
            if gross_income < 0:
                raise ValueError("Gross income cannot be negative")

            # Calculate deductions
            total_deductions, deductions_breakdown = self._calculate_total_deductions(
                gross_income, deductions
            )

            # Calculate taxable income
            taxable_income = max(Decimal('0'), gross_income - total_deductions)

            # Calculate income tax
            income_tax, tax_brackets_applied = self._calculate_progressive_tax(
                taxable_income
            )

            # Apply tax credits
            income_tax_after_credits, credits_applied = self._apply_tax_credits(
                income_tax, credits
            )

            # Calculate social contributions
            social_contributions, social_breakdown = self._calculate_detailed_social_contributions(
                gross_income, **kwargs
            )

            # Calculate totals
            total_tax = income_tax_after_credits + social_contributions
            net_income = gross_income - total_tax

            # Calculate rates
            effective_tax_rate = (total_tax / gross_income * 100) if gross_income > 0 else Decimal('0')
            marginal_tax_rate = self._get_marginal_tax_rate(taxable_income)
            social_contribution_rate = (social_contributions / gross_income * 100) if gross_income > 0 else Decimal('0')

            # Add country-specific notes
            notes.extend(self._get_calculation_notes(gross_income, **kwargs))

            return TaxResult(
                gross_income=self._round_currency(gross_income),
                taxable_income=self._round_currency(taxable_income),
                income_tax=self._round_currency(income_tax_after_credits),
                social_contributions=self._round_currency(social_contributions),
                total_tax=self._round_currency(total_tax),
                net_income=self._round_currency(net_income),
                tax_brackets_applied=tax_brackets_applied,
                deductions_applied=deductions_breakdown,
                credits_applied=credits_applied,
                social_contributions_breakdown=social_breakdown,
                country_code=self.country_code,
                tax_year=self.tax_year,
                currency=self.currency,
                calculation_date=date.today(),
                effective_tax_rate=self._round_rate(effective_tax_rate),
                marginal_tax_rate=self._round_rate(marginal_tax_rate),
                social_contribution_rate=self._round_rate(social_contribution_rate),
                warnings=warnings,
                notes=notes
            )

        except Exception as e:
            logger.error(f"Tax calculation failed for {self.country_code}: {str(e)}")
            raise

    def _calculate_progressive_tax(self, taxable_income: Decimal) -> Tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate progressive income tax using tax brackets"""
        brackets = self.get_tax_brackets()
        total_tax = Decimal('0')
        brackets_applied = []
        remaining_income = taxable_income

        for bracket in brackets:
            if remaining_income <= 0:
                break

            # Calculate income in this bracket
            bracket_income = min(
                remaining_income,
                (bracket.max_income or remaining_income) - bracket.min_income
            )

            if bracket_income > 0:
                bracket_tax = bracket_income * bracket.rate / 100
                total_tax += bracket_tax

                brackets_applied.append({
                    'bracket': {
                        'min_income': float(bracket.min_income),
                        'max_income': float(bracket.max_income) if bracket.max_income else None,
                        'rate': float(bracket.rate),
                        'description': bracket.description
                    },
                    'income_in_bracket': float(bracket_income),
                    'tax_amount': float(bracket_tax)
                })

                remaining_income -= bracket_income

        return total_tax, brackets_applied

    def _calculate_total_deductions(
        self,
        gross_income: Decimal,
        deductions: List[Deduction]
    ) -> Tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate total deductions and provide breakdown"""
        total_deductions = Decimal('0')
        deductions_breakdown = []

        # Add standard deductions
        standard_deductions = self.get_standard_deductions()
        all_deductions = standard_deductions + deductions

        for deduction in all_deductions:
            if deduction.is_percentage:
                deduction_amount = gross_income * deduction.amount / 100
                if deduction.max_amount:
                    deduction_amount = min(deduction_amount, deduction.max_amount)
            else:
                deduction_amount = deduction.amount

            total_deductions += deduction_amount

            deductions_breakdown.append({
                'name': deduction.name,
                'category': deduction.category,
                'amount': float(deduction_amount),
                'description': deduction.description,
                'is_percentage': deduction.is_percentage
            })

        return total_deductions, deductions_breakdown

    def _apply_tax_credits(
        self,
        income_tax: Decimal,
        credits: List[TaxCredit]
    ) -> Tuple[Decimal, List[Dict[str, Any]]]:
        """Apply tax credits and provide breakdown"""
        remaining_tax = income_tax
        credits_applied = []
        total_credits_used = Decimal('0')

        for credit in credits:
            credit_used = min(credit.amount, remaining_tax)

            if credit.is_refundable:
                credit_used = credit.amount
                remaining_tax -= credit.amount
            else:
                remaining_tax -= credit_used

            total_credits_used += credit_used

            credits_applied.append({
                'name': credit.name,
                'amount_available': float(credit.amount),
                'amount_used': float(credit_used),
                'is_refundable': credit.is_refundable,
                'description': credit.description
            })

        final_tax = max(Decimal('0'), income_tax - total_credits_used)
        return final_tax, credits_applied

    def _calculate_detailed_social_contributions(
        self,
        income: Decimal,
        **kwargs
    ) -> Tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate detailed social contributions breakdown"""
        total_contributions = self.calculate_social_contributions(income, **kwargs)

        # This should be overridden by country-specific implementations
        # to provide detailed breakdown
        breakdown = [{
            'name': 'Social Contributions',
            'amount': float(total_contributions),
            'rate': float(total_contributions / income * 100) if income > 0 else 0,
            'description': 'Total social security contributions'
        }]

        return total_contributions, breakdown

    def _get_marginal_tax_rate(self, taxable_income: Decimal) -> Decimal:
        """Get marginal tax rate for given income level"""
        brackets = self.get_tax_brackets()

        for bracket in reversed(brackets):
            if taxable_income >= bracket.min_income:
                if bracket.max_income is None or taxable_income <= bracket.max_income:
                    return bracket.rate

        return Decimal('0')

    def _get_calculation_notes(self, gross_income: Decimal, **kwargs) -> List[str]:
        """Get country-specific calculation notes"""
        return []

    def _round_currency(self, amount: Decimal) -> Decimal:
        """Round amount according to currency rules"""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _round_rate(self, rate: Decimal) -> Decimal:
        """Round percentage rate to 2 decimal places"""
        return rate.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_country_info(self) -> Dict[str, Any]:
        """Get country information and metadata"""
        return {
            'country_code': self.country_code,
            'currency': self.currency,
            'tax_year': self.tax_year,
            'supported_features': self._get_supported_features(),
            'tax_brackets_count': len(self.get_tax_brackets()),
            'standard_deductions_count': len(self.get_standard_deductions())
        }

    def _get_supported_features(self) -> List[str]:
        """Get list of supported features for this country"""
        return [
            'income_tax',
            'social_contributions',
            'tax_brackets',
            'deductions',
            'tax_credits'
        ]

    def validate_inputs(self, **kwargs) -> List[str]:
        """Validate calculation inputs and return warnings"""
        warnings = []

        # This should be overridden by country-specific implementations
        # to add country-specific validation

        return warnings

    def get_optimization_suggestions(
        self,
        gross_income: Decimal,
        current_deductions: List[Deduction] = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Get tax optimization suggestions"""
        # This should be overridden by country-specific implementations
        return []

    def compare_scenarios(
        self,
        scenarios: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compare multiple tax scenarios"""
        results = []

        for i, scenario in enumerate(scenarios):
            result = self.calculate_comprehensive_tax(**scenario)
            results.append({
                'scenario_id': i + 1,
                'scenario_name': scenario.get('name', f'Scenario {i + 1}'),
                'result': result
            })

        # Find best scenario (lowest total tax)
        best_scenario = min(results, key=lambda x: x['result'].total_tax)

        return {
            'scenarios': results,
            'best_scenario': best_scenario,
            'comparison_date': date.today().isoformat(),
            'country_code': self.country_code
        }
"""
India Tax Calculator

Implements Indian income tax calculations including:
- Income tax slabs and rates
- TDS (Tax Deducted at Source)
- CESS calculations
- Section 80C, 80D and other deductions
- Standard deduction
- Old vs New tax regime comparison
"""

from decimal import Decimal
from typing import Dict, List, Optional, Any
import json
import os
from ..base_calculator import BaseTaxCalculator, TaxBracket, Deduction, TaxCredit, SocialContribution, TaxResult

class IndiaTaxCalculator(BaseTaxCalculator):
    """India-specific tax calculator implementing Indian Income Tax Act provisions"""

    def __init__(self, tax_year: int = 2024, regime: str = 'new'):
        super().__init__('IN', 'INR', tax_year)
        self.regime = regime.lower()  # 'old' or 'new'

    def _load_tax_rules(self) -> Dict[str, Any]:
        """Load India-specific tax rules"""
        return {
            'standard_deduction': Decimal('50000'),  # Standard deduction for FY 2024-25
            'basic_exemption_limit': Decimal('300000'),  # New regime
            'basic_exemption_limit_old': Decimal('250000'),  # Old regime
            'senior_citizen_age': 60,
            'super_senior_citizen_age': 80,
            'cess_rate': Decimal('4'),  # Health and Education Cess 4%
            'surcharge_thresholds': {
                'individual': Decimal('5000000'),
                'high': Decimal('10000000'),
                'very_high': Decimal('20000000'),
                'highest': Decimal('50000000')
            },
            'surcharge_rates': {
                'individual': Decimal('10'),
                'high': Decimal('15'),
                'very_high': Decimal('25'),
                'highest': Decimal('37')
            },
            'tds_threshold': Decimal('250000')
        }

    def get_tax_brackets(self) -> List[TaxBracket]:
        """Get income tax brackets based on regime"""
        if self.regime == 'new':
            return self._get_new_regime_brackets()
        else:
            return self._get_old_regime_brackets()

    def _get_new_regime_brackets(self) -> List[TaxBracket]:
        """Tax brackets for new regime (FY 2024-25)"""
        return [
            TaxBracket(Decimal('0'), Decimal('300000'), Decimal('0'), "Tax-free up to ₹3 lakh"),
            TaxBracket(Decimal('300000'), Decimal('700000'), Decimal('5'), "5% on income between ₹3-7 lakh"),
            TaxBracket(Decimal('700000'), Decimal('1000000'), Decimal('10'), "10% on income between ₹7-10 lakh"),
            TaxBracket(Decimal('1000000'), Decimal('1200000'), Decimal('15'), "15% on income between ₹10-12 lakh"),
            TaxBracket(Decimal('1200000'), Decimal('1500000'), Decimal('20'), "20% on income between ₹12-15 lakh"),
            TaxBracket(Decimal('1500000'), None, Decimal('30'), "30% on income above ₹15 lakh")
        ]

    def _get_old_regime_brackets(self) -> List[TaxBracket]:
        """Tax brackets for old regime"""
        return [
            TaxBracket(Decimal('0'), Decimal('250000'), Decimal('0'), "Tax-free up to ₹2.5 lakh"),
            TaxBracket(Decimal('250000'), Decimal('500000'), Decimal('5'), "5% on income between ₹2.5-5 lakh"),
            TaxBracket(Decimal('500000'), Decimal('1000000'), Decimal('20'), "20% on income between ₹5-10 lakh"),
            TaxBracket(Decimal('1000000'), None, Decimal('30'), "30% on income above ₹10 lakh")
        ]

    def get_standard_deductions(self) -> List[Deduction]:
        """Get standard deductions available"""
        deductions = []

        if self.regime == 'old':
            # Standard deduction (only in old regime)
            deductions.append(Deduction(
                name="Standard Deduction",
                amount=self.tax_rules['standard_deduction'],
                category="standard",
                description="Standard deduction for salaried individuals"
            ))

            # Section 80C deductions
            deductions.append(Deduction(
                name="Section 80C",
                amount=Decimal('150000'),
                category="investment",
                description="Investments in PPF, ELSS, LIC, etc. (max ₹1.5 lakh)",
                max_amount=Decimal('150000')
            ))

            # Section 80D - Health Insurance
            deductions.append(Deduction(
                name="Section 80D",
                amount=Decimal('25000'),
                category="health",
                description="Health insurance premium (max ₹25,000 for individual)",
                max_amount=Decimal('25000')
            ))

            # Section 80CCD(1B) - NPS
            deductions.append(Deduction(
                name="Section 80CCD(1B)",
                amount=Decimal('50000'),
                category="pension",
                description="Additional NPS contribution (max ₹50,000)",
                max_amount=Decimal('50000')
            ))

            # HRA exemption
            deductions.append(Deduction(
                name="HRA Exemption",
                amount=Decimal('0'),  # Calculated separately
                category="allowance",
                description="House Rent Allowance exemption"
            ))

        return deductions

    def calculate_income_tax(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate income tax based on Indian tax slabs"""
        age = kwargs.get('age', 25)

        # Adjust exemption limit based on age
        if age >= self.tax_rules['super_senior_citizen_age']:
            exemption_limit = Decimal('500000')  # Super senior citizen
        elif age >= self.tax_rules['senior_citizen_age']:
            exemption_limit = Decimal('300000')  # Senior citizen
        else:
            if self.regime == 'new':
                exemption_limit = self.tax_rules['basic_exemption_limit']
            else:
                exemption_limit = self.tax_rules['basic_exemption_limit_old']

        # Calculate taxable income
        taxable_income = max(Decimal('0'), income - exemption_limit)

        # Calculate basic tax using brackets
        basic_tax, _ = self._calculate_progressive_tax(taxable_income)

        # Apply surcharge if applicable
        tax_with_surcharge = self._apply_surcharge(basic_tax, income)

        # Apply Health and Education Cess
        total_tax = self._apply_cess(tax_with_surcharge)

        return total_tax

    def _apply_surcharge(self, basic_tax: Decimal, total_income: Decimal) -> Decimal:
        """Apply surcharge based on income level"""
        surcharge_rate = Decimal('0')

        if total_income > self.tax_rules['surcharge_thresholds']['highest']:
            surcharge_rate = self.tax_rules['surcharge_rates']['highest']
        elif total_income > self.tax_rules['surcharge_thresholds']['very_high']:
            surcharge_rate = self.tax_rules['surcharge_rates']['very_high']
        elif total_income > self.tax_rules['surcharge_thresholds']['high']:
            surcharge_rate = self.tax_rules['surcharge_rates']['high']
        elif total_income > self.tax_rules['surcharge_thresholds']['individual']:
            surcharge_rate = self.tax_rules['surcharge_rates']['individual']

        surcharge = basic_tax * surcharge_rate / Decimal('100')
        return basic_tax + surcharge

    def _apply_cess(self, tax_with_surcharge: Decimal) -> Decimal:
        """Apply Health and Education Cess"""
        cess = tax_with_surcharge * self.tax_rules['cess_rate'] / Decimal('100')
        return tax_with_surcharge + cess

    def calculate_social_contributions(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate social contributions (EPF, ESI, etc.)"""
        # Employee Provident Fund (EPF) - 12% on basic salary
        basic_salary = kwargs.get('basic_salary', income * Decimal('0.4'))
        epf_ceiling = Decimal('15000')  # Monthly ceiling for EPF
        monthly_basic = min(basic_salary / 12, epf_ceiling)
        epf_contribution = monthly_basic * 12 * Decimal('0.12')

        # Employee State Insurance (ESI) - 0.75% on salary up to ₹21,000 per month
        esi_ceiling = Decimal('21000')
        monthly_salary = income / 12
        if monthly_salary <= esi_ceiling:
            esi_contribution = income * Decimal('0.0075')
        else:
            esi_contribution = Decimal('0')

        return epf_contribution + esi_contribution

    def _calculate_detailed_social_contributions(
        self,
        income: Decimal,
        **kwargs
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate detailed social contributions breakdown"""
        breakdown = []
        total_contributions = Decimal('0')

        # EPF calculation
        basic_salary = kwargs.get('basic_salary', income * Decimal('0.4'))
        epf_ceiling = Decimal('15000')
        monthly_basic = min(basic_salary / 12, epf_ceiling)
        epf_contribution = monthly_basic * 12 * Decimal('0.12')

        breakdown.append({
            'name': 'Employee Provident Fund (EPF)',
            'amount': float(epf_contribution),
            'rate': 12.0,
            'description': 'Provident fund contribution (12% of basic salary)',
            'ceiling': float(epf_ceiling * 12)
        })
        total_contributions += epf_contribution

        # ESI calculation
        esi_ceiling = Decimal('21000')
        monthly_salary = income / 12
        if monthly_salary <= esi_ceiling:
            esi_contribution = income * Decimal('0.0075')
            breakdown.append({
                'name': 'Employee State Insurance (ESI)',
                'amount': float(esi_contribution),
                'rate': 0.75,
                'description': 'Health insurance contribution (0.75% of salary)',
                'ceiling': float(esi_ceiling * 12)
            })
            total_contributions += esi_contribution

        return total_contributions, breakdown

    def calculate_hra_exemption(
        self,
        hra_received: Decimal,
        basic_salary: Decimal,
        rent_paid: Decimal,
        is_metro: bool = False
    ) -> Decimal:
        """Calculate HRA exemption under Section 10(13A)"""
        if hra_received <= 0 or rent_paid <= 0:
            return Decimal('0')

        # HRA exemption is minimum of:
        # 1. Actual HRA received
        # 2. 50% of basic salary (metro) or 40% (non-metro)
        # 3. Rent paid minus 10% of basic salary

        metro_percentage = Decimal('50') if is_metro else Decimal('40')
        basic_percentage = basic_salary * metro_percentage / Decimal('100')

        rent_exemption = max(Decimal('0'), rent_paid - (basic_salary * Decimal('10') / Decimal('100')))

        exemption = min(hra_received, basic_percentage, rent_exemption)
        return exemption

    def calculate_tds(self, income: Decimal, **kwargs) -> Dict[str, Any]:
        """Calculate TDS (Tax Deducted at Source)"""
        if income < self.tax_rules['tds_threshold']:
            return {
                'tds_amount': float(Decimal('0')),
                'tds_rate': 0,
                'threshold_crossed': False,
                'description': 'Income below TDS threshold'
            }

        # Calculate annual tax liability
        annual_tax = self.calculate_income_tax(income, **kwargs)

        # TDS is typically deducted monthly
        monthly_tds = annual_tax / 12

        return {
            'tds_amount': float(annual_tax),
            'monthly_tds': float(monthly_tds),
            'tds_rate': float(annual_tax / income * 100) if income > 0 else 0,
            'threshold_crossed': True,
            'description': 'TDS calculated based on estimated annual income'
        }

    def compare_tax_regimes(self, gross_income: Decimal, **kwargs) -> Dict[str, Any]:
        """Compare old vs new tax regime"""
        # Calculate under old regime
        old_calc = IndiaTaxCalculator(self.tax_year, 'old')
        old_result = old_calc.calculate_comprehensive_tax(gross_income, **kwargs)

        # Calculate under new regime
        new_calc = IndiaTaxCalculator(self.tax_year, 'new')
        new_result = new_calc.calculate_comprehensive_tax(gross_income, **kwargs)

        # Determine better regime
        better_regime = 'new' if new_result.total_tax < old_result.total_tax else 'old'
        savings = abs(new_result.total_tax - old_result.total_tax)

        return {
            'old_regime': {
                'total_tax': float(old_result.total_tax),
                'net_income': float(old_result.net_income),
                'effective_rate': float(old_result.effective_tax_rate)
            },
            'new_regime': {
                'total_tax': float(new_result.total_tax),
                'net_income': float(new_result.net_income),
                'effective_rate': float(new_result.effective_tax_rate)
            },
            'recommendation': {
                'better_regime': better_regime,
                'savings': float(savings),
                'savings_percentage': float(savings / gross_income * 100) if gross_income > 0 else 0
            },
            'comparison_date': new_result.calculation_date.isoformat()
        }

    def get_optimization_suggestions(
        self,
        gross_income: Decimal,
        current_deductions: List[Deduction] = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Get India-specific tax optimization suggestions"""
        suggestions = []

        if self.regime == 'old':
            # Section 80C optimization
            current_80c = sum(d.amount for d in (current_deductions or []) if d.name == "Section 80C")
            if current_80c < Decimal('150000'):
                remaining_80c = Decimal('150000') - current_80c
                suggestions.append({
                    'type': 'deduction',
                    'title': 'Maximize Section 80C Investments',
                    'description': f'Invest ₹{remaining_80c:,.0f} more in 80C instruments',
                    'potential_savings': float(remaining_80c * Decimal('0.30')),  # Assuming 30% tax bracket
                    'category': 'investment'
                })

            # Health insurance optimization
            suggestions.append({
                'type': 'deduction',
                'title': 'Health Insurance Premium',
                'description': 'Consider health insurance for tax benefits under Section 80D',
                'potential_savings': float(Decimal('25000') * Decimal('0.30')),
                'category': 'health'
            })

            # NPS optimization
            suggestions.append({
                'type': 'deduction',
                'title': 'Additional NPS Contribution',
                'description': 'Invest ₹50,000 in NPS for Section 80CCD(1B) benefit',
                'potential_savings': float(Decimal('50000') * Decimal('0.30')),
                'category': 'pension'
            })

        # Regime comparison suggestion
        if self.regime == 'new':
            suggestions.append({
                'type': 'regime',
                'title': 'Consider Old Tax Regime',
                'description': 'Check if old regime with deductions is more beneficial',
                'potential_savings': 0,  # Would need to calculate
                'category': 'strategy'
            })

        return suggestions

    def _get_calculation_notes(self, gross_income: Decimal, **kwargs) -> List[str]:
        """Get India-specific calculation notes"""
        notes = []

        notes.append(f"Calculation performed under {self.regime.upper()} tax regime")
        notes.append("Tax rates are for Financial Year 2024-25 (Assessment Year 2025-26)")

        if self.regime == 'new':
            notes.append("New regime does not allow most deductions except standard deduction")
        else:
            notes.append("Old regime allows various deductions under Chapter VI-A")

        notes.append("Health and Education Cess of 4% applied on tax and surcharge")

        # Age-specific notes
        age = kwargs.get('age', 25)
        if age >= 80:
            notes.append("Super senior citizen exemption limit of ₹5 lakh applied")
        elif age >= 60:
            notes.append("Senior citizen exemption limit of ₹3 lakh applied")

        return notes

    def get_country_info(self) -> Dict[str, Any]:
        """Get India-specific information"""
        info = super().get_country_info()
        info.update({
            'country_name': 'India',
            'tax_authority': 'Income Tax Department',
            'financial_year': f'FY {self.tax_year}-{str(self.tax_year + 1)[2:]}',
            'assessment_year': f'AY {self.tax_year + 1}-{str(self.tax_year + 2)[2:]}',
            'tax_regime': self.regime,
            'currency_symbol': '₹',
            'supports_regime_comparison': True,
            'supports_tds_calculation': True,
            'supports_hra_calculation': True
        })
        return info
"""
Japan Tax Calculator

Implements Japanese income tax calculations including:
- National income tax (所得税)
- Local inhabitant tax (住民税)
- Social insurance contributions (社会保険料)
- Special reconstruction tax (復興特別所得税)
- Employment insurance (雇用保険)
- Pension contributions (年金保険料)
"""

from decimal import Decimal
from typing import Dict, List, Optional, Any
import json
from ..base_calculator import BaseTaxCalculator, TaxBracket, Deduction, TaxCredit, SocialContribution

class JapanTaxCalculator(BaseTaxCalculator):
    """Japan-specific tax calculator implementing Japanese tax law"""

    def __init__(self, tax_year: int = 2024, prefecture: str = 'tokyo'):
        super().__init__('JP', 'JPY', tax_year)
        self.prefecture = prefecture.lower()

    def _load_tax_rules(self) -> Dict[str, Any]:
        """Load Japan-specific tax rules"""
        return {
            'basic_exemption': Decimal('480000'),  # Basic exemption for 2024
            'spouse_exemption': Decimal('380000'),
            'dependent_exemption': Decimal('380000'),
            'social_insurance_exemption': True,  # Social insurance premiums are fully deductible
            'reconstruction_tax_rate': Decimal('2.1'),  # 2.1% special reconstruction tax
            'employment_insurance_rate': Decimal('0.6'),  # Employee rate 2024
            'employment_insurance_ceiling': Decimal('22900000'),  # Annual ceiling
            'pension_insurance_rate': Decimal('9.15'),  # Employee rate 2024
            'pension_insurance_ceiling': Decimal('7500000'),  # Annual ceiling
            'health_insurance_rate': Decimal('5.0'),  # Approximate average
            'health_insurance_ceiling': Decimal('12000000'),  # Approximate ceiling
            'care_insurance_rate': Decimal('0.6'),  # Care insurance (40+ years old)
            'care_insurance_age': 40,
            'inhabitant_tax_uniform': Decimal('5000'),  # Uniform portion
            'inhabitant_tax_rate': Decimal('10'),  # Standard rate (6% prefecture + 4% municipal)
            'inhabitant_tax_exemption': Decimal('350000')  # Basic exemption for inhabitant tax
        }

    def get_tax_brackets(self) -> List[TaxBracket]:
        """Get Japanese national income tax brackets for 2024"""
        return [
            TaxBracket(Decimal('0'), Decimal('1950000'), Decimal('5'), "5% on income up to ¥1,950,000"),
            TaxBracket(Decimal('1950000'), Decimal('3300000'), Decimal('10'), "10% on income ¥1,950,001-¥3,300,000"),
            TaxBracket(Decimal('3300000'), Decimal('6950000'), Decimal('20'), "20% on income ¥3,300,001-¥6,950,000"),
            TaxBracket(Decimal('6950000'), Decimal('9000000'), Decimal('23'), "23% on income ¥6,950,001-¥9,000,000"),
            TaxBracket(Decimal('9000000'), Decimal('18000000'), Decimal('33'), "33% on income ¥9,000,001-¥18,000,000"),
            TaxBracket(Decimal('18000000'), Decimal('40000000'), Decimal('40'), "40% on income ¥18,000,001-¥40,000,000"),
            TaxBracket(Decimal('40000000'), None, Decimal('45'), "45% on income above ¥40,000,000")
        ]

    def get_standard_deductions(self) -> List[Deduction]:
        """Get standard deductions available in Japan"""
        return [
            Deduction(
                name="Basic Exemption",
                amount=self.tax_rules['basic_exemption'],
                category="personal",
                description="Basic personal exemption (基礎控除)"
            ),
            Deduction(
                name="Employment Income Deduction",
                amount=Decimal('0'),  # Calculated based on income
                category="employment",
                description="Standard deduction for employment income (給与所得控除)"
            ),
            Deduction(
                name="Social Insurance Premiums",
                amount=Decimal('0'),  # Calculated separately
                category="social",
                description="Social insurance premiums deduction (社会保険料控除)"
            )
        ]

    def calculate_employment_income_deduction(self, employment_income: Decimal) -> Decimal:
        """Calculate employment income deduction (給与所得控除)"""
        if employment_income <= Decimal('1625000'):
            return Decimal('550000')  # Minimum deduction
        elif employment_income <= Decimal('1800000'):
            return employment_income * Decimal('0.4') - Decimal('100000')
        elif employment_income <= Decimal('3600000'):
            return employment_income * Decimal('0.3') + Decimal('80000')
        elif employment_income <= Decimal('6600000'):
            return employment_income * Decimal('0.2') + Decimal('440000')
        elif employment_income <= Decimal('8500000'):
            return employment_income * Decimal('0.1') + Decimal('1100000')
        else:
            return Decimal('1950000')  # Maximum deduction

    def calculate_income_tax(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate Japanese national income tax"""
        # Calculate employment income deduction
        employment_deduction = self.calculate_employment_income_deduction(income)

        # Calculate social insurance contributions
        social_contributions = self.calculate_social_contributions(income, **kwargs)

        # Calculate basic exemption and other personal exemptions
        basic_exemption = self.tax_rules['basic_exemption']

        # Additional exemptions
        total_exemptions = basic_exemption
        if kwargs.get('has_spouse', False):
            total_exemptions += self.tax_rules['spouse_exemption']

        dependents = kwargs.get('dependents', 0)
        total_exemptions += dependents * self.tax_rules['dependent_exemption']

        # Calculate taxable income
        taxable_income = max(
            Decimal('0'),
            income - employment_deduction - social_contributions - total_exemptions
        )

        # Calculate basic tax using progressive brackets
        basic_tax, _ = self._calculate_progressive_tax(taxable_income)

        # Apply special reconstruction tax (2.1% of income tax)
        reconstruction_tax = basic_tax * self.tax_rules['reconstruction_tax_rate'] / Decimal('100')

        return basic_tax + reconstruction_tax

    def calculate_inhabitant_tax(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate local inhabitant tax (住民税)"""
        # Employment income deduction (same as for national tax)
        employment_deduction = self.calculate_employment_income_deduction(income)

        # Social insurance contributions
        social_contributions = self.calculate_social_contributions(income, **kwargs)

        # Basic exemption for inhabitant tax (different from national tax)
        basic_exemption = self.tax_rules['inhabitant_tax_exemption']

        # Additional exemptions
        total_exemptions = basic_exemption
        if kwargs.get('has_spouse', False):
            total_exemptions += Decimal('330000')  # Spouse exemption for inhabitant tax

        dependents = kwargs.get('dependents', 0)
        total_exemptions += dependents * Decimal('330000')  # Dependent exemption

        # Calculate taxable income for inhabitant tax
        taxable_income = max(
            Decimal('0'),
            income - employment_deduction - social_contributions - total_exemptions
        )

        # Inhabitant tax has two components:
        # 1. Uniform portion (均等割) - fixed amount
        # 2. Income-based portion (所得割) - percentage of income

        uniform_portion = self.tax_rules['inhabitant_tax_uniform']
        income_portion = taxable_income * self.tax_rules['inhabitant_tax_rate'] / Decimal('100')

        return uniform_portion + income_portion

    def calculate_social_contributions(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate total social insurance contributions"""
        age = kwargs.get('age', 30)
        is_employee = kwargs.get('is_employee', True)

        if not is_employee:
            # Different calculations for self-employed
            return self._calculate_self_employed_social_contributions(income, **kwargs)

        total_contributions = Decimal('0')

        # Employment Insurance (雇用保険)
        employment_insurance_base = min(income, self.tax_rules['employment_insurance_ceiling'])
        employment_insurance = employment_insurance_base * self.tax_rules['employment_insurance_rate'] / Decimal('100')
        total_contributions += employment_insurance

        # Pension Insurance (厚生年金保険)
        pension_insurance_base = min(income, self.tax_rules['pension_insurance_ceiling'])
        pension_insurance = pension_insurance_base * self.tax_rules['pension_insurance_rate'] / Decimal('100')
        total_contributions += pension_insurance

        # Health Insurance (健康保険)
        health_insurance_base = min(income, self.tax_rules['health_insurance_ceiling'])
        health_insurance = health_insurance_base * self.tax_rules['health_insurance_rate'] / Decimal('100')
        total_contributions += health_insurance

        # Care Insurance (介護保険) - for people 40 and older
        if age >= self.tax_rules['care_insurance_age']:
            care_insurance = health_insurance_base * self.tax_rules['care_insurance_rate'] / Decimal('100')
            total_contributions += care_insurance

        return total_contributions

    def _calculate_detailed_social_contributions(
        self,
        income: Decimal,
        **kwargs
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate detailed social contributions breakdown"""
        breakdown = []
        total_contributions = Decimal('0')
        age = kwargs.get('age', 30)
        is_employee = kwargs.get('is_employee', True)

        if not is_employee:
            return self._calculate_self_employed_detailed_contributions(income, **kwargs)

        # Employment Insurance
        employment_insurance_base = min(income, self.tax_rules['employment_insurance_ceiling'])
        employment_insurance = employment_insurance_base * self.tax_rules['employment_insurance_rate'] / Decimal('100')
        breakdown.append({
            'name': 'Employment Insurance (雇用保険)',
            'amount': float(employment_insurance),
            'rate': float(self.tax_rules['employment_insurance_rate']),
            'description': 'Unemployment insurance contribution',
            'ceiling': float(self.tax_rules['employment_insurance_ceiling'])
        })
        total_contributions += employment_insurance

        # Pension Insurance
        pension_insurance_base = min(income, self.tax_rules['pension_insurance_ceiling'])
        pension_insurance = pension_insurance_base * self.tax_rules['pension_insurance_rate'] / Decimal('100')
        breakdown.append({
            'name': 'Pension Insurance (厚生年金保険)',
            'amount': float(pension_insurance),
            'rate': float(self.tax_rules['pension_insurance_rate']),
            'description': 'Employee pension insurance contribution',
            'ceiling': float(self.tax_rules['pension_insurance_ceiling'])
        })
        total_contributions += pension_insurance

        # Health Insurance
        health_insurance_base = min(income, self.tax_rules['health_insurance_ceiling'])
        health_insurance = health_insurance_base * self.tax_rules['health_insurance_rate'] / Decimal('100')
        breakdown.append({
            'name': 'Health Insurance (健康保険)',
            'amount': float(health_insurance),
            'rate': float(self.tax_rules['health_insurance_rate']),
            'description': 'National health insurance contribution',
            'ceiling': float(self.tax_rules['health_insurance_ceiling'])
        })
        total_contributions += health_insurance

        # Care Insurance (for 40+)
        if age >= self.tax_rules['care_insurance_age']:
            care_insurance = health_insurance_base * self.tax_rules['care_insurance_rate'] / Decimal('100')
            breakdown.append({
                'name': 'Care Insurance (介護保険)',
                'amount': float(care_insurance),
                'rate': float(self.tax_rules['care_insurance_rate']),
                'description': 'Long-term care insurance (age 40+)',
                'ceiling': float(self.tax_rules['health_insurance_ceiling'])
            })
            total_contributions += care_insurance

        return total_contributions, breakdown

    def _calculate_self_employed_social_contributions(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate social contributions for self-employed individuals"""
        # Self-employed have different contribution calculations
        # This is a simplified version - actual calculations are more complex

        # National Pension (国民年金) - fixed amount
        national_pension = Decimal('198000')  # Annual amount for 2024

        # National Health Insurance (国民健康保険) - varies by municipality
        # Simplified calculation: approximately 10% of income
        health_insurance = income * Decimal('0.10')
        health_insurance = min(health_insurance, Decimal('890000'))  # Approximate ceiling

        return national_pension + health_insurance

    def _calculate_self_employed_detailed_contributions(
        self,
        income: Decimal,
        **kwargs
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate detailed self-employed social contributions"""
        breakdown = []
        total_contributions = Decimal('0')

        # National Pension
        national_pension = Decimal('198000')  # 2024 rate
        breakdown.append({
            'name': 'National Pension (国民年金)',
            'amount': float(national_pension),
            'rate': 0,  # Fixed amount
            'description': 'Mandatory pension for self-employed',
            'ceiling': float(national_pension)
        })
        total_contributions += national_pension

        # National Health Insurance
        health_insurance = income * Decimal('0.10')
        health_insurance = min(health_insurance, Decimal('890000'))
        breakdown.append({
            'name': 'National Health Insurance (国民健康保険)',
            'amount': float(health_insurance),
            'rate': 10.0,
            'description': 'Health insurance for self-employed',
            'ceiling': 890000.0
        })
        total_contributions += health_insurance

        return total_contributions, breakdown

    def calculate_comprehensive_tax(
        self,
        gross_income: Decimal,
        deductions: Optional[List] = None,
        credits: Optional[List] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Calculate comprehensive tax including national and local taxes"""
        # Calculate national income tax
        national_tax = self.calculate_income_tax(gross_income, **kwargs)

        # Calculate inhabitant tax
        inhabitant_tax = self.calculate_inhabitant_tax(gross_income, **kwargs)

        # Calculate social contributions
        social_contributions = self.calculate_social_contributions(gross_income, **kwargs)

        # Total tax burden
        total_tax = national_tax + inhabitant_tax + social_contributions
        net_income = gross_income - total_tax

        # Calculate effective rates
        effective_rate = (total_tax / gross_income * 100) if gross_income > 0 else Decimal('0')

        return {
            'gross_income': float(gross_income),
            'national_income_tax': float(national_tax),
            'inhabitant_tax': float(inhabitant_tax),
            'social_contributions': float(social_contributions),
            'total_tax': float(total_tax),
            'net_income': float(net_income),
            'effective_tax_rate': float(effective_rate),
            'country_code': self.country_code,
            'tax_year': self.tax_year,
            'currency': self.currency,
            'prefecture': self.prefecture
        }

    def get_optimization_suggestions(
        self,
        gross_income: Decimal,
        current_deductions: List = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Get Japan-specific tax optimization suggestions"""
        suggestions = []

        # iDeCo (Individual Defined Contribution Pension)
        suggestions.append({
            'type': 'deduction',
            'title': 'iDeCo Contribution',
            'description': 'Contribute to individual pension plan for tax deduction',
            'potential_savings': float(Decimal('276000') * Decimal('0.20')),  # Max contribution × marginal rate
            'category': 'pension'
        })

        # Life Insurance Premium Deduction
        suggestions.append({
            'type': 'deduction',
            'title': 'Life Insurance Premium',
            'description': 'Life insurance premiums qualify for tax deduction up to ¥120,000',
            'potential_savings': float(Decimal('120000') * Decimal('0.20')),
            'category': 'insurance'
        })

        # Earthquake Insurance Premium Deduction
        suggestions.append({
            'type': 'deduction',
            'title': 'Earthquake Insurance Premium',
            'description': 'Earthquake insurance premiums qualify for deduction up to ¥50,000',
            'potential_savings': float(Decimal('50000') * Decimal('0.20')),
            'category': 'insurance'
        })

        # Medical Expense Deduction
        suggestions.append({
            'type': 'deduction',
            'title': 'Medical Expense Deduction',
            'description': 'Medical expenses exceeding ¥100,000 can be deducted',
            'potential_savings': 0,  # Depends on actual expenses
            'category': 'medical'
        })

        return suggestions

    def _get_calculation_notes(self, gross_income: Decimal, **kwargs) -> List[str]:
        """Get Japan-specific calculation notes"""
        notes = []

        notes.append("Calculation includes national income tax and special reconstruction tax")
        notes.append("Local inhabitant tax is calculated separately")
        notes.append("Social insurance contributions are fully deductible from income tax")
        notes.append("Employment income deduction is applied automatically for salary earners")
        notes.append("Tax rates are for calendar year 2024")

        age = kwargs.get('age', 30)
        if age >= 40:
            notes.append("Care insurance contribution included (age 40+)")

        is_employee = kwargs.get('is_employee', True)
        if not is_employee:
            notes.append("Self-employed social contribution rates applied")

        return notes

    def get_country_info(self) -> Dict[str, Any]:
        """Get Japan-specific information"""
        info = super().get_country_info()
        info.update({
            'country_name': 'Japan',
            'tax_authority': 'National Tax Agency (国税庁)',
            'tax_year_type': 'Calendar year',
            'prefecture': self.prefecture,
            'currency_symbol': '¥',
            'supports_inhabitant_tax': True,
            'supports_social_insurance': True,
            'supports_reconstruction_tax': True,
            'language': 'Japanese (日本語)'
        })
        return info
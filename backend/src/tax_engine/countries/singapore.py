"""
Singapore Tax Calculator

Implements Singapore income tax calculations including:
- Progressive income tax system
- CPF (Central Provident Fund) contributions
- Tax reliefs and rebates
- Non-resident tax calculations
- IRAS-compliant calculations
"""

from decimal import Decimal
from typing import Dict, List, Optional, Any
from ..base_calculator import BaseTaxCalculator, TaxBracket, Deduction, TaxCredit

class SingaporeTaxCalculator(BaseTaxCalculator):
    """Singapore-specific tax calculator implementing IRAS tax rules"""

    def __init__(self, tax_year: int = 2024, resident_status: str = 'resident'):
        super().__init__('SG', 'SGD', tax_year)
        self.resident_status = resident_status.lower()  # 'resident' or 'non_resident'

    def _load_tax_rules(self) -> Dict[str, Any]:
        """Load Singapore-specific tax rules"""
        return {
            'personal_relief': Decimal('1000'),  # Personal relief for YA 2024
            'earned_income_relief': Decimal('1000'),  # Earned income relief
            'spouse_relief': Decimal('2000'),  # Spouse relief
            'child_relief': Decimal('4000'),  # Per child relief
            'parent_relief': Decimal('9000'),  # Parent relief (aged 55+)
            'grandparent_relief': Decimal('3000'),  # Grandparent relief
            'disabled_relief': Decimal('3500'),  # Relief for disabled individuals
            'cpf_employee_rate': {
                'ordinary_wage': Decimal('20'),  # 20% for ordinary wages
                'additional_wage': Decimal('20')
            },
            'cpf_ceiling': {
                'ordinary_wage': Decimal('72000'),  # Annual ceiling for 2024
                'additional_wage': Decimal('102000')  # Annual ceiling for additional wages
            },
            'cpf_age_bands': {
                '35_below': {'employee': Decimal('20'), 'employer': Decimal('17')},
                '35_45': {'employee': Decimal('20'), 'employer': Decimal('17')},
                '45_50': {'employee': Decimal('20'), 'employer': Decimal('17')},
                '50_55': {'employee': Decimal('20'), 'employer': Decimal('17')},
                '55_60': {'employee': Decimal('13'), 'employer': Decimal('13')},
                '60_65': {'employee': Decimal('7.5'), 'employer': Decimal('9')},
                '65_70': {'employee': Decimal('5'), 'employer': Decimal('7.5')},
                '70_above': {'employee': Decimal('5'), 'employer': Decimal('5')}
            },
            'non_resident_rate': Decimal('22'),  # Flat rate for non-residents (from S$22,000)
            'non_resident_threshold': Decimal('22000'),
            'srs_contribution_limit': Decimal('15300'),  # SRS annual contribution limit
            'course_fee_relief_limit': Decimal('5500')  # Course fee relief limit
        }

    def get_tax_brackets(self) -> List[TaxBracket]:
        """Get Singapore income tax brackets for residents (YA 2024)"""
        if self.resident_status == 'non_resident':
            return self._get_non_resident_brackets()

        return [
            TaxBracket(Decimal('0'), Decimal('20000'), Decimal('0'), "No tax on first S$20,000"),
            TaxBracket(Decimal('20000'), Decimal('30000'), Decimal('2'), "2% on next S$10,000"),
            TaxBracket(Decimal('30000'), Decimal('40000'), Decimal('3.5'), "3.5% on next S$10,000"),
            TaxBracket(Decimal('40000'), Decimal('80000'), Decimal('7'), "7% on next S$40,000"),
            TaxBracket(Decimal('80000'), Decimal('120000'), Decimal('11.5'), "11.5% on next S$40,000"),
            TaxBracket(Decimal('120000'), Decimal('160000'), Decimal('15'), "15% on next S$40,000"),
            TaxBracket(Decimal('160000'), Decimal('200000'), Decimal('18'), "18% on next S$40,000"),
            TaxBracket(Decimal('200000'), Decimal('240000'), Decimal('19'), "19% on next S$40,000"),
            TaxBracket(Decimal('240000'), Decimal('280000'), Decimal('19.5'), "19.5% on next S$40,000"),
            TaxBracket(Decimal('280000'), Decimal('320000'), Decimal('20'), "20% on next S$40,000"),
            TaxBracket(Decimal('320000'), None, Decimal('22'), "22% on income above S$320,000")
        ]

    def _get_non_resident_brackets(self) -> List[TaxBracket]:
        """Tax brackets for non-residents"""
        return [
            TaxBracket(Decimal('0'), Decimal('22000'), Decimal('0'), "No tax on first S$22,000"),
            TaxBracket(Decimal('22000'), None, Decimal('22'), "22% flat rate above S$22,000")
        ]

    def get_standard_deductions(self) -> List[Deduction]:
        """Get standard reliefs available in Singapore"""
        reliefs = []

        if self.resident_status == 'resident':
            reliefs.extend([
                Deduction(
                    name="Personal Relief",
                    amount=self.tax_rules['personal_relief'],
                    category="personal",
                    description="Personal relief for Singapore tax residents"
                ),
                Deduction(
                    name="Earned Income Relief",
                    amount=self.tax_rules['earned_income_relief'],
                    category="employment",
                    description="Relief for earned income"
                ),
                Deduction(
                    name="CPF Contributions",
                    amount=Decimal('0'),  # Calculated separately
                    category="retirement",
                    description="Employee CPF contributions"
                )
            ])

        return reliefs

    def calculate_cpf_contributions(self, income: Decimal, age: int = 30) -> Dict[str, Decimal]:
        """Calculate CPF contributions based on age and income"""
        # Determine age band
        if age < 35:
            age_band = '35_below'
        elif age < 45:
            age_band = '35_45'
        elif age < 50:
            age_band = '45_50'
        elif age < 55:
            age_band = '50_55'
        elif age < 60:
            age_band = '55_60'
        elif age < 65:
            age_band = '60_65'
        elif age < 70:
            age_band = '65_70'
        else:
            age_band = '70_above'

        rates = self.tax_rules['cpf_age_bands'][age_band]

        # Apply CPF ceiling
        cpf_income = min(income, self.tax_rules['cpf_ceiling']['ordinary_wage'])

        employee_contribution = cpf_income * rates['employee'] / Decimal('100')
        employer_contribution = cpf_income * rates['employer'] / Decimal('100')

        return {
            'employee': employee_contribution,
            'employer': employer_contribution,
            'total': employee_contribution + employer_contribution,
            'employee_rate': rates['employee'],
            'employer_rate': rates['employer']
        }

    def calculate_income_tax(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate Singapore income tax"""
        if self.resident_status == 'non_resident':
            return self._calculate_non_resident_tax(income, **kwargs)

        # Calculate CPF contributions (tax-deductible)
        age = kwargs.get('age', 30)
        cpf = self.calculate_cpf_contributions(income, age)

        # Calculate total reliefs
        total_reliefs = self._calculate_total_reliefs(income, **kwargs)

        # Calculate taxable income
        taxable_income = max(
            Decimal('0'),
            income - cpf['employee'] - total_reliefs
        )

        # Calculate tax using progressive brackets
        tax, _ = self._calculate_progressive_tax(taxable_income)

        return tax

    def _calculate_non_resident_tax(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate tax for non-residents (flat 22% above threshold)"""
        if income <= self.tax_rules['non_resident_threshold']:
            return Decimal('0')

        taxable_income = income - self.tax_rules['non_resident_threshold']
        return taxable_income * self.tax_rules['non_resident_rate'] / Decimal('100')

    def _calculate_total_reliefs(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate total tax reliefs"""
        total_reliefs = Decimal('0')

        # Personal relief
        total_reliefs += self.tax_rules['personal_relief']

        # Earned income relief
        total_reliefs += self.tax_rules['earned_income_relief']

        # Spouse relief
        if kwargs.get('has_spouse', False) and not kwargs.get('spouse_working', True):
            total_reliefs += self.tax_rules['spouse_relief']

        # Child relief
        children = kwargs.get('children', 0)
        total_reliefs += children * self.tax_rules['child_relief']

        # Parent relief
        supported_parents = kwargs.get('supported_parents', 0)
        total_reliefs += supported_parents * self.tax_rules['parent_relief']

        # Grandparent relief
        supported_grandparents = kwargs.get('supported_grandparents', 0)
        total_reliefs += supported_grandparents * self.tax_rules['grandparent_relief']

        # Disabled relief
        if kwargs.get('is_disabled', False):
            total_reliefs += self.tax_rules['disabled_relief']

        # SRS contributions
        srs_contribution = kwargs.get('srs_contribution', Decimal('0'))
        srs_relief = min(srs_contribution, self.tax_rules['srs_contribution_limit'])
        total_reliefs += srs_relief

        # Course fee relief
        course_fees = kwargs.get('course_fees', Decimal('0'))
        course_relief = min(course_fees, self.tax_rules['course_fee_relief_limit'])
        total_reliefs += course_relief

        return total_reliefs

    def calculate_social_contributions(self, income: Decimal, **kwargs) -> Decimal:
        """Calculate CPF contributions (employee portion only for tax purposes)"""
        if self.resident_status == 'non_resident':
            return Decimal('0')  # Non-residents typically don't contribute to CPF

        age = kwargs.get('age', 30)
        cpf = self.calculate_cpf_contributions(income, age)
        return cpf['employee']

    def _calculate_detailed_social_contributions(
        self,
        income: Decimal,
        **kwargs
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate detailed CPF contributions breakdown"""
        if self.resident_status == 'non_resident':
            return Decimal('0'), []

        age = kwargs.get('age', 30)
        cpf = self.calculate_cpf_contributions(income, age)

        breakdown = [{
            'name': 'Central Provident Fund (CPF) - Employee',
            'amount': float(cpf['employee']),
            'rate': float(cpf['employee_rate']),
            'description': f'Employee CPF contribution (age {age})',
            'ceiling': float(self.tax_rules['cpf_ceiling']['ordinary_wage'])
        }]

        # Note: Employer contribution is not included in tax calculation
        # but can be shown for information
        breakdown.append({
            'name': 'Central Provident Fund (CPF) - Employer',
            'amount': float(cpf['employer']),
            'rate': float(cpf['employer_rate']),
            'description': f'Employer CPF contribution (not deducted from salary)',
            'ceiling': float(self.tax_rules['cpf_ceiling']['ordinary_wage']),
            'note': 'Paid by employer, not deducted from employee salary'
        })

        return cpf['employee'], breakdown

    def calculate_comprehensive_tax(
        self,
        gross_income: Decimal,
        deductions: Optional[List] = None,
        credits: Optional[List] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Calculate comprehensive Singapore tax"""
        # Calculate income tax
        income_tax = self.calculate_income_tax(gross_income, **kwargs)

        # Calculate CPF contributions
        cpf_contributions = self.calculate_social_contributions(gross_income, **kwargs)

        # Total deductions from salary
        total_deductions = income_tax + cpf_contributions
        net_income = gross_income - total_deductions

        # Calculate effective rates
        effective_tax_rate = (income_tax / gross_income * 100) if gross_income > 0 else Decimal('0')
        total_deduction_rate = (total_deductions / gross_income * 100) if gross_income > 0 else Decimal('0')

        # Get detailed CPF breakdown
        age = kwargs.get('age', 30)
        cpf_details = self.calculate_cpf_contributions(gross_income, age)

        return {
            'gross_income': float(gross_income),
            'income_tax': float(income_tax),
            'cpf_employee': float(cpf_contributions),
            'cpf_employer': float(cpf_details.get('employer', 0)),
            'total_cpf': float(cpf_details.get('total', 0)),
            'total_deductions': float(total_deductions),
            'net_income': float(net_income),
            'effective_tax_rate': float(effective_tax_rate),
            'total_deduction_rate': float(total_deduction_rate),
            'country_code': self.country_code,
            'tax_year': self.tax_year,
            'currency': self.currency,
            'resident_status': self.resident_status
        }

    def compare_resident_status(self, gross_income: Decimal, **kwargs) -> Dict[str, Any]:
        """Compare tax as resident vs non-resident"""
        # Calculate as resident
        resident_calc = SingaporeTaxCalculator(self.tax_year, 'resident')
        resident_result = resident_calc.calculate_comprehensive_tax(gross_income, **kwargs)

        # Calculate as non-resident
        non_resident_calc = SingaporeTaxCalculator(self.tax_year, 'non_resident')
        non_resident_result = non_resident_calc.calculate_comprehensive_tax(gross_income, **kwargs)

        # Compare
        resident_total = resident_result['total_deductions']
        non_resident_total = non_resident_result['total_deductions']

        better_status = 'resident' if resident_total < non_resident_total else 'non_resident'
        savings = abs(resident_total - non_resident_total)

        return {
            'resident': resident_result,
            'non_resident': non_resident_result,
            'recommendation': {
                'better_status': better_status,
                'savings': savings,
                'savings_percentage': (savings / gross_income * 100) if gross_income > 0 else 0
            }
        }

    def get_optimization_suggestions(
        self,
        gross_income: Decimal,
        current_deductions: List = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Get Singapore-specific tax optimization suggestions"""
        suggestions = []

        if self.resident_status == 'resident':
            # SRS contribution optimization
            current_srs = kwargs.get('srs_contribution', Decimal('0'))
            if current_srs < self.tax_rules['srs_contribution_limit']:
                remaining_srs = self.tax_rules['srs_contribution_limit'] - current_srs
                marginal_rate = self._get_marginal_tax_rate(gross_income)
                potential_savings = remaining_srs * marginal_rate / Decimal('100')

                suggestions.append({
                    'type': 'relief',
                    'title': 'Supplementary Retirement Scheme (SRS)',
                    'description': f'Contribute S${remaining_srs:,.0f} more to SRS for tax relief',
                    'potential_savings': float(potential_savings),
                    'category': 'retirement'
                })

            # Course fee relief
            current_course_fees = kwargs.get('course_fees', Decimal('0'))
            if current_course_fees < self.tax_rules['course_fee_relief_limit']:
                suggestions.append({
                    'type': 'relief',
                    'title': 'Course Fee Relief',
                    'description': 'Enroll in approved courses for tax relief up to S$5,500',
                    'potential_savings': float(self.tax_rules['course_fee_relief_limit'] * marginal_rate / Decimal('100')),
                    'category': 'education'
                })

            # Life insurance relief
            suggestions.append({
                'type': 'relief',
                'title': 'Life Insurance Relief',
                'description': 'Life insurance premiums qualify for tax relief up to S$5,000',
                'potential_savings': float(Decimal('5000') * marginal_rate / Decimal('100')),
                'category': 'insurance'
            })

            # Parent relief optimization
            if not kwargs.get('supported_parents', 0):
                suggestions.append({
                    'type': 'relief',
                    'title': 'Parent Relief',
                    'description': 'Consider claiming parent relief if supporting aged parents',
                    'potential_savings': float(self.tax_rules['parent_relief'] * marginal_rate / Decimal('100')),
                    'category': 'family'
                })

        return suggestions

    def _get_calculation_notes(self, gross_income: Decimal, **kwargs) -> List[str]:
        """Get Singapore-specific calculation notes"""
        notes = []

        notes.append(f"Calculation for {self.resident_status} tax status")
        notes.append("Tax rates are for Year of Assessment 2024")

        if self.resident_status == 'resident':
            notes.append("CPF contributions are tax-deductible")
            notes.append("Various tax reliefs are available for residents")
        else:
            notes.append("Non-residents are taxed at flat 22% rate above S$22,000")
            notes.append("No CPF contributions required for non-residents")

        age = kwargs.get('age', 30)
        notes.append(f"CPF contribution rates based on age {age}")

        return notes

    def get_country_info(self) -> Dict[str, Any]:
        """Get Singapore-specific information"""
        info = super().get_country_info()
        info.update({
            'country_name': 'Singapore',
            'tax_authority': 'Inland Revenue Authority of Singapore (IRAS)',
            'tax_year_type': 'Year of Assessment (previous calendar year)',
            'resident_status': self.resident_status,
            'currency_symbol': 'S$',
            'supports_cpf': True,
            'supports_resident_comparison': True,
            'supports_srs': True,
            'language': 'English'
        })
        return info
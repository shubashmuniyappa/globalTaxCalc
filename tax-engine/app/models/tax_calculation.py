"""
Pydantic models for tax calculation requests and responses
"""

from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator, root_validator


class CountryCode(str, Enum):
    """Supported country codes"""
    US = "US"
    CA = "CA"
    UK = "UK"
    AU = "AU"
    DE = "DE"


class FilingStatus(str, Enum):
    """Tax filing status options"""
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    QUALIFYING_WIDOW = "qualifying_widow"


class IncomeType(str, Enum):
    """Types of income"""
    SALARY = "salary"
    WAGES = "wages"
    SELF_EMPLOYMENT = "self_employment"
    BUSINESS = "business"
    RENTAL = "rental"
    INVESTMENT = "investment"
    CAPITAL_GAINS = "capital_gains"
    PENSION = "pension"
    SOCIAL_SECURITY = "social_security"
    UNEMPLOYMENT = "unemployment"
    OTHER = "other"


class DeductionType(str, Enum):
    """Types of deductions"""
    STANDARD = "standard"
    ITEMIZED = "itemized"
    MORTGAGE_INTEREST = "mortgage_interest"
    STATE_LOCAL_TAX = "state_local_tax"
    CHARITABLE = "charitable"
    MEDICAL = "medical"
    BUSINESS_EXPENSE = "business_expense"
    EDUCATION = "education"
    RETIREMENT = "retirement"
    OTHER = "other"


class IncomeItem(BaseModel):
    """Individual income item"""
    income_type: IncomeType
    amount: Decimal = Field(..., ge=0, description="Income amount")
    description: Optional[str] = Field(None, max_length=200)
    is_taxable: bool = Field(True, description="Whether this income is taxable")
    source_country: Optional[CountryCode] = Field(None, description="Country where income was earned")

    @validator('amount')
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError("Income amount must be non-negative")
        if v > Decimal('10000000'):  # 10 million limit
            raise ValueError("Income amount exceeds maximum allowed")
        return v


class DeductionItem(BaseModel):
    """Individual deduction item"""
    deduction_type: DeductionType
    amount: Decimal = Field(..., ge=0, description="Deduction amount")
    description: Optional[str] = Field(None, max_length=200)
    is_above_line: bool = Field(False, description="Whether this is an above-the-line deduction")
    documentation_required: bool = Field(True, description="Whether documentation is required")

    @validator('amount')
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError("Deduction amount must be non-negative")
        if v > Decimal('1000000'):  # 1 million limit
            raise ValueError("Deduction amount exceeds maximum allowed")
        return v


class TaxCalculationRequest(BaseModel):
    """Tax calculation request model"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., ge=2020, le=2025, description="Tax year")
    filing_status: FilingStatus = Field(..., description="Filing status")

    # Income information
    income_items: List[IncomeItem] = Field(..., min_items=1, description="List of income items")

    # Deduction information
    deduction_items: List[DeductionItem] = Field(default=[], description="List of deduction items")
    use_standard_deduction: bool = Field(True, description="Whether to use standard deduction")

    # Personal information
    age: Optional[int] = Field(None, ge=0, le=120, description="Taxpayer age")
    spouse_age: Optional[int] = Field(None, ge=0, le=120, description="Spouse age")
    dependents: int = Field(0, ge=0, le=20, description="Number of dependents")
    is_blind: bool = Field(False, description="Whether taxpayer is blind")
    spouse_is_blind: bool = Field(False, description="Whether spouse is blind")

    # State/Province information (for US/Canada)
    state_province: Optional[str] = Field(None, max_length=10, description="State or province code")

    # Additional options
    calculate_quarterly: bool = Field(False, description="Calculate quarterly tax estimates")
    include_state_tax: bool = Field(True, description="Include state/provincial tax calculations")
    optimization_suggestions: bool = Field(False, description="Include optimization suggestions")

    @validator('tax_year')
    def validate_tax_year(cls, v):
        current_year = 2024  # This should be dynamic in production
        if v < 2020 or v > current_year + 1:
            raise ValueError(f"Tax year must be between 2020 and {current_year + 1}")
        return v

    @root_validator
    def validate_spouse_fields(cls, values):
        filing_status = values.get('filing_status')
        spouse_age = values.get('spouse_age')
        spouse_is_blind = values.get('spouse_is_blind')

        married_statuses = [FilingStatus.MARRIED_FILING_JOINTLY, FilingStatus.MARRIED_FILING_SEPARATELY]

        if filing_status in married_statuses:
            if spouse_age is None:
                values['spouse_age'] = values.get('age', 0)
        else:
            if spouse_age is not None or spouse_is_blind:
                raise ValueError("Spouse information should only be provided for married filing statuses")

        return values

    @property
    def total_income(self) -> Decimal:
        """Calculate total income"""
        return sum(item.amount for item in self.income_items if item.is_taxable)

    @property
    def total_deductions(self) -> Decimal:
        """Calculate total deductions"""
        return sum(item.amount for item in self.deduction_items)


class TaxBracket(BaseModel):
    """Tax bracket information"""
    rate: Decimal = Field(..., ge=0, le=1, description="Tax rate (as decimal)")
    min_income: Decimal = Field(..., ge=0, description="Minimum income for this bracket")
    max_income: Optional[Decimal] = Field(None, ge=0, description="Maximum income for this bracket")
    tax_on_bracket: Decimal = Field(..., ge=0, description="Tax amount for this bracket")

    @validator('max_income')
    def validate_max_income(cls, v, values):
        if v is not None and 'min_income' in values and v <= values['min_income']:
            raise ValueError("Maximum income must be greater than minimum income")
        return v


class TaxBreakdown(BaseModel):
    """Detailed tax calculation breakdown"""
    gross_income: Decimal = Field(..., description="Total gross income")
    adjusted_gross_income: Decimal = Field(..., description="Adjusted gross income")
    taxable_income: Decimal = Field(..., description="Taxable income after deductions")

    # Federal/National taxes
    federal_income_tax: Decimal = Field(..., description="Federal/national income tax")
    federal_tax_brackets: List[TaxBracket] = Field(default=[], description="Federal tax brackets used")

    # State/Provincial taxes
    state_income_tax: Optional[Decimal] = Field(None, description="State/provincial income tax")
    state_tax_brackets: Optional[List[TaxBracket]] = Field(None, description="State tax brackets used")

    # Social security and other taxes
    social_security_tax: Optional[Decimal] = Field(None, description="Social security tax")
    medicare_tax: Optional[Decimal] = Field(None, description="Medicare tax")
    additional_medicare_tax: Optional[Decimal] = Field(None, description="Additional Medicare tax")
    unemployment_tax: Optional[Decimal] = Field(None, description="Unemployment tax")

    # Deductions
    standard_deduction: Decimal = Field(..., description="Standard deduction amount")
    itemized_deductions: Decimal = Field(default=Decimal('0'), description="Itemized deductions amount")
    deduction_used: Decimal = Field(..., description="Actual deduction used")
    deduction_type_used: str = Field(..., description="Type of deduction used")

    # Tax rates
    marginal_tax_rate: Decimal = Field(..., description="Marginal tax rate")
    effective_tax_rate: Decimal = Field(..., description="Effective tax rate")

    # Total taxes
    total_tax: Decimal = Field(..., description="Total tax owed")
    total_tax_rate: Decimal = Field(..., description="Total tax as percentage of income")


class QuarterlyEstimate(BaseModel):
    """Quarterly tax estimate"""
    quarter: int = Field(..., ge=1, le=4, description="Quarter number")
    due_date: str = Field(..., description="Due date for quarterly payment")
    estimated_payment: Decimal = Field(..., ge=0, description="Estimated quarterly payment")


class TaxCalculationResponse(BaseModel):
    """Tax calculation response model"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., description="Tax year")
    filing_status: FilingStatus = Field(..., description="Filing status")

    # Calculation results
    tax_breakdown: TaxBreakdown = Field(..., description="Detailed tax breakdown")

    # Quarterly estimates (if requested)
    quarterly_estimates: Optional[List[QuarterlyEstimate]] = Field(None, description="Quarterly tax estimates")

    # Calculation metadata
    calculation_date: str = Field(..., description="When calculation was performed")
    calculation_duration_ms: float = Field(..., description="Calculation time in milliseconds")
    tax_rules_version: str = Field(..., description="Version of tax rules used")
    cached_result: bool = Field(False, description="Whether result was retrieved from cache")

    # Warnings and notes
    warnings: List[str] = Field(default=[], description="Calculation warnings")
    notes: List[str] = Field(default=[], description="Additional notes")

    # Tax optimization suggestions (if requested)
    optimization_suggestions: Optional[List[Dict]] = Field(None, description="Tax optimization suggestions")

    @property
    def after_tax_income(self) -> Decimal:
        """Calculate after-tax income"""
        return self.tax_breakdown.gross_income - self.tax_breakdown.total_tax


class TaxRulesRequest(BaseModel):
    """Request for tax rules information"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., ge=2020, le=2025, description="Tax year")
    rule_type: Optional[str] = Field(None, description="Specific rule type to retrieve")


class TaxRulesResponse(BaseModel):
    """Tax rules information response"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., description="Tax year")
    rules_version: str = Field(..., description="Version of tax rules")
    last_updated: str = Field(..., description="When rules were last updated")

    # Tax brackets
    federal_brackets: List[Dict] = Field(..., description="Federal tax brackets")
    state_brackets: Optional[Dict] = Field(None, description="State tax brackets by state")

    # Standard deductions
    standard_deductions: Dict = Field(..., description="Standard deduction amounts by filing status")

    # Tax rates
    social_security_rate: Optional[Decimal] = Field(None, description="Social security tax rate")
    medicare_rate: Optional[Decimal] = Field(None, description="Medicare tax rate")

    # Limits and thresholds
    social_security_wage_base: Optional[Decimal] = Field(None, description="Social security wage base limit")
    additional_medicare_threshold: Optional[Dict] = Field(None, description="Additional Medicare tax thresholds")

    # Other rules
    personal_exemption: Optional[Decimal] = Field(None, description="Personal exemption amount")
    dependent_exemption: Optional[Decimal] = Field(None, description="Dependent exemption amount")


class TaxBracketsRequest(BaseModel):
    """Request for tax brackets"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., ge=2020, le=2025, description="Tax year")
    filing_status: FilingStatus = Field(..., description="Filing status")
    state_province: Optional[str] = Field(None, description="State or province code")


class TaxBracketsResponse(BaseModel):
    """Tax brackets response"""
    country: CountryCode = Field(..., description="Country code")
    tax_year: int = Field(..., description="Tax year")
    filing_status: FilingStatus = Field(..., description="Filing status")
    state_province: Optional[str] = Field(None, description="State or province code")

    federal_brackets: List[TaxBracket] = Field(..., description="Federal tax brackets")
    state_brackets: Optional[List[TaxBracket]] = Field(None, description="State tax brackets")

    standard_deduction: Decimal = Field(..., description="Standard deduction amount")
    personal_exemption: Optional[Decimal] = Field(None, description="Personal exemption amount")
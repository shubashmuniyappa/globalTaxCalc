"""
Test models and validation
"""

import pytest
from decimal import Decimal
from pydantic import ValidationError

from app.models.tax_calculation import (
    TaxCalculationRequest,
    TaxCalculationResponse,
    IncomeItem,
    DeductionItem,
    TaxBreakdown,
    Country,
    FilingStatus,
    IncomeType,
    DeductionType
)


class TestTaxCalculationRequest:
    """Test TaxCalculationRequest model"""

    def test_valid_request(self, sample_income_items, sample_deduction_items):
        """Test valid tax calculation request"""
        request = TaxCalculationRequest(
            country=Country.US,
            tax_year=2024,
            filing_status=FilingStatus.SINGLE,
            income_items=sample_income_items,
            deduction_items=sample_deduction_items,
            total_income=Decimal("80000")
        )

        assert request.country == Country.US
        assert request.tax_year == 2024
        assert request.filing_status == FilingStatus.SINGLE
        assert len(request.income_items) == 2
        assert len(request.deduction_items) == 2
        assert request.total_income == Decimal("80000")

    def test_invalid_tax_year(self, sample_income_items):
        """Test invalid tax year validation"""
        with pytest.raises(ValidationError):
            TaxCalculationRequest(
                country=Country.US,
                tax_year=2019,  # Too old
                filing_status=FilingStatus.SINGLE,
                income_items=sample_income_items,
                total_income=Decimal("50000")
            )

    def test_negative_total_income(self, sample_income_items):
        """Test negative total income validation"""
        with pytest.raises(ValidationError):
            TaxCalculationRequest(
                country=Country.US,
                tax_year=2024,
                filing_status=FilingStatus.SINGLE,
                income_items=sample_income_items,
                total_income=Decimal("-1000")  # Negative
            )

    def test_empty_income_items(self):
        """Test empty income items validation"""
        with pytest.raises(ValidationError):
            TaxCalculationRequest(
                country=Country.US,
                tax_year=2024,
                filing_status=FilingStatus.SINGLE,
                income_items=[],  # Empty
                total_income=Decimal("50000")
            )


class TestIncomeItem:
    """Test IncomeItem model"""

    def test_valid_income_item(self):
        """Test valid income item"""
        item = IncomeItem(
            income_type=IncomeType.SALARY,
            amount=Decimal("50000"),
            description="Software Engineer Salary",
            is_taxable=True
        )

        assert item.income_type == IncomeType.SALARY
        assert item.amount == Decimal("50000")
        assert item.description == "Software Engineer Salary"
        assert item.is_taxable is True

    def test_negative_amount(self):
        """Test negative amount validation"""
        with pytest.raises(ValidationError):
            IncomeItem(
                income_type=IncomeType.SALARY,
                amount=Decimal("-1000"),  # Negative
                description="Test"
            )

    def test_default_values(self):
        """Test default values"""
        item = IncomeItem(
            income_type=IncomeType.SALARY,
            amount=Decimal("50000"),
            description="Test"
        )

        assert item.is_taxable is True  # Default value


class TestDeductionItem:
    """Test DeductionItem model"""

    def test_valid_deduction_item(self):
        """Test valid deduction item"""
        item = DeductionItem(
            deduction_type=DeductionType.CHARITABLE,
            amount=Decimal("2000"),
            description="Charitable donations"
        )

        assert item.deduction_type == DeductionType.CHARITABLE
        assert item.amount == Decimal("2000")
        assert item.description == "Charitable donations"
        assert item.is_above_line is False  # Default

    def test_above_line_deduction(self):
        """Test above-the-line deduction"""
        item = DeductionItem(
            deduction_type=DeductionType.RETIREMENT,
            amount=Decimal("5000"),
            description="401k contribution",
            is_above_line=True
        )

        assert item.is_above_line is True


class TestTaxBreakdown:
    """Test TaxBreakdown model"""

    def test_valid_tax_breakdown(self):
        """Test valid tax breakdown"""
        breakdown = TaxBreakdown(
            gross_income=Decimal("80000"),
            adjusted_gross_income=Decimal("75000"),
            taxable_income=Decimal("60400"),
            federal_income_tax=Decimal("8000"),
            total_tax=Decimal("12000"),
            marginal_tax_rate=Decimal("0.22"),
            effective_tax_rate=Decimal("0.15")
        )

        assert breakdown.gross_income == Decimal("80000")
        assert breakdown.total_tax == Decimal("12000")
        assert breakdown.effective_tax_rate == Decimal("0.15")

    def test_calculated_fields(self):
        """Test calculated fields in tax breakdown"""
        breakdown = TaxBreakdown(
            gross_income=Decimal("100000"),
            adjusted_gross_income=Decimal("95000"),
            taxable_income=Decimal("80000"),
            federal_income_tax=Decimal("15000"),
            social_security_tax=Decimal("6200"),
            medicare_tax=Decimal("1450"),
            total_tax=Decimal("22650"),
            marginal_tax_rate=Decimal("0.24"),
            effective_tax_rate=Decimal("0.2265")
        )

        # Verify calculated totals
        calculated_total = (
            breakdown.federal_income_tax +
            (breakdown.social_security_tax or Decimal('0')) +
            (breakdown.medicare_tax or Decimal('0'))
        )
        assert calculated_total == Decimal("22650")


class TestEnums:
    """Test enum values"""

    def test_country_enum(self):
        """Test Country enum"""
        assert Country.US.value == "US"
        assert Country.CA.value == "CA"
        assert Country.UK.value == "UK"
        assert Country.AU.value == "AU"
        assert Country.DE.value == "DE"

    def test_filing_status_enum(self):
        """Test FilingStatus enum"""
        assert FilingStatus.SINGLE.value == "single"
        assert FilingStatus.MARRIED_FILING_JOINTLY.value == "married_filing_jointly"
        assert FilingStatus.MARRIED_FILING_SEPARATELY.value == "married_filing_separately"
        assert FilingStatus.HEAD_OF_HOUSEHOLD.value == "head_of_household"

    def test_income_type_enum(self):
        """Test IncomeType enum"""
        assert IncomeType.SALARY.value == "salary"
        assert IncomeType.WAGES.value == "wages"
        assert IncomeType.SELF_EMPLOYMENT.value == "self_employment"
        assert IncomeType.BUSINESS.value == "business"
        assert IncomeType.INVESTMENT.value == "investment"

    def test_deduction_type_enum(self):
        """Test DeductionType enum"""
        assert DeductionType.CHARITABLE.value == "charitable"
        assert DeductionType.MEDICAL.value == "medical"
        assert DeductionType.EDUCATION.value == "education"
        assert DeductionType.BUSINESS_EXPENSE.value == "business_expense"
        assert DeductionType.RETIREMENT.value == "retirement"
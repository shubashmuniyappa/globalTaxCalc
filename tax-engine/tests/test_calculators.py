"""
Test tax calculators
"""

import pytest
from decimal import Decimal
from unittest.mock import Mock

from app.calculators.usa import USATaxCalculator
from app.calculators.canada import CanadaTaxCalculator
from app.calculators.uk import UKTaxCalculator
from app.calculators.australia import AustraliaTaxCalculator
from app.calculators.germany import GermanyTaxCalculator
from app.models.tax_calculation import FilingStatus, Country


class TestUSATaxCalculator:
    """Test USA tax calculator"""

    @pytest.fixture
    def usa_calculator(self, sample_tax_rules):
        """USA calculator instance"""
        return USATaxCalculator(sample_tax_rules)

    def test_initialization(self, usa_calculator):
        """Test calculator initialization"""
        assert usa_calculator.country_code == "US"
        assert usa_calculator.tax_rules is not None

    def test_get_standard_deduction(self, usa_calculator):
        """Test standard deduction calculation"""
        # Single filer, age 35
        deduction = usa_calculator.get_standard_deduction(2024, FilingStatus.SINGLE, 35)
        assert deduction == Decimal("14600")

        # Married filing jointly
        deduction = usa_calculator.get_standard_deduction(2024, FilingStatus.MARRIED_FILING_JOINTLY, 35)
        assert deduction == Decimal("29200")

    def test_get_tax_brackets(self, usa_calculator):
        """Test tax bracket retrieval"""
        federal_brackets, state_brackets = usa_calculator.get_tax_brackets(2024, FilingStatus.SINGLE)

        assert len(federal_brackets) == 4  # Based on sample data
        assert federal_brackets[0].rate == Decimal("0.10")
        assert federal_brackets[0].min_income == Decimal("0")
        assert federal_brackets[0].max_income == Decimal("11000")

    def test_calculate_social_security_tax(self, usa_calculator):
        """Test Social Security tax calculation"""
        wages = Decimal("50000")
        ss_tax = usa_calculator.calculate_social_security_tax(wages, 2024)

        expected = wages * Decimal("0.062")  # 6.2% rate
        assert ss_tax == expected.quantize(Decimal("0.01"))

    def test_calculate_medicare_tax(self, usa_calculator):
        """Test Medicare tax calculation"""
        wages = Decimal("50000")
        medicare_tax = usa_calculator.calculate_medicare_tax(wages, 2024)

        expected = wages * Decimal("0.0145")  # 1.45% rate
        assert medicare_tax == expected.quantize(Decimal("0.01"))

    @pytest.mark.asyncio
    async def test_calculate_tax(self, usa_calculator, sample_tax_calculation_request):
        """Test full tax calculation"""
        response = await usa_calculator.calculate_tax(sample_tax_calculation_request)

        assert response.country == Country.US
        assert response.tax_year == 2024
        assert response.tax_breakdown.gross_income == Decimal("80000")
        assert response.tax_breakdown.total_tax > 0
        assert response.tax_breakdown.effective_tax_rate > 0


class TestCanadaTaxCalculator:
    """Test Canada tax calculator"""

    @pytest.fixture
    def canada_rules(self):
        """Sample Canada tax rules"""
        return {
            "version": "2024.1",
            "country": "CA",
            "tax_year": 2024,
            "federal": {
                "tax_brackets": [
                    {"rate": 0.15, "min": 0, "max": 55867},
                    {"rate": 0.205, "min": 55868, "max": 111733}
                ],
                "basic_personal_amount": 15705,
                "cpp": {
                    "rate": 0.0595,
                    "exemption": 3500,
                    "maximum": 71300
                },
                "ei": {
                    "rate": 0.0163,
                    "maximum_insurable": 68500
                }
            }
        }

    @pytest.fixture
    def canada_calculator(self, canada_rules):
        """Canada calculator instance"""
        return CanadaTaxCalculator(canada_rules)

    def test_initialization(self, canada_calculator):
        """Test calculator initialization"""
        assert canada_calculator.country_code == "CA"

    def test_get_standard_deduction(self, canada_calculator):
        """Test basic personal amount"""
        deduction = canada_calculator.get_standard_deduction(2024, FilingStatus.SINGLE, 35)
        assert deduction == Decimal("15705")

    def test_calculate_cpp_contributions(self, canada_calculator, sample_tax_calculation_request):
        """Test CPP contributions calculation"""
        cpp = canada_calculator.calculate_cpp_contributions(sample_tax_calculation_request)

        # Should calculate based on employment income minus exemption
        assert cpp > 0


class TestTaxCalculatorBase:
    """Test base tax calculator functionality"""

    def test_progressive_tax_calculation(self, usa_calculator):
        """Test progressive tax calculation"""
        brackets = [
            Mock(rate=Decimal("0.10"), min_income=Decimal("0"), max_income=Decimal("10000")),
            Mock(rate=Decimal("0.20"), min_income=Decimal("10001"), max_income=Decimal("50000")),
            Mock(rate=Decimal("0.30"), min_income=Decimal("50001"), max_income=None)
        ]

        # Test income in first bracket
        tax, brackets_used = usa_calculator.calculate_progressive_tax(Decimal("5000"), brackets)
        expected = Decimal("5000") * Decimal("0.10")
        assert tax == expected

        # Test income spanning multiple brackets
        tax, brackets_used = usa_calculator.calculate_progressive_tax(Decimal("30000"), brackets)
        expected = (
            Decimal("10000") * Decimal("0.10") +  # First bracket
            Decimal("20000") * Decimal("0.20")    # Second bracket
        )
        assert tax == expected

    def test_marginal_tax_rate_calculation(self, usa_calculator):
        """Test marginal tax rate calculation"""
        brackets = [
            Mock(rate=Decimal("0.10"), min_income=Decimal("0"), max_income=Decimal("10000")),
            Mock(rate=Decimal("0.20"), min_income=Decimal("10001"), max_income=Decimal("50000")),
            Mock(rate=Decimal("0.30"), min_income=Decimal("50001"), max_income=None)
        ]

        # Income in second bracket should have 20% marginal rate
        marginal_rate = usa_calculator.calculate_marginal_tax_rate(Decimal("30000"), brackets)
        assert marginal_rate == Decimal("0.20")

        # Income in third bracket should have 30% marginal rate
        marginal_rate = usa_calculator.calculate_marginal_tax_rate(Decimal("60000"), brackets)
        assert marginal_rate == Decimal("0.30")

    def test_effective_tax_rate_calculation(self, usa_calculator):
        """Test effective tax rate calculation"""
        total_tax = Decimal("10000")
        income = Decimal("50000")

        effective_rate = usa_calculator.calculate_effective_tax_rate(total_tax, income)
        expected = total_tax / income
        assert effective_rate == expected

        # Test zero income
        effective_rate = usa_calculator.calculate_effective_tax_rate(Decimal("0"), Decimal("0"))
        assert effective_rate == Decimal("0")

    def test_round_currency(self, usa_calculator):
        """Test currency rounding"""
        amount = Decimal("123.456")
        rounded = usa_calculator.round_currency(amount)
        assert rounded == Decimal("123.46")

        amount = Decimal("123.454")
        rounded = usa_calculator.round_currency(amount)
        assert rounded == Decimal("123.45")


class TestCalculatorValidation:
    """Test calculator validation"""

    def test_validate_request(self, usa_calculator, sample_tax_calculation_request):
        """Test request validation"""
        # Valid request should not raise exception
        usa_calculator.validate_request(sample_tax_calculation_request)

        # Test with invalid request
        invalid_request = sample_tax_calculation_request.model_copy()
        invalid_request.total_income = Decimal("-1000")

        with pytest.raises(Exception):
            usa_calculator.validate_request(invalid_request)

    def test_filing_status_support(self, usa_calculator):
        """Test filing status support"""
        supported_statuses = usa_calculator.get_supported_filing_statuses()

        assert FilingStatus.SINGLE in supported_statuses
        assert FilingStatus.MARRIED_FILING_JOINTLY in supported_statuses
        assert len(supported_statuses) > 0
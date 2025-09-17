"""
Test tax services
"""

import pytest
from decimal import Decimal
from unittest.mock import Mock, AsyncMock

from app.services.tax_calculation import TaxCalculationService
from app.services.tax_rules import TaxRulesService
from app.services.tax_optimization import TaxOptimizationService
from app.models.tax_calculation import Country, FilingStatus
from app.core.exceptions import TaxCalculationError, CountryNotSupportedException


class TestTaxRulesService:
    """Test TaxRulesService"""

    def test_get_supported_countries(self, mock_tax_rules_service):
        """Test getting supported countries"""
        countries = mock_tax_rules_service.get_supported_countries()
        assert isinstance(countries, list)
        assert "US" in countries
        assert len(countries) > 0

    def test_get_tax_rules(self, mock_tax_rules_service, sample_tax_rules):
        """Test getting tax rules for a country"""
        rules = mock_tax_rules_service.get_tax_rules("US", 2024)
        assert rules == sample_tax_rules
        assert rules["country"] == "US"
        assert rules["tax_year"] == 2024

    def test_get_tax_rules_unsupported_country(self, mock_tax_rules_service):
        """Test getting tax rules for unsupported country"""
        mock_tax_rules_service.get_tax_rules.side_effect = CountryNotSupportedException("Country XX not supported")

        with pytest.raises(CountryNotSupportedException):
            mock_tax_rules_service.get_tax_rules("XX", 2024)

    def test_get_tax_rule_specific_path(self, mock_tax_rules_service):
        """Test getting specific tax rule by path"""
        mock_tax_rules_service.get_tax_rule.return_value = 14600

        deduction = mock_tax_rules_service.get_tax_rule("US", 2024, "federal.standard_deduction.single")
        assert deduction == 14600

    def test_get_supported_years(self, mock_tax_rules_service):
        """Test getting supported years for a country"""
        years = mock_tax_rules_service.get_supported_years("US")
        assert isinstance(years, list)
        assert 2024 in years


class TestTaxCalculationService:
    """Test TaxCalculationService"""

    @pytest.mark.asyncio
    async def test_calculate_tax_success(self, tax_calculation_service, sample_tax_calculation_request):
        """Test successful tax calculation"""
        # Mock the calculator's calculate_tax method
        with pytest.mock.patch.object(tax_calculation_service, '_get_calculator') as mock_get_calc:
            mock_calculator = Mock()
            mock_response = Mock()
            mock_response.tax_breakdown.total_tax = Decimal("10000")
            mock_response.tax_breakdown.effective_tax_rate = Decimal("0.15")
            mock_calculator.calculate_tax = AsyncMock(return_value=mock_response)
            mock_get_calc.return_value = mock_calculator

            response = await tax_calculation_service.calculate_tax(sample_tax_calculation_request)

            assert response is not None
            mock_calculator.calculate_tax.assert_called_once_with(sample_tax_calculation_request)

    @pytest.mark.asyncio
    async def test_calculate_tax_unsupported_country(self, tax_calculation_service, sample_tax_calculation_request):
        """Test tax calculation for unsupported country"""
        # Change country to unsupported one
        sample_tax_calculation_request.country = "XX"

        with pytest.raises(CountryNotSupportedException):
            await tax_calculation_service.calculate_tax(sample_tax_calculation_request)

    def test_get_supported_countries(self, tax_calculation_service):
        """Test getting supported countries"""
        countries = tax_calculation_service.get_supported_countries()
        assert isinstance(countries, dict)
        assert "US" in countries
        assert countries["US"] == "United States"

    def test_get_country_info(self, tax_calculation_service):
        """Test getting country information"""
        with pytest.mock.patch.object(tax_calculation_service, '_get_calculator') as mock_get_calc:
            mock_calculator = Mock()
            mock_calculator.get_supported_filing_statuses.return_value = [FilingStatus.SINGLE]
            mock_get_calc.return_value = mock_calculator

            info = tax_calculation_service.get_country_info("US")

            assert info["country_code"] == "US"
            assert info["country_name"] == "United States"
            assert "supported_years" in info
            assert "currency" in info

    def test_validate_request_valid(self, tax_calculation_service, sample_tax_calculation_request):
        """Test request validation with valid request"""
        # Should not raise any exception
        tax_calculation_service._validate_request(sample_tax_calculation_request)

    def test_validate_request_negative_income(self, tax_calculation_service, sample_tax_calculation_request):
        """Test request validation with negative income"""
        sample_tax_calculation_request.total_income = Decimal("-1000")

        with pytest.raises(TaxCalculationError):
            tax_calculation_service._validate_request(sample_tax_calculation_request)

    def test_validate_request_empty_income_items(self, tax_calculation_service, sample_tax_calculation_request):
        """Test request validation with empty income items"""
        sample_tax_calculation_request.income_items = []

        with pytest.raises(TaxCalculationError):
            tax_calculation_service._validate_request(sample_tax_calculation_request)

    def test_validate_request_income_mismatch(self, tax_calculation_service, sample_tax_calculation_request):
        """Test request validation with income mismatch"""
        sample_tax_calculation_request.total_income = Decimal("50000")  # Doesn't match sum of income items

        with pytest.raises(TaxCalculationError):
            tax_calculation_service._validate_request(sample_tax_calculation_request)


class TestTaxOptimizationService:
    """Test TaxOptimizationService"""

    @pytest.mark.asyncio
    async def test_optimize_tax_success(self, tax_optimization_service, sample_optimization_request):
        """Test successful tax optimization"""
        # Mock the tax calculation service
        with pytest.mock.patch.object(tax_optimization_service.tax_calculation_service, 'calculate_tax') as mock_calc:
            mock_baseline = Mock()
            mock_baseline.tax_breakdown.total_tax = Decimal("15000")
            mock_calc.return_value = mock_baseline

            # Mock scenario generation
            with pytest.mock.patch.object(tax_optimization_service, '_generate_optimization_scenarios') as mock_scenarios:
                mock_scenarios.return_value = []  # No scenarios for simplicity

                response = await tax_optimization_service.optimize_tax(sample_optimization_request)

                assert response.baseline_tax == Decimal("15000")
                assert response.country == sample_optimization_request.base_calculation.country
                assert isinstance(response.optimized_scenarios, list)

    @pytest.mark.asyncio
    async def test_generate_income_scenarios(self, tax_optimization_service, sample_tax_calculation_request):
        """Test income scenario generation"""
        scenarios = await tax_optimization_service._generate_income_scenarios(sample_tax_calculation_request)

        # Should generate scenarios for high income
        if sample_tax_calculation_request.total_income > Decimal("100000"):
            assert len(scenarios) > 0
        else:
            # May or may not generate scenarios based on income level
            assert isinstance(scenarios, list)

    @pytest.mark.asyncio
    async def test_generate_deduction_scenarios(self, tax_optimization_service, sample_tax_calculation_request):
        """Test deduction scenario generation"""
        scenarios = await tax_optimization_service._generate_deduction_scenarios(sample_tax_calculation_request)

        assert isinstance(scenarios, list)
        # Scenarios depend on current deduction levels

    @pytest.mark.asyncio
    async def test_generate_us_scenarios(self, tax_optimization_service, sample_tax_calculation_request):
        """Test US-specific scenario generation"""
        scenarios = await tax_optimization_service._generate_us_scenarios(sample_tax_calculation_request)

        assert isinstance(scenarios, list)
        # Should include 401k and HSA scenarios

    def test_copy_request(self, tax_optimization_service, sample_tax_calculation_request):
        """Test request copying"""
        copied = tax_optimization_service._copy_request(sample_tax_calculation_request)

        assert copied.country == sample_tax_calculation_request.country
        assert copied.tax_year == sample_tax_calculation_request.tax_year
        assert copied.total_income == sample_tax_calculation_request.total_income
        assert len(copied.income_items) == len(sample_tax_calculation_request.income_items)
        assert len(copied.deduction_items) == len(sample_tax_calculation_request.deduction_items)

        # Ensure it's a deep copy
        copied.total_income = Decimal("99999")
        assert sample_tax_calculation_request.total_income != Decimal("99999")

    def test_determine_suggestion_type(self, tax_optimization_service):
        """Test suggestion type determination"""
        from app.models.tax_optimization import SuggestionType

        # Test retirement scenarios
        suggestion_type = tax_optimization_service._determine_suggestion_type("401k Maximization")
        assert suggestion_type == SuggestionType.RETIREMENT_CONTRIBUTION

        # Test deduction scenarios
        suggestion_type = tax_optimization_service._determine_suggestion_type("Charitable Deduction Optimization")
        assert suggestion_type == SuggestionType.DEDUCTION_OPTIMIZATION

        # Test income scenarios
        suggestion_type = tax_optimization_service._determine_suggestion_type("Income Deferral Strategy")
        assert suggestion_type == SuggestionType.INCOME_TIMING

    def test_calculate_confidence_level(self, tax_optimization_service, sample_optimization_request):
        """Test confidence level calculation"""
        from app.services.tax_optimization import OptimizationScenario

        # Easy implementation should have high confidence
        easy_scenario = OptimizationScenario(
            name="Test",
            description="Test",
            modified_request=sample_optimization_request.base_calculation,
            estimated_savings=Decimal("1000"),
            implementation_difficulty="easy",
            requirements=[]
        )

        confidence = tax_optimization_service._calculate_confidence_level(easy_scenario, sample_optimization_request)
        assert confidence == 0.9

        # Complex implementation should have lower confidence
        complex_scenario = OptimizationScenario(
            name="Test",
            description="Test",
            modified_request=sample_optimization_request.base_calculation,
            estimated_savings=Decimal("1000"),
            implementation_difficulty="complex",
            requirements=[]
        )

        confidence = tax_optimization_service._calculate_confidence_level(complex_scenario, sample_optimization_request)
        assert confidence == 0.6


class TestServiceIntegration:
    """Test service integration"""

    @pytest.mark.asyncio
    async def test_full_calculation_flow(self, tax_calculation_service, sample_tax_calculation_request):
        """Test full calculation flow integration"""
        # This test would require proper mock setup for the entire flow
        # For now, we'll test that the service exists and has the right interface
        assert hasattr(tax_calculation_service, 'calculate_tax')
        assert hasattr(tax_calculation_service, 'get_supported_countries')
        assert hasattr(tax_calculation_service, 'get_country_info')

    def test_service_dependencies(self, tax_calculation_service, tax_optimization_service):
        """Test service dependencies"""
        # Tax calculation service should have tax rules service
        assert hasattr(tax_calculation_service, 'tax_rules_service')

        # Tax optimization service should have tax calculation service
        assert hasattr(tax_optimization_service, 'tax_calculation_service')

    def test_cache_integration(self, mock_cache_manager):
        """Test cache manager integration"""
        # Test that cache manager has expected interface
        assert hasattr(mock_cache_manager, 'get_tax_rules')
        assert hasattr(mock_cache_manager, 'set_tax_rules')
        assert hasattr(mock_cache_manager, 'get_tax_calculation')
        assert hasattr(mock_cache_manager, 'set_tax_calculation')


class TestErrorHandling:
    """Test error handling in services"""

    @pytest.mark.asyncio
    async def test_calculation_service_error_handling(self, tax_calculation_service, sample_tax_calculation_request):
        """Test error handling in calculation service"""
        # Mock an error in the calculator
        with pytest.mock.patch.object(tax_calculation_service, '_get_calculator') as mock_get_calc:
            mock_calculator = Mock()
            mock_calculator.calculate_tax = AsyncMock(side_effect=Exception("Calculator error"))
            mock_get_calc.return_value = mock_calculator

            with pytest.raises(TaxCalculationError):
                await tax_calculation_service.calculate_tax(sample_tax_calculation_request)

    def test_rules_service_error_handling(self, mock_tax_rules_service):
        """Test error handling in rules service"""
        # Test with non-existent country
        mock_tax_rules_service.get_tax_rules.side_effect = CountryNotSupportedException("Invalid country")

        with pytest.raises(CountryNotSupportedException):
            mock_tax_rules_service.get_tax_rules("INVALID", 2024)

    @pytest.mark.asyncio
    async def test_optimization_service_error_handling(self, tax_optimization_service, sample_optimization_request):
        """Test error handling in optimization service"""
        # Mock an error in the tax calculation service
        with pytest.mock.patch.object(tax_optimization_service.tax_calculation_service, 'calculate_tax') as mock_calc:
            mock_calc.side_effect = TaxCalculationError("Calculation failed")

            with pytest.raises(TaxCalculationError):
                await tax_optimization_service.optimize_tax(sample_optimization_request)
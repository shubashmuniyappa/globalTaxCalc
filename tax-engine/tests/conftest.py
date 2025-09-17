"""
Test configuration and fixtures
"""

import pytest
from decimal import Decimal
from typing import Dict, Any
from unittest.mock import Mock

from app.models.tax_calculation import (
    TaxCalculationRequest,
    IncomeItem,
    DeductionItem,
    Country,
    FilingStatus,
    IncomeType,
    DeductionType
)
from app.models.tax_optimization import TaxOptimizationRequest
from app.services.tax_rules import TaxRulesService
from app.services.tax_calculation import TaxCalculationService
from app.services.tax_optimization import TaxOptimizationService


@pytest.fixture
def sample_tax_rules() -> Dict[str, Any]:
    """Sample tax rules for testing"""
    return {
        "version": "2024.1",
        "country": "US",
        "tax_year": 2024,
        "currency": "USD",
        "federal": {
            "tax_brackets": {
                "single": [
                    {"rate": 0.10, "min": 0, "max": 11000},
                    {"rate": 0.12, "min": 11001, "max": 44725},
                    {"rate": 0.22, "min": 44726, "max": 95375},
                    {"rate": 0.24, "min": 95376, "max": null}
                ]
            },
            "standard_deduction": {
                "single": 14600,
                "married_filing_jointly": 29200
            },
            "social_security": {
                "rate": 0.062,
                "wage_base": 168600
            },
            "medicare": {
                "rate": 0.0145
            }
        }
    }


@pytest.fixture
def sample_income_items():
    """Sample income items for testing"""
    return [
        IncomeItem(
            income_type=IncomeType.SALARY,
            amount=Decimal("75000"),
            description="Software Engineer Salary",
            is_taxable=True
        ),
        IncomeItem(
            income_type=IncomeType.INVESTMENT,
            amount=Decimal("5000"),
            description="Investment dividends",
            is_taxable=True
        )
    ]


@pytest.fixture
def sample_deduction_items():
    """Sample deduction items for testing"""
    return [
        DeductionItem(
            deduction_type=DeductionType.CHARITABLE,
            amount=Decimal("2000"),
            description="Charitable donations"
        ),
        DeductionItem(
            deduction_type=DeductionType.BUSINESS_EXPENSE,
            amount=Decimal("1500"),
            description="Business expenses"
        )
    ]


@pytest.fixture
def sample_tax_calculation_request(sample_income_items, sample_deduction_items):
    """Sample tax calculation request"""
    return TaxCalculationRequest(
        country=Country.US,
        tax_year=2024,
        filing_status=FilingStatus.SINGLE,
        income_items=sample_income_items,
        deduction_items=sample_deduction_items,
        total_income=Decimal("80000"),
        age=35,
        include_state_tax=False,
        calculate_quarterly=False
    )


@pytest.fixture
def sample_optimization_request(sample_tax_calculation_request):
    """Sample tax optimization request"""
    return TaxOptimizationRequest(
        base_calculation=sample_tax_calculation_request,
        optimization_goals=["reduce_current_tax", "retirement_planning"],
        risk_tolerance="moderate",
        max_suggestions=5
    )


@pytest.fixture
def mock_cache_manager():
    """Mock cache manager for testing"""
    mock = Mock()
    mock.get_tax_rules.return_value = None
    mock.set_tax_rules.return_value = None
    mock.get_tax_calculation.return_value = None
    mock.set_tax_calculation.return_value = None
    return mock


@pytest.fixture
def mock_tax_rules_service(sample_tax_rules):
    """Mock tax rules service for testing"""
    mock = Mock(spec=TaxRulesService)
    mock.get_tax_rules.return_value = sample_tax_rules
    mock.get_tax_rule.return_value = None
    mock.get_supported_countries.return_value = ["US", "CA", "UK", "AU", "DE"]
    mock.get_supported_years.return_value = [2024, 2025]
    return mock


@pytest.fixture
def tax_calculation_service(mock_tax_rules_service, mock_cache_manager):
    """Tax calculation service for testing"""
    return TaxCalculationService(mock_tax_rules_service, mock_cache_manager)


@pytest.fixture
def tax_optimization_service(tax_calculation_service, mock_cache_manager):
    """Tax optimization service for testing"""
    return TaxOptimizationService(tax_calculation_service, mock_cache_manager)
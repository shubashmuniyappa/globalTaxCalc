"""
Test API endpoints
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

from main import app
from app.models.tax_calculation import TaxCalculationResponse, TaxBreakdown, Country, FilingStatus


@pytest.fixture
def client():
    """Test client for API testing"""
    return TestClient(app)


@pytest.fixture
def sample_api_request():
    """Sample API request payload"""
    return {
        "country": "US",
        "tax_year": 2024,
        "filing_status": "single",
        "income_items": [
            {
                "income_type": "salary",
                "amount": "75000",
                "description": "Software Engineer Salary",
                "is_taxable": True
            }
        ],
        "deduction_items": [
            {
                "deduction_type": "charitable",
                "amount": "2000",
                "description": "Charitable donations",
                "is_above_line": False
            }
        ],
        "total_income": "75000",
        "age": 35,
        "include_state_tax": False,
        "calculate_quarterly": False
    }


@pytest.fixture
def sample_tax_response():
    """Sample tax calculation response"""
    return TaxCalculationResponse(
        country=Country.US,
        tax_year=2024,
        filing_status=FilingStatus.SINGLE,
        tax_breakdown=TaxBreakdown(
            gross_income=Decimal("75000"),
            adjusted_gross_income=Decimal("75000"),
            taxable_income=Decimal("60400"),
            federal_income_tax=Decimal("8000"),
            social_security_tax=Decimal("4650"),
            medicare_tax=Decimal("1087.50"),
            total_tax=Decimal("13737.50"),
            marginal_tax_rate=Decimal("0.22"),
            effective_tax_rate=Decimal("0.1832")
        ),
        calculation_date="2024-01-15T10:30:00",
        calculation_duration_ms=150.0,
        tax_rules_version="2024.1",
        cached_result=False,
        warnings=[],
        notes=[]
    )


class TestHealthEndpoints:
    """Test health check endpoints"""

    def test_health_check(self, client):
        """Test basic health check"""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "version" in data

    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert data["service"] == "GlobalTaxCalc Tax Engine"
        assert "supported_countries" in data
        assert "endpoints" in data


class TestTaxCalculationEndpoint:
    """Test tax calculation endpoint"""

    @patch('app.services.tax_calculation.get_tax_calculation_service')
    def test_calculate_tax_success(self, mock_service, client, sample_api_request, sample_tax_response):
        """Test successful tax calculation"""
        # Mock the service
        mock_service_instance = Mock()
        mock_service_instance.calculate_tax.return_value = sample_tax_response
        mock_service.return_value = mock_service_instance

        response = client.post("/api/v1/calculate", json=sample_api_request)
        assert response.status_code == 200

        data = response.json()
        assert data["country"] == "US"
        assert data["tax_year"] == 2024
        assert "tax_breakdown" in data
        assert float(data["tax_breakdown"]["total_tax"]) > 0

    def test_calculate_tax_invalid_country(self, client, sample_api_request):
        """Test tax calculation with invalid country"""
        invalid_request = sample_api_request.copy()
        invalid_request["country"] = "INVALID"

        response = client.post("/api/v1/calculate", json=invalid_request)
        assert response.status_code == 422  # Validation error

    def test_calculate_tax_missing_fields(self, client):
        """Test tax calculation with missing required fields"""
        incomplete_request = {
            "country": "US",
            "tax_year": 2024
            # Missing required fields
        }

        response = client.post("/api/v1/calculate", json=incomplete_request)
        assert response.status_code == 422

    def test_calculate_tax_invalid_income(self, client, sample_api_request):
        """Test tax calculation with invalid income"""
        invalid_request = sample_api_request.copy()
        invalid_request["total_income"] = "-1000"  # Negative income

        response = client.post("/api/v1/calculate", json=invalid_request)
        assert response.status_code == 422


class TestTaxBracketsEndpoint:
    """Test tax brackets endpoint"""

    @patch('app.services.tax_calculation.get_tax_calculation_service')
    def test_get_tax_brackets_success(self, mock_service, client):
        """Test successful tax brackets retrieval"""
        # Mock the service
        mock_service_instance = Mock()
        mock_service_instance.get_tax_brackets.return_value = {
            "country": "US",
            "tax_year": 2024,
            "filing_status": "single",
            "federal_brackets": [
                {"rate": 0.10, "min_income": 0, "max_income": 11000},
                {"rate": 0.12, "min_income": 11001, "max_income": 44725}
            ]
        }
        mock_service.return_value = mock_service_instance

        response = client.get("/api/v1/brackets/US?tax_year=2024&filing_status=single")
        assert response.status_code == 200

        data = response.json()
        assert data["country"] == "US"
        assert data["tax_year"] == 2024
        assert "federal_brackets" in data
        assert len(data["federal_brackets"]) > 0

    def test_get_tax_brackets_invalid_status(self, client):
        """Test tax brackets with invalid filing status"""
        response = client.get("/api/v1/brackets/US?tax_year=2024&filing_status=invalid")
        assert response.status_code == 400

    def test_get_tax_brackets_invalid_year(self, client):
        """Test tax brackets with invalid year"""
        response = client.get("/api/v1/brackets/US?tax_year=2050&filing_status=single")
        assert response.status_code == 400


class TestCountriesEndpoint:
    """Test countries endpoint"""

    @patch('app.services.tax_calculation.get_tax_calculation_service')
    def test_get_supported_countries(self, mock_service, client):
        """Test supported countries endpoint"""
        # Mock the service
        mock_service_instance = Mock()
        mock_service_instance.get_supported_countries.return_value = {
            "US": "United States",
            "CA": "Canada",
            "UK": "United Kingdom",
            "AU": "Australia",
            "DE": "Germany"
        }
        mock_service.return_value = mock_service_instance

        response = client.get("/api/v1/countries")
        assert response.status_code == 200

        data = response.json()
        assert "US" in data
        assert data["US"] == "United States"
        assert len(data) == 5

    @patch('app.services.tax_calculation.get_tax_calculation_service')
    def test_get_country_info(self, mock_service, client):
        """Test country info endpoint"""
        # Mock the service
        mock_service_instance = Mock()
        mock_service_instance.get_country_info.return_value = {
            "country_code": "US",
            "country_name": "United States",
            "supported_years": [2024, 2025],
            "supported_filing_statuses": ["single", "married_filing_jointly"],
            "has_state_tax": True,
            "currency": "USD",
            "features": {
                "federal_tax": True,
                "state_tax": True,
                "social_security": True
            }
        }
        mock_service.return_value = mock_service_instance

        response = client.get("/api/v1/countries/US/info")
        assert response.status_code == 200

        data = response.json()
        assert data["country_code"] == "US"
        assert data["has_state_tax"] is True
        assert "features" in data


class TestOptimizationEndpoint:
    """Test tax optimization endpoint"""

    def test_optimize_tax_endpoint_exists(self, client):
        """Test that optimization endpoint exists"""
        # This is a basic test to verify the endpoint exists
        # We expect it to fail with validation error due to missing request body
        response = client.post("/api/v1/optimize", json={})
        assert response.status_code == 422  # Validation error expected


class TestFilingStatusesEndpoint:
    """Test filing statuses endpoint"""

    def test_get_filing_statuses(self, client):
        """Test filing statuses endpoint"""
        response = client.get("/api/v1/filing-statuses")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert "single" in data
        assert "married_filing_jointly" in data
        assert len(data) > 0


class TestErrorHandling:
    """Test API error handling"""

    def test_404_error(self, client):
        """Test 404 error handling"""
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404

    def test_method_not_allowed(self, client):
        """Test 405 error handling"""
        response = client.put("/api/v1/countries")
        assert response.status_code == 405

    @patch('app.services.tax_calculation.get_tax_calculation_service')
    def test_internal_server_error_handling(self, mock_service, client, sample_api_request):
        """Test 500 error handling"""
        # Mock the service to raise an exception
        mock_service_instance = Mock()
        mock_service_instance.calculate_tax.side_effect = Exception("Internal error")
        mock_service.return_value = mock_service_instance

        response = client.post("/api/v1/calculate", json=sample_api_request)
        assert response.status_code == 500

        data = response.json()
        assert "detail" in data


class TestRequestValidation:
    """Test request validation"""

    def test_request_content_type(self, client):
        """Test content type validation"""
        response = client.post("/api/v1/calculate", data="invalid json")
        assert response.status_code == 422

    def test_request_size_limit(self, client):
        """Test request size limits"""
        # Create a very large request
        large_request = {
            "country": "US",
            "tax_year": 2024,
            "filing_status": "single",
            "income_items": [
                {
                    "income_type": "salary",
                    "amount": "75000",
                    "description": "x" * 10000,  # Very long description
                    "is_taxable": True
                }
            ] * 1000,  # Many items
            "total_income": "75000"
        }

        response = client.post("/api/v1/calculate", json=large_request)
        # Should handle gracefully, either accept or reject with appropriate error
        assert response.status_code in [200, 400, 413, 422]
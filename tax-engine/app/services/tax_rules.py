"""
Tax Rules Service
Manages loading, validation, and caching of tax rules from JSON configurations
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import hashlib

from app.core.config import get_settings
from app.core.exceptions import TaxEngineException, CountryNotSupportedException
from app.core.logging import LoggingMixin
from app.core.cache import TaxRulesCacheManager


class TaxRulesValidationError(TaxEngineException):
    """Raised when tax rules validation fails"""
    pass


class TaxRulesService(LoggingMixin):
    """Service for managing tax rules from JSON configurations"""

    def __init__(self, cache_manager: Optional[TaxRulesCacheManager] = None):
        super().__init__()
        self.settings = get_settings()
        self.cache_manager = cache_manager
        self.rules_cache: Dict[str, Dict[str, Any]] = {}
        self.rules_directory = Path(__file__).parent.parent / "data" / "tax_rules"

        # Supported countries
        self.supported_countries = ["US", "CA", "UK", "AU", "DE"]

        # Load rules on initialization
        self._load_all_rules()

    def _load_all_rules(self) -> None:
        """Load all tax rules from JSON files"""
        try:
            for year_dir in self.rules_directory.iterdir():
                if year_dir.is_dir() and year_dir.name.isdigit():
                    tax_year = int(year_dir.name)
                    for country_file in year_dir.glob("*.json"):
                        country_code = country_file.stem.upper()
                        if country_code in self.supported_countries:
                            self._load_country_rules(country_code, tax_year)

            self.logger.info(f"Loaded tax rules for {len(self.rules_cache)} country-year combinations")

        except Exception as e:
            self.logger.error(f"Failed to load tax rules: {str(e)}")
            raise TaxRulesValidationError(f"Failed to load tax rules: {str(e)}")

    def _load_country_rules(self, country_code: str, tax_year: int) -> None:
        """Load tax rules for a specific country and year"""
        rules_file = self.rules_directory / str(tax_year) / f"{country_code.lower()}.json"

        if not rules_file.exists():
            self.logger.warning(f"Tax rules file not found: {rules_file}")
            return

        try:
            with open(rules_file, 'r', encoding='utf-8') as f:
                rules_data = json.load(f)

            # Validate rules structure
            self._validate_rules(rules_data, country_code, tax_year)

            # Cache the rules
            cache_key = f"{country_code}_{tax_year}"
            self.rules_cache[cache_key] = rules_data

            # Store in Redis cache if available
            if self.cache_manager:
                self.cache_manager.set_tax_rules(country_code, tax_year, rules_data)

            self.logger.debug(f"Loaded tax rules for {country_code} {tax_year}")

        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in {rules_file}: {str(e)}")
            raise TaxRulesValidationError(f"Invalid JSON in tax rules for {country_code} {tax_year}")
        except Exception as e:
            self.logger.error(f"Error loading {rules_file}: {str(e)}")
            raise TaxRulesValidationError(f"Error loading tax rules for {country_code} {tax_year}: {str(e)}")

    def _validate_rules(self, rules_data: Dict[str, Any], country_code: str, tax_year: int) -> None:
        """Validate tax rules structure and required fields"""
        required_fields = ["version", "country", "tax_year", "currency"]

        for field in required_fields:
            if field not in rules_data:
                raise TaxRulesValidationError(f"Missing required field '{field}' in {country_code} {tax_year} rules")

        # Validate country code matches
        if rules_data["country"].upper() != country_code:
            raise TaxRulesValidationError(f"Country code mismatch in {country_code} {tax_year} rules")

        # Validate tax year matches
        if rules_data["tax_year"] != tax_year:
            raise TaxRulesValidationError(f"Tax year mismatch in {country_code} {tax_year} rules")

        # Country-specific validations
        if country_code == "US":
            self._validate_us_rules(rules_data)
        elif country_code == "CA":
            self._validate_canada_rules(rules_data)
        elif country_code == "UK":
            self._validate_uk_rules(rules_data)
        elif country_code == "AU":
            self._validate_australia_rules(rules_data)
        elif country_code == "DE":
            self._validate_germany_rules(rules_data)

    def _validate_us_rules(self, rules_data: Dict[str, Any]) -> None:
        """Validate US-specific tax rules"""
        required_sections = ["federal"]
        for section in required_sections:
            if section not in rules_data:
                raise TaxRulesValidationError(f"Missing {section} section in US tax rules")

        # Validate federal tax brackets
        federal = rules_data["federal"]
        if "tax_brackets" not in federal:
            raise TaxRulesValidationError("Missing tax_brackets in US federal rules")

        required_filing_statuses = ["single", "married_filing_jointly", "married_filing_separately", "head_of_household"]
        for status in required_filing_statuses:
            if status not in federal["tax_brackets"]:
                raise TaxRulesValidationError(f"Missing tax brackets for {status} in US rules")

            brackets = federal["tax_brackets"][status]
            if not isinstance(brackets, list) or len(brackets) == 0:
                raise TaxRulesValidationError(f"Invalid tax brackets for {status} in US rules")

            # Validate bracket structure
            for i, bracket in enumerate(brackets):
                required_bracket_fields = ["rate", "min"]
                for field in required_bracket_fields:
                    if field not in bracket:
                        raise TaxRulesValidationError(f"Missing {field} in bracket {i} for {status}")

    def _validate_canada_rules(self, rules_data: Dict[str, Any]) -> None:
        """Validate Canada-specific tax rules"""
        required_sections = ["federal"]
        for section in required_sections:
            if section not in rules_data:
                raise TaxRulesValidationError(f"Missing {section} section in Canada tax rules")

        federal = rules_data["federal"]
        if "tax_brackets" not in federal:
            raise TaxRulesValidationError("Missing tax_brackets in Canada federal rules")

        if "basic_personal_amount" not in federal:
            raise TaxRulesValidationError("Missing basic_personal_amount in Canada federal rules")

    def _validate_uk_rules(self, rules_data: Dict[str, Any]) -> None:
        """Validate UK-specific tax rules"""
        required_sections = ["income_tax", "personal_allowance", "national_insurance"]
        for section in required_sections:
            if section not in rules_data:
                raise TaxRulesValidationError(f"Missing {section} section in UK tax rules")

    def _validate_australia_rules(self, rules_data: Dict[str, Any]) -> None:
        """Validate Australia-specific tax rules"""
        required_sections = ["income_tax", "medicare_levy"]
        for section in required_sections:
            if section not in rules_data:
                raise TaxRulesValidationError(f"Missing {section} section in Australia tax rules")

    def _validate_germany_rules(self, rules_data: Dict[str, Any]) -> None:
        """Validate Germany-specific tax rules"""
        required_fields = ["basic_allowance", "tax_formula", "solidarity_tax"]
        for field in required_fields:
            if field not in rules_data:
                raise TaxRulesValidationError(f"Missing {field} in Germany tax rules")

    def get_tax_rules(self, country_code: str, tax_year: int) -> Dict[str, Any]:
        """Get tax rules for a specific country and year"""
        country_code = country_code.upper()

        if country_code not in self.supported_countries:
            raise CountryNotSupportedException(f"Country {country_code} is not supported")

        cache_key = f"{country_code}_{tax_year}"

        # Try Redis cache first
        if self.cache_manager:
            cached_rules = self.cache_manager.get_tax_rules(country_code, tax_year)
            if cached_rules:
                self.logger.debug(f"Retrieved tax rules from cache for {country_code} {tax_year}")
                return cached_rules

        # Try local cache
        if cache_key in self.rules_cache:
            rules = self.rules_cache[cache_key]
            # Update Redis cache
            if self.cache_manager:
                self.cache_manager.set_tax_rules(country_code, tax_year, rules)
            return rules

        # Try to load from file
        try:
            self._load_country_rules(country_code, tax_year)
            if cache_key in self.rules_cache:
                return self.rules_cache[cache_key]
        except Exception as e:
            self.logger.error(f"Failed to load tax rules for {country_code} {tax_year}: {str(e)}")

        raise TaxRulesValidationError(f"Tax rules not found for {country_code} {tax_year}")

    def get_tax_rule(self, country_code: str, tax_year: int, rule_path: str) -> Any:
        """Get a specific tax rule using dot notation path"""
        rules = self.get_tax_rules(country_code, tax_year)

        # Navigate through the rule path
        current = rules
        for key in rule_path.split('.'):
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None

        return current

    def get_supported_countries(self) -> List[str]:
        """Get list of supported countries"""
        return self.supported_countries.copy()

    def get_supported_years(self, country_code: str) -> List[int]:
        """Get list of supported tax years for a country"""
        country_code = country_code.upper()
        if country_code not in self.supported_countries:
            raise CountryNotSupportedException(f"Country {country_code} is not supported")

        years = []
        for cache_key in self.rules_cache.keys():
            if cache_key.startswith(f"{country_code}_"):
                year = int(cache_key.split("_")[1])
                years.append(year)

        return sorted(years)

    def get_rules_version(self, country_code: str, tax_year: int) -> str:
        """Get the version of tax rules for a country and year"""
        rules = self.get_tax_rules(country_code, tax_year)
        return rules.get("version", "unknown")

    def get_rules_hash(self, country_code: str, tax_year: int) -> str:
        """Get a hash of the tax rules for cache validation"""
        rules = self.get_tax_rules(country_code, tax_year)
        rules_str = json.dumps(rules, sort_keys=True)
        return hashlib.md5(rules_str.encode()).hexdigest()

    def reload_rules(self, country_code: Optional[str] = None, tax_year: Optional[int] = None) -> None:
        """Reload tax rules from files"""
        if country_code and tax_year:
            # Reload specific country and year
            cache_key = f"{country_code.upper()}_{tax_year}"
            if cache_key in self.rules_cache:
                del self.rules_cache[cache_key]

            if self.cache_manager:
                self.cache_manager.delete_tax_rules(country_code.upper(), tax_year)

            self._load_country_rules(country_code.upper(), tax_year)
        else:
            # Reload all rules
            self.rules_cache.clear()
            if self.cache_manager:
                self.cache_manager.clear_all_tax_rules()
            self._load_all_rules()

    def validate_all_rules(self) -> Dict[str, List[str]]:
        """Validate all loaded tax rules and return validation errors"""
        errors = {}

        for cache_key, rules_data in self.rules_cache.items():
            country_code, tax_year = cache_key.split("_")
            tax_year = int(tax_year)

            try:
                self._validate_rules(rules_data, country_code, tax_year)
            except TaxRulesValidationError as e:
                if cache_key not in errors:
                    errors[cache_key] = []
                errors[cache_key].append(str(e))

        return errors


# Global instance
_tax_rules_service: Optional[TaxRulesService] = None


def get_tax_rules_service() -> TaxRulesService:
    """Get the global tax rules service instance"""
    global _tax_rules_service
    if _tax_rules_service is None:
        _tax_rules_service = TaxRulesService()
    return _tax_rules_service


def init_tax_rules_service(cache_manager: Optional[TaxRulesCacheManager] = None) -> TaxRulesService:
    """Initialize the global tax rules service"""
    global _tax_rules_service
    _tax_rules_service = TaxRulesService(cache_manager)
    return _tax_rules_service
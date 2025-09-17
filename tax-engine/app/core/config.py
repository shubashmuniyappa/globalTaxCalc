"""
Configuration management for the tax engine
"""

import os
from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    environment: str = Field(default="development", alias="ENVIRONMENT")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    workers: int = Field(default=1, alias="WORKERS")

    # Security
    secret_key: str = Field(default="dev-secret-key", alias="SECRET_KEY")
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3009"],
        alias="CORS_ORIGINS"
    )
    allowed_hosts: List[str] = Field(
        default=["localhost", "127.0.0.1", "*"],
        alias="ALLOWED_HOSTS"
    )

    # Redis Cache
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    redis_password: Optional[str] = Field(default=None, alias="REDIS_PASSWORD")
    redis_db: int = Field(default=0, alias="REDIS_DB")

    # Cache TTL settings (in seconds)
    tax_rules_cache_ttl: int = Field(default=3600, alias="TAX_RULES_CACHE_TTL")  # 1 hour
    calculation_cache_ttl: int = Field(default=300, alias="CALCULATION_CACHE_TTL")  # 5 minutes
    optimization_cache_ttl: int = Field(default=600, alias="OPTIMIZATION_CACHE_TTL")  # 10 minutes

    # Database (optional for future extensions)
    database_url: Optional[str] = Field(default=None, alias="DATABASE_URL")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")

    # Tax calculation settings
    max_calculation_time: float = Field(default=10.0, alias="MAX_CALCULATION_TIME")  # seconds
    default_tax_year: int = Field(default=2024, alias="DEFAULT_TAX_YEAR")
    supported_countries: List[str] = Field(
        default=["US", "CA", "UK", "AU", "DE"],
        alias="SUPPORTED_COUNTRIES"
    )

    # Performance settings
    enable_calculation_cache: bool = Field(default=True, alias="ENABLE_CALCULATION_CACHE")
    enable_rule_cache: bool = Field(default=True, alias="ENABLE_RULE_CACHE")
    max_concurrent_calculations: int = Field(default=100, alias="MAX_CONCURRENT_CALCULATIONS")

    # External services
    auth_service_url: str = Field(
        default="http://localhost:3001",
        alias="AUTH_SERVICE_URL"
    )
    api_gateway_url: str = Field(
        default="http://localhost:3000",
        alias="API_GATEWAY_URL"
    )

    # Rate limiting
    rate_limit_requests: int = Field(default=100, alias="RATE_LIMIT_REQUESTS")
    rate_limit_window: int = Field(default=60, alias="RATE_LIMIT_WINDOW")  # seconds

    # Monitoring
    enable_metrics: bool = Field(default=True, alias="ENABLE_METRICS")
    metrics_port: int = Field(default=8001, alias="METRICS_PORT")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    def get_redis_config(self) -> dict:
        """Get Redis connection configuration"""
        config = {
            "url": self.redis_url,
            "db": self.redis_db,
            "decode_responses": True,
            "encoding": "utf-8",
            "socket_connect_timeout": 5,
            "socket_timeout": 5,
            "retry_on_timeout": True,
            "retry_on_error": [ConnectionError, TimeoutError],
            "health_check_interval": 30
        }

        if self.redis_password:
            config["password"] = self.redis_password

        return config

    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.environment.lower() == "development"

    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.environment.lower() == "production"

    def get_cache_prefix(self, cache_type: str) -> str:
        """Get cache key prefix for different cache types"""
        return f"globaltaxcalc:tax_engine:{cache_type}:{self.environment}"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Environment-specific configurations
class DevelopmentSettings(Settings):
    """Development environment settings"""
    log_level: str = "DEBUG"
    enable_metrics: bool = True


class ProductionSettings(Settings):
    """Production environment settings"""
    log_level: str = "INFO"
    workers: int = 4
    cors_origins: List[str] = ["https://globaltaxcalc.com"]
    allowed_hosts: List[str] = ["globaltaxcalc.com", "api.globaltaxcalc.com"]


class TestSettings(Settings):
    """Test environment settings"""
    environment: str = "test"
    redis_url: str = "redis://localhost:6379/1"  # Use different DB for tests
    enable_calculation_cache: bool = False  # Disable cache for tests
    enable_rule_cache: bool = False
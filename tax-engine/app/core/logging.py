"""
Logging configuration for the tax engine
"""

import logging
import sys
from typing import Any, Dict

import structlog

from .config import get_settings

settings = get_settings()


def setup_logging():
    """Setup structured logging configuration"""

    # Configure structlog
    structlog.configure(
        processors=[
            # Filter out debug logs in production
            structlog.stdlib.filter_by_level,
            # Add logger name to log entries
            structlog.stdlib.add_logger_name,
            # Add log level to log entries
            structlog.stdlib.add_log_level,
            # Add timestamp
            structlog.processors.TimeStamper(fmt="iso"),
            # Add extra context
            structlog.processors.StackInfoRenderer(),
            # Format exception info
            structlog.dev.ConsoleRenderer() if settings.is_development()
            else structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper())
    )

    # Set logging levels for third-party libraries
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("redis").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger instance"""
    return structlog.get_logger(name)


class LoggingMixin:
    """Mixin class to add logging capabilities"""

    @property
    def logger(self) -> structlog.BoundLogger:
        """Get logger for this class"""
        return structlog.get_logger(self.__class__.__name__)

    def log_calculation_start(self, country: str, tax_year: int, income: float):
        """Log the start of a tax calculation"""
        self.logger.info(
            "Tax calculation started",
            country=country,
            tax_year=tax_year,
            income=income
        )

    def log_calculation_end(
        self,
        country: str,
        tax_year: int,
        income: float,
        total_tax: float,
        duration: float
    ):
        """Log the completion of a tax calculation"""
        self.logger.info(
            "Tax calculation completed",
            country=country,
            tax_year=tax_year,
            income=income,
            total_tax=total_tax,
            duration=duration
        )

    def log_calculation_error(
        self,
        country: str,
        tax_year: int,
        income: float,
        error: str
    ):
        """Log a tax calculation error"""
        self.logger.error(
            "Tax calculation failed",
            country=country,
            tax_year=tax_year,
            income=income,
            error=error
        )

    def log_cache_hit(self, cache_key: str, cache_type: str):
        """Log a cache hit"""
        self.logger.debug(
            "Cache hit",
            cache_key=cache_key,
            cache_type=cache_type
        )

    def log_cache_miss(self, cache_key: str, cache_type: str):
        """Log a cache miss"""
        self.logger.debug(
            "Cache miss",
            cache_key=cache_key,
            cache_type=cache_type
        )

    def log_rule_loaded(self, country: str, tax_year: int, rule_type: str):
        """Log tax rule loading"""
        self.logger.info(
            "Tax rule loaded",
            country=country,
            tax_year=tax_year,
            rule_type=rule_type
        )

    def log_optimization_start(self, country: str, tax_year: int):
        """Log the start of tax optimization"""
        self.logger.info(
            "Tax optimization started",
            country=country,
            tax_year=tax_year
        )

    def log_optimization_end(
        self,
        country: str,
        tax_year: int,
        suggestions_count: int,
        potential_savings: float,
        duration: float
    ):
        """Log the completion of tax optimization"""
        self.logger.info(
            "Tax optimization completed",
            country=country,
            tax_year=tax_year,
            suggestions_count=suggestions_count,
            potential_savings=potential_savings,
            duration=duration
        )


class PerformanceLogger:
    """Logger for performance metrics"""

    def __init__(self):
        self.logger = structlog.get_logger("performance")

    def log_request_metrics(
        self,
        endpoint: str,
        method: str,
        duration: float,
        status_code: int,
        cache_hit: bool = False
    ):
        """Log request performance metrics"""
        self.logger.info(
            "Request metrics",
            endpoint=endpoint,
            method=method,
            duration=duration,
            status_code=status_code,
            cache_hit=cache_hit
        )

    def log_calculation_metrics(
        self,
        country: str,
        calculation_type: str,
        duration: float,
        complexity_score: float,
        cache_used: bool = False
    ):
        """Log calculation performance metrics"""
        self.logger.info(
            "Calculation metrics",
            country=country,
            calculation_type=calculation_type,
            duration=duration,
            complexity_score=complexity_score,
            cache_used=cache_used
        )

    def log_cache_metrics(
        self,
        cache_type: str,
        operation: str,
        duration: float,
        key_count: int = None,
        hit_rate: float = None
    ):
        """Log cache performance metrics"""
        metrics = {
            "cache_type": cache_type,
            "operation": operation,
            "duration": duration
        }

        if key_count is not None:
            metrics["key_count"] = key_count

        if hit_rate is not None:
            metrics["hit_rate"] = hit_rate

        self.logger.info("Cache metrics", **metrics)


class SecurityLogger:
    """Logger for security events"""

    def __init__(self):
        self.logger = structlog.get_logger("security")

    def log_suspicious_request(
        self,
        client_ip: str,
        endpoint: str,
        reason: str,
        details: Dict[str, Any] = None
    ):
        """Log suspicious request activity"""
        self.logger.warning(
            "Suspicious request detected",
            client_ip=client_ip,
            endpoint=endpoint,
            reason=reason,
            details=details or {}
        )

    def log_rate_limit_exceeded(
        self,
        client_ip: str,
        endpoint: str,
        request_count: int,
        window_seconds: int
    ):
        """Log rate limit violations"""
        self.logger.warning(
            "Rate limit exceeded",
            client_ip=client_ip,
            endpoint=endpoint,
            request_count=request_count,
            window_seconds=window_seconds
        )

    def log_validation_failure(
        self,
        client_ip: str,
        endpoint: str,
        validation_errors: list
    ):
        """Log input validation failures"""
        self.logger.warning(
            "Input validation failed",
            client_ip=client_ip,
            endpoint=endpoint,
            validation_errors=validation_errors
        )
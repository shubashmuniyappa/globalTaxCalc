"""
Configuration management for the File Processing Service
"""
import os
from pathlib import Path
from typing import List, Optional
from pydantic import BaseSettings, Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Application Configuration
    app_name: str = Field(default="GlobalTaxCalc File Processing Service", env="APP_NAME")
    app_version: str = Field(default="1.0.0", env="APP_VERSION")
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")

    # Server Configuration
    host: str = Field(default="localhost", env="HOST")
    port: int = Field(default=8000, env="PORT")
    workers: int = Field(default=4, env="WORKERS")

    # Database Configuration
    database_url: str = Field(env="DATABASE_URL")
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=30, env="DATABASE_MAX_OVERFLOW")

    # Redis Configuration
    redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    redis_db: int = Field(default=0, env="REDIS_DB")
    celery_broker_url: str = Field(default="redis://localhost:6379/1", env="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://localhost:6379/2", env="CELERY_RESULT_BACKEND")

    # File Storage Configuration
    upload_directory: Path = Field(default=Path("./uploads"), env="UPLOAD_DIRECTORY")
    temp_directory: Path = Field(default=Path("./temp"), env="TEMP_DIRECTORY")
    max_file_size: str = Field(default="50MB", env="MAX_FILE_SIZE")
    allowed_extensions: List[str] = Field(
        default=["pdf", "jpg", "jpeg", "png", "tiff", "tif"],
        env="ALLOWED_EXTENSIONS"
    )
    file_retention_hours: int = Field(default=24, env="FILE_RETENTION_HOURS")

    # OCR Configuration
    tesseract_path: str = Field(default="/usr/bin/tesseract", env="TESSERACT_PATH")
    tesseract_lang: str = Field(default="eng+fra+deu+spa", env="TESSERACT_LANG")
    ocr_dpi: int = Field(default=300, env="OCR_DPI")
    ocr_confidence_threshold: int = Field(default=60, env="OCR_CONFIDENCE_THRESHOLD")

    # Security Configuration
    secret_key: str = Field(env="SECRET_KEY")
    encryption_key: str = Field(env="ENCRYPTION_KEY")
    jwt_secret_key: str = Field(env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, env="JWT_EXPIRATION_HOURS")

    # Virus Scanning Configuration
    clamav_enabled: bool = Field(default=True, env="CLAMAV_ENABLED")
    clamav_host: str = Field(default="localhost", env="CLAMAV_HOST")
    clamav_port: int = Field(default=3310, env="CLAMAV_PORT")
    clamav_timeout: int = Field(default=30, env="CLAMAV_TIMEOUT")

    # File Processing Configuration
    max_concurrent_jobs: int = Field(default=10, env="MAX_CONCURRENT_JOBS")
    job_timeout_minutes: int = Field(default=30, env="JOB_TIMEOUT_MINUTES")
    retry_attempts: int = Field(default=3, env="RETRY_ATTEMPTS")
    cleanup_interval_hours: int = Field(default=1, env="CLEANUP_INTERVAL_HOURS")

    # Form Recognition Configuration
    form_confidence_threshold: float = Field(default=0.8, env="FORM_CONFIDENCE_THRESHOLD")
    field_confidence_threshold: float = Field(default=0.7, env="FIELD_CONFIDENCE_THRESHOLD")
    min_text_length: int = Field(default=2, env="MIN_TEXT_LENGTH")
    max_text_length: int = Field(default=500, env="MAX_TEXT_LENGTH")

    # Supported Countries and Forms
    supported_countries: List[str] = Field(
        default=["US", "CA", "UK", "AU", "DE", "FR"],
        env="SUPPORTED_COUNTRIES"
    )
    us_forms: List[str] = Field(
        default=["W-2", "1099-MISC", "1099-INT", "1099-DIV", "1040", "1040EZ"],
        env="US_FORMS"
    )
    ca_forms: List[str] = Field(
        default=["T4", "T4A", "T5", "T3", "T1", "T1-General"],
        env="CA_FORMS"
    )
    uk_forms: List[str] = Field(
        default=["P60", "P45", "SA100", "SA302"],
        env="UK_FORMS"
    )
    au_forms: List[str] = Field(
        default=["PAYG", "Group Certificate"],
        env="AU_FORMS"
    )

    # Data Validation Configuration
    amount_min: float = Field(default=0.01, env="AMOUNT_MIN")
    amount_max: float = Field(default=999999999.99, env="AMOUNT_MAX")
    date_min_year: int = Field(default=1900, env="DATE_MIN_YEAR")
    date_max_year: int = Field(default=2030, env="DATE_MAX_YEAR")

    # Logging Configuration
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")
    log_file: str = Field(default="logs/file-processing.log", env="LOG_FILE")
    sentry_dsn: Optional[str] = Field(default=None, env="SENTRY_DSN")

    # CORS Configuration
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "https://globaltaxcalc.com"],
        env="CORS_ORIGINS"
    )
    cors_allow_credentials: bool = Field(default=True, env="CORS_ALLOW_CREDENTIALS")

    # Rate Limiting
    rate_limit_enabled: bool = Field(default=True, env="RATE_LIMIT_ENABLED")
    rate_limit_requests: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    rate_limit_window: int = Field(default=3600, env="RATE_LIMIT_WINDOW")

    # Monitoring
    prometheus_enabled: bool = Field(default=True, env="PROMETHEUS_ENABLED")
    prometheus_port: int = Field(default=9090, env="PROMETHEUS_PORT")
    health_check_enabled: bool = Field(default=True, env="HEALTH_CHECK_ENABLED")

    # Compliance
    gdpr_compliance: bool = Field(default=True, env="GDPR_COMPLIANCE")
    auto_delete_files: bool = Field(default=True, env="AUTO_DELETE_FILES")
    audit_logging: bool = Field(default=True, env="AUDIT_LOGGING")
    pii_detection: bool = Field(default=True, env="PII_DETECTION")

    # External Services
    tax_calculator_api_url: str = Field(
        default="http://localhost:3001/api",
        env="TAX_CALCULATOR_API_URL"
    )
    notification_service_url: str = Field(
        default="http://localhost:3005/api",
        env="NOTIFICATION_SERVICE_URL"
    )
    user_service_url: str = Field(
        default="http://localhost:3002/api",
        env="USER_SERVICE_URL"
    )

    @validator("allowed_extensions", pre=True)
    def parse_extensions(cls, v):
        if isinstance(v, str):
            return [ext.strip().lower() for ext in v.split(",")]
        return v

    @validator("supported_countries", pre=True)
    def parse_countries(cls, v):
        if isinstance(v, str):
            return [country.strip().upper() for country in v.split(",")]
        return v

    @validator("us_forms", "ca_forms", "uk_forms", "au_forms", pre=True)
    def parse_forms(cls, v):
        if isinstance(v, str):
            return [form.strip() for form in v.split(",")]
        return v

    @validator("cors_origins", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @validator("max_file_size")
    def parse_file_size(cls, v):
        """Convert file size string to bytes"""
        if isinstance(v, str):
            v = v.upper().replace(" ", "")
            if v.endswith("MB"):
                return int(v[:-2]) * 1024 * 1024
            elif v.endswith("KB"):
                return int(v[:-2]) * 1024
            elif v.endswith("GB"):
                return int(v[:-2]) * 1024 * 1024 * 1024
            else:
                return int(v)
        return v

    @validator("upload_directory", "temp_directory", pre=True)
    def create_directories(cls, v):
        """Ensure directories exist"""
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return path

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Form type configurations
FORM_CONFIGS = {
    "US": {
        "W-2": {
            "fields": {
                "employee_name": {"box": "e", "required": True},
                "employee_ssn": {"box": "a", "required": True},
                "employer_name": {"box": "c", "required": True},
                "employer_ein": {"box": "b", "required": True},
                "wages": {"box": "1", "required": True, "type": "amount"},
                "federal_tax": {"box": "2", "required": True, "type": "amount"},
                "social_security_wages": {"box": "3", "required": False, "type": "amount"},
                "social_security_tax": {"box": "4", "required": False, "type": "amount"},
                "medicare_wages": {"box": "5", "required": False, "type": "amount"},
                "medicare_tax": {"box": "6", "required": False, "type": "amount"},
                "state_wages": {"box": "16", "required": False, "type": "amount"},
                "state_tax": {"box": "17", "required": False, "type": "amount"}
            }
        },
        "1099-MISC": {
            "fields": {
                "payer_name": {"box": "1", "required": True},
                "payer_tin": {"box": "2", "required": True},
                "recipient_name": {"box": "4", "required": True},
                "recipient_tin": {"box": "3", "required": True},
                "nonemployee_compensation": {"box": "1", "required": False, "type": "amount"},
                "rents": {"box": "1", "required": False, "type": "amount"},
                "royalties": {"box": "2", "required": False, "type": "amount"},
                "other_income": {"box": "3", "required": False, "type": "amount"},
                "federal_tax": {"box": "4", "required": False, "type": "amount"}
            }
        }
    },
    "CA": {
        "T4": {
            "fields": {
                "employee_name": {"box": "12", "required": True},
                "employee_sin": {"box": "11", "required": True},
                "employer_name": {"box": "10", "required": True},
                "employer_account": {"box": "54", "required": True},
                "employment_income": {"box": "14", "required": True, "type": "amount"},
                "income_tax": {"box": "22", "required": True, "type": "amount"},
                "cpp_pensionable": {"box": "26", "required": False, "type": "amount"},
                "cpp_contributions": {"box": "16", "required": False, "type": "amount"},
                "ei_insurable": {"box": "24", "required": False, "type": "amount"},
                "ei_premiums": {"box": "18", "required": False, "type": "amount"}
            }
        }
    },
    "UK": {
        "P60": {
            "fields": {
                "employee_name": {"section": "1", "required": True},
                "employee_nino": {"section": "2", "required": True},
                "employer_name": {"section": "3", "required": True},
                "employer_paye": {"section": "4", "required": True},
                "total_pay": {"section": "1a", "required": True, "type": "amount"},
                "total_tax": {"section": "1b", "required": True, "type": "amount"},
                "student_loan": {"section": "1c", "required": False, "type": "amount"},
                "tax_code": {"section": "1d", "required": False}
            }
        }
    }
}

# OCR preprocessing configurations
OCR_PREPROCESSING = {
    "denoise": True,
    "deskew": True,
    "contrast_enhancement": True,
    "resolution_enhancement": True,
    "edge_detection": False,
    "morphology": True
}

# Supported image formats for conversion
IMAGE_FORMATS = {
    "pdf": {"convert": True, "dpi": 300},
    "jpg": {"convert": False},
    "jpeg": {"convert": False},
    "png": {"convert": False},
    "tiff": {"convert": False},
    "tif": {"convert": False}
}

# Create global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings"""
    return settings
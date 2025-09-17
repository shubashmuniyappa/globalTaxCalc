from pydantic_settings import BaseSettings
from typing import Optional, List
import os
from pathlib import Path


class Settings(BaseSettings):
    # Application settings
    app_name: str = "GlobalTaxCalc AI Service"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8003
    workers: int = 1

    # API settings
    api_prefix: str = "/api/v1"
    docs_url: str = "/docs"
    redoc_url: str = "/redoc"
    openapi_url: str = "/openapi.json"

    # Security settings
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS settings
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    allowed_methods: List[str] = ["*"]
    allowed_headers: List[str] = ["*"]

    # Database settings
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "globaltaxcalc_ai"

    # Redis settings
    redis_url: str = "redis://localhost:6379"
    redis_db: int = 0
    cache_ttl: int = 3600  # 1 hour

    # AI Model settings
    huggingface_token: Optional[str] = None
    openai_api_key: Optional[str] = None
    model_cache_dir: str = "./models"

    # Llama model settings
    llama_model_name: str = "microsoft/DialoGPT-medium"  # Fallback for now
    llama_max_length: int = 512
    llama_temperature: float = 0.7
    llama_top_p: float = 0.9

    # OpenAI settings (fallback)
    openai_model: str = "gpt-3.5-turbo"
    openai_max_tokens: int = 500
    openai_temperature: float = 0.7

    # Voice processing settings
    whisper_model: str = "base"
    max_audio_duration: int = 300  # 5 minutes
    supported_audio_formats: List[str] = ["wav", "mp3", "m4a", "flac"]

    # Response settings
    max_response_time: float = 3.0  # seconds
    confidence_threshold: float = 0.7
    max_suggestions: int = 5

    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_period: int = 3600  # 1 hour

    # Logging settings
    log_level: str = "INFO"
    log_format: str = "json"

    # External services
    geolocation_service_url: str = "http://localhost:3001/api"
    tax_engine_service_url: str = "http://localhost:3002/api"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()

# Ensure model cache directory exists
os.makedirs(settings.model_cache_dir, exist_ok=True)
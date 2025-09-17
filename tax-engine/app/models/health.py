"""
Pydantic models for health check and system monitoring
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Basic health check response"""
    status: str = Field(..., description="Overall health status")
    timestamp: float = Field(..., description="Health check timestamp")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Environment name")
    components: Optional[Dict[str, str]] = Field(None, description="Component health status")
    error: Optional[str] = Field(None, description="Error message if unhealthy")


class SystemInfo(BaseModel):
    """Detailed system information"""
    status: str = Field(..., description="Overall system status")
    timestamp: float = Field(..., description="System check timestamp")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Environment name")

    system: Dict[str, Any] = Field(..., description="System metrics")
    cache: Dict[str, Any] = Field(..., description="Cache information")
    tax_engine: Dict[str, Any] = Field(..., description="Tax engine statistics")


class ComponentHealth(BaseModel):
    """Individual component health status"""
    name: str = Field(..., description="Component name")
    status: str = Field(..., description="Component status")
    last_check: float = Field(..., description="Last health check timestamp")
    response_time_ms: Optional[float] = Field(None, description="Response time in milliseconds")
    error: Optional[str] = Field(None, description="Error message if unhealthy")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional component metadata")
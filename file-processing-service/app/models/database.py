"""
Database models for the File Processing Service
"""
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    Column, String, DateTime, Integer, Float, Boolean, Text, JSON,
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class ProcessingStatus(str, Enum):
    """File processing status enumeration"""
    UPLOADED = "uploaded"
    SCANNING = "scanning"
    PROCESSING = "processing"
    EXTRACTING = "extracting"
    VALIDATING = "validating"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


class FormType(str, Enum):
    """Supported form types"""
    W2 = "W-2"
    F1099_MISC = "1099-MISC"
    F1099_INT = "1099-INT"
    F1099_DIV = "1099-DIV"
    T4 = "T4"
    T4A = "T4A"
    P60 = "P60"
    P45 = "P45"
    UNKNOWN = "unknown"


class ConfidenceLevel(str, Enum):
    """Confidence levels for extracted data"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    MANUAL_REVIEW = "manual_review"


class FileUpload(Base):
    """File upload record"""
    __tablename__ = "file_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=False)
    encrypted_path = Column(String(500), nullable=True)

    # Processing information
    status = Column(String(20), nullable=False, default=ProcessingStatus.UPLOADED)
    job_id = Column(String(100), nullable=True, index=True)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_duration = Column(Float, nullable=True)  # seconds

    # Security and compliance
    virus_scan_result = Column(String(20), nullable=True)  # clean, infected, error
    virus_scan_details = Column(Text, nullable=True)
    is_encrypted = Column(Boolean, default=False)
    encryption_key_id = Column(String(100), nullable=True)

    # Metadata
    upload_ip = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(String(500), nullable=True)
    country_code = Column(String(2), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    processing_jobs = relationship("ProcessingJob", back_populates="file_upload", cascade="all, delete-orphan")
    extracted_data = relationship("ExtractedData", back_populates="file_upload", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="file_upload", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_file_uploads_user_status', 'user_id', 'status'),
        Index('idx_file_uploads_created_at', 'created_at'),
        Index('idx_file_uploads_expires_at', 'expires_at'),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "file_type": self.file_type,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processing_duration": self.processing_duration
        }


class ProcessingJob(Base):
    """Background processing job record"""
    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_upload_id = Column(UUID(as_uuid=True), ForeignKey("file_uploads.id"), nullable=False)
    job_id = Column(String(100), nullable=False, unique=True, index=True)
    job_type = Column(String(50), nullable=False)  # ocr, extraction, validation

    # Job status and progress
    status = Column(String(20), nullable=False, default="pending")
    progress = Column(Integer, default=0)  # 0-100
    current_step = Column(String(100), nullable=True)
    total_steps = Column(Integer, default=1)

    # Results and errors
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Float, nullable=True)  # seconds
    estimated_duration = Column(Float, nullable=True)  # seconds

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    file_upload = relationship("FileUpload", back_populates="processing_jobs")

    # Indexes
    __table_args__ = (
        Index('idx_processing_jobs_status', 'status'),
        Index('idx_processing_jobs_created_at', 'created_at'),
    )


class ExtractedData(Base):
    """Extracted data from processed documents"""
    __tablename__ = "extracted_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_upload_id = Column(UUID(as_uuid=True), ForeignKey("file_uploads.id"), nullable=False)

    # Form identification
    detected_form_type = Column(String(50), nullable=True)
    form_confidence = Column(Float, nullable=True)  # 0.0 - 1.0
    country_code = Column(String(2), nullable=True)
    tax_year = Column(Integer, nullable=True)

    # Raw OCR data
    raw_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    page_count = Column(Integer, default=1)

    # Structured extracted fields
    extracted_fields = Column(JSON, nullable=True)  # Field name -> value mapping
    field_confidences = Column(JSON, nullable=True)  # Field name -> confidence mapping
    field_locations = Column(JSON, nullable=True)  # Field name -> bounding box mapping

    # Validation results
    validation_results = Column(JSON, nullable=True)
    validation_errors = Column(JSON, nullable=True)
    overall_confidence = Column(String(20), nullable=True)  # high, medium, low, manual_review
    requires_manual_review = Column(Boolean, default=False)

    # Processing metadata
    processing_version = Column(String(20), nullable=True)
    extraction_method = Column(String(50), nullable=True)  # tesseract, manual, hybrid

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    file_upload = relationship("FileUpload", back_populates="extracted_data")
    field_extractions = relationship("FieldExtraction", back_populates="extracted_data", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_extracted_data_form_type', 'detected_form_type'),
        Index('idx_extracted_data_confidence', 'overall_confidence'),
        Index('idx_extracted_data_review', 'requires_manual_review'),
    )


class FieldExtraction(Base):
    """Individual field extraction details"""
    __tablename__ = "field_extractions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    extracted_data_id = Column(UUID(as_uuid=True), ForeignKey("extracted_data.id"), nullable=False)

    # Field information
    field_name = Column(String(100), nullable=False)
    field_type = Column(String(50), nullable=False)  # text, amount, date, ssn, ein
    raw_value = Column(Text, nullable=True)
    cleaned_value = Column(Text, nullable=True)
    formatted_value = Column(Text, nullable=True)

    # Confidence and validation
    confidence = Column(Float, nullable=True)  # 0.0 - 1.0
    confidence_level = Column(String(20), nullable=True)  # high, medium, low
    is_valid = Column(Boolean, nullable=True)
    validation_errors = Column(JSON, nullable=True)

    # Location information
    bounding_box = Column(JSON, nullable=True)  # {x, y, width, height}
    page_number = Column(Integer, default=1)

    # Processing metadata
    extraction_method = Column(String(50), nullable=True)
    alternatives = Column(JSON, nullable=True)  # Alternative values with confidences

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    extracted_data = relationship("ExtractedData", back_populates="field_extractions")

    # Indexes
    __table_args__ = (
        Index('idx_field_extractions_field_name', 'field_name'),
        Index('idx_field_extractions_confidence', 'confidence_level'),
    )


class AuditLog(Base):
    """Audit log for file processing operations"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_upload_id = Column(UUID(as_uuid=True), ForeignKey("file_uploads.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Event information
    event_type = Column(String(50), nullable=False)  # upload, process, delete, access
    event_description = Column(String(500), nullable=False)
    event_details = Column(JSON, nullable=True)

    # Request context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(100), nullable=True)

    # Security and compliance
    sensitive_data_accessed = Column(Boolean, default=False)
    gdpr_relevant = Column(Boolean, default=False)
    retention_period_days = Column(Integer, nullable=True)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    file_upload = relationship("FileUpload", back_populates="audit_logs")

    # Indexes
    __table_args__ = (
        Index('idx_audit_logs_event_type', 'event_type'),
        Index('idx_audit_logs_created_at', 'created_at'),
        Index('idx_audit_logs_user_id', 'user_id'),
        Index('idx_audit_logs_sensitive', 'sensitive_data_accessed'),
    )


class ProcessingStatistics(Base):
    """Processing statistics for monitoring and optimization"""
    __tablename__ = "processing_statistics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Time period
    date = Column(DateTime(timezone=True), nullable=False)
    hour = Column(Integer, nullable=True)  # 0-23 for hourly stats

    # File statistics
    total_files_uploaded = Column(Integer, default=0)
    total_files_processed = Column(Integer, default=0)
    total_files_failed = Column(Integer, default=0)
    total_file_size = Column(Integer, default=0)  # bytes

    # Processing performance
    average_processing_time = Column(Float, nullable=True)  # seconds
    median_processing_time = Column(Float, nullable=True)  # seconds
    max_processing_time = Column(Float, nullable=True)  # seconds

    # Form type breakdown
    form_type_counts = Column(JSON, nullable=True)  # form_type -> count

    # Confidence distribution
    high_confidence_count = Column(Integer, default=0)
    medium_confidence_count = Column(Integer, default=0)
    low_confidence_count = Column(Integer, default=0)
    manual_review_count = Column(Integer, default=0)

    # Error statistics
    ocr_errors = Column(Integer, default=0)
    extraction_errors = Column(Integer, default=0)
    validation_errors = Column(Integer, default=0)
    virus_scan_errors = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index('idx_processing_statistics_date', 'date'),
        UniqueConstraint('date', 'hour', name='uq_processing_statistics_date_hour'),
    )


class FormTemplate(Base):
    """Form templates for recognition and extraction"""
    __tablename__ = "form_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Form identification
    form_type = Column(String(50), nullable=False, index=True)
    country_code = Column(String(2), nullable=False)
    form_version = Column(String(20), nullable=True)
    tax_year = Column(Integer, nullable=True)

    # Template definition
    template_data = Column(JSON, nullable=False)  # Field definitions and locations
    field_mappings = Column(JSON, nullable=False)  # Field name mappings
    validation_rules = Column(JSON, nullable=True)  # Validation rules for fields

    # Recognition patterns
    recognition_patterns = Column(JSON, nullable=True)  # Patterns for form identification
    confidence_weights = Column(JSON, nullable=True)  # Weights for confidence calculation

    # Metadata
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher priority templates checked first
    description = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index('idx_form_templates_type_country', 'form_type', 'country_code'),
        Index('idx_form_templates_active', 'is_active'),
    )
"""Base document model with common fields for all document types"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    """Supported document types"""
    FUEL_RECEIPT = "fuel_receipt"
    TAX_INVOICE = "tax_invoice"
    TRAVEL_DOC = "travel_doc"
    ODOMETER = "odometer"
    UNKNOWN = "unknown"


class ValidationSeverity(str, Enum):
    """Validation warning severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationFlag(BaseModel):
    """Single validation result/warning"""
    field: str = Field(..., description="Field name that has validation issue")
    severity: ValidationSeverity = Field(..., description="Severity level")
    message: str = Field(..., description="Human-readable validation message")
    auto_fixed: bool = Field(default=False, description="Whether issue was auto-fixed")
    suggested_value: Optional[Any] = Field(None, description="Suggested correct value")


class BaseDocumentData(BaseModel):
    """
    Base document model with common fields shared across all document types

    All specific document models (FuelReceiptData, TaxInvoiceData, etc.)
    should inherit from this base class.
    """

    # Document Metadata
    document_type: DocumentType = Field(
        ...,
        description="Type of document detected"
    )
    document_id: Optional[str] = Field(
        None,
        description="Unique document identifier from OCR (invoice number, receipt number, etc.)"
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="AI confidence in extraction accuracy (0.0 to 1.0)"
    )

    # User Context
    user_id: Optional[str] = Field(
        None,
        description="LINE User ID who submitted the document"
    )
    user_display_name: Optional[str] = Field(
        None,
        description="Display name of user who submitted"
    )
    submitted_at: Optional[str] = Field(
        None,
        description="Timestamp when document was submitted (ISO format)"
    )

    # Raw Data
    ocr_raw_text: Optional[str] = Field(
        None,
        description="Raw OCR text for debugging and validation"
    )

    # Validation Results
    validation_flags: List[ValidationFlag] = Field(
        default_factory=list,
        description="List of validation warnings and errors"
    )
    is_valid: bool = Field(
        default=True,
        description="Whether document passed all validations"
    )

    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "document_type": "fuel_receipt",
                "document_id": "12345",
                "confidence_score": 0.95,
                "user_id": "U1234567890",
                "user_display_name": "Driver Name",
                "submitted_at": "2025-03-19T10:30:00Z",
                "validation_flags": [],
                "is_valid": True
            }
        }

    def add_validation_flag(
        self,
        field: str,
        severity: ValidationSeverity,
        message: str,
        auto_fixed: bool = False,
        suggested_value: Any = None
    ) -> None:
        """
        Add a validation flag to this document

        Args:
            field: Field name with validation issue
            severity: Severity level (info, warning, error, critical)
            message: Human-readable validation message
            auto_fixed: Whether the issue was automatically fixed
            suggested_value: Suggested correct value if applicable
        """
        flag = ValidationFlag(
            field=field,
            severity=severity,
            message=message,
            auto_fixed=auto_fixed,
            suggested_value=suggested_value
        )
        self.validation_flags.append(flag)

        # Update is_valid based on severity
        if severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]:
            self.is_valid = False

    def get_critical_flags(self) -> List[ValidationFlag]:
        """Get only critical and error validation flags"""
        return [f for f in self.validation_flags
                if f.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]]

    def get_warnings(self) -> List[ValidationFlag]:
        """Get warning and info validation flags"""
        return [f for f in self.validation_flags
                if f.severity in [ValidationSeverity.WARNING, ValidationSeverity.INFO]]

    def has_validation_issues(self) -> bool:
        """Check if document has any validation issues"""
        return len(self.validation_flags) > 0

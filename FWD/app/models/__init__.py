"""Document Models Package - Exports all document type models"""

# Base models
from .base_document import (
    BaseDocumentData,
    DocumentType,
    ValidationSeverity,
    ValidationFlag
)

# Specific document models
from .receipt_data import FuelReceiptData, ReceiptData, ReceiptResponse
from .tax_invoice import TaxInvoiceData, InvoiceLineItem
from .travel_doc import TravelDocumentData
from .odometer import OdometerReadingData

__all__ = [
    # Base
    "BaseDocumentData",
    "DocumentType",
    "ValidationSeverity",
    "ValidationFlag",

    # Documents
    "FuelReceiptData",
    "ReceiptData",  # Backward compatibility alias
    "TaxInvoiceData",
    "TravelDocumentData",
    "OdometerReadingData",

    # Response
    "ReceiptResponse",

    # Sub-models
    "InvoiceLineItem",
]

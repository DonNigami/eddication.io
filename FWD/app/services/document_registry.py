"""Document Registry - Central registry for document type configuration and routing"""
from typing import Dict, Type, List
from app.models.base_document import BaseDocumentData, DocumentType
from app.models.receipt_data import FuelReceiptData
from app.models.tax_invoice import TaxInvoiceData
from app.models.travel_doc import TravelDocumentData
from app.models.odometer import OdometerReadingData


class DocumentRegistry:
    """
    Central registry for document type models, prompts, and configuration

    This class provides a single source of truth for:
    - Which Pydantic model to use for each document type
    - What AI prompt to use for extraction
    - Which fields are required for validation
    - Whether a document type is enabled
    """

    # ============ Model Registry ============
    MODELS: Dict[DocumentType, Type[BaseDocumentData]] = {
        DocumentType.FUEL_RECEIPT: FuelReceiptData,
        DocumentType.TAX_INVOICE: TaxInvoiceData,
        DocumentType.TRAVEL_DOC: TravelDocumentData,
        DocumentType.ODOMETER: OdometerReadingData,
    }

    # ============ AI Prompts ============
    PROMPTS: Dict[DocumentType, str] = {
        DocumentType.FUEL_RECEIPT: """You are a Thai fuel receipt OCR specialist for gas stations.

Extract ALL information from the fuel receipt image including:
- Station name (PT, Shell, PTT, etc.)
- Date and time of purchase
- Pump number
- Fuel type (ดีเซล/แก๊สโซฮล/E85/E20/etc.)
- Liters (amount of fuel)
- Price per liter
- Total amount
- License plate (if shown)
- Odometer reading (if shown)
- Receipt number

IMPORTANT: Return ONLY valid JSON matching this schema:
{
  "document_type": "fuel_receipt",
  "station_name": "...",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "pump_number": "...",
  "fuel_type": "...",
  "liters": 0.00,
  "price_per_liter": 0.00,
  "total_amount": 0.00,
  "license_plate": "...",
  "odometer_reading": 0.00,
  "receipt_number": "...",
  "payment_method": "...",
  "confidence_score": 0.95
}

Handle Thai text properly. For numbers, extract only digits (no commas, spaces).""",

        DocumentType.TAX_INVOICE: """You are a Thai tax invoice (ใบกำกับภาษี) OCR specialist.

Extract ALL information from the tax invoice including:

HEADER:
- Invoice number (เลขที่)
- Invoice date (วันที่)
- Due date (วันครบกำหนด)

VENDOR (ผู้ขาย):
- Vendor name (ชื่อผู้ขาย)
- Vendor Tax ID (เลขประจำตัวผู้เสียภาษี - 13 digits)
- Vendor branch (สาขาเลขที่)
- Vendor address

CUSTOMER (ผู้ซื้อ):
- Customer name
- Customer Tax ID
- Customer branch

FINANCIAL:
- Subtotal (ยอดก่อนภาษี)
- VAT amount (ภาษีมูลค่าเพิ่ม - usually 7%)
- VAT rate (อัตราภาษี)
- Total amount (ยอดรวมทั้งสิ้น)

LINE ITEMS:
- Description (รายการ)
- Quantity (จำนวน)
- Unit price (ราคาต่อหน่วย)
- Amount (จำนวนเงิน)

Return ONLY valid JSON matching the schema:
{
  "document_type": "tax_invoice",
  "invoice_number": "...",
  "invoice_date": "YYYY-MM-DD",
  "vendor_name": "...",
  "vendor_tax_id": "...",
  "subtotal": 0.00,
  "vat_amount": 0.00,
  "total_amount": 0.00,
  "line_items": [
    {
      "description": "...",
      "quantity": 0.00,
      "unit_price": 0.00,
      "amount": 0.00
    }
  ],
  "confidence_score": 0.95
}

CRITICAL: Verify that VAT is approximately 7% of subtotal. If not, add a warning.""",

        DocumentType.TRAVEL_DOC: """You are a travel document OCR specialist.

First, detect the TYPE of travel document:
- Boarding pass (บัตรโดยสารเครื่องบิน)
- Hotel booking (ใบจองโรงแรม)
- Train ticket (ตั๋วรถไฟ)
- Bus ticket (ตั๋วรถบัส)
- E-ticket (ตั๋วอิเล็กทรอนิกส์)

Then extract ALL relevant information:

COMMON FIELDS:
- Passenger name
- Booking reference / PNR / Confirmation code
- Ticket number

FOR FLIGHTS:
- Airline
- Flight number
- Origin airport/city
- Destination airport/city
- Departure date and time
- Arrival date and time
- Seat number
- Class (Economy/Business/First)

FOR HOTELS:
- Hotel name
- Hotel address
- Check-in date
- Check-out date
- Room type

FOR TRAINS/BUSES:
- Company name
- Train/Bus number
- Origin
- Destination
- Departure date and time
- Arrival date and time
- Seat number

FINANCIAL:
- Total amount
- Currency (THB, USD, etc.)
- Taxes and fees

Return ONLY valid JSON matching the schema:
{
  "document_type": "travel_doc",
  "travel_doc_type": "boarding_pass|hotel_booking|train_ticket|bus_ticket",
  "passenger_name": "...",
  "airline": "...",
  "flight_number": "...",
  "origin": "...",
  "destination": "...",
  "departure_date": "YYYY-MM-DD",
  "departure_time": "HH:MM",
  "arrival_date": "YYYY-MM-DD",
  "arrival_time": "HH:MM",
  "seat_number": "...",
  "class_code": "...",
  "booking_reference": "...",
  "ticket_number": "...",
  "total_amount": 0.00,
  "currency": "...",
  "confidence_score": 0.95
}

Handle multi-language text (Thai/English).""",

        DocumentType.ODOMETER: """You are an odometer reading OCR specialist.

Extract the following information from the odometer display:

REQUIRED FIELDS:
- License plate number (ทะเบียนรถ)
- Current odometer reading (เลขไมล์ปัจจุบัน)

OPTIONAL FIELDS:
- Date (if visible)
- Location (if mentioned)
- Vehicle type (if visible)

IMPORTANT INSTRUCTIONS:
- Extract ONLY the numeric digits for odometer reading
- Do NOT include units, commas, or spaces
- For example: "125450" not "125,450 km" or "125450 กม."

Return ONLY valid JSON matching the schema:
{
  "document_type": "odometer",
  "license_plate": "...",
  "current_reading": 125450.5,
  "reading_date": "YYYY-MM-DD",
  "location": "...",
  "vehicle_type": "...",
  "confidence_score": 0.98
}

Focus on accurately reading the digits from analog or digital displays."""
    }

    # ============ Required Fields for Validation ============
    REQUIRED_FIELDS: Dict[DocumentType, List[str]] = {
        DocumentType.FUEL_RECEIPT: ["station_name", "total_amount"],
        DocumentType.TAX_INVOICE: ["invoice_number", "vendor_name", "total_amount"],
        DocumentType.TRAVEL_DOC: ["passenger_name"],  # Minimum requirement
        DocumentType.ODOMETER: ["license_plate", "current_reading"],
    }

    # ============ Display Names ============
    DISPLAY_NAMES: Dict[DocumentType, str] = {
        DocumentType.FUEL_RECEIPT: "Fuel Receipt (บิลน้ำมัน)",
        DocumentType.TAX_INVOICE: "Tax Invoice (ใบกำกับภาษี)",
        DocumentType.TRAVEL_DOC: "Travel Document (เอกสารการเดินทาง)",
        DocumentType.ODOMETER: "Odometer Reading (เลขไมล์)",
    }

    @classmethod
    def get_model(cls, doc_type: DocumentType) -> Type[BaseDocumentData]:
        """
        Get Pydantic model for document type

        Args:
            doc_type: Document type enum

        Returns:
            Type[BaseDocumentData]: Pydantic model class for the document type

        Raises:
            KeyError: If document type is not registered
        """
        if doc_type not in cls.MODELS:
            raise ValueError(f"Unknown document type: {doc_type}. "
                           f"Available types: {list(cls.MODELS.keys())}")
        return cls.MODELS[doc_type]

    @classmethod
    def get_prompt(cls, doc_type: DocumentType) -> str:
        """
        Get AI prompt for document type

        Args:
            doc_type: Document type enum

        Returns:
            str: AI prompt for extraction
        """
        return cls.PROMPTS.get(doc_type, "")

    @classmethod
    def get_required_fields(cls, doc_type: DocumentType) -> List[str]:
        """
        Get required fields for document type validation

        Args:
            doc_type: Document type enum

        Returns:
            list: List of required field names
        """
        return cls.REQUIRED_FIELDS.get(doc_type, [])

    @classmethod
    def is_enabled(cls, doc_type: DocumentType, enabled_types: List[str]) -> bool:
        """
        Check if document type is enabled

        Args:
            doc_type: Document type enum
            enabled_types: List of enabled document type strings from config

        Returns:
            bool: True if document type is enabled
        """
        return doc_type.value in enabled_types

    @classmethod
    def get_display_name(cls, doc_type: DocumentType) -> str:
        """
        Get human-readable display name for document type

        Args:
            doc_type: Document type enum

        Returns:
            str: Display name in Thai/English
        """
        return cls.DISPLAY_NAMES.get(doc_type, doc_type.value)

    @classmethod
    def get_all_document_types(cls) -> List[DocumentType]:
        """
        Get all registered document types

        Returns:
            list[DocumentType]: List of all document type enums
        """
        return list(cls.MODELS.keys())

    @classmethod
    def detect_document_type(
        cls,
        image_bytes: bytes,
        ai_client
    ) -> DocumentType:
        """
        Detect document type from image using AI

        This is a placeholder for future implementation.
        For now, returns UNKNOWN and relies on AI to detect.

        Args:
            image_bytes: Raw image data
            ai_client: AI vision client

        Returns:
            DocumentType: Detected document type
        """
        # TODO: Implement AI-based type detection
        # For now, let the AI prompt handle detection
        return DocumentType.UNKNOWN

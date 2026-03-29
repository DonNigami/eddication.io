"""Fuel Receipt document model - Refactored to extend BaseDocumentData"""
from pydantic import BaseModel, Field
from typing import Optional
from .base_document import BaseDocumentData, DocumentType


class FuelReceiptData(BaseDocumentData):
    """
    Fuel Receipt data model with validation

    This model represents the structured data extracted from a fuel receipt image
    by the AI Vision API (Gemini or OpenAI).

    Extends BaseDocumentData to inherit common fields like document_type,
    confidence_score, validation_flags, etc.
    """

    document_type: DocumentType = DocumentType.FUEL_RECEIPT

    # ============ Customer Information ============
    customer_name: Optional[str] = Field(
        None,
        description="Customer name or account number"
    )
    tax_id: Optional[str] = Field(
        None,
        description="Tax ID or company registration number"
    )
    cost_center: Optional[str] = Field(
        None,
        description="Cost center code for accounting"
    )
    department: Optional[str] = Field(
        None,
        description="Department or section name"
    )
    project_code: Optional[str] = Field(
        None,
        description="Project code or reference"
    )

    # ============ Vehicle Information ============
    license_plate: Optional[str] = Field(
        None,
        description="Vehicle license plate number"
    )
    odometer_reading: Optional[float] = Field(
        None,
        ge=0,
        description="Odometer/mileage reading"
    )
    driver_name: Optional[str] = Field(
        None,
        description="Driver name (if different from customer)"
    )
    vehicle_type: Optional[str] = Field(
        None,
        description="Vehicle type (e.g., รถบรรทุก 10 ล้อ, รถเทรลเลอร์)"
    )

    # ============ Station Information ============
    station_name: Optional[str] = Field(
        None,
        description="Name of the gas station (e.g., PT, Shell, PTT)"
    )

    # ============ Date and Time ============
    date: Optional[str] = Field(
        None,
        description="Date of fuel purchase in YYYY-MM-DD format"
    )
    time: Optional[str] = Field(
        None,
        description="Time of fuel purchase in HH:MM format"
    )

    # ============ Pump Information ============
    pump_number: Optional[str] = Field(
        None,
        description="Pump number identifier (e.g., A1, B2)"
    )

    # ============ Fuel Details ============
    fuel_type: Optional[str] = Field(
        None,
        description="Type of fuel (e.g., ดีเซล, แก๊สโซฮล, E85)"
    )
    liters: Optional[float] = Field(
        None,
        ge=0,
        description="Amount of fuel in liters"
    )
    price_per_liter: Optional[float] = Field(
        None,
        ge=0,
        description="Price per liter in THB"
    )

    # ============ Payment Information ============
    total_amount: Optional[float] = Field(
        None,
        ge=0,
        description="Total amount paid in THB"
    )
    payment_method: Optional[str] = Field(
        None,
        description="Payment method (e.g., เงินสด, บัตรเครดิต)"
    )

    # ============ Additional Information ============
    receipt_number: Optional[str] = Field(
        None,
        description="Receipt transaction number"
    )
    ocr_raw_text: Optional[str] = Field(
        None,
        description="Raw OCR text for debugging purposes"
    )

    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "document_type": "fuel_receipt",
                "customer_name": "บริษัท ขนส่ง จำกัด",
                "tax_id": "0105551234567",
                "cost_center": "CC-001",
                "department": "ขนส่งสินค้า",
                "project_code": "PRJ-2025-001",
                "license_plate": "70-1234",
                "odometer_reading": 125000.0,
                "driver_name": "สมชาย ใจดี",
                "vehicle_type": "รถบรรทุก 10 ล้อ",
                "station_name": "PT GAS STATION",
                "date": "2025-03-18",
                "time": "14:30",
                "pump_number": "A1",
                "fuel_type": "ดีเซล",
                "liters": 35.50,
                "price_per_liter": 35.50,
                "total_amount": 1260.25,
                "payment_method": "เงินสด",
                "receipt_number": "12345",
                "confidence_score": 0.95
            }
        }

    def get_summary(self) -> str:
        """
        Get a human-readable summary of the receipt

        Returns:
            str: Formatted receipt summary
        """
        summary_lines = [
            "📄 **Fuel Receipt Summary**",
            f"👤 Customer: {self.customer_name or 'N/A'}",
            f"👤 Submitted by: {self.user_display_name or 'N/A'}",
            f"🚗 License Plate: {self.license_plate or 'N/A'}",
            f"⛽ Station: {self.station_name or 'N/A'}",
            f"📅 Date: {self.date or 'N/A'}",
            f"⏰ Time: {self.time or 'N/A'}",
            f"🔢 Pump: {self.pump_number or 'N/A'}",
            f"⚡ Fuel: {self.fuel_type or 'N/A'}",
            f"📊 Liters: {self.liters or 'N/A'}",
            f"💰 Price/Liter: ฿{self.price_per_liter or 'N/A'}",
            f"💵 Total: ฿{self.total_amount or 'N/A'}",
            f"💳 Payment: {self.payment_method or 'N/A'}",
            f"🧾 Receipt No: {self.receipt_number or 'N/A'}",
        ]

        # Add validation warnings if any
        if self.validation_flags:
            summary_lines.append("\n⚠️ **Validation Warnings:**")
            for flag in self.get_critical_flags():
                summary_lines.append(f"  ❌ {flag.field}: {flag.message}")
            for flag in self.get_warnings():
                summary_lines.append(f"  ⚠️ {flag.field}: {flag.message}")

        return "\n".join(summary_lines)


# Keep backward compatibility alias
ReceiptData = FuelReceiptData


class ReceiptResponse(BaseModel):
    """
    Response model for receipt processing
    """
    success: bool = Field(
        ...,
        description="Whether the receipt was processed successfully"
    )
    data: Optional[FuelReceiptData] = Field(
        None,
        description="Extracted receipt data (if successful)"
    )
    receipts: Optional[list[FuelReceiptData]] = Field(
        None,
        description="Multiple extracted receipts (if multiple detected)"
    )
    error: Optional[str] = Field(
        None,
        description="Error message (if unsuccessful)"
    )
    ai_provider: str = Field(
        ...,
        description="AI provider used for OCR (gemini or openai)"
    )
    processing_time: Optional[float] = Field(
        None,
        description="Processing time in seconds"
    )
    receipt_count: int = Field(
        1,
        description="Number of receipts detected (1 for single, >1 for multiple)"
    )

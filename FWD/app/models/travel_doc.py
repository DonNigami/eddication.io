"""Travel Document model (boarding passes, hotel bookings, e-tickets)"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time
from .base_document import BaseDocumentData, DocumentType


class TravelDocumentData(BaseDocumentData):
    """
    Travel Document model for various travel-related documents

    Supports:
    - Boarding passes (บัตรโดยสารเครื่องบิน)
    - Hotel bookings (ใบจองโรงแรม)
    - Train tickets (ตั๋วรถไฟ)
    - Bus tickets (ตั๋วรถบัส)
    - E-tickets (ตั๋วอิเล็กทรอนิกส์)
    """

    document_type: DocumentType = DocumentType.TRAVEL_DOC

    # ============ Document Classification ============
    travel_doc_type: Optional[str] = Field(
        None,
        description="Type of travel document: boarding_pass, hotel_booking, train_ticket, bus_ticket, etc."
    )

    # ============ Passenger/Traveler Information ============
    passenger_name: Optional[str] = Field(
        None,
        description="Passenger/traveler name (ชื่อผู้โดยสาร)"
    )
    passenger_id: Optional[str] = Field(
        None,
        description="Passenger ID or membership number"
    )

    # ============ Flight/Travel Details ============
    airline: Optional[str] = Field(
        None,
        description="Airline code or name (สายการบิน)"
    )
    flight_number: Optional[str] = Field(
        None,
        description="Flight number (เที่ยวบันที่)"
    )
    train_number: Optional[str] = Field(
        None,
        description="Train number (ขบวนรถด่วนพิเศษ/รถด่วน)"
    )
    bus_company: Optional[str] = Field(
        None,
        description="Bus company name (บริษัทรถบัส)"
    )

    # ============ Route Information ============
    origin: Optional[str] = Field(
        None,
        description="Departure city/airport/station (ต้นทาง)"
    )
    destination: Optional[str] = Field(
        None,
        description="Arrival city/airport/station (ปลายทาง)"
    )
    via: Optional[str] = Field(
        None,
        description="Connecting city/layover (เมืองที่เชื่อมต่อ)"
    )

    # ============ Date and Time ============
    departure_date: Optional[date] = Field(
        None,
        description="Departure date (วันเดินทาง)"
    )
    departure_time: Optional[time] = Field(
        None,
        description="Departure time (เวลาออกเดินทาง)"
    )
    arrival_date: Optional[date] = Field(
        None,
        description="Arrival date (วันถึงที่หมาย)"
    )
    arrival_time: Optional[time] = Field(
        None,
        description="Arrival time (เวลาถึงที่หมาย)"
    )

    # ============ Seat/Class Information ============
    seat_number: Optional[str] = Field(
        None,
        description="Seat number (เลขที่นั่ง)"
    )
    class_code: Optional[str] = Field(
        None,
        description="Class of service: Economy, Business, First, etc. (ชั้นที่นั่ง)"
    )
    cabin: Optional[str] = Field(
        None,
        description="Cabin class (Main Cabin, Business, First)"
    )

    # ============ Hotel Specific Fields ============
    hotel_name: Optional[str] = Field(
        None,
        description="Hotel name (ชื่อโรงแรม)"
    )
    hotel_address: Optional[str] = Field(
        None,
        description="Hotel address (ที่อยู่โรงแรม)"
    )
    check_in_date: Optional[date] = Field(
        None,
        description="Check-in date (วันเช็คอิน)"
    )
    check_out_date: Optional[date] = Field(
        None,
        description="Check-out date (วันเช็คเอาท์)"
    )
    room_type: Optional[str] = Field(
        None,
        description="Room type (ประเภทห้องพัก)"
    )

    # ============ Financial Information ============
    ticket_number: Optional[str] = Field(
        None,
        description="Ticket number (เลขที่ตั๋ว)"
    )
    booking_reference: Optional[str] = Field(
        None,
        description="Booking reference code/PNR (รหัสการจอง)"
    )
    total_amount: Optional[float] = Field(
        None,
        ge=0,
        description="Total ticket/booking price (ค่าโดยสาร/ค่าจอง)"
    )
    currency: Optional[str] = Field(
        None,
        description="Currency code: THB, USD, EUR, etc. (สกุลเงิน)"
    )
    taxes_fees: Optional[float] = Field(
        None,
        ge=0,
        description="Taxes and fees amount (ภาษีและค่าธรรมเนียม)"
    )

    # ============ Additional Information ============
    issuing_agent: Optional[str] = Field(
        None,
        description="Agent who issued the ticket/booking"
    )
    issue_date: Optional[date] = Field(
        None,
        description="Date when ticket was issued (วันที่ออกตั๋ว)"
    )
    status: Optional[str] = Field(
        None,
        description="Booking status: Confirmed, Waitlist, Cancelled, etc."
    )

    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "document_type": "travel_doc",
                "travel_doc_type": "boarding_pass",
                "passenger_name": "สมชาย ใจดี",
                "airline": "Thai Airways",
                "flight_number": "TG201",
                "origin": "BKK (Suvarnabhumi)",
                "destination": "CNX (Chiang Mai)",
                "departure_date": "2025-03-25",
                "departure_time": "08:30",
                "arrival_date": "2025-03-25",
                "arrival_time": "09:50",
                "seat_number": "12A",
                "class_code": "Economy",
                "ticket_number": "1765432109876",
                "booking_reference": "ABC123",
                "total_amount": 2500.00,
                "currency": "THB",
                "confidence_score": 0.95
            }
        }

    def get_summary(self) -> str:
        """
        Get a human-readable summary of the travel document

        Returns:
            str: Formatted travel document summary
        """
        # Determine document type icon
        doc_icons = {
            "boarding_pass": "✈️",
            "hotel_booking": "🏨",
            "train_ticket": "🚆",
            "bus_ticket": "🚌",
            "ticket": "🎫"
        }
        icon = doc_icons.get(self.travel_doc_type, "📄")

        summary_lines = [
            f"{icon} **{self.travel_doc_type or 'Travel'} Document**",
        ]

        # Passenger info
        if self.passenger_name:
            summary_lines.append(f"👤 Passenger: {self.passenger_name}")

        # Route information
        if self.origin and self.destination:
            summary_lines.append(
                f"📍 Route: {self.origin} → {self.destination}"
            )
            if self.via:
                summary_lines.append(f"   Via: {self.via}")

        # Date/Time
        if self.departure_date:
            time_str = f" {self.departure_time}" if self.departure_time else ""
            summary_lines.append(f"📅 Departure: {self.departure_date}{time_str}")

        if self.arrival_date and self.arrival_date != self.departure_date:
            time_str = f" {self.arrival_time}" if self.arrival_time else ""
            summary_lines.append(f"📅 Arrival: {self.arrival_date}{time_str}")

        # Flight/Train/Bus details
        if self.flight_number:
            summary_lines.append(f"✈️ Flight: {self.airline or ''} {self.flight_number}")
        elif self.train_number:
            summary_lines.append(f"🚆 Train: {self.train_number}")
        elif self.bus_company:
            summary_lines.append(f"🚌 Bus: {self.bus_company}")

        # Hotel details
        if self.hotel_name:
            summary_lines.append(f"🏨 Hotel: {self.hotel_name}")
            if self.check_in_date and self.check_out_date:
                nights = (self.check_out_date - self.check_in_date).days
                summary_lines.append(
                    f"📅 Check-in: {self.check_in_date} → {self.check_out_date} ({nights} nights)"
                )

        # Seat/Class
        if self.seat_number:
            summary_lines.append(f"💺 Seat: {self.seat_number} ({self.class_code or 'Standard'})")

        # Financial
        if self.total_amount:
            currency = self.currency or "THB"
            summary_lines.append(f"💰 Amount: {currency} {self.total_amount:,.2f}")

        # Reference
        if self.booking_reference:
            summary_lines.append(f"🔖 Reference: {self.booking_reference}")
        elif self.ticket_number:
            summary_lines.append(f"🎫 Ticket: {self.ticket_number}")

        # Submission info
        if self.user_display_name:
            summary_lines.append(f"👤 Submitted by: {self.user_display_name}")

        # Validation warnings
        if self.validation_flags:
            summary_lines.append("\n⚠️ **Validation Warnings:**")
            for flag in self.get_critical_flags():
                summary_lines.append(f"  ❌ {flag.field}: {flag.message}")
            for flag in self.get_warnings():
                summary_lines.append(f"  ⚠️ {flag.field}: {flag.message}")

        return "\n".join(summary_lines)

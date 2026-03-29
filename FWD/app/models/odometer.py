"""Odometer Reading document model"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from .base_document import BaseDocumentData, DocumentType


class OdometerReadingData(BaseDocumentData):
    """
    Odometer Reading document model

    Used for tracking vehicle mileage readings for:
    - Distance traveled calculation
    - Fuel efficiency monitoring
    - Maintenance scheduling
    - Trip verification
    """

    document_type: DocumentType = DocumentType.ODOMETER

    # ============ Vehicle Information ============
    license_plate: str = Field(
        ...,
        description="Vehicle license plate number (ทะเบียนรถ)"
    )
    vehicle_type: Optional[str] = Field(
        None,
        description="Vehicle type: 10-wheel truck, trailer, semi-trailer, etc. (ประเภทรถ)"
    )

    # ============ Reading Information ============
    current_reading: float = Field(
        ...,
        ge=0,
        description="Current odometer reading in kilometers (เลขไมล์ปัจจุบัน กม.)"
    )
    previous_reading: Optional[float] = Field(
        None,
        ge=0,
        description="Previous odometer reading for distance calculation (เลขไมล์ครั้งก่อน)"
    )
    distance_traveled: Optional[float] = Field(
        None,
        ge=0,
        description="Calculated distance since last reading (ระยะทางที่ใช้ไป กม.)"
    )

    # ============ Date and Location ============
    reading_date: Optional[date] = Field(
        None,
        description="Date when reading was taken (วันที่อ่านค่าไมล์)"
    )
    location: Optional[str] = Field(
        None,
        description="Location where reading was taken (สถานที่อ่านค่าไมล์)"
    )

    # ============ Driver & Trip Context ============
    driver_name: Optional[str] = Field(
        None,
        description="Driver name (ชื่อพนักงานขับรถ)"
    )
    route: Optional[str] = Field(
        None,
        description="Route or trip description (เส้นทางการเดินทาง)"
    )
    purpose: Optional[str] = Field(
        None,
        description="Purpose of reading: Start trip, End trip, Fuel stop, etc. (วัตถุประสงค์)"
    )

    # ============ Fuel Efficiency (if available) ============
    fuel_consumed: Optional[float] = Field(
        None,
        ge=0,
        description="Fuel consumed since last reading in liters (น้ำมันที่ใช้ไป ลิตร)"
    )
    fuel_efficiency: Optional[float] = Field(
        None,
        ge=0,
        description="Fuel efficiency: km per liter or liters per 100km (อัตราสิ้นเปลืองน้ำมัน)"
    )

    # ============ Additional Information ============
    notes: Optional[str] = Field(
        None,
        description="Additional notes or comments (หมายเหตุ)"
    )
    photo_type: Optional[str] = Field(
        None,
        description="Type of photo: Dashboard, analog gauge, digital display, etc."
    )

    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "document_type": "odometer",
                "license_plate": "70-1234",
                "vehicle_type": "รถบรรทุก 10 ล้อ",
                "current_reading": 125450.5,
                "previous_reading": 125000.0,
                "distance_traveled": 450.5,
                "reading_date": "2025-03-19",
                "location": "PT Gas Station Bangkok",
                "driver_name": "สมชาย ใจดี",
                "route": "กรุงเทพฯ → ชลบุรี → กรุงเทพฯ",
                "purpose": "End trip",
                "fuel_consumed": 35.50,
                "fuel_efficiency": 12.69,
                "notes": "Normal trip, no issues",
                "confidence_score": 0.98
            }
        }

    def get_summary(self) -> str:
        """
        Get a human-readable summary of the odometer reading

        Returns:
            str: Formatted odometer summary
        """
        summary_lines = [
            "🔢 **Odometer Reading**",
            f"🚗 License Plate: {self.license_plate}",
        ]

        # Vehicle type
        if self.vehicle_type:
            summary_lines.append(f"🚚 Type: {self.vehicle_type}")

        # Current reading
        summary_lines.append(f"📊 Current Reading: {self.current_reading:,.1f} km")

        # Distance traveled
        if self.distance_traveled:
            summary_lines.append(f"📍 Distance Traveled: {self.distance_traveled:,.1f} km")

        # Previous reading
        if self.previous_reading:
            summary_lines.append(f"⬅️ Previous Reading: {self.previous_reading:,.1f} km")

        # Date and location
        if self.reading_date:
            summary_lines.append(f"📅 Date: {self.reading_date}")
        if self.location:
            summary_lines.append(f"📍 Location: {self.location}")

        # Driver info
        if self.driver_name:
            summary_lines.append(f"👤 Driver: {self.driver_name}")

        # Route
        if self.route:
            summary_lines.append(f"🛣️ Route: {self.route}")

        # Purpose
        if self.purpose:
            summary_lines.append(f"🎯 Purpose: {self.purpose}")

        # Fuel efficiency
        if self.fuel_efficiency:
            summary_lines.append(f"⛽ Fuel Efficiency: {self.fuel_efficiency:.2f} km/L")

        # Fuel consumed
        if self.fuel_consumed:
            summary_lines.append(f"⛽ Fuel Consumed: {self.fuel_consumed:.2f} liters")

        # Notes
        if self.notes:
            summary_lines.append(f"📝 Notes: {self.notes}")

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

    def calculate_distance(self) -> Optional[float]:
        """
        Calculate distance traveled from current and previous readings

        Returns:
            float: Distance in kilometers, or None if previous_reading not available
        """
        if self.previous_reading is not None:
            self.distance_traveled = self.current_reading - self.previous_reading
            return self.distance_traveled
        return None

    def calculate_fuel_efficiency(self) -> Optional[float]:
        """
        Calculate fuel efficiency in km per liter

        Returns:
            float: km per liter, or None if fuel_consumed or distance_traveled not available
        """
        if self.fuel_consumed and self.fuel_consumed > 0:
            # Ensure distance is calculated
            if not self.distance_traveled:
                self.calculate_distance()

            if self.distance_traveled and self.distance_traveled > 0:
                self.fuel_efficiency = self.distance_traveled / self.fuel_consumed
                return self.fuel_efficiency
        return None

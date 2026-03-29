"""Smart Validation Service - Business logic validation for all document types"""
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
import logging

from app.models.base_document import (
    BaseDocumentData,
    DocumentType,
    ValidationSeverity
)
from app.models.receipt_data import FuelReceiptData
from app.models.tax_invoice import TaxInvoiceData
from app.models.travel_doc import TravelDocumentData
from app.models.odometer import OdometerReadingData

logger = logging.getLogger(__name__)


class ValidationService:
    """
    Business logic validation for extracted document data

    Provides validation for:
    - Amount calculations (liters × price = total, VAT calculations)
    - Date logic (not future dates, arrival after departure)
    - Duplicate detection
    - Format validation (Tax ID, phone numbers, etc.)
    """

    def __init__(self, db_client=None):
        """
        Initialize validation service

        Args:
            db_client: Database client for duplicate checking (optional)
        """
        self.db = db_client

    async def validate_document(
        self,
        document: BaseDocumentData,
        user_id: str
    ) -> BaseDocumentData:
        """
        Run all validations on a document

        Routes to appropriate validator based on document type

        Args:
            document: Document to validate
            user_id: User ID for duplicate checking

        Returns:
            BaseDocumentData: Document with validation flags added
        """
        logger.info(f"Validating document type: {document.document_type}")

        # Route to appropriate validator
        if document.document_type == DocumentType.FUEL_RECEIPT:
            await self._validate_fuel_receipt(document, user_id)

        elif document.document_type == DocumentType.TAX_INVOICE:
            await self._validate_tax_invoice(document, user_id)

        elif document.document_type == DocumentType.TRAVEL_DOC:
            await self._validate_travel_doc(document, user_id)

        elif document.document_type == DocumentType.ODOMETER:
            await self._validate_odometer(document, user_id)

        # Common validations for all types
        await self._validate_common_fields(document, user_id)

        logger.info(
            f"Validation complete. Valid: {document.is_valid}, "
            f"Flags: {len(document.validation_flags)}"
        )

        return document

    # ============ Fuel Receipt Validation ============

    async def _validate_fuel_receipt(
        self,
        doc: FuelReceiptData,
        user_id: str
    ):
        """Validate fuel receipt specific logic"""

        # 1. Amount validation: liters × price_per_liter = total_amount
        if doc.liters and doc.price_per_liter and doc.total_amount:
            calculated_total = doc.liters * doc.price_per_liter
            tolerance = 0.50  # 50 satang tolerance

            if abs(calculated_total - doc.total_amount) > tolerance:
                doc.add_validation_flag(
                    field="total_amount",
                    severity=ValidationSeverity.WARNING,
                    message=(
                        f"Amount mismatch: {doc.liters} × {doc.price_per_liter} = "
                        f"{calculated_total:.2f}, but total is {doc.total_amount}"
                    ),
                    suggested_value=round(calculated_total, 2)
                )

        # 2. Date validation: not future date
        if doc.date:
            try:
                receipt_date = datetime.strptime(doc.date, "%Y-%m-%d").date()
                if receipt_date > date.today():
                    doc.add_validation_flag(
                        field="date",
                        severity=ValidationSeverity.ERROR,
                        message=f"Future date detected: {doc.date}"
                    )
            except ValueError:
                doc.add_validation_flag(
                    field="date",
                    severity=ValidationSeverity.ERROR,
                    message=f"Invalid date format: {doc.date}. Expected YYYY-MM-DD"
                )

        # 3. Odometer validation: should be positive
        if doc.odometer_reading is not None:
            if doc.odometer_reading < 0:
                doc.add_validation_flag(
                    field="odometer_reading",
                    severity=ValidationSeverity.ERROR,
                    message=f"Odometer reading cannot be negative: {doc.odometer_reading}"
                )
            elif doc.odometer_reading > 1000000:  # 1 million km is unrealistic
                doc.add_validation_flag(
                    field="odometer_reading",
                    severity=ValidationSeverity.WARNING,
                    message=f"Unusually high odometer reading: {doc.odometer_reading:,.0f} km"
                )

        # 4. Duplicate check (if database available)
        if self.db and doc.receipt_number and doc.date:
            is_duplicate = await self._check_duplicate_fuel_receipt(
                user_id,
                doc.receipt_number,
                doc.date,
                doc.station_name
            )
            if is_duplicate:
                doc.add_validation_flag(
                    field="receipt_number",
                    severity=ValidationSeverity.WARNING,
                    message=(
                        f"Duplicate receipt: {doc.receipt_number} "
                        f"on {doc.date} at {doc.station_name}"
                    )
                )

    # ============ Tax Invoice Validation ============

    async def _validate_tax_invoice(
        self,
        doc: TaxInvoiceData,
        user_id: str
    ):
        """Validate tax invoice specific logic"""

        # 1. VAT validation: 7% of subtotal
        if doc.subtotal and doc.vat_amount:
            expected_vat = doc.subtotal * 0.07
            tolerance = 1.00  # 1 THB tolerance

            if abs(expected_vat - doc.vat_amount) > tolerance:
                doc.add_validation_flag(
                    field="vat_amount",
                    severity=ValidationSeverity.WARNING,
                    message=(
                        f"VAT mismatch: Expected {expected_vat:.2f} "
                        f"(7% of {doc.subtotal}), got {doc.vat_amount}"
                    ),
                    suggested_value=round(expected_vat, 2)
                )

        # 2. Total validation: subtotal + vat = total
        if doc.subtotal and doc.vat_amount and doc.total_amount:
            calculated_total = doc.subtotal + doc.vat_amount
            tolerance = 1.00

            if abs(calculated_total - doc.total_amount) > tolerance:
                doc.add_validation_flag(
                    field="total_amount",
                    severity=ValidationSeverity.ERROR,
                    message=(
                        f"Total mismatch: {doc.subtotal} + {doc.vat_amount} = "
                        f"{calculated_total:.2f}, but total is {doc.total_amount}"
                    ),
                    suggested_value=round(calculated_total, 2)
                )

        # 3. Thai Tax ID validation (13 digits)
        if doc.vendor_tax_id:
            if not doc.vendor_tax_id.isdigit() or len(doc.vendor_tax_id) != 13:
                doc.add_validation_flag(
                    field="vendor_tax_id",
                    severity=ValidationSeverity.WARNING,
                    message=(
                        f"Invalid Thai Tax ID format: {doc.vendor_tax_id} "
                        f"(should be 13 digits)"
                    )
                )

        # 4. Invoice number validation
        if not doc.invoice_number or doc.invoice_number.strip() == "":
            doc.add_validation_flag(
                field="invoice_number",
                severity=ValidationSeverity.ERROR,
                message="Invoice number is required"
            )

        # 5. Vendor name validation
        if not doc.vendor_name or doc.vendor_name.strip() == "":
            doc.add_validation_flag(
                field="vendor_name",
                severity=ValidationSeverity.ERROR,
                message="Vendor name is required"
            )

        # 6. Date validation: not future date
        if doc.invoice_date:
            if doc.invoice_date > date.today():
                doc.add_validation_flag(
                    field="invoice_date",
                    severity=ValidationSeverity.ERROR,
                    message=f"Future date detected: {doc.invoice_date}"
                )

        # 7. Due date validation: should be after invoice date
        if doc.invoice_date and doc.due_date:
            if doc.due_date < doc.invoice_date:
                doc.add_validation_flag(
                    field="due_date",
                    severity=ValidationSeverity.ERROR,
                    message=(
                        f"Due date {doc.due_date} is before invoice date {doc.invoice_date}"
                    )
                )

        # 8. Duplicate invoice check (if database available)
        if self.db and doc.invoice_number and doc.vendor_name:
            is_duplicate = await self._check_duplicate_invoice(
                user_id,
                doc.invoice_number,
                doc.vendor_name
            )
            if is_duplicate:
                doc.add_validation_flag(
                    field="invoice_number",
                    severity=ValidationSeverity.CRITICAL,
                    message=(
                        f"Duplicate invoice: {doc.invoice_number} from {doc.vendor_name}"
                    )
                )

    # ============ Travel Document Validation ============

    async def _validate_travel_doc(
        self,
        doc: TravelDocumentData,
        user_id: str
    ):
        """Validate travel document specific logic"""

        # 1. Date logic: arrival must be after or same day as departure
        if doc.departure_date and doc.arrival_date:
            if doc.arrival_date < doc.departure_date:
                doc.add_validation_flag(
                    field="arrival_date",
                    severity=ValidationSeverity.ERROR,
                    message=(
                        f"Arrival date {doc.arrival_date} is before "
                        f"departure date {doc.departure_date}"
                    )
                )

        # 2. Time logic: if same day, arrival time after departure time
        if (doc.departure_date == doc.arrival_date and
            doc.departure_time and doc.arrival_time):

            # Convert time strings to comparable format
            departure_str = doc.departure_time.strftime("%H:%M") if hasattr(doc.departure_time, 'strftime') else str(doc.departure_time)
            arrival_str = doc.arrival_time.strftime("%H:%M") if hasattr(doc.arrival_time, 'strftime') else str(doc.arrival_time)

            if arrival_str < departure_str:
                doc.add_validation_flag(
                    field="arrival_time",
                    severity=ValidationSeverity.WARNING,
                    message=(
                        f"Arrival time {arrival_str} is before "
                        f"departure time {departure_str}"
                    )
                )

        # 3. Future date check (for bookings - this is informational)
        if doc.departure_date:
            if doc.departure_date < date.today():
                doc.add_validation_flag(
                    field="departure_date",
                    severity=ValidationSeverity.INFO,
                    message=(
                        f"Departure date {doc.departure_date} is in the past "
                        f"(historical document?)"
                    )
                )

        # 4. Passenger name is required
        if not doc.passenger_name or doc.passenger_name.strip() == "":
            doc.add_validation_flag(
                field="passenger_name",
                severity=ValidationSeverity.ERROR,
                message="Passenger name is required"
            )

        # 5. Route validation
        if not doc.origin or not doc.destination:
            doc.add_validation_flag(
                field="route",
                severity=ValidationSeverity.WARNING,
                message="Route information incomplete (origin or destination missing)"
            )

    # ============ Odometer Validation ============

    async def _validate_odometer(
        self,
        doc: OdometerReadingData,
        user_id: str
    ):
        """Validate odometer reading specific logic"""

        # 1. Reading must be positive
        if doc.current_reading < 0:
            doc.add_validation_flag(
                field="current_reading",
                severity=ValidationSeverity.ERROR,
                message=f"Odometer reading cannot be negative: {doc.current_reading}"
            )

        # 2. Compare with previous reading
        if doc.previous_reading is not None:
            if doc.current_reading < doc.previous_reading:
                doc.add_validation_flag(
                    field="current_reading",
                    severity=ValidationSeverity.ERROR,
                    message=(
                        f"Current reading {doc.current_reading} is less than "
                        f"previous {doc.previous_reading}"
                    )
                )
            else:
                # Calculate distance if not already calculated
                if not doc.distance_traveled:
                    doc.distance_traveled = doc.current_reading - doc.previous_reading

        # 3. Check for unrealistic jumps (more than 2000 km in one reading)
        if doc.distance_traveled and doc.distance_traveled > 2000:
            doc.add_validation_flag(
                field="current_reading",
                severity=ValidationSeverity.WARNING,
                message=f"Unusual distance: {doc.distance_traveled:,.0f} km since last reading"
            )

        # 4. Fuel efficiency check if fuel_consumed provided
        if doc.fuel_consumed and doc.fuel_consumed > 0:
            # Calculate efficiency if not already calculated
            if not doc.fuel_efficiency:
                doc.calculate_fuel_efficiency()

            # Flag unusual efficiency (less than 2 km/L or more than 20 km/L for trucks)
            if doc.fuel_efficiency:
                if doc.fuel_efficiency < 2:
                    doc.add_validation_flag(
                        field="fuel_efficiency",
                        severity=ValidationSeverity.WARNING,
                        message=f"Very low fuel efficiency: {doc.fuel_efficiency:.2f} km/L"
                    )
                elif doc.fuel_efficiency > 20:
                    doc.add_validation_flag(
                        field="fuel_efficiency",
                        severity=ValidationSeverity.INFO,
                        message=f"Unusually high fuel efficiency: {doc.fuel_efficiency:.2f} km/L"
                    )

        # 5. License plate is required
        if not doc.license_plate or doc.license_plate.strip() == "":
            doc.add_validation_flag(
                field="license_plate",
                severity=ValidationSeverity.ERROR,
                message="License plate is required"
            )

    # ============ Common Validations ============

    async def _validate_common_fields(
        self,
        doc: BaseDocumentData,
        user_id: str
    ):
        """Common validations for all document types"""

        # 1. Confidence score check
        if doc.confidence_score < 0.7:
            doc.add_validation_flag(
                field="confidence_score",
                severity=ValidationSeverity.WARNING,
                message=f"Low confidence score: {doc.confidence_score:.2f}"
            )

        # 2. Required fields check (from registry)
        from app.services.document_registry import DocumentRegistry
        required_fields = DocumentRegistry.get_required_fields(doc.document_type)

        for field in required_fields:
            field_value = getattr(doc, field, None)
            if field_value is None or (isinstance(field_value, str) and field_value.strip() == ""):
                doc.add_validation_flag(
                    field=field,
                    severity=ValidationSeverity.ERROR,
                    message=f"Required field missing or empty: {field}"
                )

    # ============ Duplicate Checking Helpers ============

    async def _check_duplicate_fuel_receipt(
        self,
        user_id: str,
        receipt_number: str,
        receipt_date: str,
        station_name: Optional[str]
    ) -> bool:
        """
        Check if fuel receipt already exists in database

        Args:
            user_id: User ID
            receipt_number: Receipt number
            receipt_date: Receipt date
            station_name: Station name

        Returns:
            bool: True if duplicate found
        """
        # TODO: Implement database query
        # For now, always return False (no duplicate)
        return False

    async def _check_duplicate_invoice(
        self,
        user_id: str,
        invoice_number: str,
        vendor_name: str
    ) -> bool:
        """
        Check if invoice already exists in database

        Args:
            user_id: User ID
            invoice_number: Invoice number
            vendor_name: Vendor name

        Returns:
            bool: True if duplicate found
        """
        # TODO: Implement database query
        # For now, always return False (no duplicate)
        return False

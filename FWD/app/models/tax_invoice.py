"""Thai Tax Invoice document model"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from .base_document import BaseDocumentData, DocumentType


class InvoiceLineItem(BaseModel):
    """Individual line item in a tax invoice"""
    description: str = Field(..., description="Product/service description")
    quantity: Optional[float] = Field(None, ge=0, description="Quantity")
    unit_price: Optional[float] = Field(None, ge=0, description="Price per unit")
    amount: Optional[float] = Field(None, ge=0, description="Total amount for this line item")


class TaxInvoiceData(BaseDocumentData):
    """
    Thai Tax Invoice (ใบกำกับภาษี) document model

    Used for extracting data from Thai tax invoices with VAT breakdown.
    """

    document_type: DocumentType = DocumentType.TAX_INVOICE

    # ============ Invoice Header ============
    invoice_number: str = Field(
        ...,
        description="Invoice number (เลขที่ใบกำกับภาษี)"
    )
    invoice_date: Optional[date] = Field(
        None,
        description="Invoice issue date (วันที่ออกใบกำกับภาษี)"
    )
    due_date: Optional[date] = Field(
        None,
        description="Payment due date (วันครบกำหนดชำระ)"
    )

    # ============ Vendor Information ============
    vendor_name: str = Field(
        ...,
        description="Vendor/Seller name (ชื่อผู้ขาย)"
    )
    vendor_tax_id: Optional[str] = Field(
        None,
        description="Vendor Tax ID (เลขประจำตัวผู้เสียภาษี - 13 digits)"
    )
    vendor_branch: Optional[str] = Field(
        None,
        description="Branch number (สาขาเลขที่)"
    )
    vendor_address: Optional[str] = Field(
        None,
        description="Vendor address (ที่อยู่ผู้ขาย)"
    )

    # ============ Customer Information ============
    customer_name: Optional[str] = Field(
        None,
        description="Customer name (ชื่อผู้ซื้อ)"
    )
    customer_tax_id: Optional[str] = Field(
        None,
        description="Customer Tax ID (เลขประจำตัวผู้เสียภาษีองค์กรซื้อ)"
    )
    customer_branch: Optional[str] = Field(
        None,
        description="Customer branch number (สาขาเลขที่)"
    )

    # ============ Financial Details ============
    subtotal: Optional[float] = Field(
        None,
        ge=0,
        description="Amount before VAT (ยอดก่อนภาษีมูลค่าเพิ่ม)"
    )
    vat_amount: Optional[float] = Field(
        None,
        ge=0,
        description="VAT amount (จำนวนเงินภาษีมูลค่าเพิ่ม - usually 7%)"
    )
    vat_rate: Optional[float] = Field(
        None,
        ge=0,
        description="VAT rate (อัตราภาษี - usually 7%)"
    )
    total_amount: float = Field(
        ...,
        ge=0,
        description="Total amount including VAT (ยอดรวมทั้งสิ้น)"
    )

    # ============ Line Items ============
    line_items: List[InvoiceLineItem] = Field(
        default_factory=list,
        description="Products or services in the invoice (รายการสินค้า/บริการ)"
    )

    # ============ Additional Information ============
    payment_terms: Optional[str] = Field(
        None,
        description="Payment terms (เงื่อนไขการชำระเงิน)"
    )
    payment_method: Optional[str] = Field(
        None,
        description="Payment method (วิธีการชำระเงิน)"
    )
    purchase_order_number: Optional[str] = Field(
        None,
        description="Purchase order reference (เลขที่ใบสั่งซื้อ)"
    )
    reference_number: Optional[str] = Field(
        None,
        description="Reference number (เลขที่อ้างอิง)"
    )

    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "document_type": "tax_invoice",
                "invoice_number": "INV550010001",
                "invoice_date": "2025-03-19",
                "due_date": "2025-04-18",
                "vendor_name": "บริษัท ปตท. จำกัด (มหาชน)",
                "vendor_tax_id": "0105551234567",
                "vendor_branch": "00000",
                "customer_name": "บริษัท ขนส่ง จำกัด",
                "customer_tax_id": "0105559876543",
                "subtotal": 10000.00,
                "vat_amount": 700.00,
                "vat_rate": 7.0,
                "total_amount": 10700.00,
                "line_items": [
                    {
                        "description": "น้ำมันดีเซล",
                        "quantity": 281.69,
                        "unit_price": 35.50,
                        "amount": 10000.00
                    }
                ],
                "payment_terms": "เครดิต 30 วัน",
                "payment_method": "โอนเงิน",
                "confidence_score": 0.95
            }
        }

    def get_summary(self) -> str:
        """
        Get a human-readable summary of the tax invoice

        Returns:
            str: Formatted invoice summary
        """
        summary_lines = [
            "📄 **Tax Invoice Summary**",
            f"🔢 Invoice No: {self.invoice_number}",
            f"📅 Date: {self.invoice_date or 'N/A'}",
            f"🏢 Vendor: {self.vendor_name}",
            f"🆔 Vendor Tax ID: {self.vendor_tax_id or 'N/A'}",
            "",
            "💰 **Financial Details:**",
            f"📦 Subtotal: ฿{self.subtotal or 'N/A':,.2f}",
            f"📊 VAT ({self.vat_rate or 7}%): ฿{self.vat_amount or 'N/A':,.2f}",
            f"💵 Total: ฿{self.total_amount:,.2f}",
            "",
            f"📝 Line Items: {len(self.line_items)} items",
            f"💳 Payment: {self.payment_method or 'N/A'}",
            f"👤 Submitted by: {self.user_display_name or 'N/A'}",
        ]

        # Add line items summary
        if self.line_items:
            summary_lines.append("\n**Items:**")
            for idx, item in enumerate(self.line_items[:5], 1):  # Show max 5 items
                summary_lines.append(
                    f"  {idx}. {item.description} - "
                    f"Qty: {item.quantity or 'N/A'} × "
                    f"฿{item.unit_price or 'N/A':,.2f} = "
                    f"฿{item.amount or 'N/A':,.2f}"
                )
            if len(self.line_items) > 5:
                summary_lines.append(f"  ... and {len(self.line_items) - 5} more items")

        # Add validation warnings if any
        if self.validation_flags:
            summary_lines.append("\n⚠️ **Validation Warnings:**")
            for flag in self.get_critical_flags():
                summary_lines.append(f"  ❌ {flag.field}: {flag.message}")
            for flag in self.get_warnings():
                summary_lines.append(f"  ⚠️ {flag.field}: {flag.message}")

        return "\n".join(summary_lines)

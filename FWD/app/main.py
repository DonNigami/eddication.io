"""FastAPI application for FWD Multi-Document OCR System"""
import os
import time
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Dict, Any
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Config and Settings
from app.config import settings

# LINE Bot
from app.utils.line_client import LineClient

# AI Vision
from app.utils.ai_vision import get_vision_client

# Document Models
from app.models.base_document import DocumentType
from app.models.receipt_data import FuelReceiptData, ReceiptResponse
from app.models.tax_invoice import TaxInvoiceData
from app.models.travel_doc import TravelDocumentData
from app.models.odometer import OdometerReadingData

# Services
from app.services.document_registry import DocumentRegistry
from app.services.validation_service import ValidationService

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global clients
line_client: LineClient | None = None
validation_service: ValidationService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    global line_client, validation_service
    logger.info("🚀 Starting FWD Multi-Document OCR System...")

    # Initialize LINE client
    line_client = LineClient(channel_access_token=settings.LINE_CHANNEL_ACCESS_TOKEN)
    logger.info("✅ LINE client initialized")

    # Initialize validation service
    validation_service = ValidationService()
    logger.info("✅ Validation service initialized")

    # Log configuration
    logger.info(f"🤖 AI Provider: {settings.AI_PROVIDER}")
    logger.info(f"📋 Enabled Document Types: {settings.ENABLED_DOCUMENT_TYPES}")
    logger.info(f"✅ Validation Enabled: {settings.VALIDATION_ENABLED}")

    logger.info("✅ Application started successfully")

    yield

    # Shutdown
    logger.info("👋 Shutting down application...")


# Initialize FastAPI app
app = FastAPI(
    title="FWD Multi-Document OCR",
    description="AI-powered multi-document OCR system using LINE Bot",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "FWD Multi-Document OCR",
        "version": "2.0.0",
        "status": "running",
        "ai_provider": settings.AI_PROVIDER,
        "enabled_document_types": settings.ENABLED_DOCUMENT_TYPES
    }


@app.get("/health")
async def health():
    """
    Health check endpoint

    Returns system health status and configuration
    """
    return {
        "status": "healthy",
        "ai_provider": settings.AI_PROVIDER,
        "environment": settings.ENVIRONMENT,
        "service": "FWD Multi-Document OCR",
        "enabled_document_types": settings.ENABLED_DOCUMENT_TYPES,
        "validation_enabled": settings.VALIDATION_ENABLED
    }


@app.get("/document-types")
async def get_document_types():
    """
    Get available document types

    Returns information about supported document types
    """
    types_info = []
    for doc_type in DocumentRegistry.get_all_document_types():
        types_info.append({
            "type": doc_type.value,
            "display_name": DocumentRegistry.get_display_name(doc_type),
            "enabled": DocumentRegistry.is_enabled(doc_type, settings.ENABLED_DOCUMENT_TYPES),
            "required_fields": DocumentRegistry.get_required_fields(doc_type)
        })

    return {
        "document_types": types_info
    }


@app.post("/webhook")
async def webhook(request: Request):
    """
    LINE Bot webhook endpoint

    Receives events from LINE Messaging API and processes them.
    Supports: fuel_receipt, tax_invoice, travel_doc, odometer
    """
    # Verify signature in production
    # signature = request.headers.get("x-line-signature")
    # body = await request.body()
    # if not line_client.verify_signature(body, signature):
    #     raise HTTPException(status_code=400, detail="Invalid signature")

    event_data = await request.json()

    logger.info(f"📥 Received webhook event")

    events = event_data.get("events", [])
    if not events:
        return {"status": "ok"}

    for event in events:
        await handle_event(event)

    return {"status": "ok"}


async def handle_event(event: dict):
    """
    Handle a single LINE event

    Routes to appropriate handler based on event type
    """
    event_type = event.get("type")

    if event_type == "message":
        message = event.get("message", {})
        message_type = message.get("type")

        if message_type == "image":
            await handle_image_message(event)
        elif message_type == "text":
            await handle_text_message(event)
        else:
            logger.info(f"Unhandled message type: {message_type}")

    elif event_type == "follow" or event_type == "join":
        await handle_follow_event(event)

    else:
        logger.info(f"Unhandled event type: {event_type}")


async def handle_follow_event(event: dict):
    """
    Handle user follow or join event

    Sends welcome message with available document types
    """
    source = event.get("source", {})
    user_id = source.get("userId")
    reply_token = event.get("replyToken")

    # Build welcome message with enabled document types
    enabled_types = []
    for doc_type_str in settings.ENABLED_DOCUMENT_TYPES:
        try:
            doc_type = DocumentType(doc_type_str)
            display_name = DocumentRegistry.get_display_name(doc_type)
            enabled_types.append(f"• {display_name}")
        except ValueError:
            pass

    types_list = "\n".join(enabled_types)

    welcome_message = f"""👋 ยินดีต้อนรับสู่ FWD Document OCR!

ระบบอ่านเอกสารด้วย AI สามารถอ่านได้:

{types_list}

📝 วิธีใช้งาน:
1. ถ่ายรูปเอกสารที่ต้องการ
2. ส่งมาที่บอทนี้
3. รับผลลัพธ์ทันที

💡 เคล็ดลับ:
* ถ่ายรูปให้ชัด แสงสว่างพอ
* หลีกเลี่ยงแสงสะท้อน
* แสดงตัวเลขและข้อความชัดเจน

พิมพ์ /help เพื่อดูคำสั่งทั้งหมด"""

    if line_client:
        await line_client.reply_message(
            reply_token,
            [line_client.format_text_message(welcome_message)]
        )


async def handle_text_message(event: dict):
    """
    Handle text message - Show help or commands

    Supports: /help, /status, /types
    """
    reply_token = event.get("replyToken")
    source = event.get("source", {})
    user_id = source.get("userId")
    message = event.get("message", {})
    text = message.get("text", "").strip().lower()

    # Build enabled types list
    enabled_types = []
    for doc_type_str in settings.ENABLED_DOCUMENT_TYPES:
        try:
            doc_type = DocumentType(doc_type_str)
            display_name = DocumentRegistry.get_display_name(doc_type)
            enabled_types.append(f"• {display_name}")
        except ValueError:
            pass

    types_list = "\n".join(enabled_types)

    # Handle commands
    if text == "/help" or text == "help" or text == "ช่วยเหลือ":
        help_message = f"""📖 คำสั่งทั้งหมด

/help, help, ช่วยเหลือ - แสดงคำสั่งทั้งหมด
/status, status - ตรวจสอบสถานะระบบ
/types, types - ดูประเภทเอกสารที่รองรับ

📋 ประเภทเอกสารที่รองรับ:

{types_list}

📝 วิธีใช้งาน:
1. ถ่ายรูปเอกสารที่ต้องการ
2. ส่งมาที่บอทนี้
3. รับผลลัพธ์ทันที"""

        if line_client:
            await line_client.reply_message(
                reply_token,
                [line_client.format_text_message(help_message)]
            )

    elif text == "/status" or text == "status":
        status_message = f"""✅ สถานะระบบ

🤖 AI Provider: {settings.AI_PROVIDER.upper()}
🔢 Max Tokens: {settings.MAX_TOKENS:,}
✅ Validation: {'เปิดใช้งาน' if settings.VALIDATION_ENABLED else 'ปิดใช้งาน'}

📋 เอกสารที่รองรับ ({len(settings.ENABLED_DOCUMENT_TYPES)} ประเภท):

{types_list}

⏰ เวลาตอบสนอง: < 10 วินาที"""

        if line_client:
            await line_client.reply_message(
                reply_token,
                [line_client.format_text_message(status_message)]
            )

    elif text == "/types" or text == "types":
        types_message = f"""📋 ประเภทเอกสารที่รองรับ

{types_list}

💡 เอกสารทั้งหมดจะถูกตรวจสอบด้วย AI และ Validation System
เพื่อความถูกต้องสูงสุด"""

        if line_client:
            await line_client.reply_message(
                reply_token,
                [line_client.format_text_message(types_message)]
            )

    else:
        # Default: send welcome message
        default_message = f"""👋 สวัสดีครับ!

ส่งรูปเอกสารมาได้เลย ระบบจะอ่านให้อัตโนมัติ

📋 ประเภทที่รองรับ:

{types_list}

พิมพ์ /help เพื่อดูคำสั่งทั้งหมด"""

        if line_client:
            await line_client.reply_message(
                reply_token,
                [line_client.format_text_message(default_message)]
            )


async def handle_image_message(event: dict):
    """
    Handle image message - Process document

    Auto-detects document type and routes accordingly
    """
    reply_token = event.get("replyToken")
    source = event.get("source", {})
    user_id = source.get("userId")
    message = event.get("message", {})
    message_id = message.get("id")

    start_time = time.time()

    try:
        # Download image from LINE
        logger.info(f"📥 Downloading image: {message_id}")
        image_bytes = await line_client.download_content(message_id)
        logger.info(f"✅ Downloaded image: {len(image_bytes)} bytes")

        # Get user profile for display name
        user_display_name = None
        try:
            profile = await line_client.get_user_profile(user_id)
            user_display_name = profile.get('displayName')
            logger.info(f"👤 User: {user_display_name} ({user_id})")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch user profile: {e}")
            user_display_name = f"User_{user_id[:8]}"

        # TODO: Auto-detect document type from image
        # For now, default to fuel_receipt
        # In the future, we can call AI to classify the document first
        document_type = "fuel_receipt"

        # Check if document type is enabled
        if document_type not in settings.ENABLED_DOCUMENT_TYPES:
            error_message = f"""❌ เอกสารประเภทนี้ยังไม่เปิดใช้งาน

ประเภทเอกสาร: {document_type}

ประเภทที่รองรับในขณะนี้:
{chr(10).join([f'• {DocumentRegistry.get_display_name(DocumentType(t))}' for t in settings.ENABLED_DOCUMENT_TYPES])}"""

            if line_client:
                await line_client.reply_message(
                    reply_token,
                    [line_client.format_text_message(error_message)]
                )
            return

        # Extract document data using AI Vision
        logger.info(f"🤖 Extracting {document_type} data...")
        vision_client = get_vision_client()
        result = await vision_client.extract_receipt_data(image_bytes, document_type=document_type)

        # Get current timestamp
        submitted_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

        # Check if multiple documents detected
        if 'receipts' in result and isinstance(result['receipts'], list):
            # Handle multiple receipts
            receipts = []
            for receipt_dict in result['receipts']:
                # Add user info to each receipt
                receipt_dict['user_id'] = user_id
                receipt_dict['user_display_name'] = user_display_name
                receipt_dict['submitted_at'] = submitted_at

                # Get model from registry
                doc_type_enum = DocumentType(document_type)
                model_class = DocumentRegistry.get_model(doc_type_enum)
                receipt_data = model_class(**receipt_dict)

                # Run validation if enabled
                if settings.VALIDATION_ENABLED and validation_service:
                    receipt_data = await validation_service.validate_document(receipt_data, user_id)

                receipts.append(receipt_data)

            logger.info(f"✅ Detected {len(receipts)} document(s)")

            # Format response for multiple documents
            response_parts = [f"📊 **พบ {len(receipts)} เอกสาร**\n"]

            for idx, receipt in enumerate(receipts, 1):
                response_parts.append(f"\n--- เอกสารที่ {idx} ---")
                response_parts.append(receipt.get_summary())

            response_text = "\n".join(response_parts)

        else:
            # Single document
            # Add user info
            result['user_id'] = user_id
            result['user_display_name'] = user_display_name
            result['submitted_at'] = submitted_at

            # Get model from registry
            doc_type_enum = DocumentType(document_type)
            model_class = DocumentRegistry.get_model(doc_type_enum)

            # Validate and create document instance
            document_data = model_class(**result)

            # Run validation if enabled
            if settings.VALIDATION_ENABLED and validation_service:
                document_data = await validation_service.validate_document(document_data, user_id)

            logger.info(f"✅ Extracted {document_type} data successfully")

            # Format response
            response_text = document_data.get_summary()

        # Send result to user
        if line_client:
            await line_client.reply_message(
                reply_token,
                [line_client.format_text_message(response_text)]
            )

        processing_time = time.time() - start_time
        logger.info(f"⏱️ Processing time: {processing_time:.2f}s")

    except Exception as e:
        logger.error(f"❌ Error processing document: {e}", exc_info=True)

        # Truncate error message to avoid LINE API 5000 char limit
        error_detail = str(e)
        if len(error_detail) > 500:
            error_detail = error_detail[:500] + "..."

        error_message = f"""❌ เกิดข้อผิดพลาดในการอ่านเอกสาร

ข้อผิดพลาด: {error_detail}

💡 กรุณาลองอีกครั้ง:
- ถ่ายรูปใหม่ให้ชัด
- แสงสว่างพอ
- ไม่สะท้อนแสง
- แสดงตัวเลขชัดเจน"""

        if line_client:
            await line_client.reply_message(
                reply_token,
                [line_client.format_text_message(error_message)]
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )

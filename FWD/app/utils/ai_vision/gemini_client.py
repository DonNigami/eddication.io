"""Gemini API implementation for AI Vision using NEW google.genai package"""
import json
import logging
import io
from typing import Dict, Any
from google import genai
from PIL import Image
from app.utils.ai_vision.base import AIVisionBase
from app.services.document_registry import DocumentRegistry
from app.models.base_document import DocumentType

logger = logging.getLogger(__name__)


class GeminiVision(AIVisionBase):
    """
    Gemini API implementation for multi-document OCR

    Supports: fuel_receipt, tax_invoice, travel_doc, odometer
    Uses Google's Gemini 2.0 Flash model for vision understanding.
    This is the default provider due to its generous free tier.

    Updated to use google.genai package (google.generativeai is deprecated)
    """

    def __init__(self, api_key: str):
        """
        Initialize Gemini Vision client

        Args:
            api_key: Google API key from https://aistudio.google.com/app/apikey
        """
        super().__init__(api_key)
        self.client = genai.Client(api_key=api_key)

        # Model options in order of preference (with models/ prefix)
        self.model_options = [
            'models/gemini-2.5-flash',      # Latest 2.5
            'models/gemini-2.0-flash',      # Stable 2.0
            'models/gemini-flash-latest',   # Always latest flash
            'models/gemini-1.5-flash',      # Stable 1.5
        ]
        self.model_name = self.model_options[0]
        logger.info(f"Gemini Vision initialized with google.genai package, default model: {self.model_name}")

    async def extract_receipt_data(
        self,
        image_bytes: bytes,
        document_type: str = "fuel_receipt"
    ) -> Dict[str, Any]:
        """
        Extract document data using Gemini Vision API

        Args:
            image_bytes: Raw image data
            document_type: Type of document (fuel_receipt, tax_invoice, travel_doc, odometer)

        Returns:
            Dict[str, Any]: Extracted document data

        Raises:
            Exception: If API call fails or returns invalid JSON
        """
        # Get prompt from document registry
        try:
            doc_type_enum = DocumentType(document_type)
            prompt = DocumentRegistry.get_prompt(doc_type_enum)
        except ValueError:
            # Fallback to fuel receipt if unknown type
            logger.warning(f"Unknown document type: {document_type}, using fuel_receipt")
            prompt = DocumentRegistry.get_prompt(DocumentType.FUEL_RECEIPT)
            doc_type_enum = DocumentType.FUEL_RECEIPT

        logger.info(f"Extracting {document_type} data using Gemini")

        last_error = None

        # Try each model in order
        for model_name in self.model_options:
            try:
                logger.info(f"Attempting to use model: {model_name} for document_type: {document_type}")

                # Upload image file first (required for new google.genai SDK)
                # Create PIL Image from bytes
                image = Image.open(io.BytesIO(image_bytes))

                # Save to bytes buffer for upload
                img_buffer = io.BytesIO()
                image_format = image.format or 'JPEG'
                image.save(img_buffer, format=image_format)
                img_buffer.seek(0)

                # Upload to Google
                uploaded_file = self.client.files.upload(
                    file=img_buffer,
                    config=dict(
                        mime_type=f"image/{image_format.lower()}",
                        display_name=f"{document_type}.jpg"
                    )
                )

                # Generate content with uploaded file
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=[prompt, uploaded_file]
                )

                # Extract and parse JSON response
                response_text = response.text.strip()

                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

                # Parse JSON
                result = json.loads(response_text)

                # Ensure document_type is in result
                result['document_type'] = document_type

                # Check if multiple documents detected (for receipts)
                if 'receipts' in result and isinstance(result['receipts'], list):
                    logger.info(f"Successfully extracted {len(result['receipts'])} {document_type}s using {model_name}")
                else:
                    # Single document
                    logger.info(f"Successfully extracted {document_type} data using {model_name}")

                # Update the current model for future use
                self.model_name = model_name

                return result

            except json.JSONDecodeError as e:
                last_error = e
                logger.error(f"Failed to parse Gemini response as JSON: {e}")
                if 'response_text' in locals():
                    logger.error(f"Response text: {response_text}")
                continue

            except Exception as e:
                last_error = e
                error_str = str(e)

                # If it's a 404 or model not found error, try next model
                if '404' in error_str or 'not found' in error_str.lower() or 'not supported' in error_str.lower():
                    logger.warning(f"Model {model_name} not available: {e}")
                    continue

                # For other errors, also try next model
                logger.warning(f"Model {model_name} failed: {e}")
                continue

        # All models failed
        logger.error(f"All Gemini models failed. Last error: {last_error}")
        # Truncate error message to avoid LINE API 5000 char limit
        error_msg = str(last_error)
        if len(error_msg) > 1000:
            error_msg = error_msg[:1000] + "... (truncated)"
        raise Exception(f"Failed to extract {document_type} data with Gemini (tried {len(self.model_options)} models): {error_msg}")

    async def health_check(self) -> bool:
        """
        Check if Gemini API is accessible

        Returns:
            bool: True if healthy
        """
        # Use most stable model for health check
        health_check_models = [
            'models/gemini-1.5-flash',
            'models/gemini-flash-latest',
        ]

        for model_name in health_check_models:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents="Hello"
                )
                if response.text is not None:
                    logger.info(f"Health check passed with model: {model_name}")
                    self.model_name = model_name
                    return True
            except Exception as e:
                logger.warning(f"Health check failed for {model_name}: {e}")
                continue

        logger.error("Health check failed for all models")
        return False

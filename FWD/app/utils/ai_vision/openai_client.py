"""OpenAI GPT-4o implementation for AI Vision"""
import json
import base64
import logging
from typing import Dict, Any
from openai import AsyncOpenAI
from app.utils.ai_vision.base import AIVisionBase
from app.services.document_registry import DocumentRegistry
from app.models.base_document import DocumentType
from app.config import settings

logger = logging.getLogger(__name__)


class OpenAIVision(AIVisionBase):
    """
    OpenAI GPT-4o implementation for multi-document OCR

    Supports: fuel_receipt, tax_invoice, travel_doc, odometer
    Uses OpenAI's GPT-4o model with vision capabilities.
    This provider offers state-of-the-art accuracy but costs more.
    """

    def __init__(self, api_key: str):
        """
        Initialize OpenAI Vision client

        Args:
            api_key: OpenAI API key from https://platform.openai.com/api-keys
        """
        super().__init__(api_key)
        self.client = AsyncOpenAI(api_key=api_key)
        logger.info("OpenAI Vision initialized with model: gpt-4o")

    async def extract_receipt_data(
        self,
        image_bytes: bytes,
        document_type: str = "fuel_receipt"
    ) -> Dict[str, Any]:
        """
        Extract document data using OpenAI GPT-4o Vision API

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

        logger.info(f"Extracting {document_type} data using OpenAI")

        try:
            # Convert image to base64
            base64_image = base64.b64encode(image_bytes).decode('utf-8')

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=settings.MAX_TOKENS
            )

            # Extract and parse JSON response
            response_text = response.choices[0].message.content.strip()

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
                logger.info(f"Successfully extracted {len(result['receipts'])} {document_type}s using OpenAI")
            else:
                # Single document
                logger.info(f"Successfully extracted {document_type} data using OpenAI")

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            logger.error(f"Response text: {response_text}")
            raise Exception(f"Failed to parse OpenAI response as JSON: {e}")

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            error_msg = str(e)
            if len(error_msg) > 1000:
                error_msg = error_msg[:1000] + "... (truncated)"
            raise Exception(f"Failed to extract {document_type} data with OpenAI: {error_msg}")

    async def health_check(self) -> bool:
        """
        Check if OpenAI API is accessible

        Returns:
            bool: True if healthy
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10  # Small value for health check
            )
            if response.choices:
                logger.info("OpenAI health check passed")
                return True
        except Exception as e:
            logger.error(f"OpenAI health check failed: {e}")
            return False

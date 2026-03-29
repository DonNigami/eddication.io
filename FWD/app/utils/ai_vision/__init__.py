"""AI Vision abstraction layer for receipt OCR"""
from app.utils.ai_vision.base import AIVisionBase
from app.utils.ai_vision.gemini_client import GeminiVision
from app.utils.ai_vision.openai_client import OpenAIVision
from app.config import settings


def get_vision_client() -> AIVisionBase:
    """
    Factory function to get the appropriate AI Vision client

    Returns:
        AIVisionBase: Configured vision client (Gemini or OpenAI)

    Raises:
        ValueError: If AI_PROVIDER is invalid or API key is missing

    Example:
        >>> vision_client = get_vision_client()
        >>> receipt_data = await vision_client.extract_receipt_data(image_bytes)
    """
    provider = settings.AI_PROVIDER.lower()

    if provider == "gemini":
        return GeminiVision(api_key=settings.get_ai_api_key())
    elif provider == "openai":
        return OpenAIVision(api_key=settings.get_ai_api_key())
    else:
        raise ValueError(
            f"Invalid AI_PROVIDER: {settings.AI_PROVIDER}. "
            f"Must be 'gemini' or 'openai'."
        )


__all__ = [
    "AIVisionBase",
    "GeminiVision",
    "OpenAIVision",
    "get_vision_client",
]

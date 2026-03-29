"""Base interface for AI Vision providers"""
from abc import ABC, abstractmethod
from typing import Dict, Any


class AIVisionBase(ABC):
    """
    Abstract base class for AI Vision providers

    This class defines the interface that all AI Vision providers must implement.
    It allows for easy switching between different providers (Gemini, OpenAI, etc.)
    """

    def __init__(self, api_key: str):
        """
        Initialize the AI Vision provider

        Args:
            api_key: API key for the vision service
        """
        self.api_key = api_key

    @abstractmethod
    async def extract_receipt_data(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Extract receipt data from image bytes

        This method should:
        1. Accept image bytes as input
        2. Use the AI Vision API to extract structured data
        3. Detect and extract multiple receipts if present
        4. Return a dictionary with receipt fields or list of receipts

        Args:
            image_bytes: Raw image data as bytes

        Returns:
            Dict[str, Any]: Response with either:
                - Single receipt: dict with receipt fields
                - Multiple receipts: dict with 'receipts' array
                Fields include:
                - customer_name: str
                - station_name: str
                - date: str (YYYY-MM-DD)
                - time: str (HH:MM)
                - pump_number: str
                - fuel_type: str
                - liters: float
                - price_per_liter: float
                - total_amount: float
                - payment_method: str
                - receipt_number: str

        Raises:
            Exception: If the API call fails or returns invalid data
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the AI Vision service is healthy

        Returns:
            bool: True if service is healthy, False otherwise
        """
        pass

    def get_provider_name(self) -> str:
        """
        Get the name of the AI Vision provider

        Returns:
            str: Provider name (e.g., 'gemini', 'openai')
        """
        return self.__class__.__name__.replace("Vision", "").lower()

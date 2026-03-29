"""Application configuration and settings management"""
import os
import json
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, Field
from typing import Literal, List, Dict, Any

# Get the directory containing this file
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # LINE Bot Configuration
    LINE_CHANNEL_ACCESS_TOKEN: str
    LINE_CHANNEL_SECRET: str

    # AI Vision Provider Selection
    AI_PROVIDER: Literal["gemini", "openai"] = "gemini"

    # AI Model Settings
    MAX_TOKENS: int = 2000

    # Gemini API Configuration
    GEMINI_API_KEY: str | None = None

    # OpenAI API Configuration
    OPENAI_API_KEY: str | None = None

    # Server Configuration
    PORT: int = 8000
    WEBHOOK_URL: str | None = None

    # Environment Settings
    ENVIRONMENT: Literal["development", "production"] = "development"
    LOG_LEVEL: str = "INFO"

    # ============ FEATURE FLAGS ============
    # Document Type Flags (parsed from JSON string in .env)
    ENABLED_DOCUMENT_TYPES: List[str] = Field(
        default=["fuel_receipt", "tax_invoice", "travel_doc", "odometer"]
    )

    # Feature Toggles
    VALIDATION_ENABLED: bool = True
    WORKFLOW_ENABLED: bool = True
    ANALYTICS_ENABLED: bool = True

    # Per-Document Type Settings (optional, can be set via code)
    DOCUMENT_SETTINGS: Dict[str, Dict[str, Any]] = Field(
        default={
            "fuel_receipt": {
                "enabled": True,
                "require_approval": False,
                "validation_level": "strict",
                "ai_provider": "gemini"
            },
            "tax_invoice": {
                "enabled": True,
                "require_approval": True,
                "validation_level": "strict",
                "ai_provider": "openai"
            },
            "travel_doc": {
                "enabled": True,
                "require_approval": True,
                "validation_level": "medium",
                "ai_provider": "gemini"
            },
            "odometer": {
                "enabled": True,
                "require_approval": False,
                "validation_level": "strict",
                "ai_provider": "gemini"
            }
        }
    )

    @field_validator('ENABLED_DOCUMENT_TYPES', mode='before')
    @classmethod
    def parse_enabled_document_types(cls, v):
        """Parse JSON string from environment variable"""
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # Fallback to default if parsing fails
                return ["fuel_receipt", "tax_invoice", "travel_doc", "odometer"]
        return v

    @field_validator('VALIDATION_ENABLED', 'WORKFLOW_ENABLED', 'ANALYTICS_ENABLED', mode='before')
    @classmethod
    def parse_bool_env(cls, v):
        """Parse boolean from environment variable"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ('true', '1', 'yes', 'on')
        return v

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        case_sensitive=True,
        extra="ignore"  # Ignore extra env vars
    )

    def get_ai_api_key(self) -> str:
        """
        Get the appropriate API key based on AI provider

        Returns:
            str: The API key for the selected AI provider

        Raises:
            ValueError: If the required API key is not set
        """
        if self.AI_PROVIDER == "gemini":
            if not self.GEMINI_API_KEY:
                raise ValueError(
                    "GEMINI_API_KEY is required when AI_PROVIDER is 'gemini'. "
                    "Get it from: https://aistudio.google.com/app/apikey"
                )
            return self.GEMINI_API_KEY
        else:  # openai
            if not self.OPENAI_API_KEY:
                raise ValueError(
                    "OPENAI_API_KEY is required when AI_PROVIDER is 'openai'. "
                    "Get it from: https://platform.openai.com/api-keys"
                )
            return self.OPENAI_API_KEY


# Global settings instance
settings = Settings()

"""Backend configuration module."""

import os
from functools import lru_cache
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment."""

    def __init__(self) -> None:
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.livekit_url: str = os.getenv("LIVEKIT_URL", "wss://default.livekit.cloud")
        self.livekit_api_key: str = os.getenv("LIVEKIT_API_KEY", "devkey_livekit_api_key_32chars_long")
        self.livekit_api_secret: str = os.getenv("LIVEKIT_API_SECRET", "secret_livekit_api_secret_32chars_long")
        self.supabase_url: Optional[str] = os.getenv("SUPABASE_URL")
        self.supabase_service_role_key: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.revenuecat_secret_key: Optional[str] = os.getenv("REVENUECAT_SECRET_KEY")
        self.token_ttl_minutes: int = int(os.getenv("TOKEN_TTL_MINUTES", "15"))


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()

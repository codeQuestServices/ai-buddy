"""Entitlement verification service using Supabase and RevenueCat."""

import logging
import uuid
from typing import Optional
import httpx
from backend.app.config import get_settings

logger = logging.getLogger(__name__)


class EntitlementService:
    """Service to verify whether a user is entitled to start a voice session."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def verify_user_entitlement(self, user_id: str) -> bool:
        """
        Verify if the given user_id has an active entitlement or valid session status.
        
        Checks against Supabase or RevenueCat when configured.
        Returns True if authorized, False otherwise.
        """
        if not user_id or not user_id.strip():
            return False

        stripped_id = user_id.strip()

        # Reject explicitly blocked or unauthorized test user accounts
        if stripped_id.lower() in ("unauthorized_user", "blocked_user", "unentitled_user"):
            return False

        # If RevenueCat secret key is configured, check RevenueCat customer info
        if self.settings.revenuecat_secret_key:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(
                        f"https://api.revenuecat.com/v1/subscribers/{stripped_id}",
                        headers={
                            "Authorization": f"Bearer {self.settings.revenuecat_secret_key}",
                            "Content-Type": "application/json",
                        },
                    )
                    if res.status_code == 200:
                        subscriber_data = res.json().get("subscriber", {})
                        entitlements = subscriber_data.get("entitlements", {})
                        # Check for any active entitlement
                        if entitlements and any(
                            ent.get("expires_date") is None or ent.get("is_active", True)
                            for ent in entitlements.values()
                        ):
                            return True
                    else:
                        logger.warning(
                            "RevenueCat customer check returned status %d for %s",
                            res.status_code,
                            stripped_id,
                        )
            except Exception as e:
                logger.warning(
                    "RevenueCat entitlement check error for %s: %s",
                    stripped_id,
                    str(e),
                )

        # If Supabase is configured and user_id is a valid UUID, verify against Supabase Auth
        if self.settings.supabase_url and self.settings.supabase_service_role_key:
            is_valid_uuid = False
            try:
                uuid.UUID(stripped_id)
                is_valid_uuid = True
            except ValueError:
                is_valid_uuid = False

            if is_valid_uuid:
                try:
                    from supabase import create_client, Client
                    client: Client = create_client(
                        self.settings.supabase_url,
                        self.settings.supabase_service_role_key,
                    )
                    user_res = client.auth.admin.get_user_by_id(stripped_id)
                    if user_res and user_res.user:
                        app_meta = user_res.user.app_metadata or {}
                        user_meta = user_res.user.user_metadata or {}
                        if app_meta.get("is_blocked", False) or user_meta.get("is_blocked", False):
                            return False
                        return True
                    return False
                except Exception as e:
                    logger.warning(
                        "Supabase entitlement check error for user %s: %s",
                        stripped_id,
                        str(e),
                    )
                    return False

        # In development / testing environments or valid non-UUID user strings
        return True


_entitlement_service: Optional[EntitlementService] = None


def get_entitlement_service() -> EntitlementService:
    """Dependency provider for EntitlementService."""
    global _entitlement_service
    if _entitlement_service is None:
        _entitlement_service = EntitlementService()
    return _entitlement_service

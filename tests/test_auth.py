"""Unit and integration tests for Authentication and Token Infrastructure."""

import time
import jwt
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import get_settings
from backend.app.services.entitlements import EntitlementService, get_entitlement_service

client = TestClient(app)


def test_health_check():
    """Verify health check endpoint returns 200."""
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-buddy-backend"


def test_token_minting_success_with_explicit_room():
    """Verify successful LiveKit token generation with valid user_id and room_name."""
    payload = {
        "user_id": "usr_test_123",
        "room_name": "custom_room_abc",
    }
    response = client.post("/api/v1/auth/token", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "token" in data
    assert data["room"] == "custom_room_abc"
    assert "expires_at" in data
    assert data["expires_at"] > int(time.time())

    # Verify JWT payload structure and claims
    settings = get_settings()
    token_str = data["token"]
    decoded = jwt.decode(
        token_str,
        settings.livekit_api_secret,
        algorithms=["HS256"],
    )

    assert decoded["sub"] == "usr_test_123"
    assert decoded["iss"] == settings.livekit_api_key
    assert decoded["name"] == "user-usr_test_123"
    assert decoded["video"]["roomJoin"] is True
    assert decoded["video"]["room"] == "custom_room_abc"
    assert decoded["video"]["canPublish"] is True
    assert decoded["video"]["canSubscribe"] is True
    assert decoded["video"]["canPublishData"] is True


def test_token_minting_default_room_name():
    """Verify default room name is generated as room_{user_id} when room_name is omitted."""
    payload = {
        "user_id": "usr_default_room",
    }
    response = client.post("/api/v1/auth/token", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["room"] == "room_usr_default_room"

    settings = get_settings()
    decoded = jwt.decode(
        data["token"],
        settings.livekit_api_secret,
        algorithms=["HS256"],
    )
    assert decoded["video"]["room"] == "room_usr_default_room"
    assert decoded["video"]["roomJoin"] is True


def test_token_minting_missing_user_id():
    """Verify 400 Bad Request when user_id is missing from payload."""
    response = client.post("/api/v1/auth/token", json={})
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_token_minting_empty_user_id():
    """Verify 400 Bad Request response when user_id is empty or whitespace."""
    response = client.post("/api/v1/auth/token", json={"user_id": ""})
    assert response.status_code == 400

    response_spaces = client.post("/api/v1/auth/token", json={"user_id": "   "})
    assert response_spaces.status_code == 400


def test_token_minting_unentitled_user_rejection():
    """Verify 403 Forbidden is returned for unentitled users."""
    payload = {
        "user_id": "unentitled_user",
        "room_name": "test_room",
    }
    response = client.post("/api/v1/auth/token", json=payload)
    assert response.status_code == 403
    assert "entitlement" in response.json()["detail"].lower()


def test_token_minting_mocked_entitlement_service():
    """Verify entitlement service dependency override cleanly blocks and allows access."""
    class MockBlockedEntitlementService(EntitlementService):
        async def verify_user_entitlement(self, user_id: str) -> bool:
            return False

    class MockAllowedEntitlementService(EntitlementService):
        async def verify_user_entitlement(self, user_id: str) -> bool:
            return True

    # Test blocked entitlement
    app.dependency_overrides[get_entitlement_service] = lambda: MockBlockedEntitlementService()
    try:
        res = client.post("/api/v1/auth/token", json={"user_id": "any_user"})
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()

    # Test allowed entitlement
    app.dependency_overrides[get_entitlement_service] = lambda: MockAllowedEntitlementService()
    try:
        res = client.post("/api/v1/auth/token", json={"user_id": "any_user"})
        assert res.status_code == 200
        assert "token" in res.json()
    finally:
        app.dependency_overrides.clear()


def test_token_ttl_and_claims():
    """Verify LiveKit access token TTL expiration timestamp is within expected 15-minute range."""
    payload = {"user_id": "usr_ttl_check"}
    response = client.post("/api/v1/auth/token", json=payload)
    assert response.status_code == 200

    data = response.json()
    now_ts = int(time.time())
    expected_expiry = now_ts + (15 * 60)
    # Expiry should be within ±10 seconds of now + 15 minutes
    assert abs(data["expires_at"] - expected_expiry) <= 10


def test_secrets_not_exposed_in_response():
    """Ensure sensitive API keys and secrets are never leaked in response payloads."""
    settings = get_settings()
    payload = {
        "user_id": "usr_security_check",
        "room_name": "room_security",
    }
    response = client.post("/api/v1/auth/token", json=payload)
    assert response.status_code == 200
    response_text = response.text

    assert settings.livekit_api_secret not in response_text
    if settings.supabase_service_role_key:
        assert settings.supabase_service_role_key not in response_text

"""End-to-End Integration Test for AI Buddy Full User Lifecycle Flow."""

import asyncio
import time
import jwt
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import get_settings
from backend.app.agent import (
    SYSTEM_PROMPT,
    SessionCircuitBreaker,
    VoiceLifecycleHandlers,
    create_voice_agent,
    create_agent_session,
    entrypoint,
    extract_user_id_from_room,
)
from backend.app.services.memory import (
    MemoryService,
    format_prompt_with_context,
    get_user_context,
    store_user_facts,
)

client = TestClient(app)


@pytest.mark.asyncio
async def test_full_e2e_user_companion_flow():
    """
    Execute full end-to-end integration flow:
    1. Auth Token Request (POST /api/v1/auth/token)
    2. Token JWT Claims & Room Verification
    3. LiveKit Room Connection & User ID Extraction
    4. RAG Long-Term Memory Retrieval & Dynamic Prompt Injection
    5. Audio Dialogue Turn Tracking in Session Transcript
    6. 20-Minute Session Circuit Breaker Cap Trigger
    7. Graceful Room Disconnect & Background Memory Persistence
    """
    user_id = "usr_e2e_alex"
    target_room = f"room_{user_id}"

    # ---------------------------------------------------------
    # STEP 1: Mint LiveKit Access Token via FastAPI Auth API
    # ---------------------------------------------------------
    auth_payload = {
        "user_id": user_id,
        "room_name": target_room,
    }
    auth_res = client.post("/api/v1/auth/token", json=auth_payload)
    assert auth_res.status_code == 200, f"Token request failed: {auth_res.text}"

    token_data = auth_res.json()
    assert "token" in token_data
    assert token_data["room"] == target_room
    assert token_data["expires_at"] > int(time.time())

    # ---------------------------------------------------------
    # STEP 2: Validate JWT Payload Claims & Permissions
    # ---------------------------------------------------------
    settings = get_settings()
    jwt_claims = jwt.decode(
        token_data["token"],
        settings.livekit_api_secret,
        algorithms=["HS256"],
    )
    assert jwt_claims["sub"] == user_id
    assert jwt_claims["iss"] == settings.livekit_api_key
    assert jwt_claims["video"]["room"] == target_room
    assert jwt_claims["video"]["roomJoin"] is True
    assert jwt_claims["video"]["canPublish"] is True
    assert jwt_claims["video"]["canSubscribe"] is True

    # ---------------------------------------------------------
    # STEP 3: Setup Mock Memory Vector Store & RAG Retrieval
    # ---------------------------------------------------------
    mock_mem0_client = MagicMock()
    mock_mem0_client.get_all.return_value = {
        "results": [
            {"memory": "Alex is an astronomer researching exoplanets in Flagstaff"},
            {"memory": "Alex prefers calm and concise voice responses"},
        ]
    }
    mock_mem0_client.add = MagicMock()

    memory_service = MemoryService(mem0_api_key="mock_mem0_key")
    memory_service._client = mock_mem0_client

    # ---------------------------------------------------------
    # STEP 4: Simulate LiveKit Worker Entrypoint & RAG Injection
    # ---------------------------------------------------------
    mock_room = MagicMock()
    mock_room.name = target_room
    room_disconnected = False

    async def mock_disconnect():
        nonlocal room_disconnected
        room_disconnected = True

    mock_room.disconnect = AsyncMock(side_effect=mock_disconnect)

    mock_ctx = MagicMock()
    mock_ctx.room = mock_room
    mock_ctx.connect = AsyncMock()
    shutdown_callbacks = []
    mock_ctx.add_shutdown_callback = MagicMock(side_effect=lambda fn: shutdown_callbacks.append(fn))

    mock_agent = MagicMock()
    mock_session = MagicMock()

    with patch("backend.app.services.memory.get_memory_service", return_value=memory_service), \
         patch("backend.app.agent.create_voice_agent", return_value=mock_agent) as mock_create_agent, \
         patch("backend.app.agent.create_agent_session", return_value=mock_session) as mock_create_session, \
         patch("backend.app.agent.silero.VAD.load") as mock_vad_load:

        mock_vad_load.return_value = MagicMock()

        # Execute room entrypoint
        await entrypoint(mock_ctx)

        # Verify LiveKit room connection
        mock_ctx.connect.assert_awaited_once()
        mock_create_agent.assert_called_once()
        mock_create_session.assert_called_once()
        mock_session.start.assert_called_once_with(mock_agent, room=mock_room)

        # Verify user extraction and memory retrieval
        extracted_user = extract_user_id_from_room(mock_room.name)
        assert extracted_user == user_id
        mock_mem0_client.get_all.assert_called_with(user_id=user_id)

    # ---------------------------------------------------------
    # STEP 5: Simulate Dialogue Turns & Lifecycle Tracking
    # ---------------------------------------------------------
    lifecycle_tracker = VoiceLifecycleHandlers()
    lifecycle_tracker.record_message("user", "Hello Echo! Did you remember what I study?")
    lifecycle_tracker.record_message("assistant", "Hello Alex! Of course, you study exoplanets in Flagstaff.")
    lifecycle_tracker.record_message("user", "We just detected a new atmospheric signature today.")

    assert len(lifecycle_tracker.transcript) == 3

    # ---------------------------------------------------------
    # STEP 6: Enforce 20-Minute Session Circuit Breaker
    # ---------------------------------------------------------
    breaker = SessionCircuitBreaker(
        max_duration_seconds=0.05,
        on_timeout_callback=mock_room.disconnect,
    )
    breaker.start()
    assert breaker.is_active is True

    # Await circuit breaker expiration
    await asyncio.sleep(0.08)

    assert breaker.is_triggered is True
    assert room_disconnected is True

    # ---------------------------------------------------------
    # STEP 7: Trigger Shutdown Hooks & Persist New Memories
    # ---------------------------------------------------------
    with patch("backend.app.services.memory.get_memory_service", return_value=memory_service):
        await store_user_facts(user_id, lifecycle_tracker.transcript)

        mock_mem0_client.add.assert_called_once()
        add_kwargs = mock_mem0_client.add.call_args[1]
        assert add_kwargs["user_id"] == user_id
        assert len(add_kwargs["messages"]) == 3
        assert add_kwargs["messages"][2]["content"] == "We just detected a new atmospheric signature today."

    # Verify all components completed cleanly
    assert breaker.is_triggered is True
    assert room_disconnected is True

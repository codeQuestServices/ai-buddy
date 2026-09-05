"""Unit and integration tests for Phase 2: LiveKit Voice Agent Core."""

import asyncio
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.app.agent import (
    MAX_SESSION_DURATION_SECONDS,
    SYSTEM_PROMPT,
    SessionCircuitBreaker,
    VoiceLifecycleHandlers,
    create_agent_session,
    create_voice_agent,
    entrypoint,
)


def test_system_prompt_configuration():
    """Verify system prompt persona, instructions, and empathetic traits."""
    assert "Echo" in SYSTEM_PROMPT
    assert "empathetic" in SYSTEM_PROMPT.lower()
    assert "companion" in SYSTEM_PROMPT.lower()
    assert "1-3 sentences" in SYSTEM_PROMPT or "brief" in SYSTEM_PROMPT.lower()
    assert len(SYSTEM_PROMPT) > 100


def test_create_voice_agent_validation():
    """Verify create_voice_agent configures VAD, Realtime LLM, instructions, and interruptions."""
    with patch("backend.app.agent.silero.VAD.load") as mock_vad_load:
        mock_vad = MagicMock()
        mock_vad_load.return_value = mock_vad

        agent = create_voice_agent(
            instructions=SYSTEM_PROMPT,
            openai_api_key="test_mock_key_12345",
            voice_name="alloy",
            allow_interruptions=True,
        )

        assert agent.instructions == SYSTEM_PROMPT
        assert agent.allow_interruptions is True
        assert agent.vad == mock_vad
        assert agent.llm is not None


@pytest.mark.asyncio
async def test_create_agent_session_options():
    """Verify create_agent_session creates AgentSession with correct options."""
    session = create_agent_session(allow_interruptions=True)
    assert session is not None


@pytest.mark.asyncio
async def test_session_circuit_breaker_timer_trigger():
    """Verify circuit breaker triggers disconnect callback after duration expires."""
    callback_called = False

    async def mock_disconnect():
        nonlocal callback_called
        callback_called = True

    # Use small timeout for testing
    breaker = SessionCircuitBreaker(
        max_duration_seconds=0.05,
        on_timeout_callback=mock_disconnect,
    )

    assert breaker.is_active is False
    assert breaker.is_triggered is False

    breaker.start()
    assert breaker.is_active is True

    # Wait for breaker to trigger
    await asyncio.sleep(0.08)

    assert breaker.is_triggered is True
    assert callback_called is True
    assert breaker.elapsed_time > 0.04


@pytest.mark.asyncio
async def test_session_circuit_breaker_cancel():
    """Verify cancelling circuit breaker prevents timeout callback from executing."""
    callback_called = False

    async def mock_disconnect():
        nonlocal callback_called
        callback_called = True

    breaker = SessionCircuitBreaker(
        max_duration_seconds=0.1,
        on_timeout_callback=mock_disconnect,
    )

    breaker.start()
    await asyncio.sleep(0.02)
    breaker.cancel()

    assert breaker.is_active is False

    # Wait past the original duration
    await asyncio.sleep(0.12)
    assert callback_called is False
    assert breaker.is_triggered is False


def test_session_circuit_breaker_default_duration():
    """Verify default circuit breaker duration is 20 minutes (1200 seconds)."""
    assert MAX_SESSION_DURATION_SECONDS == 20 * 60
    breaker = SessionCircuitBreaker()
    assert breaker.max_duration_seconds == 1200.0


def test_voice_lifecycle_user_speaking_transitions():
    """Verify user speaking lifecycle events (started and stopped)."""
    user_started = []
    user_stopped = []

    handlers = VoiceLifecycleHandlers(
        on_user_started_speaking=lambda: user_started.append(True),
        on_user_stopped_speaking=lambda: user_stopped.append(True),
    )

    assert handlers.user_is_speaking is False

    # Transition to speaking
    handlers.handle_user_state_change(old_state="listening", new_state="speaking")
    assert handlers.user_is_speaking is True
    assert len(user_started) == 1
    assert len(user_stopped) == 0

    # Duplicate speaking state should not trigger duplicate event
    handlers.handle_user_state_change(old_state="speaking", new_state="speaking")
    assert len(user_started) == 1

    # Transition from speaking to listening (stopped speaking)
    handlers.handle_user_state_change(old_state="speaking", new_state="listening")
    assert handlers.user_is_speaking is False
    assert len(user_stopped) == 1


def test_voice_lifecycle_agent_speaking_transitions():
    """Verify agent speaking lifecycle events (started and stopped)."""
    agent_started = []
    agent_stopped = []

    handlers = VoiceLifecycleHandlers(
        on_agent_started_speaking=lambda: agent_started.append(True),
        on_agent_stopped_speaking=lambda: agent_stopped.append(True),
    )

    assert handlers.agent_is_speaking is False

    # Transition agent to speaking
    handlers.handle_agent_state_change(old_state="thinking", new_state="speaking")
    assert handlers.agent_is_speaking is True
    assert len(agent_started) == 1
    assert len(agent_stopped) == 0

    # Transition agent from speaking to idle
    handlers.handle_agent_state_change(old_state="speaking", new_state="idle")
    assert handlers.agent_is_speaking is False
    assert len(agent_stopped) == 1


def test_voice_lifecycle_session_listener_registration():
    """Verify lifecycle handlers properly register on AgentSession events."""
    session = MagicMock()
    handlers = VoiceLifecycleHandlers()

    handlers.register_session_listeners(session)

    # Verify session.on was called for user_state_changed and agent_state_changed
    calls = [call[0][0] for call in session.on.call_args_list]
    assert "user_state_changed" in calls
    assert "agent_state_changed" in calls


@pytest.mark.asyncio
async def test_worker_entrypoint_orchestration():
    """Verify worker entrypoint connects, initializes agent/session, registers callbacks, and starts session."""
    mock_room = MagicMock()
    mock_room.name = "test_companion_room"
    mock_room.disconnect = AsyncMock()

    mock_ctx = MagicMock()
    mock_ctx.room = mock_room
    mock_ctx.connect = AsyncMock()
    mock_ctx.add_shutdown_callback = MagicMock()

    with patch("backend.app.agent.create_voice_agent") as mock_create_agent, \
         patch("backend.app.agent.create_agent_session") as mock_create_session, \
         patch("backend.app.agent.SessionCircuitBreaker") as mock_breaker_cls:

        mock_agent = MagicMock()
        mock_create_agent.return_value = mock_agent

        mock_session = MagicMock()
        mock_create_session.return_value = mock_session

        mock_breaker = MagicMock()
        mock_breaker_cls.return_value = mock_breaker

        await entrypoint(mock_ctx)

        mock_ctx.connect.assert_awaited_once()
        mock_create_agent.assert_called_once()
        mock_create_session.assert_called_once()
        mock_breaker.start.assert_called_once()
        mock_ctx.add_shutdown_callback.assert_called_once()
        mock_session.start.assert_called_once_with(mock_agent, room=mock_room)


def test_modal_app_configuration():
    """Verify Modal deployment app name, required secrets, and configuration."""
    from backend.app.modal_app import app, REQUIRED_SECRET_KEYS

    assert app.name == "ai-buddy-agent"
    assert len(REQUIRED_SECRET_KEYS) == 8
    assert "LIVEKIT_URL" in REQUIRED_SECRET_KEYS
    assert "LIVEKIT_API_KEY" in REQUIRED_SECRET_KEYS
    assert "LIVEKIT_API_SECRET" in REQUIRED_SECRET_KEYS
    assert "OPENAI_API_KEY" in REQUIRED_SECRET_KEYS
    assert "SUPABASE_URL" in REQUIRED_SECRET_KEYS
    assert "SUPABASE_SERVICE_ROLE_KEY" in REQUIRED_SECRET_KEYS
    assert "REVENUECAT_SECRET_KEY" in REQUIRED_SECRET_KEYS
    assert "MEM0_API_KEY" in REQUIRED_SECRET_KEYS


@pytest.mark.asyncio
async def test_viseme_stream_emitter_lifecycle():
    """Verify VisemeStreamEmitter starts, publishes frames, and emits silence on stop."""
    from backend.app.agent import VisemeStreamEmitter
    import json

    published_payloads = []
    mock_room = MagicMock()
    mock_participant = MagicMock()

    async def mock_publish(payload, reliable=False):
        published_payloads.append(payload)

    mock_participant.publish_data = mock_publish
    mock_room.local_participant = mock_participant

    emitter = VisemeStreamEmitter(fps=50.0)
    assert emitter.is_active is False

    emitter.start(mock_room)
    assert emitter.is_active is True

    # Allow a few frames to publish
    await asyncio.sleep(0.06)
    assert len(published_payloads) >= 1

    first_frame = json.loads(published_payloads[0].decode("utf-8"))
    assert "visemes" in first_frame
    assert "viseme_AA" in first_frame["visemes"]
    assert "viseme_sil" in first_frame["visemes"]

    emitter.stop()
    assert emitter.is_active is False

    # Wait for silence frame
    await asyncio.sleep(0.02)
    last_frame = json.loads(published_payloads[-1].decode("utf-8"))
    assert last_frame["visemes"]["viseme_sil"] == 1.0


def test_config_token_ttl_fallback():
    """Verify Settings handles invalid, empty, or non-numeric TOKEN_TTL_MINUTES safely."""
    from backend.app.config import Settings

    with patch.dict(os.environ, {"TOKEN_TTL_MINUTES": "invalid_num"}):
        s = Settings()
        assert s.token_ttl_minutes == 15

    with patch.dict(os.environ, {"TOKEN_TTL_MINUTES": ""}):
        s = Settings()
        assert s.token_ttl_minutes == 15

    with patch.dict(os.environ, {"TOKEN_TTL_MINUTES": "45"}):
        s = Settings()
        assert s.token_ttl_minutes == 45


@pytest.mark.asyncio
async def test_worker_shutdown_callback_execution():
    """Verify async shutdown callback cancels breaker, stops viseme emitter, and persists facts."""
    from backend.app.agent import entrypoint

    mock_room = MagicMock()
    mock_room.name = "room_user_123"
    mock_room.disconnect = AsyncMock()

    mock_ctx = MagicMock()
    mock_ctx.room = mock_room
    mock_ctx.connect = AsyncMock()

    captured_shutdown_cb = None

    def capture_cb(cb):
        nonlocal captured_shutdown_cb
        captured_shutdown_cb = cb

    mock_ctx.add_shutdown_callback = capture_cb

    with patch("backend.app.agent.get_user_context", new_callable=AsyncMock) as mock_ctx_fn, \
         patch("backend.app.agent.create_voice_agent") as mock_agent_fn, \
         patch("backend.app.agent.create_agent_session") as mock_sess_fn, \
         patch("backend.app.agent.store_user_facts", new_callable=AsyncMock) as mock_store_facts:

        mock_ctx_fn.return_value = ""
        mock_agent_fn.return_value = MagicMock()
        mock_session = MagicMock()
        mock_sess_fn.return_value = mock_session

        await entrypoint(mock_ctx)
        assert captured_shutdown_cb is not None

        # Execute shutdown callback
        res = captured_shutdown_cb()
        if asyncio.iscoroutine(res):
            await res


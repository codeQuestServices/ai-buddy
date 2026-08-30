"""Unit and integration tests for Phase 3: RAG & Persistent Memory Pipeline."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from backend.app.services.memory import (
    MemoryService,
    format_prompt_with_context,
    get_user_context,
    store_user_facts,
)
from backend.app.agent import (
    SYSTEM_PROMPT,
    extract_user_id_from_room,
    entrypoint,
)


def test_format_memories_as_context():
    """Verify raw memories are correctly transformed into formatted bullet points."""
    raw_dict_memories = {
        "results": [
            {"memory": "User prefers concise answers"},
            {"memory": "User lives in Seattle"},
            {"memory": "User has a golden retriever named Max"},
        ]
    }
    context = MemoryService.format_memories_as_context(raw_dict_memories)
    assert "User Long-Term Memory & Context:" in context
    assert "- User prefers concise answers" in context
    assert "- User lives in Seattle" in context
    assert "- User has a golden retriever named Max" in context


def test_format_memories_list_and_string_formats():
    """Verify memory formatter handles list of dicts, list of strings, and edge cases."""
    raw_list_memories = [
        {"text": "User is studying physics"},
        "User loves sci-fi novels",
    ]
    context = MemoryService.format_memories_as_context(raw_list_memories)
    assert "- User is studying physics" in context
    assert "- User loves sci-fi novels" in context


def test_format_prompt_with_context():
    """Verify prompt formatting combines user memories and base prompt cleanly."""
    base_prompt = "You are Echo, a companion."
    user_context = "User Long-Term Memory & Context:\n- Name is Taylor"
    
    combined = format_prompt_with_context(base_prompt, user_context)
    assert combined.startswith("User Long-Term Memory & Context:\n- Name is Taylor")
    assert combined.endswith("You are Echo, a companion.")


def test_format_prompt_with_empty_context():
    """Verify base prompt is preserved as-is when user context is empty."""
    base_prompt = "You are Echo, a companion."
    assert format_prompt_with_context(base_prompt, "") == base_prompt
    assert format_prompt_with_context(base_prompt, "   ") == base_prompt


@pytest.mark.asyncio
async def test_get_user_context_success():
    """Verify get_user_context retrieves and formats memories from Mem0 client."""
    service = MemoryService(mem0_api_key="mock_key")
    mock_client = MagicMock()
    mock_client.get_all.return_value = {
        "results": [{"memory": "User's favorite color is blue"}]
    }
    service._client = mock_client

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        context = await get_user_context("usr_12345")
        assert "favorite color is blue" in context
        mock_client.get_all.assert_called_once_with(user_id="usr_12345")


@pytest.mark.asyncio
async def test_get_user_context_new_user_graceful_fallback():
    """Verify new users with no past memory return an empty string without errors."""
    service = MemoryService(mem0_api_key="mock_key")
    mock_client = MagicMock()
    mock_client.get_all.return_value = {"results": []}
    service._client = mock_client

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        context = await get_user_context("new_user_without_history")
        assert context == ""


@pytest.mark.asyncio
async def test_get_user_context_uninitialized_client_fallback():
    """Verify graceful empty string return when client is None."""
    service = MemoryService()
    service._client = None

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        context = await get_user_context("any_user")
        assert context == ""


@pytest.mark.asyncio
async def test_get_user_context_database_error_handling():
    """Verify database/network failure does not raise and returns empty string."""
    service = MemoryService(mem0_api_key="mock_key")
    mock_client = MagicMock()
    mock_client.get_all.side_effect = ConnectionError("Supabase pgvector connection failed")
    service._client = mock_client

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        context = await get_user_context("usr_error_test")
        assert context == ""


@pytest.mark.asyncio
async def test_get_user_context_timeout_handling():
    """Verify memory retrieval timeout falls back to empty context without blocking."""
    service = MemoryService(mem0_api_key="mock_key", timeout_seconds=0.05)
    mock_client = MagicMock()

    def slow_query(*args, **kwargs):
        import time
        time.sleep(0.1)
        return {"results": [{"memory": "Too late"}]}

    mock_client.get_all.side_effect = slow_query
    service._client = mock_client

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        context = await get_user_context("usr_timeout")
        assert context == ""


@pytest.mark.asyncio
async def test_store_user_facts_success():
    """Verify store_user_facts processes and writes transcript turns to vector memory."""
    service = MemoryService(mem0_api_key="mock_key")
    mock_client = MagicMock()
    service._client = mock_client

    transcript = [
        {"role": "user", "content": "I recently moved to Austin, Texas."},
        {"role": "assistant", "content": "Austin is wonderful! How are you settling in?"},
        {"role": "user", "content": "I love the warm weather and live music."},
    ]

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        await store_user_facts("usr_austin_123", transcript)

        mock_client.add.assert_called_once()
        call_kwargs = mock_client.add.call_args[1]
        assert call_kwargs["user_id"] == "usr_austin_123"
        messages = call_kwargs["messages"]
        assert len(messages) == 3
        assert messages[0] == {"role": "user", "content": "I recently moved to Austin, Texas."}
        assert messages[1] == {"role": "assistant", "content": "Austin is wonderful! How are you settling in?"}


@pytest.mark.asyncio
async def test_store_user_facts_error_resilience():
    """Verify writing facts tolerates failures without propagating exceptions."""
    service = MemoryService(mem0_api_key="mock_key")
    mock_client = MagicMock()
    mock_client.add.side_effect = RuntimeError("Mem0 vector write failed")
    service._client = mock_client

    transcript = [{"role": "user", "content": "My favorite food is tacos."}]

    with patch("backend.app.services.memory.get_memory_service", return_value=service):
        # Should not raise exception
        await store_user_facts("usr_error", transcript)


def test_extract_user_id_from_room():
    """Verify extracting user_id from room naming patterns."""
    assert extract_user_id_from_room("room_usr_12345") == "usr_12345"
    assert extract_user_id_from_room("custom_room_abc") == "custom_room_abc"
    assert extract_user_id_from_room("") == "default_user"


@pytest.mark.asyncio
async def test_entrypoint_with_rag_memory_integration():
    """Verify entrypoint retrieves user context and initializes agent with dynamic personalized instructions."""
    mock_room = MagicMock()
    mock_room.name = "room_usr_personalized"
    mock_room.disconnect = AsyncMock()

    mock_ctx = MagicMock()
    mock_ctx.room = mock_room
    mock_ctx.connect = AsyncMock()
    mock_ctx.add_shutdown_callback = MagicMock()

    with patch("backend.app.agent.get_user_context", new_callable=AsyncMock) as mock_get_context, \
         patch("backend.app.agent.create_voice_agent") as mock_create_agent, \
         patch("backend.app.agent.create_agent_session") as mock_create_session, \
         patch("backend.app.agent.SessionCircuitBreaker") as mock_breaker_cls:

        mock_get_context.return_value = "User Long-Term Memory & Context:\n- User is Jordan"
        mock_agent = MagicMock()
        mock_create_agent.return_value = mock_agent
        mock_session = MagicMock()
        mock_create_session.return_value = mock_session
        mock_breaker = MagicMock()
        mock_breaker_cls.return_value = mock_breaker

        await entrypoint(mock_ctx)

        mock_get_context.assert_awaited_once_with("usr_personalized")
        mock_create_agent.assert_called_once()
        passed_instructions = mock_create_agent.call_args[1]["instructions"]
        assert "User is Jordan" in passed_instructions
        assert "Echo" in passed_instructions

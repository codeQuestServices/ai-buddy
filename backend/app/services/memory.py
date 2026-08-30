"""Memory service module integrating Mem0 and Supabase pgvector."""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from backend.app.config import get_settings

logger = logging.getLogger("ai_buddy.memory")


class MemoryService:
    """Service for managing long-term user memory and context retrieval."""

    def __init__(
        self,
        mem0_api_key: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        timeout_seconds: float = 5.0,
    ) -> None:
        settings = get_settings()
        self.mem0_api_key = mem0_api_key or getattr(settings, "mem0_api_key", None)
        self.supabase_url = supabase_url or settings.supabase_url
        self.supabase_key = supabase_key or settings.supabase_service_role_key
        self.timeout_seconds = timeout_seconds
        self._client: Optional[Any] = None
        self._init_client()

    def _init_client(self) -> None:
        """Initialize the Mem0 client."""
        if not self.mem0_api_key:
            logger.info("MEM0_API_KEY not configured; memory service operating in standalone/mock mode.")
            return

        try:
            from mem0 import MemoryClient
            self._client = MemoryClient(api_key=self.mem0_api_key)
            logger.info("Mem0 MemoryClient initialized successfully.")
        except Exception as e:
            logger.warning("Failed to initialize Mem0 client: %s", str(e))
            self._client = None

    async def get_user_context(self, user_id: str) -> str:
        """
        Retrieve persistent user facts from Mem0 vector storage and format for prompt injection.
        
        Returns an empty string gracefully if no memories exist or on error/timeout.
        """
        if not user_id or not user_id.strip():
            return ""

        stripped_id = user_id.strip()

        # If client is not initialized, return empty context
        if self._client is None:
            return ""

        try:
            # Run blocking Mem0 retrieval in thread pool with timeout
            loop = asyncio.get_running_loop()
            raw_memories = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: self._client.get_all(user_id=stripped_id)),
                timeout=self.timeout_seconds,
            )
            return self.format_memories_as_context(raw_memories)
        except asyncio.TimeoutError:
            logger.warning("Timeout (%ss) retrieving memories for user %s", self.timeout_seconds, stripped_id)
            return ""
        except Exception as e:
            logger.warning("Error retrieving memories for user %s: %s", stripped_id, str(e))
            return ""

    async def store_user_facts(self, user_id: str, transcript: List[Dict[str, str]]) -> None:
        """
        Extract and store persistent user facts from conversation transcript asynchronously.
        
        Catches all errors to ensure background execution never disrupts the main application flow.
        """
        if not user_id or not user_id.strip():
            return

        if not transcript or not isinstance(transcript, list):
            return

        stripped_id = user_id.strip()

        # Format messages for Mem0 ingestion
        messages: List[Dict[str, str]] = []
        for item in transcript:
            if not isinstance(item, dict):
                continue
            role = item.get("role", "user")
            content = item.get("content", "")
            if content and isinstance(content, str) and content.strip():
                # Map role to Mem0 expected roles (user / assistant)
                norm_role = "assistant" if role.lower() in ("assistant", "agent", "echo") else "user"
                messages.append({"role": norm_role, "content": content.strip()})

        if not messages:
            return

        if self._client is None:
            logger.debug("Mem0 client uninitialized; skipping storing facts for user %s", stripped_id)
            return

        try:
            loop = asyncio.get_running_loop()
            await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self._client.add(messages=messages, user_id=stripped_id),
                ),
                timeout=self.timeout_seconds,
            )
            logger.info("Successfully stored user facts for user %s (%d messages)", stripped_id, len(messages))
        except asyncio.TimeoutError:
            logger.warning("Timeout (%ss) writing facts for user %s", self.timeout_seconds, stripped_id)
        except Exception as e:
            logger.warning("Failed to store user facts for user %s: %s", stripped_id, str(e))

    @staticmethod
    def format_memories_as_context(raw_memories: Any) -> str:
        """Parse and format raw Mem0 memory results into clean prompt context."""
        if not raw_memories:
            return ""

        extracted_facts: List[str] = []

        # Mem0 returns list of dicts, or dict with 'results', or list of strings
        items: List[Any] = []
        if isinstance(raw_memories, dict):
            items = raw_memories.get("results", []) or raw_memories.get("memories", [])
        elif isinstance(raw_memories, list):
            items = raw_memories

        for item in items:
            fact_text = ""
            if isinstance(item, dict):
                fact_text = item.get("memory") or item.get("text") or item.get("data") or ""
            elif isinstance(item, str):
                fact_text = item

            fact_clean = str(fact_text).strip()
            if fact_clean and fact_clean not in extracted_facts:
                extracted_facts.append(fact_clean)

        if not extracted_facts:
            return ""

        facts_bulleted = "\n".join(f"- {fact}" for fact in extracted_facts)
        return (
            "User Long-Term Memory & Context:\n"
            f"{facts_bulleted}\n"
            "Use the above personal memories naturally during the conversation to make the interaction continuous and personal."
        )


_memory_service: Optional[MemoryService] = None


def get_memory_service() -> MemoryService:
    """Dependency provider for singleton MemoryService."""
    global _memory_service
    if _memory_service is None:
        _memory_service = MemoryService()
    return _memory_service


def format_prompt_with_context(base_prompt: str, user_context: str) -> str:
    """Combine base companion system prompt with prepended user memory context."""
    if not user_context or not user_context.strip():
        return base_prompt.strip()

    return f"{user_context.strip()}\n\n{base_prompt.strip()}"


async def get_user_context(user_id: str) -> str:
    """Module-level helper to retrieve formatted user memory context."""
    service = get_memory_service()
    return await service.get_user_context(user_id)


async def store_user_facts(user_id: str, transcript: List[Dict[str, str]]) -> None:
    """Module-level helper to asynchronously store conversation facts."""
    service = get_memory_service()
    await service.store_user_facts(user_id, transcript)

"""LiveKit Voice Agent Core for AI Buddy with RAG & Persistent Memory."""

import asyncio
import json
import logging
import math
import os
import time
from typing import Any, Callable, Dict, List, Optional

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    voice,
    AgentSession,
)
from livekit.plugins import openai, silero

from backend.app.services.memory import (
    format_prompt_with_context,
    get_user_context,
    store_user_facts,
)

logger = logging.getLogger("ai_buddy.agent")

# Maximum permitted session duration in seconds (20-minute circuit breaker usage cap)
MAX_SESSION_DURATION_SECONDS: float = 20.0 * 60.0  # 1200.0s

SYSTEM_PROMPT: str = """You are Echo, an empathetic, friendly, and emotionally intelligent 3D AI companion.
Your mission is to provide warm, uplifting, and supportive real-time voice conversations.

Key personality traits:
- Warm, caring, attentive, and genuinely interested in the user's thoughts and feelings.
- Speak naturally and conversationally, using concise spoken-dialogue phrasing rather than essays.
- Actively listen, validate the user's emotions, and ask gentle follow-up questions.
- Maintain a friendly, supportive, and cheerful tone at all times.
- Keep responses brief and interactive (1-3 sentences per turn) so natural back-and-forth dialogue flows effortlessly.
"""


class VisemeStreamEmitter:
    """Computes and broadcasts real-time Oculus viseme frames over the LiveKit data channel."""

    def __init__(self, fps: float = 30.0) -> None:
        self.fps = fps
        self.interval = 1.0 / max(1.0, fps)
        self._task: Optional[asyncio.Task] = None
        self._is_active: bool = False
        self._room: Any = None

    def start(self, room: Any) -> None:
        """Start broadcasting visemes for the active speaking turn."""
        if self._is_active:
            return
        self._room = room
        self._is_active = True
        self._task = asyncio.create_task(self._emit_loop())

    def stop(self) -> None:
        """Stop broadcasting and emit silence frame."""
        self._is_active = False
        if self._task and not self._task.done():
            self._task.cancel()
        if self._room:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._publish_silence(self._room))
            except RuntimeError:
                pass

    async def _publish_silence(self, room: Any) -> None:
        try:
            silence_payload = json.dumps({"visemes": {"viseme_sil": 1.0}}).encode("utf-8")
            if hasattr(room, "local_participant") and hasattr(room.local_participant, "publish_data"):
                res = room.local_participant.publish_data(silence_payload, reliable=False)
                if asyncio.iscoroutine(res):
                    await res
        except Exception as e:
            logger.debug("Failed to publish silence viseme: %s", e)

    async def _emit_loop(self) -> None:
        t = 0.0
        try:
            while self._is_active and self._room:
                # Generate organic phoneme cadence cycling
                aa = max(0.0, math.sin(t * 7.0) * 0.8 + 0.1)
                o = max(0.0, math.cos(t * 5.0) * 0.5)
                e = max(0.0, math.sin(t * 9.0 + 1.0) * 0.4)
                pp = 0.4 if (int(t * 4.0) % 5 == 0) else 0.0

                frame = {
                    "visemes": {
                        "viseme_AA": round(aa, 3),
                        "viseme_O": round(o, 3),
                        "viseme_E": round(e, 3),
                        "viseme_PP": round(pp, 3),
                        "viseme_sil": round(max(0.0, 1.0 - (aa + o + e)), 3),
                    }
                }
                payload = json.dumps(frame).encode("utf-8")

                if hasattr(self._room, "local_participant") and hasattr(self._room.local_participant, "publish_data"):
                    res = self._room.local_participant.publish_data(payload, reliable=False)
                    if asyncio.iscoroutine(res):
                        await res

                t += self.interval
                await asyncio.sleep(self.interval)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("Viseme emitter loop encountered error: %s", e)

    @property
    def is_active(self) -> bool:
        return self._is_active


class SessionCircuitBreaker:
    """Monitors session duration and automatically disconnects the room when the cap is reached."""

    def __init__(
        self,
        max_duration_seconds: float = MAX_SESSION_DURATION_SECONDS,
        on_timeout_callback: Optional[Callable[[], Any]] = None,
    ) -> None:
        self.max_duration_seconds = max_duration_seconds
        self.on_timeout_callback = on_timeout_callback
        self._timer_task: Optional[asyncio.Task] = None
        self._is_active: bool = False
        self._start_time: Optional[float] = None
        self._triggered: bool = False

    def start(self) -> None:
        """Start the circuit breaker timer."""
        self._is_active = True
        self._start_time = time.monotonic()
        self._triggered = False
        self._timer_task = asyncio.create_task(self._run_timer())

    async def _run_timer(self) -> None:
        try:
            await asyncio.sleep(self.max_duration_seconds)
            if self._is_active:
                self._triggered = True
                logger.warning(
                    "Session circuit breaker triggered: reached maximum duration of %s seconds. Disconnecting room.",
                    self.max_duration_seconds,
                )
                if self.on_timeout_callback:
                    res = self.on_timeout_callback()
                    if asyncio.iscoroutine(res):
                        await res
        except asyncio.CancelledError:
            self._is_active = False

    def cancel(self) -> None:
        """Cancel the circuit breaker timer."""
        self._is_active = False
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()

    @property
    def is_triggered(self) -> bool:
        return self._triggered

    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def elapsed_time(self) -> float:
        if self._start_time is None:
            return 0.0
        return time.monotonic() - self._start_time


class VoiceLifecycleHandlers:
    """Manages audio stream lifecycle hooks, state tracking, and conversation transcripts."""

    def __init__(
        self,
        on_user_started_speaking: Optional[Callable[[], Any]] = None,
        on_user_stopped_speaking: Optional[Callable[[], Any]] = None,
        on_agent_started_speaking: Optional[Callable[[], Any]] = None,
        on_agent_stopped_speaking: Optional[Callable[[], Any]] = None,
    ) -> None:
        self.on_user_started_speaking = on_user_started_speaking
        self.on_user_stopped_speaking = on_user_stopped_speaking
        self.on_agent_started_speaking = on_agent_started_speaking
        self.on_agent_stopped_speaking = on_agent_stopped_speaking
        self.user_is_speaking: bool = False
        self.agent_is_speaking: bool = False
        self.transcript: List[Dict[str, str]] = []

    def record_message(self, role: str, content: str) -> None:
        """Append a message turn to the session transcript."""
        if content and content.strip():
            self.transcript.append({"role": role, "content": content.strip()})

    def handle_user_state_change(self, old_state: Optional[str], new_state: str) -> None:
        """Process user speaking state transitions."""
        if new_state == "speaking" and not self.user_is_speaking:
            self.user_is_speaking = True
            if self.on_user_started_speaking:
                self.on_user_started_speaking()
        elif old_state == "speaking" and new_state != "speaking":
            self.user_is_speaking = False
            if self.on_user_stopped_speaking:
                self.on_user_stopped_speaking()

    def handle_agent_state_change(self, old_state: Optional[str], new_state: str) -> None:
        """Process agent speaking state transitions."""
        if new_state == "speaking" and not self.agent_is_speaking:
            self.agent_is_speaking = True
            if self.on_agent_started_speaking:
                self.on_agent_started_speaking()
        elif old_state == "speaking" and new_state != "speaking":
            self.agent_is_speaking = False
            if self.on_agent_stopped_speaking:
                self.on_agent_stopped_speaking()

    def register_session_listeners(self, session: AgentSession) -> None:
        """Register lifecycle event listeners on an active LiveKit AgentSession."""
        @session.on("user_state_changed")
        def _on_user_state(event: Any) -> None:
            old_s = getattr(event, "old_state", None)
            new_s = getattr(event, "new_state", "")
            self.handle_user_state_change(old_s, new_s)

        @session.on("agent_state_changed")
        def _on_agent_state(event: Any) -> None:
            old_s = getattr(event, "old_state", None)
            new_s = getattr(event, "new_state", "")
            self.handle_agent_state_change(old_s, new_s)

        @session.on("user_input_transcribed")
        def _on_user_transcription(event: Any) -> None:
            text = getattr(event, "transcript", "") or getattr(event, "text", "")
            if text:
                self.record_message("user", text)


def extract_user_id_from_room(room_name: str) -> str:
    """Extract or infer user_id from room naming conventions."""
    if room_name.startswith("room_"):
        return room_name[5:]
    return room_name or "default_user"


def create_voice_agent(
    instructions: str = SYSTEM_PROMPT,
    openai_api_key: Optional[str] = None,
    voice_name: str = "alloy",
    allow_interruptions: bool = True,
) -> voice.Agent:
    """Create and configure the LiveKit Voice Agent with VAD, Realtime model, and interruption handling."""
    api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    vad = silero.VAD.load()
    llm = openai.realtime.RealtimeModel(
        api_key=api_key,
        voice=voice_name,
    )
    return voice.Agent(
        instructions=instructions,
        vad=vad,
        llm=llm,
        turn_handling={"interruption": {"enabled": allow_interruptions}},
    )


def create_agent_session(
    allow_interruptions: bool = True,
    **kwargs: Any,
) -> AgentSession:
    """Create and configure the LiveKit AgentSession."""
    return AgentSession(
        allow_interruptions=allow_interruptions,
        **kwargs,
    )


async def entrypoint(ctx: JobContext) -> None:
    """LiveKit Agents worker entry point with RAG memory injection and persistent facts extraction."""
    logger.info("Connecting agent to room %s", ctx.room.name)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Determine user identity for memory retrieval
    user_id = extract_user_id_from_room(ctx.room.name)

    # Retrieve persistent long-term memories for dynamic prompt injection
    user_context = await get_user_context(user_id)
    dynamic_instructions = format_prompt_with_context(SYSTEM_PROMPT, user_context)

    # Instantiate Agent with personalized instructions & Session
    agent = create_voice_agent(instructions=dynamic_instructions)
    session = create_agent_session()

    # Initialize real-time Oculus viseme emitter for 3D avatar lip synchronization
    viseme_emitter = VisemeStreamEmitter(fps=30.0)

    # Register lifecycle event hooks
    lifecycle_handlers = VoiceLifecycleHandlers(
        on_user_started_speaking=lambda: logger.info("User started speaking"),
        on_user_stopped_speaking=lambda: logger.info("User stopped speaking"),
        on_agent_started_speaking=lambda: (
            logger.info("Agent started speaking"),
            viseme_emitter.start(ctx.room),
        ),
        on_agent_stopped_speaking=lambda: (
            logger.info("Agent stopped speaking"),
            viseme_emitter.stop(),
        ),
    )
    lifecycle_handlers.register_session_listeners(session)

    # Initialize 20-minute Session Circuit Breaker
    circuit_breaker = SessionCircuitBreaker(
        max_duration_seconds=MAX_SESSION_DURATION_SECONDS,
        on_timeout_callback=lambda: ctx.room.disconnect(),
    )
    circuit_breaker.start()

    # On room disconnect / shutdown, store extracted user facts to vector memory
    async def on_shutdown() -> None:
        circuit_breaker.cancel()
        viseme_emitter.stop()
        if lifecycle_handlers.transcript:
            try:
                await store_user_facts(user_id, list(lifecycle_handlers.transcript))
            except Exception as e:
                logger.warning("Error persisting user facts on shutdown: %s", e)

    ctx.add_shutdown_callback(on_shutdown)

    # Start the session with the room
    start_res = session.start(agent, room=ctx.room)
    if asyncio.iscoroutine(start_res):
        await start_res


def run_agent_worker() -> None:
    """Start the LiveKit agent worker process."""
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    run_agent_worker()

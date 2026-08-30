# Active Context

## Current Status
- **Phase**: Phase 3 (RAG & Persistent Memory Pipeline) Complete & Verified ([APPROVED])
- **Active Task**: Mem0 vector memory service with Supabase pgvector integration and automated test suite passing (33/33 tests).

## Recent Changes
- Implemented `backend/app/services/memory.py` using `mem0ai`:
  - Configured `MemoryService` with Mem0 vector store connection for persistent user memory extraction and retrieval.
  - Implemented `get_user_context(user_id)` retrieving top long-term facts (names, preferences, historical details) formatted cleanly for dynamic system prompt injection.
  - Implemented `store_user_facts(user_id, transcript)` extracting and persisting conversation facts asynchronously in the background.
  - Added robust timeout protection and graceful fallback for new users with no past memory history and resilience during database/network errors.
  - Added `format_memories_as_context` and `format_prompt_with_context` helpers.
- Updated `backend/app/agent.py`:
  - On room join, retrieves user memory context and dynamically prepends personal memories to the agent's base companion prompt ("Echo / AI Buddy").
  - Tracks session dialogue turns in `VoiceLifecycleHandlers`.
  - On room disconnect / shutdown, triggers `store_user_facts` in a background task with accumulated session transcripts.
- Created `tests/test_memory.py` covering:
  - Fact retrieval formatting and context injection.
  - Asynchronous transcript processing and memory storage.
  - Graceful fallback for new users without existing memory history.
  - Error and timeout resilience when database or vector store operations fail.
  - LiveKit `JobContext` entrypoint integration with personalized RAG prompt initialization.
- Verified test suite with `pytest tests/test_memory.py` (13/13 passed) and full project suite `pytest` (33/33 passed).

## Next Steps
- Phase 4: Expo React Native 3D Avatar canvas with Oculus visemes in React Three Fiber.
- Phase 5: RevenueCat mobile subscription paywall & client integration.

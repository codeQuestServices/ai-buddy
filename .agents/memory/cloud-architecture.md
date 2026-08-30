# Cloud Architecture & Infrastructure Configuration

## Infrastructure & Managed Services
1. **LiveKit Cloud / Server**:
   - WebRTC media routing, selective forwarding, and room state management.
   - LiveKit Agent Worker connects to LiveKit to handle agent audio/video tracks.
2. **OpenAI Realtime API**:
   - High-performance, low-latency multimodal dialogue generation.
3. **Supabase (PostgreSQL + pgvector)**:
   - User authentication and persistent storage.
   - Vector embeddings storage for long-term memory retrieval via Mem0.
4. **Mem0 Platform / SDK**:
   - Manages user personalized memory extraction and dynamic context injection.
5. **RevenueCat**:
   - In-app purchase verification and subscription entitlement management.

## Environment Variable Schemas (Strictly no secrets stored in repository)

### Backend (`/backend/.env`)
| Variable | Description |
|---|---|
| `LIVEKIT_URL` | WebSocket URL for LiveKit server instance (e.g. `wss://your-project.livekit.cloud`) |
| `LIVEKIT_API_KEY` | LiveKit Server API Key |
| `LIVEKIT_API_SECRET` | LiveKit Server API Secret |
| `OPENAI_API_KEY` | OpenAI API Key for Realtime API |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key (Backend worker only) |
| `MEM0_API_KEY` | Mem0 API Key |

### Mobile Client (`/mobile/.env`)
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project public URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key |
| `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` | RevenueCat public Apple Store SDK API Key |

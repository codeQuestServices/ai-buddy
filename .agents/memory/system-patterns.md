# System Patterns & Architecture Blueprint

## 1. Directory Structure & Boundary Isolation
```
ai-buddy/
├── .agents/
│   └── memory/              # Autonomous AI memory bank (project-brief, patterns, cloud, context, progress)
├── backend/                 # Python 3.11+ LiveKit agent worker & service integration
│   ├── requirements.txt     # Python backend dependencies
│   ├── pytest.ini           # Pytest test discovery & execution configuration
│   └── .env.example         # Backend environment variables template
├── mobile/                  # Expo (React Native) iOS/Android app
│   ├── src/                 # Mobile source code
│   │   ├── components/      # UI components (Canvas, AudioControls, etc.)
│   │   ├── hooks/           # Custom hooks (LiveKit session, RevenueCat, etc.)
│   │   └── services/        # Client API & token retrieval
│   ├── package.json         # Node dependencies & scripts
│   ├── tsconfig.json        # TypeScript configuration
│   └── .env.example         # Mobile environment variables template
└── tests/                   # Python unit and integration tests
```

## 2. Component Communication & Integration Patterns
- **Audio & Video Streaming**:
  - LiveKit Agents SDK runs the Python worker handling OpenAI Realtime streaming.
  - Mobile client connects using `livekit-react-native` and consumes audio tracks and viseme metadata / events.
- **3D Rendering & Viseme Animation**:
  - React Three Fiber (`@react-three/fiber`) renders 3D avatar GLTF models.
  - Avatar morph target names strictly follow Oculus conventions (`viseme_AA`, `viseme_E`, `viseme_O`, `viseme_PP`, `viseme_TH`, `viseme_DD`, etc.).
  - Speech events drive the smooth interpolation of blendshapes in real-time.
- **Authentication & Room Tokens**:
  - Mobile client authenticates with Supabase Auth.
  - Supabase Edge Functions or Backend service verifies user identity & RevenueCat entitlements, then mints a short-lived LiveKit access token for the room.
- **Memory & Personalization**:
  - Python backend integrates Mem0 Python SDK with Supabase pgvector to retrieve past user context and store updated episodic memories.

## 3. Engineering & Quality Standards
- **Actor-Critic Refinement Protocol**: Internal refinement loop ensuring static analysis, zero type errors, and verified tests before task completion.
- **Type Safety**: Expo TypeScript builds must produce 0 type errors on `npx tsc --noEmit`.
- **Python Quality**: Python code follows PEP 8 standards and passes `pytest` test suites.

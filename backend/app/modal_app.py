"""Modal deployment entrypoint for AI Buddy LiveKit backend voice agent worker."""

import os
import sys
import modal

# ------------------------------------------------------------------------------
# 1. Application Definition
# ------------------------------------------------------------------------------
app = modal.App("ai-buddy-agent")

# ------------------------------------------------------------------------------
# 2. Container Image Specification (Debian Slim Python 3.11 + Audio Binaries)
# ------------------------------------------------------------------------------
# Resolve source package based on execution directory
local_source_package = "backend" if os.path.exists("backend") else "app"

agent_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libopus-dev", "git")
    .pip_install(
        "fastapi>=0.110.0",
        "uvicorn>=0.29.0",
        "livekit-agents>=0.8.0",
        "livekit-api>=0.8.0",
        "livekit-plugins-openai>=0.8.0",
        "livekit-plugins-silero>=0.8.0",
        "openai>=1.0.0",
        "mem0ai>=0.1.0",
        "supabase>=2.0.0",
        "pyjwt>=2.8.0",
        "httpx>=0.27.0",
        "python-dotenv>=1.0.0",
        "modal>=1.0.0",
    )
    .add_local_python_source(local_source_package)
)

# ------------------------------------------------------------------------------
# 3. Secrets Configuration (8 Core Backend Environment Keys)
# ------------------------------------------------------------------------------
# Required environment keys referenced from Modal Secret 'ai-buddy-secrets':
# 1. LIVEKIT_URL
# 2. LIVEKIT_API_KEY
# 3. LIVEKIT_API_SECRET
# 4. OPENAI_API_KEY
# 5. SUPABASE_URL
# 6. SUPABASE_SERVICE_ROLE_KEY
# 7. REVENUECAT_SECRET_KEY
# 8. MEM0_API_KEY

REQUIRED_SECRET_KEYS = [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REVENUECAT_SECRET_KEY",
    "MEM0_API_KEY",
]

secrets = [modal.Secret.from_name("ai-buddy-secrets")]

# ------------------------------------------------------------------------------
# 4. Agent Worker Function Definition
# ------------------------------------------------------------------------------
@app.function(
    image=agent_image,
    secrets=secrets,
    min_containers=1,  # Guarantees at least 1 warm worker container continuously listening for WebRTC dispatches (keep_warm=1)
    timeout=86400,     # 24-hour maximum execution limit to maintain long-running worker connections
)
def run_livekit_worker() -> None:
    """
    Long-running Modal worker execution loop for the LiveKit Voice Agent.
    Continuously listens for incoming room connections and executes the VoicePipeline.
    """
    # Verify environment keys loaded from ai-buddy-secrets
    missing_keys = [k for k in REQUIRED_SECRET_KEYS if not os.getenv(k)]
    if missing_keys:
        print(f"[WARN] Some environment keys are not set: {missing_keys}", file=sys.stderr)
    else:
        print("[INFO] All 8 required environment keys loaded from ai-buddy-secrets successfully.")

    print("[INFO] Starting LiveKit Voice Agent Worker on Modal container...")
    try:
        from backend.app.agent import run_agent_worker
    except ImportError:
        from app.agent import run_agent_worker

    # Start the continuous worker loop
    run_agent_worker()


# ------------------------------------------------------------------------------
# 5. Local Entrypoint for CLI Testing & Deployment
# ------------------------------------------------------------------------------
@app.local_entrypoint()
def main() -> None:
    """Local trigger entrypoint to test or spawn the worker remotely on Modal."""
    print("Launching AI Buddy LiveKit Voice Agent on Modal...")
    run_livekit_worker.remote()

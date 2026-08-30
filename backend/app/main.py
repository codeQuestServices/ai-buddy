"""FastAPI application entry point for AI Buddy Backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.auth import router as auth_router

app = FastAPI(
    title="AI Buddy Backend API",
    description="LiveKit real-time voice agent and secure token infrastructure API.",
    version="1.0.0",
)

# Configure CORS for Expo React Native and Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)


@app.get("/healthz", tags=["health"])
async def health_check() -> dict:
    """Service health check endpoint."""
    return {"status": "ok", "service": "ai-buddy-backend"}

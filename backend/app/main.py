"""FastAPI application entry point for AI Buddy Backend."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.auth import router as auth_router

app = FastAPI(
    title="AI Buddy Backend API",
    description="LiveKit real-time voice agent and secure token infrastructure API.",
    version="1.0.0",
)

# Custom validation exception handler to return HTTP 400 on invalid or missing payload
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors with HTTP 400 Bad Request."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "detail": "Invalid or missing request parameters",
            "errors": exc.errors(),
        },
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

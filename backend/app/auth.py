"""Authentication and LiveKit token generation router."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import livekit.api as lk_api

from backend.app.config import Settings, get_settings
from backend.app.services.entitlements import (
    EntitlementService,
    get_entitlement_service,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class TokenRequest(BaseModel):
    """Request payload for minting LiveKit room access token."""
    user_id: str = Field(
        ...,
        description="Unique identifier of the authenticated user",
        min_length=1,
    )
    room_name: Optional[str] = Field(
        None,
        description="Optional custom room name. Defaults to user-specific room if omitted.",
        min_length=1,
    )


class TokenResponse(BaseModel):
    """Response payload containing short-lived LiveKit access token."""
    token: str = Field(..., description="Short-lived signed JWT for LiveKit room connection")
    room: str = Field(..., description="Target LiveKit room name")
    expires_at: int = Field(..., description="Unix timestamp expiration of the token")


@router.post(
    "/token",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Mint LiveKit Room Access Token",
    description="Validates user entitlements and mints a short-lived LiveKit access token.",
)
async def mint_room_token(
    request: TokenRequest,
    settings: Settings = Depends(get_settings),
    entitlement_service: EntitlementService = Depends(get_entitlement_service),
) -> TokenResponse:
    """Validate entitlement and generate a short-lived LiveKit JWT token."""
    user_id = request.user_id.strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id cannot be empty or blank",
        )

    # Verify user entitlement status
    is_entitled = await entitlement_service.verify_user_entitlement(user_id)
    if not is_entitled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have an active entitlement to start a session",
        )

    # Determine room name
    target_room = (
        request.room_name.strip()
        if request.room_name and request.room_name.strip()
        else f"room_{user_id}"
    )

    ttl_minutes = settings.token_ttl_minutes
    expires_delta = timedelta(minutes=ttl_minutes)
    expires_at = int((datetime.now(timezone.utc) + expires_delta).timestamp())

    # Mint LiveKit Access Token
    try:
        token = (
            lk_api.AccessToken(
                settings.livekit_api_key,
                settings.livekit_api_secret,
            )
            .with_identity(user_id)
            .with_name(f"user-{user_id}")
            .with_grants(
                lk_api.VideoGrants(
                    room_join=True,
                    room=target_room,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                )
            )
            .with_ttl(expires_delta)
        )
        jwt_token = token.to_jwt()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate access token: {str(e)}",
        )

    return TokenResponse(
        token=jwt_token,
        room=target_room,
        expires_at=expires_at,
    )

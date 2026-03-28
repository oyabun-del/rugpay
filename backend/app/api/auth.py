from typing import Optional
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_id, get_optional_current_user_id
from app.services.auth_service import AuthService
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    MessageResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(
    data: UserRegister,
    response: Response,
    guest_user_id: Optional[int] = Depends(get_optional_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Register a new user"""
    service = AuthService(db)
    result = await service.register(data, guest_user_id=guest_user_id)
    # Clear temporary guest cookies after successful registration.
    response.delete_cookie("guest_access_token")
    response.delete_cookie("guest_expires_at")
    return result


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    response: Response,
    guest_user_id: Optional[int] = Depends(get_optional_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password"""
    service = AuthService(db)
    result = await service.login(data, guest_user_id=guest_user_id)
    # Clear temporary guest cookies after successful login.
    response.delete_cookie("guest_access_token")
    response.delete_cookie("guest_expires_at")
    return result


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user"""
    service = AuthService(db)
    return await service.get_current_user(user_id)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send password reset instructions to email."""
    service = AuthService(db)
    return await service.forgot_password(data)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using token from email."""
    service = AuthService(db)
    return await service.reset_password(data)

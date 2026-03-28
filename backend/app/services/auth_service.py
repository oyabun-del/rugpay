from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta, datetime
import secrets
from fastapi import HTTPException, status
from urllib.parse import quote
from typing import Optional, Tuple
from app.repositories.user_repository import UserRepository
from app.repositories.referral_repository import ReferralRepository
from app.repositories.order_repository import OrderRepository
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
)
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    MessageResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.core.config import settings
from app.core.logging import get_logger
from app.services.email_service import EmailService

logger = get_logger(__name__)


class AuthService:
    GUEST_EMAIL_SUFFIX = "@guest.gamecover.local"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.referral_repo = ReferralRepository(db)
        self.order_repo = OrderRepository(db)
        self.email_service = EmailService()
    
    async def register(self, data: UserRegister, guest_user_id: Optional[int] = None) -> TokenResponse:
        # Check if email exists
        existing_user = await self.user_repo.get_by_email(data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Handle referral
        referred_by = None
        if data.referral_code:
            referrer = await self.user_repo.get_by_referral_code(data.referral_code)
            if referrer:
                referred_by = referrer.id
            else:
                logger.warning("Invalid referral code", referral_code=data.referral_code)
        
        # Create user
        password_hash = get_password_hash(data.password)
        user = await self.user_repo.create(
            email=data.email,
            password_hash=password_hash,
            referred_by=referred_by,
        )
        
        # Create referral record if applicable
        if referred_by:
            await self.referral_repo.create(inviter_id=referred_by, invited_id=user.id)
            logger.info("Referral created", inviter_id=referred_by, invited_id=user.id)
        
        logger.info("User registered", user_id=user.id, email=user.email)
        await self.email_service.send_welcome_email(user.email)

        if guest_user_id:
            await self._merge_guest_orders_into_user(guest_user_id, user.id)
        
        # Generate token
        token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
        
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user)
        )
    
    async def login(self, data: UserLogin, guest_user_id: Optional[int] = None) -> TokenResponse:
        user = await self.user_repo.get_by_email(data.email)
        
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled"
            )
        
        logger.info("User logged in", user_id=user.id)

        if guest_user_id:
            await self._merge_guest_orders_into_user(guest_user_id, user.id)
        
        token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
        
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user)
        )
    
    async def get_current_user(self, user_id: int) -> UserResponse:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return UserResponse.model_validate(user)

    async def forgot_password(self, data: ForgotPasswordRequest) -> MessageResponse:
        user = await self.user_repo.get_by_email(data.email)
        if user:
            token = create_password_reset_token(user.email)
            frontend = (settings.FRONTEND_URL or "").rstrip("/")
            reset_url = f"{frontend}/reset-password?token={quote(token)}"
            await self.email_service.send_password_reset_email(user.email, reset_url)

        # Do not leak whether user exists
        return MessageResponse(message="If the email exists, reset instructions were sent")

    async def reset_password(self, data: ResetPasswordRequest) -> MessageResponse:
        email = decode_password_reset_token(data.token)
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user.password_hash = get_password_hash(data.new_password)
        await self.db.commit()
        return MessageResponse(message="Password has been updated")

    def _is_temporary_user_email(self, email: str) -> bool:
        return email.endswith(self.GUEST_EMAIL_SUFFIX)

    async def _merge_guest_orders_into_user(self, guest_user_id: int, target_user_id: int) -> None:
        guest_user = await self.user_repo.get_by_id(guest_user_id)
        if not guest_user or not self._is_temporary_user_email(guest_user.email):
            return
        moved = await self.order_repo.transfer_orders_to_user(guest_user_id, target_user_id)
        if moved:
            logger.info(
                "Transferred guest orders to authenticated user",
                guest_user_id=guest_user_id,
                target_user_id=target_user_id,
                moved_orders=moved,
            )

    async def create_temporary_user_session(self, order_seed: Optional[str] = None) -> Tuple[str, datetime]:
        seed = order_seed or secrets.token_hex(4)
        email = f"guest-{seed}-{secrets.token_hex(4)}{self.GUEST_EMAIL_SUFFIX}"
        password_hash = get_password_hash(secrets.token_urlsafe(16))
        user = await self.user_repo.create(
            email=email,
            password_hash=password_hash,
            referred_by=None,
        )
        ttl_minutes = max(1, int(settings.GUEST_SESSION_TTL_MINUTES))
        expires_delta = timedelta(minutes=ttl_minutes)
        expires_at = datetime.utcnow() + expires_delta
        token = create_access_token(
            {"sub": str(user.id), "is_admin": False},
            expires_delta=expires_delta,
        )
        logger.info("Temporary user session created", user_id=user.id, expires_at=expires_at.isoformat())
        return token, expires_at

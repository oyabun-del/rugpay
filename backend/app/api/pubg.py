from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user_id, get_optional_current_user_id, decode_access_token
from app.core.config import settings
from app.core.constants import GUEST_EMAIL_SUFFIX
from app.repositories.user_repository import UserRepository
from app.services.order_service import OrderService
from app.services.auth_service import AuthService
from app.services.antifraud_service import AntifraudService
from app.schemas.order import PubgOrderCreate, CreateOrderResponse
from app.schemas.auth import UserResponse
from app.schemas.pubg import PubgPackageInfo, PubgPackagesResponse
from app.services.fazercards_service import FazerCardsService

router = APIRouter()


@router.get("/packages", response_model=PubgPackagesResponse)
async def get_pubg_packages():
    service = FazerCardsService()
    raw_packages = await service.get_pubg_packages_with_prices()
    packages: list[PubgPackageInfo] = [PubgPackageInfo(**pkg) for pkg in raw_packages]
    return PubgPackagesResponse(packages=packages)


@router.post("/create", response_model=CreateOrderResponse)
async def create_pubg_order(
    data: PubgOrderCreate,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    bearer_user_id: Optional[int] = Depends(get_optional_current_user_id),
):
    """Create a PUBG UC order with Wata payment link (guest or authenticated)."""
    ip_address = request.client.host if request.client else None
    user_id = bearer_user_id
    guest_access_token: Optional[str] = None
    guest_expires_at = None
    guest_user = None

    if not user_id:
        cookie_token = request.cookies.get("guest_access_token")
        if cookie_token:
            payload = decode_access_token(cookie_token)
            if payload:
                cookie_user_id = payload.get("sub")
                if cookie_user_id is not None:
                    user_id = int(cookie_user_id)

    if not user_id:
        auth_service = AuthService(db)
        guest_access_token, guest_expires_at = await auth_service.create_temporary_user_session(
            order_seed=f"pubg_{data.uid}",
        )
        payload = decode_access_token(guest_access_token)
        if not payload:
            raise HTTPException(status_code=500, detail="Failed to create guest session")
        user_id = int(payload.get("sub"))
        user_repo = UserRepository(db)
        guest_user = await user_repo.get_by_id(user_id)
        if guest_expires_at:
            guest_ttl_seconds = max(60, int(settings.GUEST_SESSION_TTL_MINUTES) * 60)
            is_prod = not settings.DEBUG
            response.set_cookie(
                key="guest_access_token",
                value=guest_access_token,
                max_age=guest_ttl_seconds,
                expires=guest_ttl_seconds,
                httponly=False,
                secure=is_prod,
                samesite="lax",
                path="/",
            )
            response.set_cookie(
                key="guest_expires_at",
                value=guest_expires_at.isoformat(),
                max_age=guest_ttl_seconds,
                expires=guest_ttl_seconds,
                httponly=False,
                secure=is_prod,
                samesite="lax",
                path="/",
            )

    antifraud = AntifraudService(db)
    await antifraud.perform_checks(
        steam_nickname=data.uid,
        email=f"pubg_{data.uid}{GUEST_EMAIL_SUFFIX}",
        amount=0,
        user_id=user_id,
        ip_address=ip_address,
        skip_amount_check=True,
    )

    service = OrderService(db)
    result = await service.create_pubg_order_with_payment_link(data, user_id)
    if guest_access_token and guest_expires_at and guest_user:
        result.guest_access_token = guest_access_token
        result.guest_expires_at = guest_expires_at
        result.guest_user = UserResponse.model_validate(guest_user)
    return result


@router.post("/create/auth", response_model=CreateOrderResponse)
async def create_pubg_order_authenticated(
    data: PubgOrderCreate,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a PUBG UC order with Wata payment link (authenticated user)."""
    ip_address = request.client.host if request.client else None

    antifraud = AntifraudService(db)
    await antifraud.perform_checks(
        steam_nickname=data.uid,
        email=f"pubg_{data.uid}{GUEST_EMAIL_SUFFIX}",
        amount=0,
        user_id=user_id,
        ip_address=ip_address,
        skip_amount_check=True,
    )

    service = OrderService(db)
    return await service.create_pubg_order_with_payment_link(data, user_id)

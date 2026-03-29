from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user_id, get_optional_current_user_id, decode_access_token
from app.core.config import settings
from app.services.order_service import OrderService
from app.services.antifraud_service import AntifraudService
from app.services.auth_service import AuthService
from app.repositories.user_repository import UserRepository
from app.schemas.order import (
    OrderCreate,
    OrderResponse,
    OrderListResponse,
    OrderCalculation,
    CreateOrderResponse,
    PaymentProvidersResponse,
)
from app.schemas.auth import UserResponse

router = APIRouter()


@router.post("/calculate", response_model=OrderCalculation)
async def calculate_order(
    amount: float = Query(..., gt=0),
    promocode: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Calculate order total with commission and discounts"""
    service = OrderService(db)
    return await service.calculate_order(amount=amount, promocode=promocode)


@router.post("/create", response_model=CreateOrderResponse)
async def create_order(
    data: OrderCreate,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    bearer_user_id: Optional[int] = Depends(get_optional_current_user_id),
):
    """Create a new top-up order and Wata payment link (guest or authenticated)."""
    ip_address = request.client.host if request.client else None
    user_id = bearer_user_id
    guest_access_token: Optional[str] = None
    guest_expires_at = None
    guest_user = None

    # Try to recover temporary session from cookie when Authorization header is absent.
    if not user_id:
        cookie_token = request.cookies.get("guest_access_token")
        if cookie_token:
            try:
                payload = decode_access_token(cookie_token)
                cookie_user_id = payload.get("sub")
                if cookie_user_id is not None:
                    user_id = int(cookie_user_id)
            except Exception:
                user_id = None

    # Create temporary user session for anonymous order flow.
    if not user_id:
        auth_service = AuthService(db)
        guest_access_token, guest_expires_at = await auth_service.create_temporary_user_session(
            order_seed=data.steam_nickname,
        )
        payload = decode_access_token(guest_access_token)
        user_id = int(payload.get("sub"))
        user_repo = UserRepository(db)
        guest_user = await user_repo.get_by_id(user_id)
        if guest_expires_at:
            expires_iso = guest_expires_at.isoformat()
            guest_ttl_seconds = max(60, int(settings.GUEST_SESSION_TTL_MINUTES) * 60)
            response.set_cookie(
                key="guest_access_token",
                value=guest_access_token,
                max_age=guest_ttl_seconds,
                expires=guest_ttl_seconds,
                httponly=False,
                secure=False,
                samesite="lax",
                path="/",
            )
            response.set_cookie(
                key="guest_expires_at",
                value=expires_iso,
                max_age=guest_ttl_seconds,
                expires=guest_ttl_seconds,
                httponly=False,
                secure=False,
                samesite="lax",
                path="/",
            )

    antifraud = AntifraudService(db)
    email_for_checks = OrderService._resolve_order_email(data)
    await antifraud.perform_checks(
        steam_nickname=data.steam_nickname,
        email=email_for_checks,
        amount=data.amount,
        user_id=user_id,
        ip_address=ip_address,
    )

    service = OrderService(db)
    result = await service.create_order_with_payment_link(data, user_id)
    if guest_access_token and guest_expires_at and guest_user:
        result.guest_access_token = guest_access_token
        result.guest_expires_at = guest_expires_at
        result.guest_user = UserResponse.model_validate(guest_user)
    return result


@router.post("/create/auth", response_model=CreateOrderResponse)
async def create_order_authenticated(
    data: OrderCreate,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new top-up order and Wata payment link (authenticated user)."""
    ip_address = request.client.host if request.client else None

    antifraud = AntifraudService(db)
    email_for_checks = OrderService._resolve_order_email(data)
    await antifraud.perform_checks(
        steam_nickname=data.steam_nickname,
        email=email_for_checks,
        amount=data.amount,
        user_id=user_id,
        ip_address=ip_address,
    )

    service = OrderService(db)
    return await service.create_order_with_payment_link(data, user_id)


@router.get("/payment-providers", response_model=PaymentProvidersResponse)
async def get_payment_providers(
    db: AsyncSession = Depends(get_db),
):
    """Get available payment providers and default provider."""
    service = OrderService(db)
    return service.get_payment_providers()


@router.get("/my", response_model=OrderListResponse)
async def get_my_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's orders"""
    service = OrderService(db)
    return await service.get_user_orders(user_id, page, per_page)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get order by ID"""
    service = OrderService(db)
    return await service.get_order(order_id, user_id)

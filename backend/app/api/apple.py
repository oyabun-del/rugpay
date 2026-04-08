from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_optional_current_user_id, decode_access_token
from app.core.logging import get_logger
from app.repositories.order_repository import OrderRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.wata_voucher_service import WataVoucherService
from app.models.order import OrderType, OrderStatus
from app.schemas.order import OrderResponse, CreateOrderResponse
from app.schemas.auth import UserResponse

router = APIRouter()
logger = get_logger(__name__)


@router.get("/config")
async def get_apple_config():
    """Return public Apple Gift Card config (discount, commission)."""
    return {
        "discount_percent": settings.APPLE_DISCOUNT_PERCENT,
        "commission_percent": settings.APPLE_COMMISSION_PERCENT,
    }


@router.get("/regions")
async def get_apple_regions():
    """Return available Apple Wallet Code regions."""
    service = WataVoucherService()
    try:
        regions = await service.get_apple_services()
        return {"regions": regions}
    except Exception as e:
        logger.error("Failed to fetch Apple regions", error=str(e))
        raise HTTPException(status_code=503, detail="Сервис временно недоступен")


@router.get("/denominations/{service_id}")
async def get_apple_denominations(service_id: str):
    """Return available denominations for an Apple Wallet Code region."""
    service = WataVoucherService()
    try:
        data = await service.get_vouchers(service_id)
        return data
    except Exception as e:
        logger.error("Failed to fetch Apple denominations", service_id=service_id, error=str(e))
        raise HTTPException(status_code=503, detail="Сервис временно недоступен")


class AppleOrderCreate(BaseModel):
    email: EmailStr
    voucher_id: str
    min_price: float
    region: str = ""  # region code for display, e.g. "US"


@router.post("/create", response_model=CreateOrderResponse)
async def create_apple_order(
    data: AppleOrderCreate,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    bearer_user_id: Optional[int] = Depends(get_optional_current_user_id),
):
    """Create an Apple Gift Card order: save to DB, create Wata DG order, return payment link."""
    voucher_service = WataVoucherService()
    frontend_url = (settings.FRONTEND_URL or "https://rugpay.ru").rstrip("/")

    # --- Resolve or create user (guest session) ---
    user_id = bearer_user_id
    guest_access_token: Optional[str] = None
    guest_expires_at = None
    guest_user = None

    if not user_id:
        cookie_token = request.cookies.get("guest_access_token")
        if cookie_token:
            payload = decode_access_token(cookie_token)
            if payload:
                cid = payload.get("sub")
                if cid is not None:
                    user_id = int(cid)

    if not user_id:
        auth_service = AuthService(db)
        guest_access_token, guest_expires_at = await auth_service.create_temporary_user_session(
            order_seed=f"apple_{data.voucher_id}",
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

    # --- Calculate price ---
    final_price = voucher_service.apply_commission(data.min_price)
    discounted_price = voucher_service.apply_discount(final_price, data.min_price)
    commission = round(discounted_price - data.min_price, 2)

    # --- Save order to DB ---
    order_repo = OrderRepository(db)
    order = await order_repo.create(
        user_id=user_id,
        order_type=OrderType.APPLE,
        email=data.email,
        amount=data.min_price,
        commission=max(commission, 0),
        final_amount=discounted_price,
        apple_voucher_id=data.voucher_id,
        apple_region=data.region or None,
    )

    # --- Create Wata DG voucher order ---
    try:
        result = await voucher_service.create_order(
            voucher_id=data.voucher_id,
            min_price=data.min_price,
            email=data.email,
            internal_order_id=str(order.id),
            success_redirect_url=f"{frontend_url}/apple/success",
            fail_redirect_url=f"{frontend_url}/apple?status=fail",
        )
    except RuntimeError as e:
        logger.error("Apple Wata DG order failed", order_id=order.id, error=str(e))
        await order_repo.update_status(order.id, OrderStatus.FAILED)
        raise HTTPException(status_code=502, detail="Не удалось создать заказ. Попробуйте позже.")

    payment_link = result.get("paymentLink")
    wata_order_id = result.get("orderId")

    if not payment_link:
        logger.error("No paymentLink in Wata voucher response", order_id=order.id, result=result)
        await order_repo.update_status(order.id, OrderStatus.FAILED)
        raise HTTPException(status_code=502, detail="Не удалось получить ссылку на оплату.")

    # Store Wata order ID for webhook lookup
    order.apple_wata_order_id = str(wata_order_id) if wata_order_id else None
    order.steam_response = f"wata_dg_payment:{payment_link}"
    await db.commit()
    await db.refresh(order)

    logger.info(
        "Apple order created",
        order_id=order.id,
        wata_order_id=wata_order_id,
        amount=discounted_price,
    )

    resp = CreateOrderResponse(
        order=OrderResponse.model_validate(order),
        payment_url=payment_link,
        payment_provider="wata",
    )
    if guest_access_token and guest_expires_at and guest_user:
        resp.guest_access_token = guest_access_token
        resp.guest_expires_at = guest_expires_at
        resp.guest_user = UserResponse.model_validate(guest_user)
    return resp

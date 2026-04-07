from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.logging import get_logger
from app.services.wata_voucher_service import WataVoucherService

router = APIRouter()
logger = get_logger(__name__)


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
    amount: float  # minPrice from the denominations response


@router.post("/create")
async def create_apple_order(data: AppleOrderCreate):
    """Create an Apple Gift Card order via Wata Digital Goods API."""
    service = WataVoucherService()
    frontend_url = (settings.FRONTEND_URL or "https://rugpay.ru").rstrip("/")

    try:
        result = await service.create_order(
            voucher_id=data.voucher_id,
            amount=data.amount,
            email=data.email,
            success_redirect_url=f"{frontend_url}/apple/success",
            fail_redirect_url=f"{frontend_url}/apple",
        )
    except RuntimeError as e:
        logger.error("Apple order creation failed", error=str(e))
        raise HTTPException(status_code=502, detail="Не удалось создать заказ. Попробуйте позже.")

    payment_link = result.get("paymentLink")
    if not payment_link:
        logger.error("No paymentLink in Wata voucher response", result=result)
        raise HTTPException(status_code=502, detail="Не удалось получить ссылку на оплату.")

    return {"payment_url": payment_link, "order_id": result.get("orderId")}

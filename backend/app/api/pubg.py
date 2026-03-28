from fastapi import APIRouter, HTTPException, status

from app.schemas.pubg import (
    PubgGiftOrderCreate,
    PubgGiftOrderResponse,
    PubgPackageInfo,
    PubgPackagesResponse,
)
from app.services.fazercards_service import FazerCardsService, FazerCardsServiceError

router = APIRouter()


@router.get("/packages", response_model=PubgPackagesResponse)
async def get_pubg_packages():
    service = FazerCardsService()
    raw_packages = await service.get_pubg_packages_with_prices()
    packages: list[PubgPackageInfo] = [PubgPackageInfo(**pkg) for pkg in raw_packages]
    return PubgPackagesResponse(packages=packages)


@router.post("/create", response_model=PubgGiftOrderResponse)
async def create_pubg_order(data: PubgGiftOrderCreate):
    service = FazerCardsService()
    try:
        provider_order = await service.create_pubg_order(
            uid=data.uid,
            uc_amount=data.uc_amount,
            promocode=data.promocode,
        )
    except FazerCardsServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message,
        )

    return PubgGiftOrderResponse(
        status=str(provider_order.get("status") or "processing"),
        provider_order_id=str(provider_order.get("id") or ""),
        amount_charged=provider_order.get("amount_charged"),
        currency=provider_order.get("currency"),
        created_at=provider_order.get("created_at"),
        message="PUBG заказ создан через FazerCards",
        payload=provider_order.get("payload") if isinstance(provider_order.get("payload"), dict) else None,
    )

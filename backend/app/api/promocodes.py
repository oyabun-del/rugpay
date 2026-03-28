from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.repositories.promocode_repository import PromocodeRepository
from app.schemas.promocode import PromocodeApply, PromocodeApplyResponse

router = APIRouter()


@router.post("/apply", response_model=PromocodeApplyResponse)
async def apply_promocode(
    data: PromocodeApply,
    db: AsyncSession = Depends(get_db),
):
    """Validate and calculate discount for a promo code"""
    repo = PromocodeRepository(db)
    
    is_valid, message, promocode = await repo.is_valid(data.code, data.amount)
    
    if not is_valid or not promocode:
        return PromocodeApplyResponse(
            valid=False,
            message=message,
        )
    
    # Calculate discount
    commission = data.amount * (settings.COMMISSION_PERCENT / 100)
    discount_amount = await repo.calculate_discount(promocode, data.amount, commission)
    
    return PromocodeApplyResponse(
        valid=True,
        discount_type=promocode.discount_type,
        discount_value=promocode.discount_value,
        discount_amount=discount_amount,
        message="Promo code applied successfully",
    )

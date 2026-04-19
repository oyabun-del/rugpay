from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.repositories.promocode_repository import PromocodeRepository
from app.services.order_service import OrderService
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
    
    # Calculate discount against the amount the user would actually pay
    # (top-up amount + commission), which matches how it is deducted at checkout.
    order_service = OrderService(db)
    commission = order_service.calculate_commission(data.amount)
    final_before_promo = data.amount + commission
    discount_amount = await repo.calculate_discount(
        promocode, final_before_promo, commission,
    )
    
    return PromocodeApplyResponse(
        valid=True,
        discount_type=promocode.discount_type,
        discount_value=promocode.discount_value,
        discount_amount=discount_amount,
        message="Promo code applied successfully",
    )

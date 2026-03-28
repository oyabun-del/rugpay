from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from app.models.promocode import Promocode, DiscountType
from datetime import datetime


class PromocodeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        code: str,
        discount_type: DiscountType,
        discount_value: float,
        max_uses: Optional[int] = None,
        min_order_amount: Optional[float] = None,
        max_discount: Optional[float] = None,
        expires_at: Optional[datetime] = None,
    ) -> Promocode:
        promocode = Promocode(
            code=code.upper(),
            discount_type=discount_type,
            discount_value=discount_value,
            max_uses=max_uses,
            min_order_amount=min_order_amount,
            max_discount=max_discount,
            expires_at=expires_at,
        )
        self.db.add(promocode)
        await self.db.commit()
        await self.db.refresh(promocode)
        return promocode
    
    async def get_by_code(self, code: str) -> Optional[Promocode]:
        result = await self.db.execute(
            select(Promocode).where(Promocode.code == code.upper())
        )
        return result.scalar_one_or_none()
    
    async def get_by_id(self, promocode_id: int) -> Optional[Promocode]:
        result = await self.db.execute(
            select(Promocode).where(Promocode.id == promocode_id)
        )
        return result.scalar_one_or_none()
    
    async def increment_usage(self, promocode_id: int) -> None:
        promocode = await self.get_by_id(promocode_id)
        if promocode:
            promocode.current_uses += 1
            await self.db.commit()
    
    async def is_valid(self, code: str, amount: float) -> tuple[bool, str, Optional[Promocode]]:
        promocode = await self.get_by_code(code)
        
        if not promocode:
            return False, "Promo code not found", None
        
        if not promocode.is_active:
            return False, "Promo code is inactive", None
        
        if promocode.expires_at and promocode.expires_at < datetime.utcnow():
            return False, "Promo code has expired", None
        
        if promocode.max_uses and promocode.current_uses >= promocode.max_uses:
            return False, "Promo code has reached maximum uses", None
        
        if promocode.min_order_amount and amount < promocode.min_order_amount:
            return False, f"Minimum order amount is {promocode.min_order_amount}", None
        
        return True, "Valid", promocode
    
    async def calculate_discount(self, promocode: Promocode, amount: float, commission: float) -> float:
        if promocode.discount_type == DiscountType.PERCENTAGE:
            discount = amount * (promocode.discount_value / 100)
        elif promocode.discount_type == DiscountType.FIXED:
            discount = promocode.discount_value
        elif promocode.discount_type == DiscountType.COMMISSION:
            # Reduce commission percentage
            discount = commission * (promocode.discount_value / 100)
        else:
            discount = 0.0
        
        # Apply max discount limit
        if promocode.max_discount:
            discount = min(discount, promocode.max_discount)
        
        return discount
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Promocode]:
        result = await self.db.execute(
            select(Promocode).offset(skip).limit(limit).order_by(Promocode.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def deactivate(self, promocode_id: int) -> Optional[Promocode]:
        promocode = await self.get_by_id(promocode_id)
        if promocode:
            promocode.is_active = False
            await self.db.commit()
            await self.db.refresh(promocode)
        return promocode

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.promocode import DiscountType


class PromocodeCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    discount_type: DiscountType
    discount_value: float = Field(..., gt=0)
    max_uses: Optional[int] = None
    min_order_amount: Optional[float] = None
    max_discount: Optional[float] = None
    expires_at: Optional[datetime] = None


class PromocodeResponse(BaseModel):
    id: int
    code: str
    discount_type: DiscountType
    discount_value: float
    max_uses: Optional[int]
    current_uses: int
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class PromocodeApply(BaseModel):
    code: str
    amount: float = Field(..., gt=0)


class PromocodeApplyResponse(BaseModel):
    valid: bool
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    discount_amount: Optional[float] = None
    message: str

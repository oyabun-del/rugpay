from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.order import OrderStatus
from app.schemas.auth import UserResponse
import enum
import re


class PaymentProvider(str, enum.Enum):
    WATA = "wata"
    YOOKASSA = "yookassa"


class OrderCreate(BaseModel):
    steam_nickname: str = Field(..., min_length=2, max_length=255)
    steam_profile_url: Optional[str] = None
    email: EmailStr
    amount: float = Field(..., gt=0)
    promocode: Optional[str] = None
    use_referral_balance: bool = False
    referral_code: Optional[str] = None  # Referral code of inviter
    payment_provider: PaymentProvider = PaymentProvider.WATA
    
    @field_validator("steam_nickname")
    @classmethod
    def validate_steam_nickname(cls, v: str) -> str:
        value = v.strip()
        # Steam login only: english letters and digits, no punctuation.
        if not re.match(r"^[A-Za-z0-9]{2,32}$", value):
            raise ValueError(
                "Steam login must contain only English letters and digits (2-32 chars)"
            )
        return value
    
    @field_validator("steam_profile_url")
    @classmethod
    def validate_steam_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.startswith(("https://steamcommunity.com/", "http://steamcommunity.com/")):
            raise ValueError("Invalid Steam profile URL")
        return v.strip()


class OrderResponse(BaseModel):
    id: int
    steam_nickname: str
    email: str
    amount: float
    commission: float
    discount_amount: float
    final_amount: float
    status: OrderStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class OrderUpdate(BaseModel):
    status: OrderStatus


class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    page: int
    per_page: int


class CreateOrderResponse(BaseModel):
    """Response for order creation: order + redirect payment URL."""
    order: OrderResponse
    payment_url: str
    payment_provider: PaymentProvider
    guest_access_token: Optional[str] = None
    guest_expires_at: Optional[datetime] = None
    guest_user: Optional[UserResponse] = None


class PaymentProviderInfo(BaseModel):
    id: PaymentProvider
    name: str
    enabled: bool


class PaymentProvidersResponse(BaseModel):
    providers: List[PaymentProviderInfo]
    default_provider: Optional[PaymentProvider] = None


class OrderCalculation(BaseModel):
    amount: float
    commission: float
    commission_percent: float
    discount_amount: float
    referral_discount: float
    final_amount: float

from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.order import OrderStatus, OrderType
from app.schemas.auth import UserResponse
import enum
import re


class PaymentProvider(str, enum.Enum):
    WATA = "wata"
    YOOKASSA = "yookassa"


class OrderCreate(BaseModel):
    steam_nickname: str = Field(..., min_length=2, max_length=255)
    steam_profile_url: Optional[str] = None
    email: Optional[EmailStr] = None
    amount: float = Field(..., gt=0)
    promocode: Optional[str] = None
    use_referral_balance: bool = False
    referral_code: Optional[str] = None
    payment_provider: PaymentProvider = PaymentProvider.WATA
    
    @field_validator("steam_nickname")
    @classmethod
    def validate_steam_nickname(cls, v: str) -> str:
        value = v.strip()
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


class PubgOrderCreate(BaseModel):
    uid: str = Field(..., min_length=5, max_length=20)
    uc_amount: int = Field(..., description="UC package amount")
    promocode: Optional[str] = None
    use_referral_balance: bool = False
    referral_code: Optional[str] = None
    payment_provider: PaymentProvider = PaymentProvider.WATA

    @field_validator("uid")
    @classmethod
    def validate_uid(cls, v: str) -> str:
        value = v.strip()
        if not value.isdigit():
            raise ValueError("UID must contain only digits")
        return value

    @field_validator("uc_amount")
    @classmethod
    def validate_uc_amount(cls, v: int) -> int:
        allowed = {60, 325, 660, 1800, 3850, 8100}
        if v not in allowed:
            raise ValueError("Unsupported PUBG UC package")
        return v


class OrderResponse(BaseModel):
    id: int
    order_type: str = "steam"
    steam_nickname: Optional[str] = None
    pubg_uid: Optional[str] = None
    pubg_uc_amount: Optional[int] = None
    apple_voucher_id: Optional[str] = None
    apple_region: Optional[str] = None
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
    form_discount_percent: float
    discount_amount: float
    referral_discount: float
    final_amount: float


class OrderPricingConfig(BaseModel):
    commission_threshold_amount: float
    commission_percent_up_to_threshold: float
    commission_percent_above_threshold: float
    steam_discount_percent: float
    pubg_discount_percent: float

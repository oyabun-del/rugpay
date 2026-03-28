from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PubgPackageInfo(BaseModel):
    uc: int
    label: str
    image_url: str
    enabled: bool
    price_rub: Optional[int] = None
    real_price: Optional[float] = None
    source_currency: Optional[str] = None


class PubgPackagesResponse(BaseModel):
    packages: list[PubgPackageInfo]


class PubgGiftOrderCreate(BaseModel):
    uid: str = Field(..., min_length=5, max_length=20)
    uc_amount: int = Field(..., description="UC package amount")
    promocode: Optional[str] = None

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


class PubgGiftOrderResponse(BaseModel):
    status: str
    provider_order_id: str
    amount_charged: Optional[float] = None
    currency: Optional[str] = None
    created_at: Optional[datetime] = None
    message: Optional[str] = None
    payload: Optional[dict] = None

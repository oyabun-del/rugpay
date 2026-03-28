from typing import Optional

from pydantic import BaseModel


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

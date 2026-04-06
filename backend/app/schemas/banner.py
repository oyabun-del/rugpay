from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BannerSlideResponse(BaseModel):
    id: int
    title: str
    image_url: str
    sort_order: int
    is_active: bool
    button_text: Optional[str] = None
    button_link: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BannerSlideCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    image_url: str = Field(..., min_length=1, max_length=1024)
    sort_order: int = 0
    is_active: bool = True
    button_text: Optional[str] = Field(default=None, max_length=255)
    button_link: Optional[str] = Field(default=None, max_length=1024)


class BannerSlideUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    image_url: Optional[str] = Field(default=None, min_length=1, max_length=1024)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    button_text: Optional[str] = Field(default=None, max_length=255)
    button_link: Optional[str] = Field(default=None, max_length=1024)

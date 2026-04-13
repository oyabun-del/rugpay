from pydantic import BaseModel
from typing import Optional


class SiteSettingsResponse(BaseModel):
    steam_enabled: bool
    pubg_enabled: bool
    apple_enabled: bool

    model_config = {"from_attributes": True}


class SiteSettingsUpdate(BaseModel):
    steam_enabled: Optional[bool] = None
    pubg_enabled: Optional[bool] = None
    apple_enabled: Optional[bool] = None

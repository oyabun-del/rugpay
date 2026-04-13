from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.site_settings import SiteSettings


class SiteSettingsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self) -> SiteSettings:
        result = await self.db.execute(select(SiteSettings).where(SiteSettings.id == 1))
        settings = result.scalar_one_or_none()
        if not settings:
            settings = SiteSettings(id=1, steam_enabled=True, pubg_enabled=True, apple_enabled=True)
            self.db.add(settings)
            await self.db.commit()
            await self.db.refresh(settings)
        return settings

    async def update(self, **kwargs) -> SiteSettings:
        settings = await self.get()
        for key, value in kwargs.items():
            if hasattr(settings, key) and value is not None:
                setattr(settings, key, value)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

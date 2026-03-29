from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.banner_slide import BannerSlide


class BannerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> List[BannerSlide]:
        result = await self.db.execute(
            select(BannerSlide).order_by(BannerSlide.sort_order.asc(), BannerSlide.id.asc())
        )
        return list(result.scalars().all())

    async def get_active(self) -> List[BannerSlide]:
        result = await self.db.execute(
            select(BannerSlide)
            .where(BannerSlide.is_active.is_(True))
            .order_by(BannerSlide.sort_order.asc(), BannerSlide.id.asc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, slide_id: int) -> Optional[BannerSlide]:
        result = await self.db.execute(select(BannerSlide).where(BannerSlide.id == slide_id))
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> BannerSlide:
        slide = BannerSlide(**kwargs)
        self.db.add(slide)
        await self.db.commit()
        await self.db.refresh(slide)
        return slide

    async def update(self, slide_id: int, **kwargs) -> Optional[BannerSlide]:
        slide = await self.get_by_id(slide_id)
        if not slide:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(slide, key, value)
        await self.db.commit()
        await self.db.refresh(slide)
        return slide

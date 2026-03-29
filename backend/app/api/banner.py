from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.banner_repository import BannerRepository
from app.schemas.banner import BannerSlideResponse

router = APIRouter()


@router.get("/slides", response_model=List[BannerSlideResponse])
async def get_active_banner_slides(
    db: AsyncSession = Depends(get_db),
):
    repo = BannerRepository(db)
    slides = await repo.get_active()
    return [BannerSlideResponse.model_validate(s) for s in slides]

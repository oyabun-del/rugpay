from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.repositories.stats_repository import StatsRepository
from app.schemas.stats import PublicStats

router = APIRouter()


@router.get("/public", response_model=PublicStats)
async def get_public_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get public statistics for landing page"""
    repo = StatsRepository(db)
    stats = await repo.get_or_create()
    
    return PublicStats(
        total_orders=stats.total_orders,
        total_users=stats.total_users,
        success_rate=stats.success_rate,
        average_processing_time=stats.average_processing_time,
    )

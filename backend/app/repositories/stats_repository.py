from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.stats import Stats


class StatsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_or_create(self) -> Stats:
        result = await self.db.execute(select(Stats).limit(1))
        stats = result.scalar_one_or_none()
        
        if not stats:
            stats = Stats()
            self.db.add(stats)
            await self.db.commit()
            await self.db.refresh(stats)
        
        return stats
    
    async def update(
        self,
        total_orders: Optional[int] = None,
        total_users: Optional[int] = None,
        total_completed_orders: Optional[int] = None,
        total_revenue: Optional[float] = None,
        total_topup_amount: Optional[float] = None,
        success_rate: Optional[float] = None,
        average_processing_time: Optional[float] = None,
    ) -> Stats:
        stats = await self.get_or_create()
        
        if total_orders is not None:
            stats.total_orders = total_orders
        if total_users is not None:
            stats.total_users = total_users
        if total_completed_orders is not None:
            stats.total_completed_orders = total_completed_orders
        if total_revenue is not None:
            stats.total_revenue = total_revenue
        if total_topup_amount is not None:
            stats.total_topup_amount = total_topup_amount
        if success_rate is not None:
            stats.success_rate = success_rate
        if average_processing_time is not None:
            stats.average_processing_time = average_processing_time
        
        await self.db.commit()
        await self.db.refresh(stats)
        return stats

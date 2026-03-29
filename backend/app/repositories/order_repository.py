from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional, List, Tuple
from app.models.order import Order, OrderStatus
from datetime import datetime, timedelta


class OrderRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, **kwargs) -> Order:
        order = Order(**kwargs)
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        return order
    
    async def get_by_id(self, order_id: int) -> Optional[Order]:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        return result.scalar_one_or_none()
    
    async def get_by_user_id(
        self, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 50
    ) -> Tuple[List[Order], int]:
        # Get orders
        result = await self.db.execute(
            select(Order)
            .where(Order.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .order_by(Order.created_at.desc())
        )
        orders = list(result.scalars().all())
        
        # Get total count
        count_result = await self.db.execute(
            select(func.count(Order.id)).where(Order.user_id == user_id)
        )
        total = count_result.scalar() or 0
        
        return orders, total
    
    async def update_status(self, order_id: int, status: OrderStatus) -> Optional[Order]:
        order = await self.get_by_id(order_id)
        if order:
            order.status = status
            if status == OrderStatus.COMPLETED:
                order.completed_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(order)
        return order
    
    async def update_steam_response(
        self, 
        order_id: int, 
        steam_transaction_id: str, 
        steam_response: str
    ) -> None:
        order = await self.get_by_id(order_id)
        if order:
            order.steam_transaction_id = steam_transaction_id
            order.steam_response = steam_response
            await self.db.commit()
    
    async def get_all(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[OrderStatus] = None
    ) -> Tuple[List[Order], int]:
        query = select(Order)
        count_query = select(func.count(Order.id))
        
        if status:
            query = query.where(Order.status == status)
            count_query = count_query.where(Order.status == status)
        
        result = await self.db.execute(
            query.offset(skip).limit(limit).order_by(Order.created_at.desc())
        )
        orders = list(result.scalars().all())
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        return orders, total
    
    async def get_pending_orders(self) -> List[Order]:
        result = await self.db.execute(
            select(Order).where(Order.status == OrderStatus.PAID)
        )
        return list(result.scalars().all())

    async def transfer_orders_to_user(self, from_user_id: int, to_user_id: int) -> int:
        if from_user_id == to_user_id:
            return 0
        result = await self.db.execute(
            select(Order).where(Order.user_id == from_user_id)
        )
        orders = list(result.scalars().all())
        for order in orders:
            order.user_id = to_user_id
        if orders:
            await self.db.commit()
        return len(orders)
    
    async def get_user_orders_count_recent(self, user_id: int, minutes: int = 1) -> int:
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        result = await self.db.execute(
            select(func.count(Order.id)).where(
                and_(
                    Order.user_id == user_id,
                    Order.created_at >= cutoff
                )
            )
        )
        return result.scalar() or 0
    
    async def get_stats(self) -> dict:
        # Total orders
        total_result = await self.db.execute(select(func.count(Order.id)))
        total = total_result.scalar() or 0
        
        # Completed orders
        completed_result = await self.db.execute(
            select(func.count(Order.id)).where(Order.status == OrderStatus.COMPLETED)
        )
        completed = completed_result.scalar() or 0
        
        # Today's stats
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        orders_today_result = await self.db.execute(
            select(func.count(Order.id)).where(Order.created_at >= today)
        )
        orders_today = orders_today_result.scalar() or 0
        
        revenue_today_result = await self.db.execute(
            select(func.sum(Order.commission)).where(
                and_(
                    Order.created_at >= today,
                    Order.status == OrderStatus.COMPLETED
                )
            )
        )
        revenue_today = revenue_today_result.scalar() or 0.0
        
        # Pending and failed
        pending_result = await self.db.execute(
            select(func.count(Order.id)).where(
                Order.status.in_([OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING])
            )
        )
        pending = pending_result.scalar() or 0
        
        failed_today_result = await self.db.execute(
            select(func.count(Order.id)).where(
                and_(
                    Order.created_at >= today,
                    Order.status == OrderStatus.FAILED
                )
            )
        )
        failed_today = failed_today_result.scalar() or 0
        
        # Total revenue
        total_revenue_result = await self.db.execute(
            select(func.sum(Order.commission)).where(Order.status == OrderStatus.COMPLETED)
        )
        total_revenue = total_revenue_result.scalar() or 0.0
        
        # Total topup amount
        total_topup_result = await self.db.execute(
            select(func.sum(Order.amount)).where(Order.status == OrderStatus.COMPLETED)
        )
        total_topup = total_topup_result.scalar() or 0.0
        
        return {
            "total_orders": total,
            "total_completed_orders": completed,
            "orders_today": orders_today,
            "revenue_today": revenue_today,
            "pending_orders": pending,
            "failed_orders_today": failed_today,
            "total_revenue": total_revenue,
            "total_topup_amount": total_topup,
            "success_rate": (completed / total * 100) if total > 0 else 0.0,
        }

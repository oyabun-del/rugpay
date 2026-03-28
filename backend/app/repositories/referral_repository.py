from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from app.models.referral import Referral
from app.models.user import User
from app.models.order import Order, OrderStatus


class ReferralRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, inviter_id: int, invited_id: int) -> Referral:
        referral = Referral(
            inviter_id=inviter_id,
            invited_id=invited_id,
        )
        self.db.add(referral)
        await self.db.commit()
        await self.db.refresh(referral)
        return referral
    
    async def get_by_invited_id(self, invited_id: int) -> Optional[Referral]:
        result = await self.db.execute(
            select(Referral).where(Referral.invited_id == invited_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_inviter_id(self, inviter_id: int) -> List[Referral]:
        result = await self.db.execute(
            select(Referral).where(Referral.inviter_id == inviter_id)
        )
        return list(result.scalars().all())
    
    async def update_reward(self, referral_id: int, additional_reward: float) -> None:
        result = await self.db.execute(
            select(Referral).where(Referral.id == referral_id)
        )
        referral = result.scalar_one_or_none()
        if referral:
            referral.reward_amount += additional_reward
            await self.db.commit()
    
    async def get_referral_stats(self, user_id: int) -> dict:
        # Get all referrals
        referrals = await self.get_by_inviter_id(user_id)
        
        total_earned = sum(r.reward_amount for r in referrals)
        
        # Get user's balance
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        available_balance = user.referral_balance if user else 0.0
        
        # Get detailed referral info with order counts
        referral_details = []
        for ref in referrals:
            invited_user = await self.db.execute(
                select(User).where(User.id == ref.invited_id)
            )
            invited = invited_user.scalar_one_or_none()
            
            if invited:
                order_count = await self.db.execute(
                    select(func.count(Order.id)).where(
                        Order.user_id == ref.invited_id,
                        Order.status == OrderStatus.COMPLETED
                    )
                )
                
                referral_details.append({
                    "id": invited.id,
                    "email": invited.email[:3] + "***" + invited.email[invited.email.index("@"):],
                    "created_at": invited.created_at,
                    "total_orders": order_count.scalar() or 0,
                    "reward_earned": ref.reward_amount,
                })
        
        return {
            "total_referrals": len(referrals),
            "total_earned": total_earned,
            "available_balance": available_balance,
            "pending_rewards": 0.0,  # Could track pending rewards separately
            "referrals": referral_details,
        }

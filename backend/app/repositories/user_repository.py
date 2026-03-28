from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from app.models.user import User
from datetime import datetime, timedelta


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, email: str, password_hash: str, referred_by: Optional[int] = None) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            referred_by=referred_by,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def get_by_referral_code(self, referral_code: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.referral_code == referral_code)
        )
        return result.scalar_one_or_none()
    
    async def update_referral_balance(self, user_id: int, amount: float) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.referral_balance += amount
            await self.db.commit()
    
    async def deduct_referral_balance(self, user_id: int, amount: float) -> bool:
        user = await self.get_by_id(user_id)
        if user and user.referral_balance >= amount:
            user.referral_balance -= amount
            await self.db.commit()
            return True
        return False
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        result = await self.db.execute(
            select(User).offset(skip).limit(limit).order_by(User.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_total_count(self) -> int:
        result = await self.db.execute(select(func.count(User.id)))
        return result.scalar() or 0
    
    async def get_new_users_today(self) -> int:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count(User.id)).where(User.created_at >= today)
        )
        return result.scalar() or 0

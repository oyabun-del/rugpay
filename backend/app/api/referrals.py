from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.repositories.referral_repository import ReferralRepository
from app.repositories.user_repository import UserRepository
from app.schemas.referral import ReferralInfo

router = APIRouter()


@router.get("/info", response_model=ReferralInfo)
async def get_referral_info(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's referral information"""
    referral_repo = ReferralRepository(db)
    user_repo = UserRepository(db)
    
    # Get user's referral code
    user = await user_repo.get_by_id(user_id)
    
    # Get referral stats
    stats = await referral_repo.get_referral_stats(user_id)
    
    # Build referral link
    base_url = str(request.base_url).rstrip("/")
    referral_link = f"{base_url}/?ref={user.referral_code}"
    
    return ReferralInfo(
        referral_code=user.referral_code,
        referral_link=referral_link,
        total_referrals=stats["total_referrals"],
        total_earned=stats["total_earned"],
        available_balance=stats["available_balance"],
        referrals=stats["referrals"],
    )

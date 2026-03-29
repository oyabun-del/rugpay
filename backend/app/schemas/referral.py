from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ReferralUser(BaseModel):
    id: int
    email: str
    created_at: datetime
    total_orders: int
    reward_earned: float


class ReferralInfo(BaseModel):
    referral_code: str
    referral_link: str
    total_referrals: int
    total_earned: float
    available_balance: float
    referrals: List[ReferralUser]


class ReferralStats(BaseModel):
    total_referrals: int
    total_earned: float
    available_balance: float
    pending_rewards: float

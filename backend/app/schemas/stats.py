from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PublicStats(BaseModel):
    total_orders: int
    total_users: int
    success_rate: float
    average_processing_time: float  # In seconds


class AdminStats(BaseModel):
    total_orders: int
    total_users: int
    total_completed_orders: int
    total_revenue: float
    total_topup_amount: float
    success_rate: float
    average_processing_time: float
    orders_today: int
    revenue_today: float
    new_users_today: int
    pending_orders: int
    failed_orders_today: int


class DailyStats(BaseModel):
    date: datetime
    orders: int
    revenue: float
    topup_amount: float
    new_users: int

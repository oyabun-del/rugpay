from sqlalchemy import Column, Integer, Float, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Stats(Base):
    __tablename__ = "stats"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Counters (cached/aggregated)
    total_orders = Column(Integer, default=0)
    total_users = Column(Integer, default=0)
    total_completed_orders = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    total_topup_amount = Column(Float, default=0.0)
    
    # Metrics
    success_rate = Column(Float, default=0.0)  # Percentage
    average_processing_time = Column(Float, default=0.0)  # In seconds
    
    # Timestamps
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Referral relationship
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invited_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Reward tracking
    reward_amount = Column(Float, default=0.0)  # Total earned from this referral
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    inviter = relationship("User", foreign_keys=[inviter_id], back_populates="referrals_made")
    invited = relationship("User", foreign_keys=[invited_id])

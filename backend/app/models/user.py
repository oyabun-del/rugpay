from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import secrets


def generate_referral_code():
    return secrets.token_urlsafe(8)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Referral system
    referral_code = Column(String(32), unique=True, default=generate_referral_code)
    referred_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    referral_balance = Column(Float, default=0.0)  # Earned from referrals
    
    # Admin flag
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    referrals_made = relationship("Referral", back_populates="inviter", foreign_keys="Referral.inviter_id")
    referred_user = relationship("User", remote_side=[id], backref="referrer")

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Optional for guest orders
    
    # Steam info
    steam_nickname = Column(String(255), nullable=False)
    steam_profile_url = Column(String(512), nullable=True)
    
    # Order details
    email = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)  # Top-up amount
    commission = Column(Float, nullable=False)  # Commission amount
    final_amount = Column(Float, nullable=False)  # Total to pay
    
    # Promo code
    promocode_id = Column(Integer, ForeignKey("promocodes.id"), nullable=True)
    discount_amount = Column(Float, default=0.0)
    
    # Referral
    referral_reward = Column(Float, default=0.0)  # Reward given to referrer
    
    # Status
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING)
    
    # Steam API response
    steam_transaction_id = Column(String(255), nullable=True)
    steam_response = Column(String(2048), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    transaction = relationship("Transaction", back_populates="order", uselist=False)
    promocode = relationship("Promocode", back_populates="orders")

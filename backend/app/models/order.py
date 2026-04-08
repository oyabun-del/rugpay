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


class OrderType(str, enum.Enum):
    STEAM = "steam"
    PUBG = "pubg"
    APPLE = "apple"


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    order_type = Column(
        SQLEnum(OrderType, values_callable=lambda obj: [e.value for e in obj]),
        default=OrderType.STEAM,
        nullable=False,
        server_default="steam",
    )
    
    # Steam info (nullable for PUBG orders)
    steam_nickname = Column(String(255), nullable=True)
    steam_profile_url = Column(String(512), nullable=True)
    
    # PUBG info (nullable for Steam orders)
    pubg_uid = Column(String(20), nullable=True)
    pubg_uc_amount = Column(Integer, nullable=True)
    pubg_fazercards_order_id = Column(String(255), nullable=True)
    pubg_gift_codes = Column(String(2048), nullable=True)
    
    # Apple Gift Card info (nullable for non-apple orders)
    apple_voucher_id = Column(String(64), nullable=True)
    apple_wata_order_id = Column(String(255), nullable=True)
    apple_region = Column(String(10), nullable=True)

    # Order details
    email = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    commission = Column(Float, nullable=False)
    final_amount = Column(Float, nullable=False)
    
    # Promo code
    promocode_id = Column(Integer, ForeignKey("promocodes.id"), nullable=True)
    discount_amount = Column(Float, default=0.0)
    
    # Referral
    referral_reward = Column(Float, default=0.0)
    
    # Status
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING)
    
    # Payment / provider response
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

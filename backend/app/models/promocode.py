from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"  # Percentage discount on total
    FIXED = "fixed"  # Fixed amount discount
    COMMISSION = "commission"  # Reduced commission percentage


class Promocode(Base):
    __tablename__ = "promocodes"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    
    # Discount details
    discount_type = Column(SQLEnum(DiscountType), nullable=False)
    discount_value = Column(Float, nullable=False)  # Percentage or fixed amount
    
    # Limits
    max_uses = Column(Integer, nullable=True)  # None = unlimited
    current_uses = Column(Integer, default=0)
    min_order_amount = Column(Float, nullable=True)  # Minimum order to apply
    max_discount = Column(Float, nullable=True)  # Maximum discount amount
    
    # Validity
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    orders = relationship("Order", back_populates="promocode")

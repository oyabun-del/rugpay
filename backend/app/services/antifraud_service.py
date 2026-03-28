from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from typing import Optional
from datetime import datetime, timedelta
from app.repositories.order_repository import OrderRepository
from app.core.config import settings
from app.core.logging import get_logger
import re

logger = get_logger(__name__)


class AntifraudService:
    """Basic anti-fraud checks for order creation"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.order_repo = OrderRepository(db)
    
    async def check_order_rate_limit(self, user_id: Optional[int], ip_address: Optional[str] = None) -> bool:
        """Check if user has exceeded order rate limit"""
        if not user_id:
            # For guest orders, we'd need to implement IP-based rate limiting
            # This requires Redis for proper implementation
            return True
        
        recent_orders = await self.order_repo.get_user_orders_count_recent(
            user_id,
            minutes=1
        )
        
        if recent_orders >= settings.MAX_ORDERS_PER_MINUTE:
            logger.warning(
                "Order rate limit exceeded",
                user_id=user_id,
                recent_orders=recent_orders,
            )
            return False
        
        return True
    
    def validate_steam_nickname(self, nickname: str) -> tuple[bool, str]:
        """Validate Steam nickname format"""
        if not nickname or len(nickname) < 2:
            return False, "Steam nickname is too short"
        
        if len(nickname) > 255:
            return False, "Steam nickname is too long"
        
        # Check for common injection patterns
        dangerous_patterns = [
            r'<script',
            r'javascript:',
            r'on\w+\s*=',
            r'\bselect\b.*\bfrom\b',
            r'\bunion\b.*\bselect\b',
            r'--',
            r';',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, nickname, re.IGNORECASE):
                logger.warning("Suspicious nickname pattern detected", nickname=nickname)
                return False, "Invalid Steam nickname format"
        
        return True, "Valid"
    
    def validate_email(self, email: str) -> tuple[bool, str]:
        """Additional email validation"""
        # Check for disposable email domains
        disposable_domains = [
            "tempmail.com",
            "throwaway.email",
            "mailinator.com",
            "guerrillamail.com",
            "10minutemail.com",
        ]
        
        domain = email.split("@")[-1].lower()
        if domain in disposable_domains:
            logger.warning("Disposable email detected", email=email)
            return False, "Disposable email addresses are not allowed"
        
        return True, "Valid"
    
    def validate_amount(self, amount: float) -> tuple[bool, str]:
        """Validate order amount"""
        if amount < settings.MIN_TOPUP_AMOUNT:
            return False, f"Minimum amount is {settings.MIN_TOPUP_AMOUNT} RUB"
        
        if amount > settings.MAX_TOPUP_AMOUNT:
            return False, f"Maximum amount is {settings.MAX_TOPUP_AMOUNT} RUB"
        
        # Check for suspicious amounts (e.g., very round numbers might indicate testing)
        # This is just a logging example, not a block
        if amount % 1000 == 0 and amount >= 10000:
            logger.info("Large round amount detected", amount=amount)
        
        return True, "Valid"
    
    async def perform_checks(
        self,
        steam_nickname: str,
        email: str,
        amount: float,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Perform all anti-fraud checks"""
        
        # Rate limit check
        if not await self.check_order_rate_limit(user_id, ip_address):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many orders. Please wait before creating another order."
            )
        
        # Nickname validation
        valid, message = self.validate_steam_nickname(steam_nickname)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        # Email validation
        valid, message = self.validate_email(email)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        # Amount validation
        valid, message = self.validate_amount(amount)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        logger.info(
            "Anti-fraud checks passed",
            user_id=user_id,
            steam_nickname=steam_nickname,
            amount=amount,
        )

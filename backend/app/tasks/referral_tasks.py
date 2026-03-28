from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import get_logger
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.referral import Referral

logger = get_logger(__name__)

# Sync engine for Celery tasks
sync_engine = create_engine(settings.DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)


@shared_task
def process_referral_reward(order_id: int):
    """
    Calculate and distribute referral rewards after order completion.
    
    The referrer receives a percentage of the commission from their
    referred user's completed orders.
    """
    logger.info("Processing referral reward", order_id=order_id)
    
    session = SyncSession()
    try:
        # Get the completed order
        order = session.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            logger.error("Order not found for referral processing", order_id=order_id)
            return {"status": "error", "message": "Order not found"}
        
        if order.status != OrderStatus.COMPLETED:
            logger.warning(
                "Order not completed, skipping referral",
                order_id=order_id,
                status=order.status.value,
            )
            return {"status": "skipped", "message": "Order not completed"}
        
        if not order.user_id:
            # Guest order, no referral to process
            return {"status": "skipped", "message": "Guest order"}
        
        # Get the user who made the order
        user = session.query(User).filter(User.id == order.user_id).first()
        
        if not user or not user.referred_by:
            # User wasn't referred
            return {"status": "skipped", "message": "User not referred"}
        
        # Get the referrer
        referrer = session.query(User).filter(User.id == user.referred_by).first()
        
        if not referrer:
            logger.warning("Referrer not found", referrer_id=user.referred_by)
            return {"status": "error", "message": "Referrer not found"}
        
        # Calculate reward (percentage of commission)
        reward_amount = order.commission * (settings.REFERRAL_REWARD_PERCENT / 100)
        
        if reward_amount <= 0:
            return {"status": "skipped", "message": "No reward to process"}
        
        # Update referrer's balance
        referrer.referral_balance += reward_amount
        
        # Update referral record
        referral = session.query(Referral).filter(
            Referral.inviter_id == referrer.id,
            Referral.invited_id == user.id,
        ).first()
        
        if referral:
            referral.reward_amount += reward_amount
        
        # Update order with referral reward amount
        order.referral_reward = reward_amount
        
        session.commit()
        
        logger.info(
            "Referral reward processed",
            order_id=order_id,
            referrer_id=referrer.id,
            reward_amount=reward_amount,
        )
        
        return {
            "status": "success",
            "referrer_id": referrer.id,
            "reward_amount": reward_amount,
        }
        
    except Exception as e:
        session.rollback()
        logger.error("Referral reward processing error", order_id=order_id, error=str(e))
        raise
    finally:
        session.close()


@shared_task
def recalculate_user_referral_stats(user_id: int):
    """
    Recalculate referral statistics for a user.
    
    Used for auditing or fixing referral balances.
    """
    logger.info("Recalculating referral stats", user_id=user_id)
    
    session = SyncSession()
    try:
        # Get all referrals for this user (as inviter)
        referrals = session.query(Referral).filter(
            Referral.inviter_id == user_id
        ).all()
        
        total_earned = sum(r.reward_amount for r in referrals)
        
        # Get user and update balance if needed
        user = session.query(User).filter(User.id == user_id).first()
        
        if user:
            # Note: This doesn't account for withdrawals
            # In a real system, you'd track withdrawals separately
            logger.info(
                "Referral stats calculated",
                user_id=user_id,
                total_earned=total_earned,
                current_balance=user.referral_balance,
            )
        
        return {
            "user_id": user_id,
            "total_referrals": len(referrals),
            "total_earned": total_earned,
        }
        
    finally:
        session.close()

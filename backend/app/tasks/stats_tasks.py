from celery import shared_task
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import get_logger
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.stats import Stats
from datetime import datetime, timedelta

logger = get_logger(__name__)

# Sync engine for Celery tasks
sync_engine = create_engine(settings.DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)


@shared_task
def update_cached_stats():
    """
    Update cached statistics in the stats table.
    
    This runs periodically to keep the stats table up to date
    for fast dashboard loading.
    """
    logger.info("Updating cached stats")
    
    session = SyncSession()
    try:
        # Calculate stats
        total_orders = session.query(func.count(Order.id)).scalar() or 0
        total_users = session.query(func.count(User.id)).scalar() or 0
        
        total_completed = session.query(func.count(Order.id)).filter(
            Order.status == OrderStatus.COMPLETED
        ).scalar() or 0
        
        total_revenue = session.query(func.sum(Order.commission)).filter(
            Order.status == OrderStatus.COMPLETED
        ).scalar() or 0.0
        
        total_topup = session.query(func.sum(Order.amount)).filter(
            Order.status == OrderStatus.COMPLETED
        ).scalar() or 0.0
        
        # Calculate success rate
        success_rate = (total_completed / total_orders * 100) if total_orders > 0 else 0.0
        
        # Calculate average processing time (for completed orders)
        # This is a simplified calculation - in production, you'd track timestamps more carefully
        avg_processing_time = 30.0  # Placeholder - would calculate from completed_at - created_at
        
        # Get or create stats record
        stats = session.query(Stats).first()
        if not stats:
            stats = Stats()
            session.add(stats)
        
        # Update values
        stats.total_orders = total_orders
        stats.total_users = total_users
        stats.total_completed_orders = total_completed
        stats.total_revenue = total_revenue
        stats.total_topup_amount = total_topup
        stats.success_rate = success_rate
        stats.average_processing_time = avg_processing_time
        
        session.commit()
        
        logger.info(
            "Stats updated",
            total_orders=total_orders,
            total_users=total_users,
            success_rate=success_rate,
        )
        
        return {
            "total_orders": total_orders,
            "total_users": total_users,
            "total_completed": total_completed,
            "success_rate": success_rate,
        }
        
    except Exception as e:
        session.rollback()
        logger.error("Stats update error", error=str(e))
        raise
    finally:
        session.close()


@shared_task
def generate_daily_report():
    """
    Generate daily statistics report.
    
    Can be used to send reports to admins or store for analytics.
    """
    logger.info("Generating daily report")
    
    session = SyncSession()
    try:
        # Calculate yesterday's date range
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        
        # Orders created yesterday
        orders_count = session.query(func.count(Order.id)).filter(
            Order.created_at >= yesterday,
            Order.created_at < today,
        ).scalar() or 0
        
        # Completed orders yesterday
        completed_count = session.query(func.count(Order.id)).filter(
            Order.created_at >= yesterday,
            Order.created_at < today,
            Order.status == OrderStatus.COMPLETED,
        ).scalar() or 0
        
        # Revenue yesterday
        revenue = session.query(func.sum(Order.commission)).filter(
            Order.created_at >= yesterday,
            Order.created_at < today,
            Order.status == OrderStatus.COMPLETED,
        ).scalar() or 0.0
        
        # Top-up volume
        topup_volume = session.query(func.sum(Order.amount)).filter(
            Order.created_at >= yesterday,
            Order.created_at < today,
            Order.status == OrderStatus.COMPLETED,
        ).scalar() or 0.0
        
        # New users
        new_users = session.query(func.count(User.id)).filter(
            User.created_at >= yesterday,
            User.created_at < today,
        ).scalar() or 0
        
        report = {
            "date": yesterday.strftime("%Y-%m-%d"),
            "orders": orders_count,
            "completed_orders": completed_count,
            "revenue": revenue,
            "topup_volume": topup_volume,
            "new_users": new_users,
            "conversion_rate": (completed_count / orders_count * 100) if orders_count > 0 else 0,
        }
        
        logger.info("Daily report generated", **report)
        
        # Here you could:
        # - Send email to admins
        # - Store in a reports table
        # - Push to analytics service
        
        return report
        
    finally:
        session.close()

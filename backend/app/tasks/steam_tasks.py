import asyncio
from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import get_logger
from app.models.order import Order, OrderStatus
from app.services.steam_service import SteamTopupService
from app.services.email_service import EmailService

logger = get_logger(__name__)
email_service = EmailService()

# Sync engine for Celery tasks
sync_engine = create_engine(settings.DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)


def run_async(coro):
    """Helper to run async code in sync context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=5,
)
def process_steam_topup(self, order_id: int):
    """
    Process Steam wallet top-up for a paid order.
    
    This task is triggered after payment confirmation.
    It polls Wata Steam order status until completion.
    """
    logger.info("Processing Steam top-up", order_id=order_id, task_id=self.request.id)
    
    session = SyncSession()
    try:
        # Get order
        order = session.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            logger.error("Order not found", order_id=order_id)
            return {"status": "error", "message": "Order not found"}
        
        if order.status != OrderStatus.PAID:
            logger.warning(
                "Order not in PAID status",
                order_id=order_id,
                status=order.status.value,
            )
            return {"status": "skipped", "message": f"Order status is {order.status.value}"}
        
        # Update status to processing
        order.status = OrderStatus.PROCESSING
        session.commit()

        # Legacy PlayWallet direct top-up call is intentionally disabled.
        # It is kept here for rollback/reference.
        #
        # created_ts = int(order.created_at.timestamp()) if order.created_at else 0
        # external_id = f"sp-{order.id}-{created_ts}"
        # success, transaction_id, message = run_async(
        #     steam_service.process_topup(
        #         order_id=order.id,
        #         steam_nickname=order.steam_nickname,
        #         amount=order.amount,
        #         external_id=external_id,
        #     )
        # )

        steam_service = SteamTopupService()
        status_value, message = run_async(
            steam_service.check_topup_status(str(order.id))
        )

        if status_value == "completed":
            order.status = OrderStatus.COMPLETED
            order.steam_transaction_id = str(order.id)
            order.steam_response = message
            session.commit()
            run_async(
                email_service.send_order_status_email(
                    to_email=order.email,
                    order_id=order_id,
                    status_text="Выполнен",
                    details=message,
                )
            )

            logger.info("Steam top-up completed", order_id=order_id, transaction_id=str(order.id))
            process_referral_reward.delay(order_id)
            return {"status": "success", "transaction_id": str(order.id)}

        if status_value == "failed":
            order.status = OrderStatus.FAILED
            order.steam_response = message
            session.commit()
            run_async(
                email_service.send_order_status_email(
                    to_email=order.email,
                    order_id=order_id,
                    status_text="Ошибка",
                    details=message,
                )
            )
            logger.error("Steam top-up failed", order_id=order_id, message=message)
            raise Exception(f"Steam top-up failed: {message}")

        # Pending: keep PROCESSING and retry until terminal status.
        order.status = OrderStatus.PROCESSING
        order.steam_transaction_id = str(order.id)
        order.steam_response = message
        session.commit()
        logger.info("Steam top-up still pending, retrying", order_id=order_id, message=message)
        raise Exception(f"Steam top-up pending: {message}")
            
    except Exception as e:
        session.rollback()
        logger.error("Steam top-up task error", order_id=order_id, error=str(e))
        raise
    finally:
        session.close()


@shared_task
def retry_failed_topups():
    """
    Periodic task to retry failed top-ups.

    This task finds orders that failed and attempts to retry them.
    Dispatches the correct Celery task based on order type.
    """
    logger.info("Running retry_failed_topups periodic task")

    session = SyncSession()
    try:
        from datetime import datetime, timedelta
        from app.models.order import OrderType

        cutoff = datetime.utcnow() - timedelta(hours=24)

        failed_orders = session.query(Order).filter(
            Order.status == OrderStatus.FAILED,
            Order.created_at >= cutoff,
        ).limit(10).all()

        retry_count = 0
        for order in failed_orders:
            if order.order_type == OrderType.APPLE:
                from app.tasks.apple_tasks import request_apple_voucher
                request_apple_voucher.delay(order.id)
            elif order.order_type == OrderType.PUBG:
                from app.tasks.pubg_tasks import process_pubg_topup
                process_pubg_topup.delay(order.id)
            else:
                process_steam_topup.delay(order.id)
            retry_count += 1

        logger.info("Queued failed orders for retry", count=retry_count)
        return {"retried": retry_count}

    finally:
        session.close()


@shared_task
def check_pending_topup_status(order_id: int):
    """
    Check the status of a pending Steam top-up.
    
    Used for orders that are stuck in PROCESSING state.
    """
    logger.info("Checking pending top-up status", order_id=order_id)
    
    session = SyncSession()
    try:
        order = session.query(Order).filter(Order.id == order_id).first()
        
        if not order or order.status != OrderStatus.PROCESSING:
            return {"status": "skipped"}
        
        steam_service = SteamTopupService()
        status, message = run_async(
            steam_service.check_topup_status(str(order.id))
        )
        
        if status == "completed":
            order.status = OrderStatus.COMPLETED
            order.steam_response = message
            session.commit()
            
            # Trigger referral reward
            process_referral_reward.delay(order_id)
            
        elif status == "failed":
            order.status = OrderStatus.FAILED
            order.steam_response = message
            session.commit()
        
        return {"status": status, "message": message}
        
    finally:
        session.close()


# Import here to avoid circular imports
from app.tasks.referral_tasks import process_referral_reward

import asyncio
import json
from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import get_logger
from app.models.order import Order, OrderStatus, OrderType
from app.services.fazercards_service import FazerCardsService, FazerCardsServiceError
from app.services.email_service import EmailService

logger = get_logger(__name__)
email_service = EmailService()

sync_engine = create_engine(settings.DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)


def run_async(coro):
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
def process_pubg_topup(self, order_id: int):
    """
    Purchase PUBG UC gift card via FazerCards after payment confirmation.
    Triggered by payment webhook when an order with order_type=PUBG is paid.
    """
    logger.info("Processing PUBG top-up", order_id=order_id, task_id=self.request.id)

    session = SyncSession()
    try:
        order = session.query(Order).filter(Order.id == order_id).first()

        if not order:
            logger.error("Order not found", order_id=order_id)
            return {"status": "error", "message": "Order not found"}

        if order.order_type != OrderType.PUBG:
            logger.warning("Order is not PUBG type", order_id=order_id, order_type=order.order_type)
            return {"status": "skipped", "message": "Not a PUBG order"}

        if order.status != OrderStatus.PAID:
            logger.warning(
                "PUBG order not in PAID status",
                order_id=order_id,
                status=order.status.value,
            )
            return {"status": "skipped", "message": f"Order status is {order.status.value}"}

        order.status = OrderStatus.PROCESSING
        session.commit()

        fazercards = FazerCardsService()
        if not fazercards.is_configured():
            raise RuntimeError("FazerCards is not configured")

        if not order.pubg_uid or not order.pubg_uc_amount:
            order.status = OrderStatus.FAILED
            order.steam_response = "Missing PUBG UID or UC amount"
            session.commit()
            logger.error("PUBG order missing required fields", order_id=order_id)
            return {"status": "error", "message": "Missing PUBG UID or UC amount"}

        try:
            provider_order = run_async(
                fazercards.create_pubg_order(
                    uid=order.pubg_uid,
                    uc_amount=order.pubg_uc_amount,
                )
            )
        except FazerCardsServiceError as e:
            logger.error("FazerCards purchase failed", order_id=order_id, error=e.message)
            raise Exception(f"FazerCards purchase failed: {e.message}")

        provider_order_id = str(provider_order.get("id") or "")
        order.pubg_fazercards_order_id = provider_order_id

        codes = provider_order.get("codes") or provider_order.get("gift_codes")
        if isinstance(codes, list):
            order.pubg_gift_codes = json.dumps(codes, ensure_ascii=False)

        order.status = OrderStatus.COMPLETED
        order.steam_response = f"fazercards_order:{provider_order_id}"
        session.commit()

        run_async(
            email_service.send_order_status_email(
                to_email=order.email,
                order_id=order_id,
                status_text="Выполнен",
                details=f"PUBG Mobile {order.pubg_uc_amount} UC — заказ выполнен",
            )
        )

        logger.info(
            "PUBG top-up completed",
            order_id=order_id,
            fazercards_order_id=provider_order_id,
        )

        from app.tasks.referral_tasks import process_referral_reward
        process_referral_reward.delay(order_id)

        return {"status": "success", "fazercards_order_id": provider_order_id}

    except Exception as e:
        session.rollback()
        logger.error("PUBG top-up task error", order_id=order_id, error=str(e))
        raise
    finally:
        session.close()

import asyncio

from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.models.order import Order, OrderType
from app.models.referral import Referral
from app.models.transaction import Transaction
from app.models.user import User
from app.services.order_service import OrderService
from app.services.resilient_queue import (
    ResilientQueueService,
    QUEUE_PAYMENTS,
    QUEUE_ORDERS,
    QUEUE_GUEST_CLEANUP,
    QUEUE_EMAIL,
)

logger = get_logger(__name__)

# Sync engine for destructive cleanup jobs.
sync_engine = create_engine(settings.DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)


def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _process_payment_event_async(order_id: int, payment_status: str, payment_provider_id: str) -> bool:
    async with AsyncSessionLocal() as db:
        service = OrderService(db)
        return await service.process_payment_webhook(
            order_id=order_id,
            payment_status=payment_status,
            payment_provider_id=payment_provider_id,
        )


def _delete_guest_user_sync(user_id: int) -> None:
    from app.models.order import OrderStatus

    session = SyncSession()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user or not user.email.endswith("@guest.gamecover.local"):
            return

        # Never delete orders that have been paid, are being processed, or completed.
        # These represent real financial transactions and must be preserved.
        KEEP_STATUSES = (
            OrderStatus.PAID,
            OrderStatus.PROCESSING,
            OrderStatus.COMPLETED,
        )

        important_orders = session.query(Order.id).filter(
            Order.user_id == user_id,
            Order.status.in_(KEEP_STATUSES),
        ).count()

        if important_orders > 0:
            # Guest has active/completed orders — keep the user and all orders.
            logger.info(
                "Skipping guest cleanup — user has important orders",
                user_id=user_id,
                important_orders=important_orders,
            )
            return

        # Only delete throwaway orders (PENDING, FAILED, CANCELLED, REFUNDED)
        order_rows = session.query(Order.id).filter(Order.user_id == user_id).all()
        order_ids = [row[0] for row in order_rows]
        if order_ids:
            session.query(Transaction).filter(
                Transaction.order_id.in_(order_ids)
            ).delete(synchronize_session=False)
            session.query(Order).filter(
                Order.id.in_(order_ids)
            ).delete(synchronize_session=False)

        session.query(Referral).filter(
            (Referral.invited_id == user_id) | (Referral.inviter_id == user_id)
        ).delete(synchronize_session=False)

        session.delete(user)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@shared_task
def drain_resilient_payment_queue(max_items: int = 100) -> dict:
    queue = ResilientQueueService()
    processed = 0
    failed = 0

    for _ in range(max_items):
        payload = queue.dequeue(QUEUE_PAYMENTS)
        if payload is None:
            break
        try:
            order_id = int(payload["order_id"])
            payment_status = str(payload["payment_status"])
            payment_provider_id = str(payload.get("payment_provider_id") or f"queued-{order_id}")
            processed_ok = run_async(
                _process_payment_event_async(order_id, payment_status, payment_provider_id)
            )
            if processed_ok and payment_status == "completed":
                order_kind = _resolve_order_kind(order_id)
                queue.enqueue(QUEUE_ORDERS, {"kind": order_kind, "order_id": order_id})
            processed += 1
        except Exception as e:
            attempts = int(payload.get("attempts", 0)) + 1
            payload["attempts"] = attempts
            if attempts <= 10:
                queue.enqueue(QUEUE_PAYMENTS, payload)
            failed += 1
            logger.warning("Resilient payment queue item failed", error=str(e), payload=payload)

    return {"processed": processed, "failed": failed, "remaining": queue.size(QUEUE_PAYMENTS)}


def _resolve_order_kind(order_id: int) -> str:
    """Look up order_type from DB to determine kind for resilient queue."""
    session = SyncSession()
    try:
        order = session.query(Order).filter(Order.id == order_id).first()
        if order and order.order_type == OrderType.PUBG:
            return "pubg_topup"
        if order and order.order_type == OrderType.APPLE:
            return "apple_voucher"
        return "steam_topup"
    finally:
        session.close()


@shared_task
def drain_resilient_order_queue(max_items: int = 100) -> dict:
    queue = ResilientQueueService()
    processed = 0
    failed = 0

    for _ in range(max_items):
        payload = queue.dequeue(QUEUE_ORDERS)
        if payload is None:
            break
        try:
            kind = str(payload.get("kind") or "")
            order_id = int(payload["order_id"])
            if kind == "pubg_topup":
                from app.tasks.pubg_tasks import process_pubg_topup
                process_pubg_topup.delay(order_id)
            elif kind == "apple_voucher":
                from app.tasks.apple_tasks import request_apple_voucher
                request_apple_voucher.delay(order_id)
            elif kind == "steam_topup":
                from app.tasks.steam_tasks import process_steam_topup
                process_steam_topup.delay(order_id)
            else:
                logger.warning("Unknown order queue kind, skipping", kind=kind, order_id=order_id)
            processed += 1
        except Exception as e:
            attempts = int(payload.get("attempts", 0)) + 1
            payload["attempts"] = attempts
            if attempts <= 10:
                queue.enqueue(QUEUE_ORDERS, payload)
            failed += 1
            logger.warning("Resilient order queue item failed", error=str(e), payload=payload)

    return {"processed": processed, "failed": failed, "remaining": queue.size(QUEUE_ORDERS)}


@shared_task
def drain_resilient_guest_cleanup_queue(max_items: int = 100) -> dict:
    queue = ResilientQueueService()
    processed = 0
    failed = 0

    for _ in range(max_items):
        payload = queue.dequeue(QUEUE_GUEST_CLEANUP)
        if payload is None:
            break
        try:
            user_id = int(payload["user_id"])
            _delete_guest_user_sync(user_id)
            processed += 1
        except Exception as e:
            attempts = int(payload.get("attempts", 0)) + 1
            payload["attempts"] = attempts
            if attempts <= 10:
                queue.enqueue(QUEUE_GUEST_CLEANUP, payload)
            failed += 1
            logger.warning("Resilient guest queue item failed", error=str(e), payload=payload)

    return {"processed": processed, "failed": failed, "remaining": queue.size(QUEUE_GUEST_CLEANUP)}


@shared_task
def drain_resilient_email_queue(max_items: int = 50) -> dict:
    """Retry queued emails that failed due to SMTP unavailability."""
    from app.services.email_service import EmailService

    queue = ResilientQueueService()
    email_svc = EmailService()
    processed = 0
    failed = 0

    for _ in range(max_items):
        payload = queue.dequeue(QUEUE_EMAIL)
        if payload is None:
            break
        try:
            success = email_svc.send_email_sync(
                to_email=payload["to_email"],
                subject=payload["subject"],
                body=payload["body"],
                html_body=payload.get("html_body"),
            )
            if success:
                processed += 1
            else:
                # Re-enqueue with incremented attempt count
                attempts = int(payload.get("attempts", 0)) + 1
                payload["attempts"] = attempts
                if attempts <= 10:
                    queue.enqueue(QUEUE_EMAIL, payload)
                else:
                    logger.error(
                        "Email permanently failed after max retries",
                        to_email=payload["to_email"],
                        subject=payload["subject"],
                        attempts=attempts,
                    )
                failed += 1
        except Exception as e:
            attempts = int(payload.get("attempts", 0)) + 1
            payload["attempts"] = attempts
            if attempts <= 10:
                queue.enqueue(QUEUE_EMAIL, payload)
            failed += 1
            logger.warning("Email queue item failed", error=str(e), to_email=payload.get("to_email"))

    return {"processed": processed, "failed": failed, "remaining": queue.size(QUEUE_EMAIL)}

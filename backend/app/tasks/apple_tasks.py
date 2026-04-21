import asyncio
from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import get_logger
from app.models.order import Order, OrderStatus, OrderType
from app.services.wata_voucher_service import WataVoucherService
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
    max_retries=10,
)
def request_apple_voucher(self, order_id: int):
    """
    Request Apple Gift Card voucher from Wata DG after payment.

    Calls GET /api/v3/vouchers/order/{id} which triggers voucher delivery.
    Polls until status is Success (voucher codes returned) or Fail.
    """
    logger.info("Requesting Apple voucher", order_id=order_id, task_id=self.request.id)

    session = SyncSession()
    try:
        order = session.query(Order).filter(Order.id == order_id).first()

        if not order:
            logger.error("Order not found", order_id=order_id)
            return {"status": "error", "message": "Order not found"}

        if order.order_type != OrderType.APPLE:
            logger.warning("Order is not Apple type", order_id=order_id, order_type=order.order_type.value)
            return {"status": "skipped", "message": "Not an Apple order"}

        if order.status == OrderStatus.COMPLETED:
            logger.info("Apple order already completed", order_id=order_id)
            return {"status": "skipped", "message": "Already completed"}

        if order.status not in (OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.FAILED):
            logger.warning(
                "Apple order not in PAID/PROCESSING/FAILED status",
                order_id=order_id,
                status=order.status.value,
            )
            return {"status": "skipped", "message": f"Order status is {order.status.value}"}

        # Update status to processing
        order.status = OrderStatus.PROCESSING
        session.commit()

        wata_order_id = order.apple_wata_order_id
        if not wata_order_id:
            logger.error("No apple_wata_order_id on order", order_id=order_id)
            order.status = OrderStatus.FAILED
            order.steam_response = "No Wata DG order ID"
            session.commit()
            return {"status": "error", "message": "No Wata DG order ID"}

        voucher_service = WataVoucherService()
        dg_order = run_async(voucher_service.get_order_status(wata_order_id))

        dg_status = (dg_order.get("status") or "").strip()
        voucher_codes = dg_order.get("vouchers") or []

        if dg_status == "Success" and voucher_codes:
            codes_str = ", ".join(voucher_codes)
            order.status = OrderStatus.COMPLETED
            order.steam_response = f"apple_voucher_codes:{codes_str}"
            from datetime import datetime
            order.completed_at = datetime.utcnow()
            session.commit()

            logger.info(
                "Apple voucher received",
                order_id=order_id,
                wata_order_id=wata_order_id,
                voucher_count=len(voucher_codes),
            )

            # Send email separately so failures don't break the success flow
            try:
                run_async(
                    email_service.send_apple_gift_card_email(
                        to_email=order.email,
                        order_id=order_id,
                        codes=codes_str,
                    )
                )
            except Exception as email_err:
                logger.error(
                    "Failed to send Apple voucher email",
                    order_id=order_id,
                    error=str(email_err),
                )

            from app.tasks.referral_tasks import process_referral_reward
            process_referral_reward.delay(order_id)

            return {"status": "success", "vouchers": voucher_codes}

        if dg_status == "Fail":
            # Wata DG may report "Fail" transiently and still deliver the voucher
            # later. Only treat as terminal on the last retry attempt.
            if self.request.retries >= self.max_retries:
                order.status = OrderStatus.FAILED
                order.steam_response = f"apple_voucher_fail:{dg_status}"
                session.commit()

                logger.error("Apple voucher failed (final)", order_id=order_id, wata_order_id=wata_order_id)

                try:
                    run_async(
                        email_service.send_order_status_email(
                            to_email=order.email,
                            order_id=order_id,
                            status_text="Ошибка",
                            details="Не удалось получить код Apple Gift Card. Обратитесь в поддержку.",
                        )
                    )
                except Exception as email_err:
                    logger.error(
                        "Failed to send Apple failure email",
                        order_id=order_id,
                        error=str(email_err),
                    )

                return {"status": "failed", "message": "Wata DG order failed"}

            # Not the last retry — keep PROCESSING and retry, DG may recover.
            order.steam_response = f"apple_voucher_fail_retry:{dg_status}"
            session.commit()
            logger.warning(
                "Apple voucher DG returned Fail, retrying",
                order_id=order_id,
                wata_order_id=wata_order_id,
                retry=self.request.retries,
                max_retries=self.max_retries,
            )
            raise Exception(f"Apple voucher DG Fail, retrying ({self.request.retries}/{self.max_retries})")

        # Pending or Paid — not ready yet, retry
        order.steam_response = f"apple_voucher_pending:{dg_status}"
        session.commit()
        logger.info(
            "Apple voucher not ready, retrying",
            order_id=order_id,
            wata_order_id=wata_order_id,
            dg_status=dg_status,
        )
        raise Exception(f"Apple voucher pending: {dg_status}")

    except Exception as e:
        session.rollback()
        logger.error("Apple voucher task error", order_id=order_id, error=str(e))
        raise
    finally:
        session.close()

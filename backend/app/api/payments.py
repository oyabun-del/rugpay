from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import base64
import json
import hmac
import hashlib
from app.core.database import get_db
from app.core.config import settings
from app.services.order_service import OrderService
from app.repositories.order_repository import OrderRepository
from app.models.order import OrderStatus, OrderType
from app.services.wata_service import WataService
from app.services.yookassa_service import YooKassaService
from app.core.logging import get_logger
from app.services.resilient_queue import (
    ResilientQueueService,
    QUEUE_PAYMENTS,
    QUEUE_ORDERS,
)

router = APIRouter()
logger = get_logger(__name__)


class PaymentOrderInfo(BaseModel):
    id: int
    order_type: str = "steam"
    status: str
    amount: float
    final_amount: float
    steam_nickname: Optional[str] = None
    pubg_uid: Optional[str] = None
    pubg_uc_amount: Optional[int] = None
    apple_region: Optional[str] = None
    email: str


def _extract_yookassa_payment_id(order) -> Optional[str]:
    marker = "yookassa_payment_id:"
    raw = (order.steam_response or "").strip()
    if raw.startswith(marker):
        value = raw[len(marker):].strip()
        return value or None
    return None


def _enqueue_payment_fallback(order_id: int, payment_status: str, payment_provider_id: str) -> None:
    try:
        queue = ResilientQueueService()
        queue.enqueue(
            QUEUE_PAYMENTS,
            {
                "order_id": int(order_id),
                "payment_status": str(payment_status),
                "payment_provider_id": str(payment_provider_id),
            },
        )
    except Exception as e:
        logger.error(
            "Failed to enqueue payment fallback",
            order_id=order_id,
            payment_status=payment_status,
            error=str(e),
        )


def _enqueue_order_fallback(order_id: int, kind: str = "steam_topup") -> None:
    try:
        queue = ResilientQueueService()
        queue.enqueue(QUEUE_ORDERS, {"kind": kind, "order_id": int(order_id)})
    except Exception as e:
        logger.error("Failed to enqueue order fallback", order_id=order_id, error=str(e))


def _dispatch_topup_task(order_id: int, order_type: str) -> None:
    """Dispatch the correct Celery task based on order type, with resilient queue fallback."""
    if order_type == OrderType.APPLE:
        # Apple voucher codes are delivered by Wata directly to the customer email.
        # No Celery task needed — order is already marked completed by the webhook.
        logger.info("Apple order completed (voucher delivered by Wata)", order_id=order_id)
        return
    kind = "pubg_topup" if order_type == OrderType.PUBG else "steam_topup"
    try:
        if order_type == OrderType.PUBG:
            from app.tasks.pubg_tasks import process_pubg_topup
            process_pubg_topup.delay(order_id)
            logger.info("PUBG top-up task queued", order_id=order_id)
        else:
            from app.tasks.steam_tasks import process_steam_topup
            process_steam_topup.delay(order_id)
            logger.info("Steam top-up task queued", order_id=order_id)
    except Exception as e:
        logger.warning("Celery top-up enqueue failed, queued fallback", order_id=order_id, error=str(e))
        _enqueue_order_fallback(order_id, kind)


def verify_webhook_signature_hmac(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    """Verify HMAC webhook signature (legacy)."""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_wata_signature(raw_body: bytes, signature_b64: str, public_key_pem: str) -> bool:
    """Verify Wata webhook X-Signature (RSA-SHA512)."""
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.backends import default_backend
    except ImportError:
        logger.warning("cryptography not available for Wata signature verification")
        return False
    try:
        key = serialization.load_pem_public_key(
            public_key_pem.encode("utf-8"),
            backend=default_backend(),
        )
        sig = base64.b64decode(signature_b64)
        key.verify(sig, raw_body, padding.PKCS1v15(), hashes.SHA512())
        return True
    except Exception as e:
        logger.warning("Wata signature verification failed", error=str(e))
        return False


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    x_webhook_signature: Optional[str] = Header(None),
):
    """
    Payment webhook. Supports:
    - Wata (X-Signature RSA-SHA512, body: orderId, transactionStatus, kind).
    - Legacy HMAC (X-Webhook-Signature + PAYMENT_WEBHOOK_SECRET).
    """
    payload = await request.body()

    # Wata webhook (X-Signature)
    if x_signature:
        wata = WataService()
        if not wata.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Wata not configured",
            )
        public_key = await wata.get_public_key()
        if not public_key or not verify_wata_signature(payload, x_signature, public_key):
            logger.warning("Invalid Wata webhook signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )
        try:
            data = json.loads(payload.decode("utf-8"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON",
            )
        order_id_str = data.get("orderId")
        transaction_status = (data.get("transactionStatus") or "").strip()
        transaction_id = data.get("transactionId")

        if not order_id_str:
            logger.error("Wata webhook missing orderId", data=data)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing orderId",
            )
        try:
            order_id = int(order_id_str)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid orderId",
            )

        # Only final statuses update order
        if transaction_status == "Paid":
            payment_status = "completed"
        elif transaction_status == "Declined":
            payment_status = "failed"
        else:
            # Created, Pending — acknowledge only
            logger.info("Wata webhook non-final status", order_id=order_id, transaction_status=transaction_status)
            return {"status": "ok"}

        service = OrderService(db)
        provider_id = transaction_id or f"wata-{order_id}"
        try:
            success = await service.process_payment_webhook(
                order_id=order_id,
                payment_status=payment_status,
                payment_provider_id=provider_id,
            )
        except Exception as e:
            logger.warning("Primary payment processing failed, queued fallback", order_id=order_id, error=str(e))
            _enqueue_payment_fallback(order_id, payment_status, provider_id)
            return {"status": "queued"}
        if success and payment_status == "completed":
            repo = OrderRepository(db)
            order_obj = await repo.get_by_id(order_id)
            order_type = order_obj.order_type if order_obj else OrderType.STEAM
            _dispatch_topup_task(order_id, order_type)
        return {"status": "ok"}

    # YooKassa webhook (no signature header from provider by default).
    # Expected payload has event/object/metadata.order_id.
    try:
        generic_data = json.loads(payload.decode("utf-8"))
    except Exception:
        generic_data = None

    if isinstance(generic_data, dict) and "event" in generic_data and "object" in generic_data:
        event = generic_data.get("event")
        obj = generic_data.get("object") or {}
        metadata = obj.get("metadata") or {}
        order_id_raw = metadata.get("order_id")
        payment_id = obj.get("id") or ""
        provider_status = (obj.get("status") or "").lower()

        if not order_id_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing metadata.order_id in YooKassa webhook",
            )
        try:
            order_id = int(order_id_raw)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid metadata.order_id in YooKassa webhook",
            )

        if event == "payment.succeeded" or provider_status == "succeeded":
            payment_status = "completed"
        elif event == "payment.canceled" or provider_status == "canceled":
            payment_status = "failed"
        else:
            logger.info(
                "YooKassa webhook non-final status",
                order_id=order_id,
                event=event,
                provider_status=provider_status,
            )
            return {"status": "ok"}

        service = OrderService(db)
        provider_id = payment_id or f"yookassa-{order_id}"
        try:
            success = await service.process_payment_webhook(
                order_id=order_id,
                payment_status=payment_status,
                payment_provider_id=provider_id,
            )
        except Exception as e:
            logger.warning("Primary payment processing failed, queued fallback", order_id=order_id, error=str(e))
            _enqueue_payment_fallback(order_id, payment_status, provider_id)
            return {"status": "queued"}
        if success and payment_status == "completed":
            repo = OrderRepository(db)
            order_obj = await repo.get_by_id(order_id)
            order_type = order_obj.order_type if order_obj else OrderType.STEAM
            _dispatch_topup_task(order_id, order_type)
        return {"status": "ok"}

    # Legacy HMAC webhook (no X-Signature → require legacy secret + header)
    if not settings.PAYMENT_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing webhook signature",
        )
    if not x_webhook_signature:
        logger.warning("Webhook received without signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing webhook signature",
        )
    if not verify_webhook_signature_hmac(
        payload,
        x_webhook_signature,
        settings.PAYMENT_WEBHOOK_SECRET,
    ):
        logger.warning("Invalid webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    try:
        data = json.loads(payload.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    logger.info("Payment webhook received", data=data)
    order_id = data.get("order_id")
    payment_status = data.get("status")
    payment_provider_id = data.get("payment_id")

    if not order_id:
        logger.error("Webhook missing order_id")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing order_id",
        )

    service = OrderService(db)
    numeric_order_id = int(order_id)
    provider_id = payment_provider_id or f"legacy-{numeric_order_id}"
    try:
        success = await service.process_payment_webhook(
            order_id=numeric_order_id,
            payment_status=payment_status,
            payment_provider_id=provider_id,
        )
    except Exception as e:
        logger.warning("Primary payment processing failed, queued fallback", order_id=numeric_order_id, error=str(e))
        _enqueue_payment_fallback(numeric_order_id, payment_status or "", provider_id)
        return {"status": "queued"}
    if success and payment_status == "completed":
        repo = OrderRepository(db)
        order_obj = await repo.get_by_id(numeric_order_id)
        order_type = order_obj.order_type if order_obj else OrderType.STEAM
        _dispatch_topup_task(numeric_order_id, order_type)

    return {"status": "ok"}


@router.get("/order/{order_id}")
async def get_order_for_payment_page(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: minimal order info for payment/return page (no auth).
    Returns id, status, amount, final_amount, steam_nickname, email for display.
    """
    repo = OrderRepository(db)
    order = await repo.get_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    # Fallback sync with Wata transaction API (covers both Steam DG and PUBG H2H).
    if settings.WATA_ENABLED and order.status in [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING]:
        wata = WataService()
        tx = await wata.get_transaction_by_order_id(str(order.id))
        if tx:
            tx_status = (tx.get("status") or "").strip()
            tx_id = tx.get("id") or f"wata-{order.id}"
            service = OrderService(db)
            if tx_status == "Paid":
                success = await service.process_payment_webhook(order.id, "completed", tx_id)
                if success:
                    _dispatch_topup_task(order.id, order.order_type)
                order = await repo.get_by_id(order_id)
            elif tx_status == "Declined":
                await service.process_payment_webhook(order.id, "failed", tx_id)
                order = await repo.get_by_id(order_id)

    # Fallback sync with YooKassa.
    if settings.YOOKASSA_ENABLED and order.status in [OrderStatus.PENDING]:
        yookassa_payment_id = _extract_yookassa_payment_id(order)
        if yookassa_payment_id:
            yookassa = YooKassaService()
            payment = await yookassa.get_payment(yookassa_payment_id)
            if payment:
                yk_status = (payment.get("status") or "").lower()
                service = OrderService(db)
                if yk_status == "succeeded":
                    success = await service.process_payment_webhook(
                        order.id, "completed", yookassa_payment_id,
                    )
                    if success:
                        _dispatch_topup_task(order.id, order.order_type)
                    order = await repo.get_by_id(order_id)
                elif yk_status == "canceled":
                    await service.process_payment_webhook(order.id, "failed", yookassa_payment_id)
                    order = await repo.get_by_id(order_id)

    # Sync with Wata Steam DG order status (Steam orders only).
    if (
        order.order_type == OrderType.STEAM
        and settings.WATA_STEAM_TOPUP_ENABLED
        and order.status in [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING]
    ):
        from app.services.steam_service import SteamTopupService

        steam = SteamTopupService()
        topup_status, topup_message = await steam.check_topup_status(str(order.id))

        if topup_status == "completed":
            service = OrderService(db)
            if order.status == OrderStatus.PENDING:
                processed = await service.process_payment_webhook(order.id, "completed", f"wata-steam-{order.id}")
                if processed:
                    _dispatch_topup_task(order.id, order.order_type)
            else:
                await repo.update_status(order.id, OrderStatus.COMPLETED)
                order = await repo.get_by_id(order_id)
                if order:
                    order.steam_response = topup_message
                    await db.commit()
                    await db.refresh(order)
        elif topup_status == "failed":
            await repo.update_status(order.id, OrderStatus.FAILED)
            order = await repo.get_by_id(order_id)
            if order:
                order.steam_response = topup_message
                await db.commit()
                await db.refresh(order)
        else:
            if "processing" in topup_message.lower() and order.status == OrderStatus.PENDING:
                service = OrderService(db)
                processed = await service.process_payment_webhook(order.id, "completed", f"wata-steam-{order.id}")
                if processed:
                    _dispatch_topup_task(order.id, order.order_type)

    return PaymentOrderInfo(
        id=order.id,
        order_type=order.order_type.value if order.order_type else "steam",
        status=order.status.value,
        amount=order.amount,
        final_amount=order.final_amount,
        steam_nickname=order.steam_nickname,
        pubg_uid=order.pubg_uid,
        pubg_uc_amount=order.pubg_uc_amount,
        apple_region=getattr(order, "apple_region", None),
        email=order.email,
    )


@router.get("/order/{order_id}/pay-link")
async def get_payment_link_for_pending_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: regenerate payment link for pending order."""
    service = OrderService(db)
    payment_url, provider = await service.create_payment_link_for_existing_order(order_id)
    return {
        "order_id": order_id,
        "payment_url": payment_url,
        "payment_provider": provider.value,
    }


@router.post("/webhook/test")
async def test_webhook(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Test webhook (DEBUG only)."""
    if not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test webhook only available in debug mode",
        )
    service = OrderService(db)
    success = await service.process_payment_webhook(
        order_id=order_id,
        payment_status="completed",
        payment_provider_id=f"TEST-{order_id}",
    )
    return {"status": "ok", "processed": success}

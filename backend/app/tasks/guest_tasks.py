from datetime import datetime, timedelta

from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import get_logger
from app.models.user import User
from app.services.resilient_queue import ResilientQueueService, QUEUE_GUEST_CLEANUP

logger = get_logger(__name__)

# Sync engine for Celery tasks
sync_engine = create_engine(settings.DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)

GUEST_EMAIL_SUFFIX = "@guest.gamecover.local"


@shared_task
def cleanup_expired_guest_users() -> dict:
    """
    Remove expired temporary (guest) users and all related orders/transactions.
    """
    ttl_minutes = max(1, int(settings.GUEST_SESSION_TTL_MINUTES))
    cutoff = datetime.utcnow() - timedelta(minutes=ttl_minutes)

    session = SyncSession()
    queued_users = 0

    try:
        guest_users = session.query(User).filter(
            User.email.like(f"%{GUEST_EMAIL_SUFFIX}"),
            User.created_at <= cutoff,
        ).all()

        queue = ResilientQueueService()
        for user in guest_users:
            queue.enqueue(QUEUE_GUEST_CLEANUP, {"user_id": user.id})
            queued_users += 1

        logger.info(
            "Expired guest cleanup queued",
            cutoff=cutoff.isoformat(),
            queued_users=queued_users,
        )
        return {
            "queued_users": queued_users,
        }
    except Exception as e:
        session.rollback()
        logger.error("Expired guest cleanup failed", error=str(e))
        raise
    finally:
        session.close()

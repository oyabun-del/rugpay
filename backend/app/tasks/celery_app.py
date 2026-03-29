from celery import Celery
import os
from app.core.config import settings

celery_app = Celery(
    "steam_topup",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.steam_tasks",
        "app.tasks.pubg_tasks",
        "app.tasks.referral_tasks",
        "app.tasks.stats_tasks",
        "app.tasks.guest_tasks",
        "app.tasks.resilient_queue_tasks",
    ],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Retry settings
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=5,
    # Beat schedule for periodic tasks
    beat_schedule={
        "update-stats-every-5-minutes": {
            "task": "app.tasks.stats_tasks.update_cached_stats",
            "schedule": 300.0,  # 5 minutes
        },
        "retry-failed-topups-every-10-minutes": {
            "task": "app.tasks.steam_tasks.retry_failed_topups",
            "schedule": 600.0,  # 10 minutes
        },
        "cleanup-expired-guest-users": {
            "task": "app.tasks.guest_tasks.cleanup_expired_guest_users",
            "schedule": float(settings.GUEST_CLEANUP_INTERVAL_MINUTES * 60),
        },
        "drain-resilient-payment-queue": {
            "task": "app.tasks.resilient_queue_tasks.drain_resilient_payment_queue",
            "schedule": 60.0,
        },
        "drain-resilient-order-queue": {
            "task": "app.tasks.resilient_queue_tasks.drain_resilient_order_queue",
            "schedule": 60.0,
        },
        "drain-resilient-guest-cleanup-queue": {
            "task": "app.tasks.resilient_queue_tasks.drain_resilient_guest_cleanup_queue",
            "schedule": 60.0,
        },
    },
)

# Windows-specific worker settings.
# On Windows (especially with newer Python versions), prefork can crash with:
# "ValueError: not enough values to unpack (expected 3, got 0)".
if os.name == "nt":
    celery_app.conf.update(
        worker_pool="solo",
        worker_concurrency=1,
        task_soft_time_limit=None,
    )

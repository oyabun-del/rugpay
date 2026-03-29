import json
from typing import Any, Optional

from redis import Redis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

QUEUE_PAYMENTS = "gamecover:queue:payments"
QUEUE_ORDERS = "gamecover:queue:orders"
QUEUE_GUEST_CLEANUP = "gamecover:queue:guest_cleanup"


class ResilientQueueService:
    def __init__(self) -> None:
        self._client = Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def enqueue(self, queue_name: str, payload: dict[str, Any]) -> int:
        raw = json.dumps(payload, ensure_ascii=True)
        length = self._client.rpush(queue_name, raw)
        logger.info("Resilient queue enqueued", queue=queue_name, length=length)
        return int(length)

    def dequeue(self, queue_name: str) -> Optional[dict[str, Any]]:
        raw = self._client.lpop(queue_name)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Resilient queue payload decode failed", queue=queue_name, raw=raw)
            return None

    def size(self, queue_name: str) -> int:
        return int(self._client.llen(queue_name))

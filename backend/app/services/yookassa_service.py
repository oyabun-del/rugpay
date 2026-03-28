import base64
import uuid
from typing import Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class YooKassaServiceError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class YooKassaService:
    """
    YooKassa payment API service.
    Docs: https://yookassa.ru/developers/api#payment
    """

    def __init__(self):
        self.base_url = (settings.YOOKASSA_API_BASE_URL or "https://api.yookassa.ru/v3").rstrip("/")
        self.shop_id = settings.YOOKASSA_SHOP_ID
        self.secret_key = settings.YOOKASSA_SECRET_KEY
        self.timeout = 30.0

    def is_enabled(self) -> bool:
        return bool(settings.YOOKASSA_ENABLED)

    def is_configured(self) -> bool:
        return self.is_enabled() and bool(self.shop_id and self.secret_key)

    def _auth_header(self) -> str:
        creds = f"{self.shop_id}:{self.secret_key}".encode("utf-8")
        token = base64.b64encode(creds).decode("utf-8")
        return f"Basic {token}"

    def _headers(self, idempotence_key: Optional[str] = None) -> dict:
        headers = {
            "Authorization": self._auth_header(),
            "Content-Type": "application/json",
        }
        if idempotence_key:
            headers["Idempotence-Key"] = idempotence_key
        return headers

    async def create_payment_link(
        self,
        amount: float,
        currency: str,
        order_id: str,
        description: str,
        return_url: str,
    ) -> dict:
        if not self.is_configured():
            raise YooKassaServiceError("YooKassa is not configured")

        payload = {
            "amount": {"value": f"{amount:.2f}", "currency": currency},
            "capture": bool(settings.YOOKASSA_CAPTURE_PAYMENT),
            "confirmation": {
                "type": "redirect",
                "return_url": return_url,
            },
            "description": description,
            "metadata": {"order_id": str(order_id)},
        }

        idempotence_key = str(uuid.uuid4())
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.post(
                    f"{self.base_url}/payments",
                    json=payload,
                    headers=self._headers(idempotence_key=idempotence_key),
                )
        except httpx.RequestError as e:
            raise YooKassaServiceError(f"Network error: {str(e)}")

        data = response.json() if response.content else {}
        if response.status_code not in (200, 201):
            message = data.get("description") or data.get("type") or f"HTTP {response.status_code}"
            raise YooKassaServiceError(message, status_code=response.status_code)

        return data

    async def get_payment(self, payment_id: str) -> Optional[dict]:
        """Get YooKassa payment details by ID."""
        if not self.is_configured():
            return None
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.base_url}/payments/{payment_id}",
                    headers=self._headers(),
                )
        except httpx.RequestError as e:
            logger.warning("YooKassa get payment request failed", error=str(e), payment_id=payment_id)
            return None

        if response.status_code != 200:
            return None
        return response.json() if response.content else None

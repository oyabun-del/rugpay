"""
Wata payment provider integration.
API docs: https://wata.pro/api
"""
import httpx
from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Default timeout for API calls (Wata allows 1 min)
WATA_TIMEOUT = 60.0


class WataServiceError(Exception):
    """Raised when Wata API returns an error."""
    def __init__(self, message: str, status_code: Optional[int] = None, body: Optional[dict] = None):
        self.message = message
        self.status_code = status_code
        self.body = body
        super().__init__(message)


class WataService:
    """Client for Wata H2H API."""

    def __init__(self):
        self.base_url = (settings.WATA_API_BASE_URL or "").rstrip("/")
        self.token = settings.WATA_ACCESS_TOKEN

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    def is_configured(self) -> bool:
        return bool(self.base_url and self.token)

    async def create_payment_link(
        self,
        amount: float,
        currency: str,
        order_id: str,
        description: Optional[str] = None,
        success_redirect_url: Optional[str] = None,
        fail_redirect_url: Optional[str] = None,
    ) -> dict:
        """
        Create a one-time payment link.
        Returns dict with id, url, status, etc.
        """
        if not self.is_configured():
            raise WataServiceError("Wata is not configured (WATA_API_BASE_URL, WATA_ACCESS_TOKEN)")

        payload = {
            "amount": round(amount, 2),
            "currency": currency,
            "orderId": order_id,
        }
        if description:
            payload["description"] = description
        if success_redirect_url:
            payload["successRedirectUrl"] = success_redirect_url
        if fail_redirect_url:
            payload["failRedirectUrl"] = fail_redirect_url

        async with httpx.AsyncClient(timeout=WATA_TIMEOUT) as client:
            response = await client.post(
                f"{self.base_url}/links",
                headers=self._headers(),
                json=payload,
            )

        if response.status_code != 200:
            try:
                err_body = response.json()
            except Exception:
                err_body = None
            msg = err_body.get("error", {}).get("message", response.text) if isinstance(err_body, dict) else response.text
            logger.error("Wata create link failed", status=response.status_code, body=err_body)
            raise WataServiceError(
                msg or f"Wata API error {response.status_code}",
                status_code=response.status_code,
                body=err_body,
            )

        data = response.json()
        logger.info(
            "Wata payment link created",
            link_id=data.get("id"),
            order_id=order_id,
            amount=amount,
        )
        return data

    async def get_transaction_by_order_id(self, order_id: str) -> Optional[dict]:
        """
        Fetch latest transaction by merchant orderId.
        Returns first item from /transactions search or None.
        """
        if not self.is_configured():
            return None

        params = {
            "orderId": order_id,
            "maxResultCount": 1,
            "sorting": "creationTime desc",
        }
        async with httpx.AsyncClient(timeout=WATA_TIMEOUT) as client:
            response = await client.get(
                f"{self.base_url}/transactions",
                headers=self._headers(),
                params=params,
            )

        if response.status_code != 200:
            logger.warning("Wata transaction search failed", status=response.status_code, order_id=order_id)
            return None

        data = response.json() if response.content else {}
        items = data.get("items") if isinstance(data, dict) else None
        if not items:
            return None
        return items[0]

    async def get_public_key(self) -> Optional[str]:
        """Fetch Wata public key for webhook signature verification (no auth)."""
        if not self.base_url:
            return None
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.base_url}/public-key")
        if response.status_code != 200:
            logger.warning("Wata public key fetch failed", status=response.status_code)
            return None
        data = response.json()
        return data.get("value")

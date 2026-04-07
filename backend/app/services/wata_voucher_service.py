"""
Wata Digital Goods Voucher API client.
Docs: https://wata.pro/api/digital-goods
"""
import uuid
import httpx
from typing import Optional, List

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
TIMEOUT = 30.0


class WataVoucherService:
    """
    Client for Wata Digital Goods Voucher API (/api/v3/vouchers).
    Uses a dedicated Apple token (WATA_DG_APPLE_ACCESS_TOKEN) when set,
    falling back to the general DG token (WATA_DG_ACCESS_TOKEN).
    """

    def __init__(self):
        self.base_url = (settings.WATA_DG_API_BASE_URL or "https://dg-api.wata.pro/api").rstrip("/")
        # Apple orders use their own terminal/token if configured
        self.token = (
            settings.WATA_DG_APPLE_ACCESS_TOKEN
            or settings.WATA_DG_ACCESS_TOKEN
            or settings.WATA_ACCESS_TOKEN
        )
        self.commission_percent: float = settings.APPLE_COMMISSION_PERCENT

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url and self.token)

    def apply_commission(self, min_price: float) -> float:
        """
        Calculate the customer-facing price by applying the commission markup.
        Constraint: minPrice <= amount <= minPrice * 1.5
        """
        markup = min_price * (self.commission_percent / 100)
        amount = min_price + markup
        # Clamp to Wata's upper limit
        max_amount = min_price * 1.5
        return round(min(amount, max_amount), 2)

    async def get_apple_services(self) -> List[dict]:
        """Return available Apple Wallet Code services (regions)."""
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{self.base_url}/v3/vouchers/services",
                headers=self._headers(),
            )
        response.raise_for_status()
        services = response.json()
        return [
            {"id": str(s["id"]), "name": s["name"]}
            for s in services
            if s.get("isAvailable") and "Apple Wallet Code" in s.get("name", "")
        ]

    async def get_vouchers(self, category_id: str) -> dict:
        """Return denominations for a service, with finalPrice including commission."""
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{self.base_url}/v3/vouchers/{category_id}",
                headers=self._headers(),
            )
        response.raise_for_status()
        data = response.json()
        vouchers = [
            {
                "id": str(v["id"]),
                "name": v["name"],
                "price": v["price"],
                "minPrice": v["minPrice"],
                "finalPrice": self.apply_commission(v["minPrice"]),
                "stock": v.get("stock", 0),
            }
            for v in data.get("vouchers", [])
            if v.get("isAvailable") and v.get("stock", 0) > 0
        ]
        return {"details": data.get("details", {}), "vouchers": vouchers}

    async def create_order(
        self,
        voucher_id: str,
        min_price: float,
        email: str,
        internal_order_id: Optional[str] = None,
        success_redirect_url: Optional[str] = None,
        fail_redirect_url: Optional[str] = None,
    ) -> dict:
        """
        Create a voucher order.
        amount is calculated as minPrice + commission, clamped to minPrice * 1.5.
        """
        if not internal_order_id:
            internal_order_id = str(uuid.uuid4())

        amount = self.apply_commission(min_price)

        payload: dict = {
            "voucherId": int(voucher_id),
            "amount": amount,
            "count": 1,
            "orderId": internal_order_id,
            "email": email,
            "description": "Apple Gift Card",
        }
        if success_redirect_url:
            payload["successRedirectUrl"] = success_redirect_url
        if fail_redirect_url:
            payload["failRedirectUrl"] = fail_redirect_url

        logger.info(
            "Creating Apple voucher order",
            voucher_id=voucher_id,
            min_price=min_price,
            amount=amount,
            email=email,
        )

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{self.base_url}/v3/vouchers",
                headers=self._headers(),
                json=payload,
            )

        if response.status_code not in (200, 201):
            logger.error(
                "Wata voucher order failed",
                status=response.status_code,
                body=response.text,
                voucher_id=voucher_id,
            )
            raise RuntimeError(f"Wata voucher API error {response.status_code}: {response.text}")

        return response.json()

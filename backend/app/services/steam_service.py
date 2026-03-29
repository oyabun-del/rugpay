import httpx
from typing import Optional, Tuple

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# Legacy PlayWallet integration is intentionally disabled.
# It is kept here as a reference to preserve old functionality.
#
# class SteamTopupService:
#     def __init__(self):
#         self.api_url = (settings.PLAYWALLET_API_URL or settings.STEAM_TOPUP_API_URL or "").rstrip("/")
#         self.api_key = settings.PLAYWALLET_API_KEY or settings.STEAM_TOPUP_API_KEY
#         self.service_id = settings.PLAYWALLET_SERVICE_ID
#         self.rub_per_usd = settings.PLAYWALLET_RUB_PER_USD
#         self.timeout = 30.0


class SteamTopupService:
    """
    Steam top-up integration via Wata Digital Goods API.
    Docs: https://wata.pro/api/digital-goods#rec1483091141
    """

    def __init__(self):
        self.api_url = (settings.WATA_DG_API_BASE_URL or "https://dg-api.wata.pro/api").rstrip("/")
        self.access_token = settings.WATA_DG_ACCESS_TOKEN or settings.WATA_ACCESS_TOKEN
        self.enabled = bool(settings.WATA_STEAM_TOPUP_ENABLED)
        self.timeout = 60.0

    @property
    def _is_configured(self) -> bool:
        return bool(self.enabled and self.api_url and self.access_token)

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}",
        }

    @staticmethod
    def _extract_error_message(data: dict, fallback: str) -> str:
        error = data.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            details = error.get("details")
            if message and details:
                return f"{message} {details}".strip()
            if message:
                return str(message)
        return fallback

    async def get_topup_quote(self, steam_nickname: str, net_amount: float) -> Tuple[float, float]:
        """
        Returns (price, min_price) for Steam top-up.
        """
        if not self._is_configured:
            raise RuntimeError("Wata Steam top-up API is not configured")

        params = {
            "NetAmount": f"{net_amount:.2f}",
            "Account": steam_nickname,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.api_url}/v3/steam/amount",
                headers=self._headers(),
                params=params,
            )

        data = response.json() if response.content else {}
        if response.status_code != 200:
            message = self._extract_error_message(data, f"HTTP {response.status_code}")
            raise RuntimeError(message)

        price = float(data.get("price", 0))
        min_price = float(data.get("minPrice", 0))
        if price <= 0 or min_price <= 0:
            raise RuntimeError("Wata returned invalid Steam quote")
        return price, min_price

    async def create_topup_order(
        self,
        order_id: int,
        steam_nickname: str,
        amount: float,
        net_amount: float,
        description: str,
        success_redirect_url: Optional[str] = None,
        fail_redirect_url: Optional[str] = None,
    ) -> dict:
        """
        Create Wata Steam order and return provider payload (including paymentLink).
        """
        if not self._is_configured:
            raise RuntimeError("Wata Steam top-up API is not configured")

        payload = {
            "account": steam_nickname,
            "amount": round(amount, 2),
            "netAmount": round(net_amount, 2),
            "description": description,
            "orderId": str(order_id),
        }
        if success_redirect_url:
            payload["successRedirectUrl"] = success_redirect_url
        if fail_redirect_url:
            payload["failRedirectUrl"] = fail_redirect_url

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.api_url}/v3/steam",
                headers=self._headers(),
                json=payload,
            )

        data = response.json() if response.content else {}
        if response.status_code != 200:
            message = self._extract_error_message(data, f"HTTP {response.status_code}")
            raise RuntimeError(message)
        return data

    async def get_order_info(self, order_id: str) -> dict:
        """Get Wata Steam order status/info."""
        if not self._is_configured:
            raise RuntimeError("Wata Steam top-up API is not configured")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.api_url}/v3/steam/order/{order_id}",
                headers=self._headers(),
            )

        data = response.json() if response.content else {}
        if response.status_code != 200:
            message = self._extract_error_message(data, f"HTTP {response.status_code}")
            raise RuntimeError(message)
        return data

    async def validate_steam_account(self, steam_nickname: str) -> Tuple[bool, str]:
        """Validate Steam account by requesting quote for minimal amount."""
        logger.info("Validating Steam account", steam_nickname=steam_nickname)

        if not steam_nickname.strip():
            return False, "Steam login is empty"
        if not self._is_configured:
            logger.warning("Wata Steam API not configured, validation skipped")
            return True, "Validation skipped - API not configured"

        try:
            await self.get_topup_quote(
                steam_nickname=steam_nickname,
                net_amount=max(float(settings.MIN_TOPUP_AMOUNT), 100.0),
            )
            return True, "OK"
        except Exception as e:
            logger.error("Steam validation failed", error=str(e))
            return False, str(e)

    async def check_topup_status(
        self,
        transaction_id: str,
    ) -> Tuple[str, str]:
        """
        Check status by Wata Steam orderId.
        Returns:
            ("pending" | "completed" | "failed", message)
        """
        logger.info("Checking top-up status", transaction_id=transaction_id)

        if not self._is_configured:
            return "pending", "Wata Steam API is not configured"

        try:
            data = await self.get_order_info(transaction_id)
            provider_status = (data.get("status") or "").strip().lower()
            if provider_status == "success":
                return "completed", "Top-up completed"
            if provider_status == "fail":
                return "failed", "Top-up failed"
            if provider_status == "paid":
                return "pending", "Payment received, top-up is processing"
            return "pending", f"Top-up status: {provider_status or 'pending'}"
        except httpx.RequestError as e:
            logger.error("Steam status check request error", transaction_id=transaction_id, error=str(e))
            return "pending", f"API error: {str(e)}"
        except Exception as e:
            logger.error("Steam status check error", transaction_id=transaction_id, error=str(e))
            return "pending", str(e)

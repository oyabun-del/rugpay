import asyncio
from math import ceil
from typing import Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class FazerCardsServiceError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class FazerCardsService:
    """Client for FazerCards reseller API."""

    _pubg_packages_cache: Optional[list[dict]] = None
    _pubg_packages_cached_at: float = 0.0
    _cache_lock: asyncio.Lock = asyncio.Lock()

    def __init__(self):
        self.enabled = bool(settings.FAZERCARDS_ENABLED)
        self.base_url = (settings.FAZERCARDS_API_BASE_URL or "").rstrip("/")
        self.api_key = settings.FAZERCARDS_API_KEY
        self.timeout = 45.0
        self.rub_rate = float(settings.FAZERCARDS_RUB_RATE)
        self.markup_percent = float(settings.FAZERCARDS_MARKUP_PERCENT)
        self.pubg_products = {
            60: settings.FAZERCARDS_PUBG_PRODUCT_ID_60,
            325: settings.FAZERCARDS_PUBG_PRODUCT_ID_325,
            660: settings.FAZERCARDS_PUBG_PRODUCT_ID_660,
            1800: settings.FAZERCARDS_PUBG_PRODUCT_ID_1800,
            3850: settings.FAZERCARDS_PUBG_PRODUCT_ID_3850,
            8100: settings.FAZERCARDS_PUBG_PRODUCT_ID_8100,
        }
        self.pubg_images = {
            60: "/pubg-uc-60.png",
            325: "/pubg-uc-325.png",
            660: "/pubg-uc-660.png",
            1800: "/pubg-uc-1800.png",
        }
        self.cache_ttl_seconds = 300.0  # 5 minutes

    def is_configured(self) -> bool:
        return bool(self.enabled and self.base_url and self.api_key)

    def is_package_enabled(self, uc_amount: int) -> bool:
        product_id = self.pubg_products.get(uc_amount)
        return bool(self.is_configured() and product_id)

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key or "",
        }

    @staticmethod
    def _extract_error_message(data: dict, fallback: str) -> str:
        if not isinstance(data, dict):
            return fallback
        if isinstance(data.get("error"), str):
            return data["error"]
        if isinstance(data.get("message"), str):
            return data["message"]
        if isinstance(data.get("detail"), str):
            return data["detail"]
        return fallback

    def _calc_price_rub(self, real_price: float) -> int:
        # Formula: real_price * rate + markup%, rounded up to integer.
        multiplier = 1 + (self.markup_percent / 100.0)
        return int(ceil(real_price * self.rub_rate * multiplier))

    @staticmethod
    def _to_float(value: object) -> Optional[float]:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            normalized = value.strip().replace(",", ".")
            try:
                return float(normalized)
            except ValueError:
                return None
        return None

    def _default_pubg_packages(self) -> list[dict]:
        packages: list[dict] = []
        for uc in [60, 325, 660, 1800, 3850, 8100]:
            if not self.pubg_products.get(uc):
                continue
            packages.append(
                {
                    "uc": uc,
                    "label": f"{uc} UC",
                    "image_url": self.pubg_images.get(uc, "/pubg-mobile-logo.png"),
                    "enabled": self.is_package_enabled(uc),
                    "price_rub": None,
                    "real_price": None,
                    "source_currency": None,
                }
            )
        return packages

    async def _fetch_pubg_products(self) -> list[dict]:
        if not self.is_configured():
            raise FazerCardsServiceError("FazerCards is not configured or disabled")

        # PUBG is available in this account via gift cards.
        # Some accounts require unfiltered list and local filtering by ids.
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/giftcards/products",
                headers=self._headers(),
                params={"category": "pubg_mobile"},
            )

            data = response.json() if response.content else {}
            if response.status_code != 200:
                message = self._extract_error_message(data, f"FazerCards API error {response.status_code}")
                raise FazerCardsServiceError(message, status_code=response.status_code)

            products = data.get("products")
            if isinstance(products, list) and products:
                return products

            # Fallback: load full catalog and match products by configured IDs.
            fallback_response = await client.get(
                f"{self.base_url}/giftcards/products",
                headers=self._headers(),
            )
            fallback_data = fallback_response.json() if fallback_response.content else {}
            if fallback_response.status_code != 200:
                message = self._extract_error_message(fallback_data, f"FazerCards API error {fallback_response.status_code}")
                raise FazerCardsServiceError(message, status_code=fallback_response.status_code)
            fallback_products = fallback_data.get("products")
            return fallback_products if isinstance(fallback_products, list) else []

    async def get_pubg_packages_with_prices(self, force_refresh: bool = False) -> list[dict]:
        now = asyncio.get_running_loop().time()
        if (
            not force_refresh
            and self.__class__._pubg_packages_cache is not None
            and (now - self.__class__._pubg_packages_cached_at) < self.cache_ttl_seconds
        ):
            return self.__class__._pubg_packages_cache

        async with self.__class__._cache_lock:
            now_locked = asyncio.get_running_loop().time()
            if (
                not force_refresh
                and self.__class__._pubg_packages_cache is not None
                and (now_locked - self.__class__._pubg_packages_cached_at) < self.cache_ttl_seconds
            ):
                return self.__class__._pubg_packages_cache

            packages = self._default_pubg_packages()
            try:
                remote_products = await self._fetch_pubg_products()
                by_product_id = {}
                for item in remote_products:
                    if isinstance(item, dict):
                        product_id = item.get("id")
                        if isinstance(product_id, str) and product_id:
                            by_product_id[product_id] = item

                for pkg in packages:
                    uc = pkg["uc"]
                    mapped_product_id = self.pubg_products.get(uc)
                    if not mapped_product_id:
                        pkg["enabled"] = False
                        continue

                    provider_item = by_product_id.get(mapped_product_id)
                    if not isinstance(provider_item, dict):
                        # Keep package selectable if configured in env,
                        # even when provider catalog response is delayed/partial.
                        pkg["enabled"] = True
                        continue

                    raw_real_price = provider_item.get("real_price")
                    if raw_real_price is None:
                        raw_real_price = provider_item.get("realPrice")
                    raw_price = provider_item.get("price")
                    source_currency = provider_item.get("currency")
                    numeric_price = self._to_float(raw_real_price)
                    if numeric_price is None:
                        numeric_price = self._to_float(raw_price)

                    pkg["enabled"] = True
                    pkg["source_currency"] = str(source_currency) if source_currency else None
                    pkg["real_price"] = numeric_price
                    if numeric_price and numeric_price > 0:
                        pkg["price_rub"] = self._calc_price_rub(numeric_price)
            except Exception as e:
                logger.warning("Failed to refresh PUBG package prices, using cached/default values", error=str(e))
                if self.__class__._pubg_packages_cache is not None:
                    # Keep previously loaded prices so UI doesn't flicker/reset on transient errors.
                    return self.__class__._pubg_packages_cache
                self.__class__._pubg_packages_cache = packages
                self.__class__._pubg_packages_cached_at = asyncio.get_running_loop().time()
                return packages

            self.__class__._pubg_packages_cache = packages
            self.__class__._pubg_packages_cached_at = asyncio.get_running_loop().time()
            return packages

    async def create_pubg_order(
        self,
        uid: str,
        uc_amount: int,
        promocode: Optional[str] = None,
    ) -> dict:
        if not self.is_configured():
            raise FazerCardsServiceError("FazerCards is not configured or disabled")

        product_id = self.pubg_products.get(uc_amount)
        if not product_id:
            raise FazerCardsServiceError(f"PUBG UC package {uc_amount} is not configured")

        payload = {
            "product_id": product_id,
            "quantity": 1,
        }
        # Gift-card flow doesn't always require game fields, but we keep UID for future compatibility.
        if uid:
            payload["game_fields"] = {"user_id": uid}
        # Best-effort: if API supports promo_code, it will apply it.
        if promocode:
            payload["promo_code"] = promocode.strip()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/giftcards/order",
                    headers=self._headers(),
                    json=payload,
                )
        except httpx.RequestError as e:
            raise FazerCardsServiceError(f"FazerCards request failed: {str(e)}")

        data = response.json() if response.content else {}
        if response.status_code not in (200, 201):
            message = self._extract_error_message(data, f"FazerCards API error {response.status_code}")
            logger.error(
                "FazerCards create PUBG order failed",
                status_code=response.status_code,
                response=data,
            )
            raise FazerCardsServiceError(message, status_code=response.status_code)

        logger.info(
            "FazerCards PUBG order created",
            provider_order_id=data.get("id"),
            uc_amount=uc_amount,
            uid=uid,
        )
        return data

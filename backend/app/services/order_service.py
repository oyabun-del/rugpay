from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from typing import Optional
from app.repositories.order_repository import OrderRepository
from app.repositories.promocode_repository import PromocodeRepository
from app.repositories.user_repository import UserRepository
from app.repositories.referral_repository import ReferralRepository
from app.schemas.order import (
    OrderCreate,
    PubgOrderCreate,
    OrderResponse,
    OrderCalculation,
    CreateOrderResponse,
    PaymentProvider,
    PaymentProviderInfo,
    PaymentProvidersResponse,
)
from app.models.order import OrderStatus, OrderType
from app.core.config import settings
from app.core.constants import GUEST_EMAIL_SUFFIX
from app.core.logging import get_logger
from app.services.yookassa_service import YooKassaService, YooKassaServiceError
from app.services.wata_service import WataService, WataServiceError
from app.services.fazercards_service import FazerCardsService
from app.services.email_service import EmailService

logger = get_logger(__name__)


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.promocode_repo = PromocodeRepository(db)
        self.user_repo = UserRepository(db)
        self.referral_repo = ReferralRepository(db)
        self.email_service = EmailService()
    
    def get_commission_percent(self, amount: float) -> float:
        if amount <= settings.COMMISSION_THRESHOLD_AMOUNT:
            return settings.COMMISSION_PERCENT_UP_TO_THRESHOLD
        return settings.COMMISSION_PERCENT_ABOVE_THRESHOLD

    def calculate_commission(self, amount: float) -> float:
        percent = self.get_commission_percent(amount)
        return amount * (percent / 100)

    @staticmethod
    def get_form_discount_percent(order_type: OrderType) -> float:
        if order_type == OrderType.PUBG:
            return float(settings.PUBG_DISCOUNT_PERCENT)
        return float(settings.STEAM_DISCOUNT_PERCENT)

    @staticmethod
    def _resolve_order_email(data: OrderCreate) -> str:
        if data.email:
            return str(data.email)
        # Technical fallback: Steam form no longer sends email.
        return f"{data.steam_nickname.lower()}{GUEST_EMAIL_SUFFIX}"

    def _resolve_order_payment_provider(self, order) -> PaymentProvider:
        steam_response = (order.steam_response or "").strip()
        if steam_response.startswith("yookassa_payment_id:"):
            return PaymentProvider.YOOKASSA
        if settings.WATA_ENABLED:
            return PaymentProvider.WATA
        if settings.YOOKASSA_ENABLED:
            return PaymentProvider.YOOKASSA
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No payment providers are enabled",
        )

    async def _should_send_order_email(self, user_id: Optional[int]) -> bool:
        if not user_id:
            return False
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return False
        return not user.email.endswith(GUEST_EMAIL_SUFFIX)

    def _build_return_urls(self, order_id: int) -> tuple[Optional[str], Optional[str], str]:
        frontend = (settings.FRONTEND_URL or "").rstrip("/")
        success_url = f"{frontend}/payment/{order_id}?status=success" if frontend else None
        fail_url = f"{frontend}/payment/{order_id}?status=fail" if frontend else None
        return_url = success_url or (settings.FRONTEND_URL or "https://rugpay.ru")
        return success_url, fail_url, return_url

    async def _create_wata_steam_payment_url(
        self,
        order,
        success_url: Optional[str],
        fail_url: Optional[str],
        description: str,
    ) -> str:
        from app.services.steam_service import SteamTopupService
        steam_topup = SteamTopupService()
        if not steam_topup._is_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Wata Steam top-up provider is not configured",
            )
        try:
            # Fetch Wata quote:
            #   price    = acquisition cost (what Wata pays Steam, NOT what user pays)
            #   minPrice = minimum resale price (minimum amount to charge user)
            # Wata constraint: minPrice <= amount <= minPrice * 1.5
            _, min_price = await steam_topup.get_topup_quote(
                steam_nickname=order.steam_nickname,
                net_amount=order.amount,
            )
            max_allowed = round(min_price * 1.5, 2)
            # Use our final_amount if above minPrice, otherwise use minPrice
            wata_amount = round(min(max(order.final_amount, min_price), max_allowed), 2)

            # Update order final_amount if adjusted
            if wata_amount != order.final_amount:
                logger.info(
                    "Adjusting final_amount to Wata minPrice",
                    order_id=order.id,
                    old_amount=order.final_amount,
                    min_price=min_price,
                    wata_amount=wata_amount,
                )
                order.final_amount = wata_amount
                await self.db.commit()
                await self.db.refresh(order)

            provider_order = await steam_topup.create_topup_order(
                order_id=order.id,
                steam_nickname=order.steam_nickname,
                amount=wata_amount,
                net_amount=order.amount,
                description=description,
                success_redirect_url=success_url,
                fail_redirect_url=fail_url,
            )
        except Exception as e:
            logger.error("Wata Steam create order failed", error=str(e), order_id=order.id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Payment link error: {str(e)}",
            )
        payment_url = provider_order.get("paymentLink") or ""
        if payment_url:
            order.steam_transaction_id = str(provider_order.get("orderId") or order.id)
            order.steam_response = f"wata_steam_payment_link:{payment_url}"
            await self.db.commit()
            await self.db.refresh(order)
        return payment_url

    async def _create_wata_h2h_payment_url(
        self,
        order,
        success_url: Optional[str],
        fail_url: Optional[str],
        description: str,
    ) -> str:
        wata = WataService()
        if not settings.WATA_ENABLED or not wata.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Wata payment provider is not configured",
            )
        try:
            link = await wata.create_payment_link(
                amount=order.final_amount,
                currency="RUB",
                order_id=str(order.id),
                description=description,
                success_redirect_url=success_url,
                fail_redirect_url=fail_url,
            )
        except WataServiceError as e:
            logger.error("Wata create payment failed", error=e.message, order_id=order.id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Payment link error: {e.message}",
            )
        payment_url = link.get("url") or ""
        if payment_url:
            link_id = link.get("id") or ""
            order.steam_response = f"wata_h2h_link:{link_id}"
            await self.db.commit()
            await self.db.refresh(order)
        return payment_url

    async def _create_yookassa_payment_url(
        self,
        order,
        return_url: str,
        description: str,
    ) -> str:
        yookassa = YooKassaService()
        if not settings.YOOKASSA_ENABLED or not yookassa.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment provider (YooKassa) is not configured",
            )
        try:
            payment = await yookassa.create_payment_link(
                amount=order.final_amount,
                currency="RUB",
                order_id=str(order.id),
                description=description,
                return_url=return_url,
            )
        except YooKassaServiceError as e:
            logger.error("YooKassa create payment failed", error=e.message, order_id=order.id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Payment link error: {e.message}",
            )
        payment_url = (payment.get("confirmation") or {}).get("confirmation_url") or ""
        payment_id = payment.get("id")
        if payment_id:
            order.steam_response = f"yookassa_payment_id:{payment_id}"
            await self.db.commit()
            await self.db.refresh(order)
        return payment_url

    def get_payment_providers(self) -> PaymentProvidersResponse:
        providers = [
            PaymentProviderInfo(
                id=PaymentProvider.WATA,
                name="Wata",
                enabled=bool(settings.WATA_ENABLED),
            ),
            PaymentProviderInfo(
                id=PaymentProvider.YOOKASSA,
                name="YooKassa",
                enabled=bool(settings.YOOKASSA_ENABLED),
            ),
        ]
        default_provider = next((p.id for p in providers if p.enabled), None)
        return PaymentProvidersResponse(providers=providers, default_provider=default_provider)
    
    async def calculate_order(
        self,
        amount: float,
        order_type: OrderType = OrderType.STEAM,
        promocode: Optional[str] = None,
        user_id: Optional[int] = None,
        use_referral_balance: bool = False,
        skip_amount_limits: bool = False,
    ) -> OrderCalculation:
        if not skip_amount_limits:
            if amount < settings.MIN_TOPUP_AMOUNT:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Minimum top-up amount is {settings.MIN_TOPUP_AMOUNT} RUB"
                )
            if amount > settings.MAX_TOPUP_AMOUNT:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Maximum top-up amount is {settings.MAX_TOPUP_AMOUNT} RUB"
                )
        
        commission_percent = self.get_commission_percent(amount)
        commission = amount * (commission_percent / 100)
        discount_amount = 0.0
        
        # Apply promocode (discount against the user-facing final amount)
        if promocode:
            is_valid, message, promo = await self.promocode_repo.is_valid(promocode, amount)
            if is_valid and promo:
                final_before_promo = amount + commission
                discount_amount = await self.promocode_repo.calculate_discount(
                    promo, final_before_promo, commission,
                )
        
        # Apply referral balance
        referral_discount = 0.0
        if use_referral_balance and user_id:
            user = await self.user_repo.get_by_id(user_id)
            if user and user.referral_balance > 0:
                # Use referral balance to reduce final amount
                referral_discount = min(user.referral_balance, amount + commission - discount_amount)

        subtotal = amount + commission - discount_amount - referral_discount
        form_discount_percent = max(self.get_form_discount_percent(order_type), 0.0)
        form_discount_amount = subtotal * (form_discount_percent / 100)
        total_discount_amount = discount_amount + form_discount_amount
        final_amount = subtotal - form_discount_amount
        
        return OrderCalculation(
            amount=amount,
            commission=commission,
            commission_percent=commission_percent,
            form_discount_percent=form_discount_percent,
            discount_amount=total_discount_amount,
            referral_discount=referral_discount,
            final_amount=max(final_amount, 0),
        )
    
    async def create_order(
        self,
        data: OrderCreate,
        user_id: Optional[int] = None,
    ) -> OrderResponse:
        # Calculate order
        calculation = await self.calculate_order(
            amount=data.amount,
            order_type=OrderType.STEAM,
            promocode=data.promocode,
            user_id=user_id,
            use_referral_balance=data.use_referral_balance,
        )
        
        # Get promocode ID if applicable
        promocode_id = None
        if data.promocode:
            is_valid, _, promo = await self.promocode_repo.is_valid(data.promocode, data.amount)
            if is_valid and promo:
                promocode_id = promo.id
        
        # Deduct referral balance if used
        if data.use_referral_balance and user_id and calculation.referral_discount > 0:
            await self.user_repo.deduct_referral_balance(user_id, calculation.referral_discount)
        
        # Create order
        order = await self.order_repo.create(
            user_id=user_id,
            steam_nickname=data.steam_nickname,
            steam_profile_url=data.steam_profile_url,
            email=self._resolve_order_email(data),
            amount=calculation.amount,
            commission=calculation.commission,
            discount_amount=calculation.discount_amount,
            final_amount=calculation.final_amount,
            promocode_id=promocode_id,
        )
        
        # Handle referral tracking for new orders
        if data.referral_code and user_id:
            referrer = await self.user_repo.get_by_referral_code(data.referral_code)
            if referrer and referrer.id != user_id:
                # Track that this order came from a referral
                logger.info("Order from referral", order_id=order.id, referrer_id=referrer.id)
        
        logger.info(
            "Order created",
            order_id=order.id,
            amount=order.amount,
            final_amount=order.final_amount,
        )
        
        return OrderResponse.model_validate(order)

    async def create_order_with_payment_link(
        self,
        data: OrderCreate,
        user_id: Optional[int] = None,
    ) -> CreateOrderResponse:
        """Create order and payment link; returns order + payment_url."""
        order_response = await self.create_order(data, user_id)
        order = await self.order_repo.get_by_id(order_response.id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Order not found after create",
            )

        provider = data.payment_provider
        providers = self.get_payment_providers()
        if not any(p.id == provider and p.enabled for p in providers.providers):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Payment provider '{provider.value}' is disabled",
            )

        frontend = (settings.FRONTEND_URL or "").rstrip("/")
        success_url = f"{frontend}/payment/{order.id}?status=success" if frontend else None
        fail_url = f"{frontend}/payment/{order.id}?status=fail" if frontend else None
        return_url = success_url or (settings.FRONTEND_URL or "https://rugpay.ru")

        description = f"Steam top-up {order.amount} RUB"
        if provider == PaymentProvider.WATA:
            payment_url = await self._create_wata_steam_payment_url(
                order, success_url, fail_url, description
            )
        elif provider == PaymentProvider.YOOKASSA:
            payment_url = await self._create_yookassa_payment_url(order, return_url, description)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported payment provider: {provider.value}",
            )

        if not payment_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Payment provider did not return payment URL",
            )

        if await self._should_send_order_email(order.user_id):
            await self.email_service.send_order_created_email(
                to_email=order.email,
                order_id=order.id,
                amount_rub=order.amount,
                final_amount_rub=order.final_amount,
                payment_url=payment_url,
            )

        return CreateOrderResponse(
            order=order_response,
            payment_url=payment_url,
            payment_provider=provider,
        )

    async def create_payment_link_for_existing_order(self, order_id: int) -> tuple[str, PaymentProvider]:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )
        if order.status != OrderStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment link is available only for pending orders",
            )

        provider = self._resolve_order_payment_provider(order)
        success_url, fail_url, return_url = self._build_return_urls(order.id)

        description = f"Steam top-up {order.amount} RUB"
        if provider == PaymentProvider.WATA:
            marker = "wata_steam_payment_link:"
            raw = (order.steam_response or "").strip()
            if raw.startswith(marker):
                cached_url = raw[len(marker):].strip()
                if cached_url:
                    return cached_url, provider
            payment_url = await self._create_wata_steam_payment_url(
                order, success_url, fail_url, description
            )
        else:
            payment_url = await self._create_yookassa_payment_url(order, return_url, description)

        if not payment_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Payment provider did not return payment URL",
            )
        return payment_url, provider
    
    async def get_user_orders(
        self,
        user_id: int,
        page: int = 1,
        per_page: int = 20,
    ):
        skip = (page - 1) * per_page
        orders, total = await self.order_repo.get_by_user_id(user_id, skip, per_page)
        return {
            "orders": [OrderResponse.model_validate(o) for o in orders],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    
    async def get_order(self, order_id: int, user_id: Optional[int] = None) -> OrderResponse:
        order = await self.order_repo.get_by_id(order_id)
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Verify ownership if user_id provided
        if user_id and order.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return OrderResponse.model_validate(order)
    
    async def process_payment_webhook(
        self,
        order_id: int,
        payment_status: str,
        payment_provider_id: str,
    ) -> bool:
        order = await self.order_repo.get_by_id(order_id)
        
        if not order:
            logger.error("Order not found for webhook", order_id=order_id)
            return False
        
        if payment_status == "completed":
            # Already fully completed — true idempotency, no re-dispatch needed.
            if order.status == OrderStatus.COMPLETED:
                logger.info(
                    "Order already completed, skipping duplicate webhook",
                    order_id=order_id,
                )
                return False

            # PAID or PROCESSING → payment was already confirmed, but topup task
            # may not have been dispatched (e.g. Celery was down). Return True so
            # the caller can re-dispatch the topup task.
            if order.status in [OrderStatus.PAID, OrderStatus.PROCESSING]:
                logger.info(
                    "Re-processing webhook for already-paid order (topup may need re-dispatch)",
                    order_id=order_id,
                    current_status=order.status.value,
                )
                return True

            if order.status != OrderStatus.PENDING:
                logger.warning(
                    "Ignoring completed payment update for non-pending order",
                    order_id=order_id,
                    current_status=order.status.value,
                )
                return False

            # Update order status to paid
            await self.order_repo.update_status(order_id, OrderStatus.PAID)

            # Increment promocode usage
            if order.promocode_id:
                await self.promocode_repo.increment_usage(order.promocode_id)

            logger.info("Payment completed", order_id=order_id)
            return True
        elif payment_status == "failed":
            await self.order_repo.update_status(order_id, OrderStatus.FAILED)
            logger.warning("Payment failed", order_id=order_id)
        
        return False
    
    async def create_pubg_order_with_payment_link(
        self,
        data: PubgOrderCreate,
        user_id: Optional[int] = None,
    ) -> CreateOrderResponse:
        """Create a PUBG UC order in DB and generate a Wata H2H payment link."""

        fazercards = FazerCardsService()
        if not fazercards.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="FazerCards is not configured — PUBG orders unavailable",
            )
        if not fazercards.is_package_enabled(data.uc_amount):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PUBG UC package {data.uc_amount} is not available",
            )

        packages = await fazercards.get_pubg_packages_with_prices()
        pkg_info = next((p for p in packages if p["uc"] == data.uc_amount), None)
        if not pkg_info or not pkg_info.get("price_rub"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot determine price for the selected PUBG UC package",
            )

        amount = float(pkg_info["price_rub"])
        calculation = await self.calculate_order(
            amount=amount,
            order_type=OrderType.PUBG,
            promocode=data.promocode,
            user_id=user_id,
            use_referral_balance=data.use_referral_balance,
            skip_amount_limits=True,
        )

        promocode_id = None
        if data.promocode:
            is_valid, _, promo = await self.promocode_repo.is_valid(data.promocode, amount)
            if is_valid and promo:
                promocode_id = promo.id

        if data.use_referral_balance and user_id and calculation.referral_discount > 0:
            await self.user_repo.deduct_referral_balance(user_id, calculation.referral_discount)

        email = f"pubg_{data.uid}{GUEST_EMAIL_SUFFIX}"

        order = await self.order_repo.create(
            user_id=user_id,
            order_type=OrderType.PUBG,
            steam_nickname=None,
            steam_profile_url=None,
            pubg_uid=data.uid,
            pubg_uc_amount=data.uc_amount,
            email=email,
            amount=calculation.amount,
            commission=calculation.commission,
            discount_amount=calculation.discount_amount,
            final_amount=calculation.final_amount,
            promocode_id=promocode_id,
        )

        logger.info(
            "PUBG order created",
            order_id=order.id,
            pubg_uid=data.uid,
            uc_amount=data.uc_amount,
            final_amount=order.final_amount,
        )

        order_response = OrderResponse.model_validate(order)

        provider = data.payment_provider
        providers = self.get_payment_providers()
        if not any(p.id == provider and p.enabled for p in providers.providers):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Payment provider '{provider.value}' is disabled",
            )

        success_url, fail_url, return_url = self._build_return_urls(order.id)

        description = f"PUBG Mobile {data.uc_amount} UC"
        if provider == PaymentProvider.WATA:
            payment_url = await self._create_wata_h2h_payment_url(
                order, success_url, fail_url, description
            )
        elif provider == PaymentProvider.YOOKASSA:
            payment_url = await self._create_yookassa_payment_url(order, return_url, description)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported payment provider: {provider.value}",
            )

        if not payment_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Payment provider did not return payment URL",
            )

        if await self._should_send_order_email(order.user_id):
            await self.email_service.send_order_created_email(
                to_email=order.email,
                order_id=order.id,
                amount_rub=order.amount,
                final_amount_rub=order.final_amount,
                payment_url=payment_url,
            )

        return CreateOrderResponse(
            order=order_response,
            payment_url=payment_url,
            payment_provider=provider,
        )

    async def process_referral_reward(self, order_id: int) -> None:
        """Process referral reward after order completion"""
        order = await self.order_repo.get_by_id(order_id)
        
        if not order or not order.user_id:
            return
        
        user = await self.user_repo.get_by_id(order.user_id)
        if not user or not user.referred_by:
            return
        
        # Calculate referral reward (percentage of commission)
        reward = order.commission * (settings.REFERRAL_REWARD_PERCENT / 100)
        
        # Update referrer's balance
        await self.user_repo.update_referral_balance(user.referred_by, reward)
        
        # Update referral record
        referral = await self.referral_repo.get_by_invited_id(order.user_id)
        if referral:
            await self.referral_repo.update_reward(referral.id, reward)
        
        # Update order with referral reward amount
        order.referral_reward = reward
        await self.db.commit()
        
        logger.info(
            "Referral reward processed",
            order_id=order_id,
            referrer_id=user.referred_by,
            reward=reward,
        )

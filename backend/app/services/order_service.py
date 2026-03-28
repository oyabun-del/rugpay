from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from typing import Optional
from app.repositories.order_repository import OrderRepository
from app.repositories.promocode_repository import PromocodeRepository
from app.repositories.user_repository import UserRepository
from app.repositories.referral_repository import ReferralRepository
from app.schemas.order import (
    OrderCreate,
    OrderResponse,
    OrderCalculation,
    CreateOrderResponse,
    PaymentProvider,
    PaymentProviderInfo,
    PaymentProvidersResponse,
)
from app.models.order import OrderStatus
from app.core.config import settings
from app.core.logging import get_logger
from app.services.yookassa_service import YooKassaService, YooKassaServiceError
from app.services.steam_service import SteamTopupService
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
    
    def calculate_commission(self, amount: float) -> float:
        return amount * (settings.COMMISSION_PERCENT / 100)

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

    def _build_return_urls(self, order_id: int) -> tuple[Optional[str], Optional[str], str]:
        frontend = (settings.FRONTEND_URL or "").rstrip("/")
        success_url = f"{frontend}/payment/{order_id}?status=success" if frontend else None
        fail_url = f"{frontend}/payment/{order_id}?status=fail" if frontend else None
        return_url = success_url or (settings.FRONTEND_URL or "http://localhost:3000")
        return success_url, fail_url, return_url

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
        promocode: Optional[str] = None,
        user_id: Optional[int] = None,
        use_referral_balance: bool = False,
    ) -> OrderCalculation:
        # Validate amount
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
        
        commission = self.calculate_commission(amount)
        discount_amount = 0.0
        
        # Apply promocode
        if promocode:
            is_valid, message, promo = await self.promocode_repo.is_valid(promocode, amount)
            if is_valid and promo:
                discount_amount = await self.promocode_repo.calculate_discount(promo, amount, commission)
        
        # Apply referral balance
        referral_discount = 0.0
        if use_referral_balance and user_id:
            user = await self.user_repo.get_by_id(user_id)
            if user and user.referral_balance > 0:
                # Use referral balance to reduce final amount
                referral_discount = min(user.referral_balance, amount + commission - discount_amount)
        
        final_amount = amount + commission - discount_amount - referral_discount
        
        return OrderCalculation(
            amount=amount,
            commission=commission,
            commission_percent=settings.COMMISSION_PERCENT,
            discount_amount=discount_amount,
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
            email=data.email,
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
        return_url = success_url or (settings.FRONTEND_URL or "http://localhost:3000")

        payment_url = ""
        if provider == PaymentProvider.WATA:
            steam_topup = SteamTopupService()
            if not steam_topup._is_configured:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Wata Steam top-up provider is not configured",
                )

            try:
                provider_order = await steam_topup.create_topup_order(
                    order_id=order.id,
                    steam_nickname=order.steam_nickname,
                    amount=order.final_amount,
                    net_amount=order.amount,
                    description=f"Steam top-up {order.amount} RUB",
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

            # Legacy Wata H2H links flow is intentionally disabled.
            #
            # wata = WataService()
            # if not settings.WATA_ENABLED or not wata.is_configured():
            #     raise HTTPException(
            #         status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            #         detail="Payment provider (Wata) is not configured",
            #     )
            # link = await wata.create_payment_link(...)
        elif provider == PaymentProvider.YOOKASSA:
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
                    description=f"Steam top-up {order.amount} RUB",
                    return_url=return_url,
                )
            except YooKassaServiceError as e:
                logger.error("YooKassa create payment failed", error=e.message, order_id=order.id)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Payment link error: {e.message}",
                )
            payment_url = (payment.get("confirmation") or {}).get("confirmation_url") or ""
            # Store YooKassa payment id for fallback sync on payment status page
            payment_id = payment.get("id")
            if payment_id:
                order.steam_response = f"yookassa_payment_id:{payment_id}"
                await self.db.commit()
                await self.db.refresh(order)
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

        if provider == PaymentProvider.WATA:
            marker = "wata_steam_payment_link:"
            raw = (order.steam_response or "").strip()
            if raw.startswith(marker):
                payment_url = raw[len(marker):].strip()
                if payment_url:
                    return payment_url, provider

            steam_topup = SteamTopupService()
            if not steam_topup._is_configured:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Wata Steam top-up provider is not configured",
                )
            try:
                provider_order = await steam_topup.create_topup_order(
                    order_id=order.id,
                    steam_nickname=order.steam_nickname,
                    amount=order.final_amount,
                    net_amount=order.amount,
                    description=f"Steam top-up {order.amount} RUB",
                    success_redirect_url=success_url,
                    fail_redirect_url=fail_url,
                )
            except Exception as e:
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
        else:
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
                    description=f"Steam top-up {order.amount} RUB",
                    return_url=return_url,
                )
            except YooKassaServiceError as e:
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
            # Idempotency: avoid re-processing already handled orders.
            if order.status in [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.COMPLETED]:
                logger.info(
                    "Payment already processed, skipping duplicate webhook",
                    order_id=order_id,
                    current_status=order.status.value,
                )
                return False

            if order.status not in [OrderStatus.PENDING]:
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

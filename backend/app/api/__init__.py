from fastapi import APIRouter
from .auth import router as auth_router
from .orders import router as orders_router
from .payments import router as payments_router
from .promocodes import router as promocodes_router
from .referrals import router as referrals_router
from .admin import router as admin_router
from .health import router as health_router
from .stats import router as stats_router
from .pubg import router as pubg_router
from .banner import router as banner_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(orders_router, prefix="/orders", tags=["orders"])
api_router.include_router(payments_router, prefix="/payments", tags=["payments"])
api_router.include_router(promocodes_router, prefix="/promocode", tags=["promocodes"])
api_router.include_router(referrals_router, prefix="/referral", tags=["referrals"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(stats_router, prefix="/stats", tags=["stats"])
api_router.include_router(pubg_router, prefix="/pubg", tags=["pubg"])
api_router.include_router(banner_router, prefix="/banner", tags=["banner"])

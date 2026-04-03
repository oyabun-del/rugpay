from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional, List
from pathlib import Path
from dotenv import load_dotenv


PROJECT_ROOT_ENV = str(Path(__file__).resolve().parents[3] / ".env")
BACKEND_ENV = str(Path(__file__).resolve().parents[2] / ".env")

# Explicitly load .env files so runtime always sees project-level variables
# (especially when backend starts from backend/ working directory).
load_dotenv(PROJECT_ROOT_ENV, override=False)
load_dotenv(BACKEND_ENV, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT_ENV, BACKEND_ENV, ".env"),
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Steam Top-up API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/steam_topup"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    JWT_PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    GUEST_SESSION_TTL_MINUTES: int = 60
    GUEST_CLEANUP_INTERVAL_MINUTES: int = 30
    
    # Steam API
    STEAM_API_KEY: Optional[str] = None
    STEAM_API_BASE_URL: str = "https://api.steampowered.com"
    STEAM_TOPUP_API_URL: Optional[str] = None
    STEAM_TOPUP_API_KEY: Optional[str] = None

    # Wata Digital Goods Steam top-up API (primary flow)
    WATA_STEAM_TOPUP_ENABLED: bool = True
    WATA_DG_API_BASE_URL: str = "https://dg-api.wata.pro/api"
    WATA_DG_ACCESS_TOKEN: Optional[str] = None

    # Payment (generic)
    PAYMENT_WEBHOOK_SECRET: Optional[str] = None
    PAYMENT_PROVIDER_API_KEY: Optional[str] = None

    # Email notifications / password reset
    EMAIL_ENABLED: bool = False
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: Optional[str] = None

    # Wata payment provider (https://wata.pro/api)
    WATA_ENABLED: bool = True
    WATA_API_BASE_URL: str = "https://api-sandbox.wata.pro/api/h2h"
    WATA_ACCESS_TOKEN: Optional[str] = None
    WATA_TERMINAL_PUBLIC_ID: Optional[str] = None  # terminalPublicId for redirects (optional)
    WATA_USE_SANDBOX: bool = True  # Use sandbox (api-sandbox.wata.pro) when True
    FRONTEND_URL: str = "https://rugpay.ru"  # For success/fail redirect URLs
    
    # YooKassa payment provider (https://yookassa.ru/developers/api#payment)
    YOOKASSA_ENABLED: bool = False
    YOOKASSA_API_BASE_URL: str = "https://api.yookassa.ru/v3"
    YOOKASSA_SHOP_ID: Optional[str] = None
    YOOKASSA_SECRET_KEY: Optional[str] = None
    YOOKASSA_CAPTURE_PAYMENT: bool = True

    # FazerCards API (PUBG Mobile gift/top-up)
    FAZERCARDS_ENABLED: bool = False
    FAZERCARDS_API_BASE_URL: str = "https://api.fazercards.com/api/v1"
    FAZERCARDS_API_KEY: Optional[str] = None
    FAZERCARDS_RUB_RATE: float = 90.0
    FAZERCARDS_MARKUP_PERCENT: float = 20.0
    FAZERCARDS_PUBG_PRODUCT_ID_60: Optional[str] = None
    FAZERCARDS_PUBG_PRODUCT_ID_325: Optional[str] = None
    FAZERCARDS_PUBG_PRODUCT_ID_660: Optional[str] = None
    FAZERCARDS_PUBG_PRODUCT_ID_1800: Optional[str] = None
    FAZERCARDS_PUBG_PRODUCT_ID_3850: Optional[str] = None
    FAZERCARDS_PUBG_PRODUCT_ID_8100: Optional[str] = None
    
    # Commission
    COMMISSION_THRESHOLD_AMOUNT: float = 1000.0  # RUB
    COMMISSION_PERCENT_UP_TO_THRESHOLD: float = 11.0  # <= threshold
    COMMISSION_PERCENT_ABOVE_THRESHOLD: float = 10.0  # > threshold
    STEAM_DISCOUNT_PERCENT: float = 0.0  # extra discount on final amount
    PUBG_DISCOUNT_PERCENT: float = 0.0  # extra discount on final amount
    MIN_TOPUP_AMOUNT: float = 100.0  # Minimum amount in RUB
    MAX_TOPUP_AMOUNT: float = 50000.0  # Maximum amount in RUB
    
    # Referral
    REFERRAL_REWARD_PERCENT: float = 10.0  # 10% of commission
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds
    
    # Anti-fraud
    MAX_ORDERS_PER_MINUTE: int = 5
    MAX_FAILED_PAYMENTS_PER_HOUR: int = 10
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

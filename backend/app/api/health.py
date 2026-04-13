from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings
from app.schemas.site_settings import SiteSettingsResponse
from app.repositories.site_settings_repository import SiteSettingsRepository

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@router.get("/health/db")
async def db_health_check(db: AsyncSession = Depends(get_db)):
    """Database health check"""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}


@router.get("/settings/forms", response_model=SiteSettingsResponse)
async def get_public_form_settings(db: AsyncSession = Depends(get_db)):
    """Public endpoint: which top-up forms are currently enabled"""
    repo = SiteSettingsRepository(db)
    s = await repo.get()
    return SiteSettingsResponse.model_validate(s)

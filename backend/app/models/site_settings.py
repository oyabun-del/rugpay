from sqlalchemy import Column, Integer, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, default=1)
    steam_enabled = Column(Boolean, default=True, nullable=False)
    pubg_enabled = Column(Boolean, default=True, nullable=False)
    apple_enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

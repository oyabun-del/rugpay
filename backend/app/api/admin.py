from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_admin_user_id
from app.repositories.order_repository import OrderRepository
from app.repositories.user_repository import UserRepository
from app.repositories.promocode_repository import PromocodeRepository
from app.models.order import OrderStatus
from app.schemas.order import OrderResponse, OrderUpdate
from app.schemas.promocode import PromocodeCreate, PromocodeResponse
from app.schemas.auth import UserResponse
from app.schemas.stats import AdminStats
from app.schemas.banner import BannerSlideResponse, BannerSlideCreate, BannerSlideUpdate
from app.repositories.banner_repository import BannerRepository

router = APIRouter()


@router.get("/orders", response_model=dict)
async def get_all_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: Optional[OrderStatus] = None,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all orders (admin only)"""
    repo = OrderRepository(db)
    skip = (page - 1) * per_page
    
    orders, total = await repo.get_all(skip, per_page, status)
    
    return {
        "orders": [OrderResponse.model_validate(o) for o in orders],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    data: OrderUpdate,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update order status (admin only)"""
    repo = OrderRepository(db)
    order = await repo.update_status(order_id, data.status)
    return OrderResponse.model_validate(order)


@router.get("/users", response_model=dict)
async def get_all_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all users (admin only)"""
    repo = UserRepository(db)
    skip = (page - 1) * per_page
    
    users = await repo.get_all(skip, per_page)
    total = await repo.get_total_count()
    
    return {
        "users": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/promocode/create", response_model=PromocodeResponse)
async def create_promocode(
    data: PromocodeCreate,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new promo code (admin only)"""
    repo = PromocodeRepository(db)
    promocode = await repo.create(
        code=data.code,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        max_uses=data.max_uses,
        min_order_amount=data.min_order_amount,
        max_discount=data.max_discount,
        expires_at=data.expires_at,
    )
    return PromocodeResponse.model_validate(promocode)


@router.get("/promocodes", response_model=List[PromocodeResponse])
async def get_all_promocodes(
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all promo codes (admin only)"""
    repo = PromocodeRepository(db)
    promocodes = await repo.get_all()
    return [PromocodeResponse.model_validate(p) for p in promocodes]


@router.delete("/promocode/{promocode_id}")
async def deactivate_promocode(
    promocode_id: int,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a promo code (admin only)"""
    repo = PromocodeRepository(db)
    await repo.deactivate(promocode_id)
    return {"status": "ok"}


@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get admin dashboard statistics"""
    order_repo = OrderRepository(db)
    user_repo = UserRepository(db)
    
    order_stats = await order_repo.get_stats()
    total_users = await user_repo.get_total_count()
    new_users_today = await user_repo.get_new_users_today()
    
    return AdminStats(
        total_orders=order_stats["total_orders"],
        total_users=total_users,
        total_completed_orders=order_stats["total_completed_orders"],
        total_revenue=order_stats["total_revenue"],
        total_topup_amount=order_stats["total_topup_amount"],
        success_rate=order_stats["success_rate"],
        average_processing_time=30.0,  # Placeholder - calculate from actual data
        orders_today=order_stats["orders_today"],
        revenue_today=order_stats["revenue_today"],
        new_users_today=new_users_today,
        pending_orders=order_stats["pending_orders"],
        failed_orders_today=order_stats["failed_orders_today"],
    )


@router.get("/banner/slides", response_model=List[BannerSlideResponse])
async def get_all_banner_slides(
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    repo = BannerRepository(db)
    slides = await repo.get_all()
    return [BannerSlideResponse.model_validate(s) for s in slides]


@router.post("/banner/slides", response_model=BannerSlideResponse)
async def create_banner_slide(
    data: BannerSlideCreate,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    repo = BannerRepository(db)
    slide = await repo.create(
        title=data.title.strip(),
        image_url=data.image_url.strip(),
        sort_order=data.sort_order,
        is_active=data.is_active,
        button_text=data.button_text.strip() if data.button_text else None,
        button_link=data.button_link.strip() if data.button_link else None,
    )
    return BannerSlideResponse.model_validate(slide)


@router.patch("/banner/slides/{slide_id}", response_model=BannerSlideResponse)
async def update_banner_slide(
    slide_id: int,
    data: BannerSlideUpdate,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    repo = BannerRepository(db)
    kwargs: dict = {}
    if data.title is not None:
        kwargs["title"] = data.title.strip()
    if data.image_url is not None:
        kwargs["image_url"] = data.image_url.strip()
    if data.sort_order is not None:
        kwargs["sort_order"] = data.sort_order
    if data.is_active is not None:
        kwargs["is_active"] = data.is_active
    if "button_text" in data.model_fields_set:
        kwargs["button_text"] = data.button_text.strip() if data.button_text else None
    if "button_link" in data.model_fields_set:
        kwargs["button_link"] = data.button_link.strip() if data.button_link else None
    slide = await repo.update(slide_id, **kwargs)
    if not slide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banner slide not found",
        )
    return BannerSlideResponse.model_validate(slide)


@router.delete("/banner/slides/{slide_id}")
async def delete_banner_slide(
    slide_id: int,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncSession = Depends(get_db),
):
    repo = BannerRepository(db)
    deleted = await repo.delete(slide_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banner slide not found",
        )
    return {"status": "ok"}

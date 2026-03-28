"""Add banner slides table

Revision ID: 002
Revises: 001
Create Date: 2026-03-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "banner_slides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("image_url", sa.String(length=1024), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_banner_slides_id"), "banner_slides", ["id"], unique=False)

    op.execute(
        """
        INSERT INTO banner_slides (title, image_url, sort_order, is_active)
        VALUES
            ('Dimension Diva Set уже доступен', '/banners/dimension-diva-set.png', 1, true),
            ('Crimson Desert в продаже', '/banners/crimson-desert.png', 2, true)
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_banner_slides_id"), table_name="banner_slides")
    op.drop_table("banner_slides")

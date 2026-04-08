"""Add apple order type and apple fields

Revision ID: 005
Revises: 004
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'apple' to order_type enum
    op.execute("ALTER TYPE ordertype ADD VALUE IF NOT EXISTS 'apple'")

    # Add apple-specific columns
    op.add_column("orders", sa.Column("apple_voucher_id", sa.String(64), nullable=True))
    op.add_column("orders", sa.Column("apple_wata_order_id", sa.String(255), nullable=True))
    op.add_column("orders", sa.Column("apple_region", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "apple_region")
    op.drop_column("orders", "apple_wata_order_id")
    op.drop_column("orders", "apple_voucher_id")
    # Note: PostgreSQL doesn't support removing enum values

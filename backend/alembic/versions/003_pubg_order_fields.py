"""Add PUBG order fields and order_type to orders table

Revision ID: 003
Revises: 002
Create Date: 2026-03-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ordertype_enum = sa.Enum("steam", "pubg", name="ordertype")
    ordertype_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "orders",
        sa.Column("order_type", sa.Enum("steam", "pubg", name="ordertype"), nullable=False, server_default="steam"),
    )
    op.alter_column("orders", "steam_nickname", existing_type=sa.String(255), nullable=True)

    op.add_column("orders", sa.Column("pubg_uid", sa.String(20), nullable=True))
    op.add_column("orders", sa.Column("pubg_uc_amount", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("pubg_fazercards_order_id", sa.String(255), nullable=True))
    op.add_column("orders", sa.Column("pubg_gift_codes", sa.String(2048), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "pubg_gift_codes")
    op.drop_column("orders", "pubg_fazercards_order_id")
    op.drop_column("orders", "pubg_uc_amount")
    op.drop_column("orders", "pubg_uid")
    op.alter_column("orders", "steam_nickname", existing_type=sa.String(255), nullable=False)
    op.drop_column("orders", "order_type")

    ordertype_enum = sa.Enum("steam", "pubg", name="ordertype")
    ordertype_enum.drop(op.get_bind(), checkfirst=True)

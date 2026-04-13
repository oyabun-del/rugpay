"""Add site_settings table for form toggles

Revision ID: 006
Revises: 005
Create Date: 2026-04-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), primary_key=True, default=1),
        sa.Column("steam_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("pubg_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("apple_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Insert default row
    op.execute(
        "INSERT INTO site_settings (id, steam_enabled, pubg_enabled, apple_enabled) "
        "VALUES (1, true, true, true)"
    )


def downgrade() -> None:
    op.drop_table("site_settings")

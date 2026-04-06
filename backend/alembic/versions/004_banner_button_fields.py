"""Add button_text and button_link to banner_slides

Revision ID: 004
Revises: 003
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("banner_slides", sa.Column("button_text", sa.String(length=255), nullable=True))
    op.add_column("banner_slides", sa.Column("button_link", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("banner_slides", "button_link")
    op.drop_column("banner_slides", "button_text")

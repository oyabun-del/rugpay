"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('referral_code', sa.String(length=32), nullable=True),
        sa.Column('referred_by', sa.Integer(), nullable=True),
        sa.Column('referral_balance', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('is_admin', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['referred_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('referral_code')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # Promocodes table
    op.create_table(
        'promocodes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('discount_type', sa.Enum('PERCENTAGE', 'FIXED', 'COMMISSION', name='discounttype'), nullable=False),
        sa.Column('discount_value', sa.Float(), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('current_uses', sa.Integer(), server_default='0', nullable=True),
        sa.Column('min_order_amount', sa.Float(), nullable=True),
        sa.Column('max_discount', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_promocodes_code'), 'promocodes', ['code'], unique=True)
    op.create_index(op.f('ix_promocodes_id'), 'promocodes', ['id'], unique=False)

    # Orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('steam_nickname', sa.String(length=255), nullable=False),
        sa.Column('steam_profile_url', sa.String(length=512), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('commission', sa.Float(), nullable=False),
        sa.Column('final_amount', sa.Float(), nullable=False),
        sa.Column('promocode_id', sa.Integer(), nullable=True),
        sa.Column('discount_amount', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('referral_reward', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', name='orderstatus'), server_default='PENDING', nullable=True),
        sa.Column('steam_transaction_id', sa.String(length=255), nullable=True),
        sa.Column('steam_response', sa.String(length=2048), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['promocode_id'], ['promocodes.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)

    # Transactions table
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('payment_provider', sa.String(length=50), nullable=False),
        sa.Column('payment_provider_id', sa.String(length=255), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='RUB', nullable=True),
        sa.Column('payment_status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', name='paymentstatus'), server_default='PENDING', nullable=True),
        sa.Column('webhook_payload', sa.String(length=4096), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id')
    )
    op.create_index(op.f('ix_transactions_id'), 'transactions', ['id'], unique=False)

    # Referrals table
    op.create_table(
        'referrals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inviter_id', sa.Integer(), nullable=False),
        sa.Column('invited_id', sa.Integer(), nullable=False),
        sa.Column('reward_amount', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['invited_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['inviter_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invited_id')
    )
    op.create_index(op.f('ix_referrals_id'), 'referrals', ['id'], unique=False)

    # Stats table
    op.create_table(
        'stats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('total_orders', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_users', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_completed_orders', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_revenue', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('total_topup_amount', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('success_rate', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('average_processing_time', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stats_id'), 'stats', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_stats_id'), table_name='stats')
    op.drop_table('stats')
    op.drop_index(op.f('ix_referrals_id'), table_name='referrals')
    op.drop_table('referrals')
    op.drop_index(op.f('ix_transactions_id'), table_name='transactions')
    op.drop_table('transactions')
    op.drop_index(op.f('ix_orders_id'), table_name='orders')
    op.drop_table('orders')
    op.drop_index(op.f('ix_promocodes_id'), table_name='promocodes')
    op.drop_index(op.f('ix_promocodes_code'), table_name='promocodes')
    op.drop_table('promocodes')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS discounttype")

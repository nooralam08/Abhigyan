"""add complainant_user_id to complaints table and backfill existing records

Revision ID: 007_add_complainant_user_id
Revises: 006_system_settings
Create Date: 2026-10-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_add_complainant_user_id'
down_revision: Union[str, None] = '006_system_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add complainant_user_id column to complaints table
    with op.batch_alter_table('complaints', schema=None) as batch_op:
        batch_op.add_column(sa.Column('complainant_user_id', sa.String(length=64), nullable=True))
        batch_op.create_foreign_key(
            'fk_complaints_complainant_user_id_users',
            'users',
            ['complainant_user_id'],
            ['id'],
            ondelete='SET NULL'
        )
        batch_op.create_index(op.f('ix_complaints_complainant_user_id'), ['complainant_user_id'], unique=False)

    # 2. Backfill existing records safely where complainant_email matches users.email
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("""
            UPDATE complaints
            SET complainant_user_id = (
                SELECT u.id FROM users u
                WHERE LOWER(TRIM(complaints.complainant_email)) = LOWER(TRIM(u.email))
                LIMIT 1
            )
            WHERE complainant_user_id IS NULL AND complainant_email IS NOT NULL
        """)
    else:
        op.execute("""
            UPDATE complaints c
            SET complainant_user_id = u.id
            FROM users u
            WHERE c.complainant_user_id IS NULL
              AND c.complainant_email IS NOT NULL
              AND LOWER(TRIM(c.complainant_email)) = LOWER(TRIM(u.email))
        """)


def downgrade() -> None:
    with op.batch_alter_table('complaints', schema=None) as batch_op:
        batch_op.drop_constraint('fk_complaints_complainant_user_id_users', type_='foreignkey')
        batch_op.drop_index(op.f('ix_complaints_complainant_user_id'))
        batch_op.drop_column('complainant_user_id')

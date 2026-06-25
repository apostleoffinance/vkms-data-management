"""workers roster table and worker_attendance FK update

Revision ID: 002_workers_roster
Revises: 001_initial_schema
Create Date: 2026-06-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_workers_roster"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("DELETE FROM worker_attendance")

    op.drop_constraint("worker_attendance_worker_id_fkey", "worker_attendance", type_="foreignkey")
    op.create_foreign_key(
        "worker_attendance_worker_id_fkey",
        "worker_attendance",
        "workers",
        ["worker_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("worker_attendance_worker_id_fkey", "worker_attendance", type_="foreignkey")
    op.create_foreign_key(
        "worker_attendance_worker_id_fkey",
        "worker_attendance",
        "users",
        ["worker_id"],
        ["id"],
    )
    op.drop_table("workers")

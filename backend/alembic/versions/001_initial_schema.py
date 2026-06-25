"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("admin", "worker", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "parents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("alternative_phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_parents_phone", "parents", ["phone"])

    op.create_table(
        "classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_age", sa.Integer(), nullable=False),
        sa.Column("max_age", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "children",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("child_code", sa.String(20), nullable=False, unique=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("gender", sa.Enum("male", "female", "other", name="gender"), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("parents.id"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id"), nullable=False),
        sa.Column("medical_notes", sa.Text(), nullable=True),
        sa.Column("registration_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("qr_code_data", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_children_child_code", "children", ["child_code"])
    op.create_index("ix_children_first_name", "children", ["first_name"])
    op.create_index("ix_children_last_name", "children", ["last_name"])

    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("service_name", sa.String(100), nullable=False),
        sa.Column("service_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_services_service_date", "services", ["service_date"])

    op.create_table(
        "attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("children.id"), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("tag_number", sa.String(10), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_out_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_out", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("checked_out_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("child_id", "service_id", name="uq_child_service_attendance"),
    )
    op.create_index("ix_attendance_child_id", "attendance", ["child_id"])
    op.create_index("ix_attendance_service_id", "attendance", ["service_id"])

    op.create_table(
        "worker_attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("worker_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("worker_id", "service_id", name="uq_worker_service_attendance"),
    )
    op.create_index("ix_worker_attendance_worker_id", "worker_attendance", ["worker_id"])
    op.create_index("ix_worker_attendance_service_id", "worker_attendance", ["service_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("details", postgresql.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("worker_attendance")
    op.drop_table("attendance")
    op.drop_table("services")
    op.drop_table("children")
    op.drop_table("classes")
    op.drop_table("parents")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS userrole")

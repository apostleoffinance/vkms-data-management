"""authorized pickup contacts and dedupe 2026-06-28 attendance

Revision ID: 005_authorized_pickup_and_dedupe
Revises: 004_services_one_per_date
Create Date: 2026-06-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005_authorized_pickup_and_dedupe"
down_revision: Union[str, None] = "004_services_one_per_date"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "authorized_pickup_contacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("child_id", UUID(as_uuid=True), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("relationship", sa.String(50), nullable=False, server_default="Parent"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("photo_data", sa.LargeBinary(), nullable=True),
        sa.Column("photo_content_type", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_authorized_pickup_contacts_child_id", "authorized_pickup_contacts", ["child_id"])

    op.add_column(
        "attendance",
        sa.Column("dropped_off_contact_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "attendance",
        sa.Column("picked_up_contact_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_attendance_dropped_off_contact",
        "attendance",
        "authorized_pickup_contacts",
        ["dropped_off_contact_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_attendance_picked_up_contact",
        "attendance",
        "authorized_pickup_contacts",
        ["picked_up_contact_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Seed primary authorized contact from registered parent for existing children
    op.execute(
        """
        INSERT INTO authorized_pickup_contacts (
            id, child_id, first_name, last_name, phone, relationship, is_primary, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            c.id,
            p.first_name,
            p.last_name,
            p.phone,
            'Parent',
            true,
            NOW(),
            NOW()
        FROM children c
        JOIN parents p ON c.parent_id = p.id
        WHERE NOT EXISTS (
            SELECT 1
            FROM authorized_pickup_contacts apc
            WHERE apc.child_id = c.id
        )
        """
    )

    # Remove duplicate attendance on 2026-06-28 (same child, same service date)
    op.execute(
        """
        DELETE FROM attendance AS a
        USING (
            SELECT ranked.id
            FROM (
                SELECT
                    att.id,
                    ROW_NUMBER() OVER (
                        PARTITION BY att.child_id, s.service_date
                        ORDER BY
                            att.checked_out DESC,
                            att.check_out_time DESC NULLS LAST,
                            att.check_in_time ASC,
                            att.id ASC
                    ) AS rn
                FROM attendance AS att
                JOIN services AS s ON att.service_id = s.id
                WHERE s.service_date = DATE '2026-06-28'
            ) AS ranked
            WHERE ranked.rn > 1
        ) AS dupes
        WHERE a.id = dupes.id
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_attendance_picked_up_contact", "attendance", type_="foreignkey")
    op.drop_constraint("fk_attendance_dropped_off_contact", "attendance", type_="foreignkey")
    op.drop_column("attendance", "picked_up_contact_id")
    op.drop_column("attendance", "dropped_off_contact_id")
    op.drop_index("ix_authorized_pickup_contacts_child_id", "authorized_pickup_contacts")
    op.drop_table("authorized_pickup_contacts")

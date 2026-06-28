"""one attendance row per child per service date

Revision ID: 006_attendance_unique_service_date
Revises: 005_authorized_pickup_and_dedupe
Create Date: 2026-06-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_attendance_unique_service_date"
down_revision: Union[str, None] = "005_authorized_pickup_and_dedupe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEDUPE_SQL = """
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
    ) AS ranked
    WHERE ranked.rn > 1
) AS dupes
WHERE a.id = dupes.id
"""


def upgrade() -> None:
    # Remove all historical duplicates (including 2026-06-28 and any other dates)
    op.execute(_DEDUPE_SQL)

    op.add_column("attendance", sa.Column("service_date", sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE attendance AS a
        SET service_date = s.service_date
        FROM services AS s
        WHERE a.service_id = s.id
        """
    )
    op.alter_column("attendance", "service_date", nullable=False)
    op.create_index("ix_attendance_service_date", "attendance", ["service_date"])
    op.create_unique_constraint(
        "uq_child_service_date_attendance",
        "attendance",
        ["child_id", "service_date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_child_service_date_attendance", "attendance", type_="unique")
    op.drop_index("ix_attendance_service_date", "attendance")
    op.drop_column("attendance", "service_date")

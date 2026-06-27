"""one service per date

Revision ID: 004_services_one_per_date
Revises: 003_services_unique_name_date
Create Date: 2026-06-25
"""

from typing import Sequence, Union

from alembic import op

revision: str = "004_services_one_per_date"
down_revision: Union[str, None] = "003_services_unique_name_date"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DUPES_CTE = """
WITH service_scores AS (
    SELECT
        s.id,
        s.service_date,
        s.created_at,
        CASE WHEN s.service_name = 'Sunday Service' THEN 1 ELSE 0 END AS is_default,
        (
            SELECT COUNT(*)
            FROM attendance AS a
            WHERE a.service_id = s.id
        ) AS att_count
    FROM services AS s
),
ranked AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY service_date
            ORDER BY is_default ASC, att_count DESC, created_at ASC, id ASC
        ) AS keeper_id
    FROM service_scores
),
dupes AS (
    SELECT id AS dupe_id, keeper_id
    FROM ranked
    WHERE id != keeper_id
)
"""


def upgrade() -> None:
    # Keep one service per date. Prefer non-default names, then most attendance.
    # Some children were checked into both services on the same date; drop dupe rows
    # that would violate uq_child_service_attendance before reassigning service_id.
    op.execute(
        f"""
        {_DUPES_CTE}
        DELETE FROM attendance AS a
        USING dupes AS d
        WHERE a.service_id = d.dupe_id
          AND EXISTS (
              SELECT 1
              FROM attendance AS existing
              WHERE existing.child_id = a.child_id
                AND existing.service_id = d.keeper_id
          )
        """
    )
    op.execute(
        f"""
        {_DUPES_CTE}
        UPDATE attendance AS a
        SET service_id = d.keeper_id
        FROM dupes AS d
        WHERE a.service_id = d.dupe_id
        """
    )
    op.execute(
        f"""
        {_DUPES_CTE}
        DELETE FROM worker_attendance AS wa
        USING dupes AS d
        WHERE wa.service_id = d.dupe_id
          AND EXISTS (
              SELECT 1
              FROM worker_attendance AS existing
              WHERE existing.worker_id = wa.worker_id
                AND existing.service_id = d.keeper_id
          )
        """
    )
    op.execute(
        f"""
        {_DUPES_CTE}
        UPDATE worker_attendance AS wa
        SET service_id = d.keeper_id
        FROM dupes AS d
        WHERE wa.service_id = d.dupe_id
        """
    )
    op.execute(
        f"""
        {_DUPES_CTE}
        DELETE FROM services AS s
        USING dupes AS d
        WHERE s.id = d.dupe_id
        """
    )

    op.drop_constraint("uq_services_name_date", "services", type_="unique")
    op.create_unique_constraint("uq_services_service_date", "services", ["service_date"])


def downgrade() -> None:
    op.drop_constraint("uq_services_service_date", "services", type_="unique")
    op.create_unique_constraint("uq_services_name_date", "services", ["service_name", "service_date"])

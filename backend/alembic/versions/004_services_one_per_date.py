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


def upgrade() -> None:
    # Keep one service per date. Prefer non-default names, then most attendance.
    op.execute(
        """
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
        UPDATE attendance AS a
        SET service_id = d.keeper_id
        FROM dupes AS d
        WHERE a.service_id = d.dupe_id
        """
    )
    op.execute(
        """
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
        UPDATE worker_attendance AS wa
        SET service_id = d.keeper_id
        FROM dupes AS d
        WHERE wa.service_id = d.dupe_id
        """
    )
    op.execute(
        """
        DELETE FROM services AS s
        WHERE s.id NOT IN (
            SELECT DISTINCT keeper_id
            FROM (
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
                )
                SELECT
                    id,
                    FIRST_VALUE(id) OVER (
                        PARTITION BY service_date
                        ORDER BY is_default ASC, att_count DESC, created_at ASC, id ASC
                    ) AS keeper_id
                FROM service_scores
            ) AS ranked
        )
        """
    )

    op.drop_constraint("uq_services_name_date", "services", type_="unique")
    op.create_unique_constraint("uq_services_service_date", "services", ["service_date"])


def downgrade() -> None:
    op.drop_constraint("uq_services_service_date", "services", type_="unique")
    op.create_unique_constraint("uq_services_name_date", "services", ["service_name", "service_date"])

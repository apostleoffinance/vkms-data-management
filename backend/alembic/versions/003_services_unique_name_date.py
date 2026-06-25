"""unique service name per date

Revision ID: 003_services_unique_name_date
Revises: 002_workers_roster
Create Date: 2026-06-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_services_unique_name_date"
down_revision: Union[str, None] = "002_workers_roster"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge duplicate services: keep the earliest created row per name+date.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                FIRST_VALUE(id) OVER (
                    PARTITION BY service_name, service_date
                    ORDER BY created_at ASC, id ASC
                ) AS keeper_id
            FROM services
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
        WITH ranked AS (
            SELECT
                id,
                FIRST_VALUE(id) OVER (
                    PARTITION BY service_name, service_date
                    ORDER BY created_at ASC, id ASC
                ) AS keeper_id
            FROM services
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
        USING services AS keeper
        WHERE s.service_name = keeper.service_name
          AND s.service_date = keeper.service_date
          AND s.id > keeper.id
        """
    )

    op.create_unique_constraint(
        "uq_services_name_date",
        "services",
        ["service_name", "service_date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_services_name_date", "services", type_="unique")

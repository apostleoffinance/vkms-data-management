"""unique active first name per parent (exact match)

Revision ID: 007_child_parent_first_name
Revises: 006_attendance_unique_date
Create Date: 2026-06-30
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_child_parent_first_name"
down_revision: Union[str, None] = "006_attendance_unique_date"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_DEDUPE_EXACT_FIRST_NAME_SQL = """
WITH ranked AS (
    SELECT
        c.id,
        ROW_NUMBER() OVER (
            PARTITION BY c.parent_id, lower(trim(c.first_name))
            ORDER BY
                (SELECT count(*) FROM attendance a WHERE a.child_id = c.id) DESC,
                c.child_code ASC
        ) AS rn
    FROM children c
    WHERE c.is_active IS TRUE
)
UPDATE children
SET is_active = FALSE
WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
"""


def upgrade() -> None:
    op.execute(_DEDUPE_EXACT_FIRST_NAME_SQL)
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_children_parent_first_name_active
        ON children (parent_id, lower(trim(first_name)))
        WHERE is_active IS TRUE
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_children_parent_first_name_active")

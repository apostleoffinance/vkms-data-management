"""unique tag number per service

Revision ID: 008_tag_unique_per_service
Revises: 007_child_parent_first_name
Create Date: 2026-06-30
"""

from typing import Sequence, Union

from alembic import op

revision: str = "008_tag_unique_per_service"
down_revision: Union[str, None] = "007_child_parent_first_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_REASSIGN_DUPLICATE_TAGS_SQL = """
WITH ranked AS (
    SELECT
        id,
        service_id,
        tag_number,
        ROW_NUMBER() OVER (
            PARTITION BY service_id, tag_number
            ORDER BY check_in_time ASC, id ASC
        ) AS rn
    FROM attendance
),
to_fix AS (
    SELECT id, service_id FROM ranked WHERE rn > 1
),
service_max AS (
    SELECT service_id, COALESCE(MAX(tag_number::integer), 0) AS max_tag
    FROM attendance
    GROUP BY service_id
),
numbered AS (
    SELECT
        tf.id,
        tf.service_id,
        ROW_NUMBER() OVER (PARTITION BY tf.service_id ORDER BY tf.id) AS seq
    FROM to_fix tf
)
UPDATE attendance AS a
SET tag_number = LPAD((sm.max_tag + n.seq)::text, 3, '0')
FROM numbered n
JOIN service_max sm ON sm.service_id = n.service_id
WHERE a.id = n.id
"""


def upgrade() -> None:
    op.execute(_REASSIGN_DUPLICATE_TAGS_SQL)
    op.create_unique_constraint(
        "uq_attendance_service_tag",
        "attendance",
        ["service_id", "tag_number"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_attendance_service_tag", "attendance", type_="unique")

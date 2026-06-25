import enum
from typing import TypeVar

from sqlalchemy import Enum

E = TypeVar("E", bound=enum.Enum)


def pg_enum(enum_class: type[E], name: str | None = None) -> Enum:
    """PostgreSQL enum column that persists enum values (e.g. 'admin'), not names ('ADMIN')."""
    return Enum(
        enum_class,
        name=name,
        values_callable=lambda members: [member.value for member in members],
    )

"""Import all model modules so SQLAlchemy mappers register correctly."""

from . import (  # noqa: F401
    audit_log,
    attendance,
    authorized_pickup_contact,
    child,
    class_model,
    parent,
    service,
    user,
    worker,
    worker_attendance,
)

import logging
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def log_audit(
    db: Session,
    action: str,
    resource: str,
    user_id: uuid.UUID | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    logger.info("Audit: %s %s by user %s", action, resource, user_id)

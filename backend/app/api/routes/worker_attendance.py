import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import joinedload

from app.core.deps import AdminUser, DbSession, VerifiedUser
from app.models.service import Service
from app.models.worker import Worker
from app.models.worker_attendance import WorkerAttendance
from app.schemas.attendance import WorkerAttendanceRequest, WorkerAttendanceResponse
from app.services.audit import log_audit

router = APIRouter()

SERVICE_REQUIRED_MESSAGE = (
    "No service selected. Choose or create a service for today in Service Management."
)


@router.get("", response_model=list[WorkerAttendanceResponse])
def list_worker_attendance(
    db: DbSession,
    current_user: VerifiedUser,
    service_id: str | None = None,
) -> list[WorkerAttendanceResponse]:
    query = db.query(WorkerAttendance).options(joinedload(WorkerAttendance.worker))
    if service_id:
        query = query.filter(WorkerAttendance.service_id == uuid.UUID(service_id))
    records = query.order_by(WorkerAttendance.check_in_time.desc()).limit(100).all()
    return [
        WorkerAttendanceResponse(
            id=str(r.id),
            worker_id=str(r.worker_id),
            worker_name=r.worker.full_name,
            service_id=str(r.service_id),
            check_in_time=r.check_in_time,
        )
        for r in records
    ]


@router.post("", response_model=WorkerAttendanceResponse, status_code=status.HTTP_201_CREATED)
def mark_worker_attendance(
    body: WorkerAttendanceRequest,
    db: DbSession,
    admin: AdminUser,
) -> WorkerAttendanceResponse:
    worker = (
        db.query(Worker)
        .filter(Worker.id == uuid.UUID(body.worker_id), Worker.is_active.is_(True))
        .first()
    )
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    if not body.service_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=SERVICE_REQUIRED_MESSAGE)

    service = db.query(Service).filter(Service.id == uuid.UUID(body.service_id)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service not found")

    existing = (
        db.query(WorkerAttendance)
        .filter(
            WorkerAttendance.worker_id == worker.id,
            WorkerAttendance.service_id == service.id,
        )
        .first()
    )
    if existing:
        return WorkerAttendanceResponse(
            id=str(existing.id),
            worker_id=str(existing.worker_id),
            worker_name=worker.full_name,
            service_id=str(existing.service_id),
            check_in_time=existing.check_in_time,
        )

    now = datetime.now(UTC)
    record = WorkerAttendance(
        worker_id=worker.id,
        service_id=service.id,
        check_in_time=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_audit(
        db,
        "mark_attendance",
        "worker_attendance",
        user_id=admin.id,
        resource_id=str(record.id),
        details={"worker_id": str(worker.id), "worker_name": worker.full_name},
    )

    return WorkerAttendanceResponse(
        id=str(record.id),
        worker_id=str(record.worker_id),
        worker_name=worker.full_name,
        service_id=str(record.service_id),
        check_in_time=record.check_in_time,
    )

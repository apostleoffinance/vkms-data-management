import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdminUser, DbSession, VerifiedUser
from app.models.worker import Worker
from app.schemas.worker import WorkerCreate, WorkerResponse, WorkerUpdate
from app.services.audit import log_audit

router = APIRouter()


def _worker_response(worker: Worker) -> WorkerResponse:
    return WorkerResponse(
        id=str(worker.id),
        first_name=worker.first_name,
        last_name=worker.last_name,
        phone=worker.phone,
        is_active=worker.is_active,
        created_at=worker.created_at.isoformat(),
    )


@router.get("", response_model=list[WorkerResponse])
def list_workers(
    db: DbSession,
    current_user: VerifiedUser,
    active_only: bool = Query(default=True),
) -> list[WorkerResponse]:
    query = db.query(Worker)
    if active_only:
        query = query.filter(Worker.is_active.is_(True))
    workers = query.order_by(Worker.last_name, Worker.first_name).all()
    return [_worker_response(w) for w in workers]


@router.post("", response_model=WorkerResponse, status_code=status.HTTP_201_CREATED)
def create_worker(body: WorkerCreate, db: DbSession, admin: AdminUser) -> WorkerResponse:
    worker = Worker(
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    log_audit(db, "create", "worker", user_id=admin.id, resource_id=str(worker.id))
    return _worker_response(worker)


@router.put("/{worker_id}", response_model=WorkerResponse)
def update_worker(
    worker_id: uuid.UUID, body: WorkerUpdate, db: DbSession, admin: AdminUser
) -> WorkerResponse:
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    if body.first_name is not None:
        worker.first_name = body.first_name
    if body.last_name is not None:
        worker.last_name = body.last_name
    if body.phone is not None:
        worker.phone = body.phone
    if body.is_active is not None:
        worker.is_active = body.is_active

    db.commit()
    db.refresh(worker)
    log_audit(db, "update", "worker", user_id=admin.id, resource_id=str(worker.id))
    return _worker_response(worker)

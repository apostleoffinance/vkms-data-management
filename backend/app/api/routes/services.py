import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.constants import DEFAULT_SERVICE_NAME, PRESET_SERVICE_TYPES
from app.core.deps import AdminUser, DbSession, VerifiedUser
from app.models.service import Service
from app.schemas.attendance import ServiceCreate, ServiceResponse
from app.services.audit import log_audit
from app.services.child_service import get_or_create_today_service

router = APIRouter()

DUPLICATE_SERVICE_MESSAGE = "A service with this name is already scheduled for this date"


def _service_response(service: Service) -> ServiceResponse:
    return ServiceResponse(
        id=str(service.id),
        service_name=service.service_name,
        service_date=service.service_date,
        created_at=service.created_at.isoformat(),
    )


@router.get("/types")
def list_service_types(current_user: VerifiedUser) -> dict:
    return {
        "default": DEFAULT_SERVICE_NAME,
        "presets": PRESET_SERVICE_TYPES,
        "allow_custom": True,
    }


@router.get("/today", response_model=ServiceResponse)
def get_today_service(db: DbSession, current_user: VerifiedUser) -> ServiceResponse:
    service = get_or_create_today_service(db)
    return _service_response(service)


@router.get("/today/all", response_model=list[ServiceResponse])
def list_today_services(db: DbSession, current_user: VerifiedUser) -> list[ServiceResponse]:
    today = date.today()
    get_or_create_today_service(db)
    services = (
        db.query(Service)
        .filter(Service.service_date == today)
        .order_by(Service.service_name)
        .all()
    )
    return [_service_response(s) for s in services]


@router.get("", response_model=list[ServiceResponse])
def list_services(
    db: DbSession,
    current_user: VerifiedUser,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[ServiceResponse]:
    query = db.query(Service)
    if from_date:
        query = query.filter(Service.service_date >= from_date)
    if to_date:
        query = query.filter(Service.service_date <= to_date)
    services = query.order_by(Service.service_date.desc()).limit(50).all()
    return [_service_response(s) for s in services]


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(body: ServiceCreate, db: DbSession, admin: AdminUser) -> ServiceResponse:
    service_name = body.service_name.strip()
    if not service_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service name is required")

    existing = (
        db.query(Service)
        .filter(Service.service_name == service_name, Service.service_date == body.service_date)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DUPLICATE_SERVICE_MESSAGE)

    service = Service(service_name=service_name, service_date=body.service_date)
    db.add(service)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DUPLICATE_SERVICE_MESSAGE) from None
    db.refresh(service)
    log_audit(db, "create", "service", user_id=admin.id, resource_id=str(service.id))
    return _service_response(service)

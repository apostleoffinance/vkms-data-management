import uuid

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.deps import DbSession
from app.core.kiosk import KioskAccess
from app.core.limiter import limiter
from app.models.class_model import Class
from app.models.service import Service
from app.schemas.kiosk import (
    KioskCheckInRequest,
    KioskChildPreview,
    KioskClassOption,
    KioskLookupRequest,
    KioskLookupResponse,
    KioskRegisterRequest,
    KioskServiceResponse,
    KioskTagResponse,
)
from app.services.attendance_service import CheckInError
from app.services.audit import log_audit
from app.services.kiosk_service import (
    get_child_by_code,
    get_today_service,
    kiosk_check_in_child,
    kiosk_register_and_check_in,
    lookup_parent_children,
    parse_child_code_from_scan,
)

router = APIRouter()


def _require_today_service(db: DbSession, *, lock: bool = False) -> Service:
    service = get_today_service(db)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No service is scheduled for today. Please see the front desk.",
        )
    if not lock:
        return service
    return (
        db.query(Service)
        .filter(Service.id == service.id)
        .with_for_update()
        .first()
        or service
    )


def _handle_check_in_error(exc: CheckInError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/service/today", response_model=KioskServiceResponse | None)
@limiter.limit("60/minute")
def kiosk_today_service(
    request: Request,
    db: DbSession,
    _: KioskAccess,
) -> KioskServiceResponse | None:
    service = get_today_service(db)
    if not service:
        return None
    return KioskServiceResponse(
        id=str(service.id),
        service_name=service.service_name,
        service_date=service.service_date,
    )


@router.get("/classes", response_model=list[KioskClassOption])
@limiter.limit("60/minute")
def kiosk_classes(
    request: Request,
    db: DbSession,
    _: KioskAccess,
) -> list[KioskClassOption]:
    classes = db.query(Class).order_by(Class.min_age).all()
    return [
        KioskClassOption(id=str(c.id), name=c.name, min_age=c.min_age, max_age=c.max_age)
        for c in classes
    ]


@router.post("/lookup", response_model=KioskLookupResponse | None)
@limiter.limit("30/minute")
def kiosk_lookup(
    request: Request,
    body: KioskLookupRequest,
    db: DbSession,
    _: KioskAccess,
) -> KioskLookupResponse | None:
    service = _require_today_service(db)
    return lookup_parent_children(db, body.phone, service)


@router.get("/child/{child_code}", response_model=KioskChildPreview)
@limiter.limit("60/minute")
def kiosk_child_by_code(
    request: Request,
    child_code: str,
    db: DbSession,
    _: KioskAccess,
) -> KioskChildPreview:
    service = _require_today_service(db)
    status_row = get_child_by_code(db, child_code, service)
    if not status_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    return KioskChildPreview(child=status_row, service_name=service.service_name)


@router.post("/check-in", response_model=KioskTagResponse)
@limiter.limit("30/minute")
def kiosk_check_in(
    request: Request,
    body: KioskCheckInRequest,
    db: DbSession,
    _: KioskAccess,
) -> KioskTagResponse:
    service = _require_today_service(db, lock=True)
    try:
        child_uuid = uuid.UUID(body.child_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid child id") from exc
    try:
        result = kiosk_check_in_child(db, child_uuid, service)
    except CheckInError as exc:
        _handle_check_in_error(exc)
    else:
        log_audit(
            db,
            "kiosk_check_in",
            "attendance",
            details={
                "child_id": body.child_id,
                "tag_number": result.tag_number,
                "source": "kiosk",
            },
            ip_address=request.client.host if request.client else None,
        )
        return result
    raise HTTPException(status_code=500, detail="Check-in failed")


@router.post("/register", response_model=KioskTagResponse)
@limiter.limit("20/minute")
def kiosk_register(
    request: Request,
    body: KioskRegisterRequest,
    db: DbSession,
    _: KioskAccess,
) -> KioskTagResponse:
    service = _require_today_service(db, lock=True)
    try:
        result = kiosk_register_and_check_in(
            db,
            child_first_name=body.child_first_name,
            child_last_name=body.child_last_name,
            gender=body.gender,
            date_of_birth=body.date_of_birth,
            parent_first_name=body.parent_first_name,
            parent_last_name=body.parent_last_name,
            parent_phone=body.parent_phone,
            parent_email=str(body.parent_email) if body.parent_email else None,
            medical_notes=body.medical_notes,
            service=service,
        )
    except CheckInError as exc:
        _handle_check_in_error(exc)
    else:
        log_audit(
            db,
            "kiosk_register",
            "child",
            details={
                "child_name": f"{body.child_first_name} {body.child_last_name}",
                "tag_number": result.tag_number,
                "source": "kiosk",
            },
            ip_address=request.client.host if request.client else None,
        )
        return result
    raise HTTPException(status_code=500, detail="Registration failed")


@router.get("/qr", response_model=KioskChildPreview)
@limiter.limit("60/minute")
def kiosk_parse_qr(
    request: Request,
    db: DbSession,
    _: KioskAccess,
    data: str = Query(min_length=3),
) -> KioskChildPreview:
    """Parse scanned QR payload and return child status for today's service."""
    service = _require_today_service(db)
    code = parse_child_code_from_scan(data)
    status_row = get_child_by_code(db, code, service)
    if not status_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    return KioskChildPreview(child=status_row, service_name=service.service_name)

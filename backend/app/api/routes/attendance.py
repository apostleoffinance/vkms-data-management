import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.core.deps import DbSession, VerifiedUser
from app.models.attendance import Attendance
from app.models.child import Child
from app.models.parent import Parent
from app.models.service import Service
from app.schemas.attendance import (
    AttendanceResponse,
    CheckInRequest,
    CheckOutRequest,
    TagPrintResponse,
)
from app.services.attendance_service import CheckInError, child_attendance_on_date, perform_check_in
from app.services.audit import log_audit
from app.services.pickup_service import get_contact_for_child

router = APIRouter()

SERVICE_REQUIRED_MESSAGE = (
    "No service selected. Choose or create a service for today in Service Management."
)


def _resolve_service(db: DbSession, service_id: str | None, *, lock: bool = False) -> Service:
    if not service_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=SERVICE_REQUIRED_MESSAGE)
    try:
        service_uuid = uuid.UUID(service_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid service id") from exc
    query = db.query(Service).filter(Service.id == service_uuid)
    if lock:
        query = query.with_for_update()
    service = query.first()
    if not service:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service not found")
    return service


def _attendance_query(db: DbSession):
    return db.query(Attendance).options(
        joinedload(Attendance.child).joinedload(Child.parent),
        joinedload(Attendance.child).joinedload(Child.class_),
        joinedload(Attendance.checked_out_by_user),
        joinedload(Attendance.dropped_off_contact),
        joinedload(Attendance.picked_up_contact),
    )


def _child_attendance_on_date(db: DbSession, child_id: uuid.UUID, service_date):
    return child_attendance_on_date(db, child_id, service_date)


def _attendance_response(record: Attendance) -> AttendanceResponse:
    return AttendanceResponse(
        id=str(record.id),
        child_id=str(record.child_id),
        child_name=record.child.full_name,
        child_code=record.child.child_code,
        class_name=record.child.class_.name,
        parent_name=record.child.parent.full_name,
        service_id=str(record.service_id),
        tag_number=record.tag_number,
        check_in_time=record.check_in_time,
        check_out_time=record.check_out_time,
        checked_out=record.checked_out,
        checked_out_by_name=record.checked_out_by_user.full_name if record.checked_out_by_user else None,
        dropped_off_contact_id=str(record.dropped_off_contact_id) if record.dropped_off_contact_id else None,
        dropped_off_contact_name=record.dropped_off_contact.full_name if record.dropped_off_contact else None,
        picked_up_contact_id=str(record.picked_up_contact_id) if record.picked_up_contact_id else None,
        picked_up_contact_name=record.picked_up_contact.full_name if record.picked_up_contact else None,
        notes=record.notes,
    )


@router.get("", response_model=list[AttendanceResponse])
def list_attendance(
    db: DbSession,
    current_user: VerifiedUser,
    service_id: str | None = Query(default=None),
    child_id: str | None = Query(default=None),
) -> list[AttendanceResponse]:
    query = _attendance_query(db)
    if service_id:
        query = query.filter(Attendance.service_id == uuid.UUID(service_id))
    if child_id:
        query = query.filter(Attendance.child_id == uuid.UUID(child_id))
    records = query.order_by(Attendance.check_in_time.desc()).limit(200).all()
    return [_attendance_response(r) for r in records]


@router.get("/search", response_model=list[AttendanceResponse])
def search_checked_in(
    q: str = Query(min_length=1),
    service_id: str = Query(min_length=1),
    db: DbSession = ...,
    current_user: VerifiedUser = ...,
) -> list[AttendanceResponse]:
    """Find children currently checked in (not yet checked out) for a service."""
    service = _resolve_service(db, service_id)
    term = q.strip()
    search_term = f"%{term}%"
    filters = [
        Child.first_name.ilike(search_term),
        Child.last_name.ilike(search_term),
        func.concat(Child.first_name, " ", Child.last_name).ilike(search_term),
        Child.child_code.ilike(search_term),
        Parent.first_name.ilike(search_term),
        Parent.last_name.ilike(search_term),
        func.concat(Parent.first_name, " ", Parent.last_name).ilike(search_term),
    ]
    if term.isdigit():
        filters.append(Attendance.tag_number == term.zfill(3))

    records = (
        _attendance_query(db)
        .join(Child)
        .join(Parent)
        .join(Service)
        .filter(
            Service.service_date == service.service_date,
            Attendance.checked_out.is_(False),
            or_(*filters),
        )
        .order_by(Child.first_name, Child.last_name)
        .limit(25)
        .all()
    )
    return [_attendance_response(r) for r in records]


@router.get("/tag/{tag_number}", response_model=AttendanceResponse)
def get_by_tag(
    tag_number: str,
    db: DbSession,
    current_user: VerifiedUser,
    service_id: str | None = Query(default=None),
) -> AttendanceResponse:
    service = _resolve_service(db, service_id)

    record = (
        _attendance_query(db)
        .filter(
            Attendance.tag_number == tag_number.zfill(3),
            Attendance.service_id == service.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found for today's service")
    return _attendance_response(record)


@router.post("/check-in", response_model=TagPrintResponse)
def check_in(body: CheckInRequest, db: DbSession, current_user: VerifiedUser) -> TagPrintResponse:
    child = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.id == uuid.UUID(body.child_id), Child.is_active.is_(True))
        .first()
    )
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

    service = _resolve_service(db, body.service_id, lock=True)

    existing = _child_attendance_on_date(db, child.id, service.service_date)
    if existing:
        if existing.checked_out:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{child.full_name} has already checked in and out for this service "
                    f"(tag {existing.tag_number})"
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{child.full_name} is already checked in (tag {existing.tag_number})",
        )

    try:
        dropped_off_contact_id = uuid.UUID(body.dropped_off_contact_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid contact id") from exc

    try:
        result = perform_check_in(
            db,
            child_id=child.id,
            service=service,
            dropped_off_contact_id=dropped_off_contact_id,
            notes=body.notes,
        )
    except CheckInError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    log_audit(
        db,
        "check_in",
        "attendance",
        user_id=current_user.id,
        resource_id=str(result.attendance_id),
        details={
            "tag_number": result.tag_number,
            "child_code": child.child_code,
            "dropped_off": result.dropped_off_name,
        },
    )

    return TagPrintResponse(
        tag_number=result.tag_number,
        child_name=result.child_name,
        class_name=result.class_name,
        check_in_time=result.check_in_time,
        child_code=result.child_code,
    )


@router.post("/check-out", response_model=AttendanceResponse)
def check_out(body: CheckOutRequest, db: DbSession, current_user: VerifiedUser) -> AttendanceResponse:
    service = _resolve_service(db, body.service_id)

    record = (
        _attendance_query(db)
        .filter(
            Attendance.tag_number == body.tag_number.zfill(3),
            Attendance.service_id == service.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    if record.checked_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{record.child.full_name} has already been checked out for this service",
        )

    try:
        picked_up_contact_id = uuid.UUID(body.picked_up_contact_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid contact id") from exc

    picked_up = get_contact_for_child(db, record.child_id, picked_up_contact_id)
    if not picked_up:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected pickup person is not authorized for this child",
        )

    record.checked_out = True
    record.check_out_time = datetime.now(UTC)
    record.checked_out_by = current_user.id
    record.picked_up_contact_id = picked_up.id
    db.commit()
    db.refresh(record)

    log_audit(
        db,
        "check_out",
        "attendance",
        user_id=current_user.id,
        resource_id=str(record.id),
        details={"tag_number": record.tag_number, "picked_up": picked_up.full_name},
    )

    return _attendance_response(record)

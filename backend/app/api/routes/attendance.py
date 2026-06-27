import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.core.deps import DbSession, VerifiedUser
from app.models.attendance import Attendance
from app.models.child import Child
from app.models.parent import Parent
from app.schemas.attendance import (
    AttendanceResponse,
    CheckInRequest,
    CheckOutRequest,
    TagPrintResponse,
)
from app.services.audit import log_audit
from app.services.child_service import get_next_tag_number, get_or_create_today_service

router = APIRouter()


def _attendance_query(db: DbSession):
    return db.query(Attendance).options(
        joinedload(Attendance.child).joinedload(Child.parent),
        joinedload(Attendance.child).joinedload(Child.class_),
        joinedload(Attendance.checked_out_by_user),
    )


def _resolve_service(db: DbSession, service_id: str | None):
    if service_id:
        from app.models.service import Service

        service = db.query(Service).filter(Service.id == uuid.UUID(service_id)).first()
        if not service:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service not found")
        return service
    return get_or_create_today_service(db)


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
        notes=record.notes,
    )


@router.get("", response_model=list[AttendanceResponse])
def list_attendance(
    db: DbSession,
    current_user: VerifiedUser,
    service_id: str | None = Query(default=None),
    child_id: str | None = Query(default=None),
) -> list[AttendanceResponse]:
    query = (
        db.query(Attendance)
        .options(
            joinedload(Attendance.child).joinedload(Child.parent),
            joinedload(Attendance.child).joinedload(Child.class_),
            joinedload(Attendance.checked_out_by_user),
        )
    )
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
        .filter(
            Attendance.service_id == service.id,
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
        .filter(Attendance.tag_number == tag_number.zfill(3), Attendance.service_id == service.id)
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

    if body.service_id:
        service = _resolve_service(db, body.service_id)
    else:
        service = get_or_create_today_service(db)

    existing = (
        db.query(Attendance)
        .filter(Attendance.child_id == child.id, Attendance.service_id == service.id)
        .first()
    )
    if existing:
        if existing.checked_out:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Child already checked out for this service (tag {existing.tag_number})",
            )
        return TagPrintResponse(
            tag_number=existing.tag_number,
            child_name=child.full_name,
            class_name=child.class_.name,
            check_in_time=existing.check_in_time,
            child_code=child.child_code,
        )

    tag_number = get_next_tag_number(db, service.id)
    now = datetime.now(UTC)

    attendance = Attendance(
        child_id=child.id,
        service_id=service.id,
        tag_number=tag_number,
        check_in_time=now,
        notes=body.notes,
    )
    db.add(attendance)
    db.commit()

    log_audit(
        db,
        "check_in",
        "attendance",
        user_id=current_user.id,
        resource_id=str(attendance.id),
        details={"tag_number": tag_number, "child_code": child.child_code},
    )

    return TagPrintResponse(
        tag_number=tag_number,
        child_name=child.full_name,
        class_name=child.class_.name,
        check_in_time=now,
        child_code=child.child_code,
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Child already checked out")

    record.checked_out = True
    record.check_out_time = datetime.now(UTC)
    record.checked_out_by = current_user.id
    db.commit()
    db.refresh(record)

    log_audit(
        db,
        "check_out",
        "attendance",
        user_id=current_user.id,
        resource_id=str(record.id),
        details={"tag_number": record.tag_number},
    )

    return _attendance_response(record)

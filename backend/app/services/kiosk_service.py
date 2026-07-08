"""Parent kiosk: lookup, registration, and check-in using existing core services."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.constants import DEFAULT_CLASSES, DEFAULT_CLASS_NAME
from app.models.attendance import Attendance
from app.models.child import Child, Gender
from app.models.class_model import Class
from app.models.service import Service
from app.schemas.kiosk import KioskChildStatus, KioskLookupResponse, KioskTagResponse
from app.services.attendance_service import CheckInError, CheckInResult, child_attendance_on_date, perform_check_in
from app.services.child_service import (
    duplicate_first_name_detail,
    find_child_with_conflicting_first_name,
    find_class_by_name,
    find_parent_by_phone,
    generate_child_code,
    generate_qr_code,
    get_or_create_parent,
    get_service_for_date,
)
from app.services.pickup_service import ensure_primary_contact_from_parent


def parse_child_code_from_scan(raw: str) -> str:
    text = raw.strip()
    if text.upper().startswith("VKMS:"):
        parts = text.split(":")
        if len(parts) >= 2:
            return parts[1].strip()
    return text.split(":")[0].strip()


def class_for_date_of_birth(db: Session, dob: date) -> Class:
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    for name, min_age, max_age in DEFAULT_CLASSES:
        if min_age <= age <= max_age:
            cls = find_class_by_name(db, name)
            if cls:
                return cls
    fallback = find_class_by_name(db, DEFAULT_CLASS_NAME)
    if fallback:
        return fallback
    cls = db.query(Class).order_by(Class.min_age).first()
    if not cls:
        raise CheckInError("No classes configured in the system", status_code=500)
    return cls


def get_today_service(db: Session) -> Service | None:
    return get_service_for_date(db, date.today())


def _child_status(db: Session, child: Child, service: Service) -> KioskChildStatus:
    record = child_attendance_on_date(db, child.id, service.service_date)
    return KioskChildStatus(
        id=str(child.id),
        child_code=child.child_code,
        full_name=child.full_name,
        class_name=child.class_.name,
        checked_in_today=record is not None,
        tag_number=record.tag_number if record else None,
        checked_out=record.checked_out if record else False,
        check_in_time=record.check_in_time if record else None,
    )


def lookup_parent_children(db: Session, phone: str, service: Service) -> KioskLookupResponse | None:
    parent = find_parent_by_phone(db, phone)
    if not parent:
        return None
    children = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.parent_id == parent.id, Child.is_active.is_(True))
        .order_by(Child.first_name, Child.last_name)
        .all()
    )
    return KioskLookupResponse(
        parent_name=parent.full_name,
        phone=parent.phone,
        children=[_child_status(db, child, service) for child in children],
    )


def get_child_by_code(db: Session, raw_code: str, service: Service) -> KioskChildStatus | None:
    child_code = parse_child_code_from_scan(raw_code)
    child = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.child_code == child_code, Child.is_active.is_(True))
        .first()
    )
    if not child:
        return None
    return _child_status(db, child, service)


def _tag_response(service: Service, result: CheckInResult, *, already: bool = False) -> KioskTagResponse:
    return KioskTagResponse(
        tag_number=result.tag_number,
        child_name=result.child_name,
        class_name=result.class_name,
        child_code=result.child_code,
        check_in_time=result.check_in_time,
        service_name=service.service_name,
        already_checked_in=already,
    )


def _existing_tag_response(db: Session, child: Child, service: Service, record: Attendance) -> KioskTagResponse:
    return KioskTagResponse(
        tag_number=record.tag_number,
        child_name=child.full_name,
        class_name=child.class_.name,
        child_code=child.child_code,
        check_in_time=record.check_in_time,
        service_name=service.service_name,
        already_checked_in=True,
    )


def kiosk_check_in_child(db: Session, child_id: uuid.UUID, service: Service) -> KioskTagResponse:
    child = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.id == child_id, Child.is_active.is_(True))
        .first()
    )
    if not child:
        raise CheckInError("Child not found", status_code=404)

    existing = child_attendance_on_date(db, child.id, service.service_date)
    if existing and not existing.checked_out:
        return _existing_tag_response(db, child, service, existing)

    primary = ensure_primary_contact_from_parent(db, child)
    result = perform_check_in(
        db,
        child_id=child.id,
        service=service,
        dropped_off_contact_id=primary.id,
        notes="Parent kiosk check-in",
    )
    return _tag_response(service, result)


def kiosk_register_and_check_in(
    db: Session,
    *,
    child_first_name: str,
    child_last_name: str,
    gender: str,
    date_of_birth: date,
    parent_first_name: str,
    parent_last_name: str,
    parent_phone: str,
    parent_email: str | None,
    medical_notes: str | None,
    service: Service,
) -> KioskTagResponse:
    parent, _ = get_or_create_parent(
        db,
        first_name=parent_first_name,
        last_name=parent_last_name,
        phone=parent_phone,
        email=parent_email,
    )

    conflict = find_child_with_conflicting_first_name(db, parent.id, child_first_name)
    if conflict:
        raise CheckInError(duplicate_first_name_detail(conflict))

    class_ = class_for_date_of_birth(db, date_of_birth)
    child_code = generate_child_code(db)
    child_id = uuid.uuid4()
    qr_data = generate_qr_code(child_code, child_id)

    child = Child(
        id=child_id,
        child_code=child_code,
        first_name=child_first_name,
        last_name=child_last_name,
        gender=Gender(gender),
        date_of_birth=date_of_birth,
        parent_id=parent.id,
        class_id=class_.id,
        medical_notes=medical_notes,
        registration_date=date.today(),
        qr_code_data=qr_data,
    )
    db.add(child)
    db.flush()

    primary = ensure_primary_contact_from_parent(db, child)
    result = perform_check_in(
        db,
        child_id=child.id,
        service=service,
        dropped_off_contact_id=primary.id,
        notes="Parent kiosk registration check-in",
    )
    return _tag_response(service, result)

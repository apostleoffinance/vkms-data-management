"""Parent kiosk: lookup, registration, check-in/out, and pickup photos."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.constants import DEFAULT_CLASSES, DEFAULT_CLASS_NAME
from app.models.attendance import Attendance
from app.models.authorized_pickup_contact import AuthorizedPickupContact
from app.models.child import Child, Gender
from app.models.class_model import Class
from app.models.service import Service
from app.schemas.kiosk import (
    KioskCheckOutResponse,
    KioskChildStatus,
    KioskLookupResponse,
    KioskPickupContactOption,
    KioskPickupPerson,
    KioskTagResponse,
)
from app.services.attendance_service import (
    CheckInError,
    CheckInResult,
    child_attendance_on_date,
    perform_check_in,
    perform_check_out,
)
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
from app.services.photo_service import decode_photo_base64
from app.services.pickup_service import create_contact, ensure_primary_contact_from_parent, get_contact_for_child


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


def _decode_photo(photo_base64: str) -> tuple[bytes, str]:
    try:
        result = decode_photo_base64(photo_base64)
    except ValueError as exc:
        raise CheckInError(str(exc)) from exc
    if not result:
        raise CheckInError("Photo is required")
    return result


def _apply_photo_to_contact(contact: AuthorizedPickupContact, photo_base64: str) -> None:
    photo_data, photo_content_type = _decode_photo(photo_base64)
    contact.photo_data = photo_data
    contact.photo_content_type = photo_content_type


def verify_child_for_parent_phone(db: Session, child_id: uuid.UUID, phone: str) -> Child:
    parent = find_parent_by_phone(db, phone)
    if not parent:
        raise CheckInError("Phone number not recognized", status_code=404)
    child = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.id == child_id, Child.parent_id == parent.id, Child.is_active.is_(True))
        .first()
    )
    if not child:
        raise CheckInError("Child not found for this phone number", status_code=404)
    return child


def _child_status(db: Session, child: Child, service: Service) -> KioskChildStatus:
    record = child_attendance_on_date(db, child.id, service.service_date)
    checked_in = record is not None
    checked_out = record.checked_out if record else False
    return KioskChildStatus(
        id=str(child.id),
        child_code=child.child_code,
        full_name=child.full_name,
        class_name=child.class_.name,
        checked_in_today=checked_in,
        tag_number=record.tag_number if record else None,
        checked_out=checked_out,
        check_in_time=record.check_in_time if record else None,
        ready_for_pickup=checked_in and not checked_out,
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


def list_pickup_contacts(
    db: Session,
    child_id: uuid.UUID,
    phone: str,
) -> list[KioskPickupContactOption]:
    verify_child_for_parent_phone(db, child_id, phone)
    contacts = (
        db.query(AuthorizedPickupContact)
        .filter(AuthorizedPickupContact.child_id == child_id)
        .order_by(AuthorizedPickupContact.is_primary.desc(), AuthorizedPickupContact.first_name)
        .all()
    )
    return [
        KioskPickupContactOption(
            id=str(c.id),
            full_name=c.full_name,
            relationship=c.relationship,
            has_photo=c.has_photo,
        )
        for c in contacts
    ]


def kiosk_add_pickup_contact(
    db: Session,
    *,
    phone: str,
    child_id: uuid.UUID,
    first_name: str,
    last_name: str,
    contact_phone: str,
    relationship: str,
    photo_base64: str,
) -> KioskPickupContactOption:
    verify_child_for_parent_phone(db, child_id, phone)
    photo_data, photo_content_type = _decode_photo(photo_base64)
    contact = create_contact(
        db,
        child_id=child_id,
        first_name=first_name,
        last_name=last_name,
        phone=contact_phone,
        relationship=relationship,
        is_primary=False,
        photo_data=photo_data,
        photo_content_type=photo_content_type,
    )
    db.commit()
    return KioskPickupContactOption(
        id=str(contact.id),
        full_name=contact.full_name,
        relationship=contact.relationship,
        has_photo=contact.has_photo,
    )


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


def _checkout_response(service: Service, result) -> KioskCheckOutResponse:
    return KioskCheckOutResponse(
        child_name=result.child_name,
        tag_number=result.tag_number,
        class_name=result.class_name,
        pickup_person_name=result.pickup_person_name,
        check_out_time=result.check_out_time,
        service_name=service.service_name,
        already_checked_out=result.already_checked_out,
    )


def _ensure_primary_photo(
    db: Session,
    child: Child,
    *,
    photo_base64: str | None,
) -> AuthorizedPickupContact:
    primary = ensure_primary_contact_from_parent(db, child)
    if primary.has_photo:
        return primary
    if not photo_base64:
        raise CheckInError(
            "A photo of the parent or guardian is required. Please take a photo to continue.",
        )
    _apply_photo_to_contact(primary, photo_base64)
    db.flush()
    return primary


def kiosk_check_in_child(
    db: Session,
    child_id: uuid.UUID,
    service: Service,
    *,
    phone: str,
    photo_base64: str | None = None,
) -> KioskTagResponse:
    child = verify_child_for_parent_phone(db, child_id, phone)

    existing = child_attendance_on_date(db, child.id, service.service_date)
    if existing and not existing.checked_out:
        return _existing_tag_response(db, child, service, existing)

    primary = _ensure_primary_photo(db, child, photo_base64=photo_base64)
    result = perform_check_in(
        db,
        child_id=child.id,
        service=service,
        dropped_off_contact_id=primary.id,
        notes="Parent kiosk check-in",
    )
    return _tag_response(service, result)


def kiosk_check_out_child(
    db: Session,
    child_id: uuid.UUID,
    service: Service,
    *,
    phone: str,
    picked_up_contact_id: uuid.UUID,
    photo_base64: str | None = None,
) -> KioskCheckOutResponse:
    child = verify_child_for_parent_phone(db, child_id, phone)
    contact = get_contact_for_child(db, child.id, picked_up_contact_id)
    if not contact:
        raise CheckInError("Selected pickup person is not authorized for this child")

    if not contact.has_photo:
        if not photo_base64:
            raise CheckInError(
                f"A photo of {contact.full_name} is required before pickup. Please take their photo.",
            )
        _apply_photo_to_contact(contact, photo_base64)
        db.flush()

    result = perform_check_out(
        db,
        child_id=child.id,
        service=service,
        picked_up_contact_id=picked_up_contact_id,
        checked_out_by=None,
    )
    return _checkout_response(service, result)


def _create_pickup_from_person(
    db: Session,
    child_id: uuid.UUID,
    person: KioskPickupPerson,
    *,
    is_primary: bool,
) -> AuthorizedPickupContact:
    photo_data, photo_content_type = _decode_photo(person.photo_base64)
    return create_contact(
        db,
        child_id=child_id,
        first_name=person.first_name,
        last_name=person.last_name,
        phone=person.phone,
        relationship=person.relationship,
        is_primary=is_primary,
        photo_data=photo_data,
        photo_content_type=photo_content_type,
    )


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
    parent_photo_base64: str,
    medical_notes: str | None,
    additional_pickup: KioskPickupPerson | None,
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

    photo_data, photo_content_type = _decode_photo(parent_photo_base64)
    primary = create_contact(
        db,
        child_id=child.id,
        first_name=parent_first_name,
        last_name=parent_last_name,
        phone=parent_phone,
        relationship="Parent",
        is_primary=True,
        photo_data=photo_data,
        photo_content_type=photo_content_type,
    )

    if additional_pickup:
        _create_pickup_from_person(db, child.id, additional_pickup, is_primary=False)

    result = perform_check_in(
        db,
        child_id=child.id,
        service=service,
        dropped_off_contact_id=primary.id,
        notes="Parent kiosk registration check-in",
    )
    return _tag_response(service, result)

"""Shared check-in logic for staff and parent kiosk flows."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.attendance import Attendance
from app.models.child import Child
from app.models.service import Service
from app.services.child_service import get_next_tag_number
from app.services.pickup_service import ensure_primary_contact_from_parent, get_contact_for_child


class CheckInError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class CheckInResult:
    tag_number: str
    child_name: str
    class_name: str
    check_in_time: datetime
    child_code: str
    attendance_id: uuid.UUID
    dropped_off_name: str


def child_attendance_on_date(db: Session, child_id: uuid.UUID, service_date) -> Attendance | None:
    return (
        db.query(Attendance)
        .filter(Attendance.child_id == child_id, Attendance.service_date == service_date)
        .first()
    )


def perform_check_in(
    db: Session,
    *,
    child_id: uuid.UUID,
    service: Service,
    dropped_off_contact_id: uuid.UUID,
    notes: str | None = None,
) -> CheckInResult:
    child = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.id == child_id, Child.is_active.is_(True))
        .first()
    )
    if not child:
        raise CheckInError("Child not found", status_code=404)

    existing = child_attendance_on_date(db, child.id, service.service_date)
    if existing:
        if existing.checked_out:
            raise CheckInError(
                f"{child.full_name} has already checked in and out for this service "
                f"(tag {existing.tag_number})",
            )
        raise CheckInError(
            f"{child.full_name} is already checked in (tag {existing.tag_number})",
        )

    now = datetime.now(UTC)
    attendance: Attendance | None = None
    dropped_off_name = ""
    tag_number = get_next_tag_number(db, service.id)

    for attempt in range(2):
        ensure_primary_contact_from_parent(db, child)
        dropped_off = get_contact_for_child(db, child.id, dropped_off_contact_id)
        if not dropped_off:
            raise CheckInError("Selected drop-off person is not authorized for this child")
        dropped_off_name = dropped_off.full_name
        tag_number = get_next_tag_number(db, service.id)
        attendance = Attendance(
            child_id=child.id,
            service_id=service.id,
            service_date=service.service_date,
            tag_number=tag_number,
            check_in_time=now,
            notes=notes,
            dropped_off_contact_id=dropped_off.id,
        )
        db.add(attendance)
        try:
            db.commit()
            break
        except IntegrityError as exc:
            db.rollback()
            if attempt == 0 and "uq_attendance_service_tag" in str(exc.orig):
                continue
            raise CheckInError(
                f"{child.full_name} already has attendance recorded for this service date",
            ) from exc

    if attendance is None:
        raise CheckInError(
            "Could not assign a unique tag number. Please try again.",
            status_code=500,
        )

    db.refresh(attendance)
    return CheckInResult(
        tag_number=tag_number,
        child_name=child.full_name,
        class_name=child.class_.name,
        check_in_time=now,
        child_code=child.child_code,
        attendance_id=attendance.id,
        dropped_off_name=dropped_off_name,
    )


@dataclass
class CheckOutResult:
    child_name: str
    tag_number: str
    class_name: str
    pickup_person_name: str
    check_out_time: datetime
    attendance_id: uuid.UUID
    already_checked_out: bool = False


def perform_check_out(
    db: Session,
    *,
    child_id: uuid.UUID,
    service: Service,
    picked_up_contact_id: uuid.UUID,
    checked_out_by: uuid.UUID | None = None,
) -> CheckOutResult:
    child = (
        db.query(Child)
        .options(joinedload(Child.class_))
        .filter(Child.id == child_id, Child.is_active.is_(True))
        .first()
    )
    if not child:
        raise CheckInError("Child not found", status_code=404)

    record = child_attendance_on_date(db, child.id, service.service_date)
    if not record:
        raise CheckInError(f"{child.full_name} is not checked in for today's service", status_code=404)

    if record.checked_out:
        picked_up = record.picked_up_contact
        return CheckOutResult(
            child_name=child.full_name,
            tag_number=record.tag_number,
            class_name=child.class_.name,
            pickup_person_name=picked_up.full_name if picked_up else "",
            check_out_time=record.check_out_time or datetime.now(UTC),
            attendance_id=record.id,
            already_checked_out=True,
        )

    picked_up = get_contact_for_child(db, child.id, picked_up_contact_id)
    if not picked_up:
        raise CheckInError("Selected pickup person is not authorized for this child")

    now = datetime.now(UTC)
    record.checked_out = True
    record.check_out_time = now
    record.checked_out_by = checked_out_by
    record.picked_up_contact_id = picked_up.id
    db.commit()
    db.refresh(record)

    return CheckOutResult(
        child_name=child.full_name,
        tag_number=record.tag_number,
        class_name=child.class_.name,
        pickup_person_name=picked_up.full_name,
        check_out_time=now,
        attendance_id=record.id,
    )

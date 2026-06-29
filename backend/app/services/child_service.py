import io
import re
import uuid
from datetime import UTC, date, datetime, timedelta

import qrcode
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.constants import CLASS_IMPORT_ALIASES, DEFAULT_CLASS_NAME, DEFAULT_SERVICE_NAME
from app.models.attendance import Attendance
from app.models.authorized_pickup_contact import AuthorizedPickupContact
from app.models.child import Child, Gender
from app.models.class_model import Class
from app.models.parent import Parent
from app.models.service import Service
from app.models.worker_attendance import WorkerAttendance


def generate_child_code(db: Session) -> str:
    last_child = db.query(Child).order_by(Child.child_code.desc()).first()
    if last_child:
        last_num = int(last_child.child_code.split("-")[1])
        next_num = last_num + 1
    else:
        next_num = 1
    return f"VK-{next_num:05d}"


def generate_qr_code(child_code: str, child_id: uuid.UUID) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(f"VKMS:{child_code}:{child_id}")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return f"VKMS:{child_code}:{child_id}"


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone.strip())


_EMPTY_PLACEHOLDERS = frozenset({"nil", "n/a", "na", "none", "-", "--", "—", "n.a.", "n.a"})


def is_empty_placeholder(value: object | None) -> bool:
    if value is None:
        return True
    text = str(value).strip().lower()
    if not text:
        return True
    return text in _EMPTY_PLACEHOLDERS or text.replace(".", "") == "na"


def cell_to_optional_str(value: object | None) -> str | None:
    if is_empty_placeholder(value):
        return None
    return str(value).strip()


def cell_to_required_str(value: object | None, field_name: str) -> str:
    text = cell_to_optional_str(value)
    if not text:
        raise ValueError(f"{field_name} is required")
    return text


_CLASS_RANGE_RE = re.compile(r"(\d+)\s*[-–]\s*(\d+)")
_AGE_CLASS_CANONICAL = {
    (1, 3): "Ages 1-3",
    (4, 7): "Ages 4-7",
    (8, 12): "Ages 8-12",
    (13, 16): "Ages 13-16",
}


def resolve_class_alias(class_name: object | None) -> str:
    raw = cell_to_optional_str(class_name) or DEFAULT_CLASS_NAME
    lowered = raw.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)

    if lowered in CLASS_IMPORT_ALIASES:
        return CLASS_IMPORT_ALIASES[lowered]

    match = _CLASS_RANGE_RE.search(lowered.replace("ages", "age"))
    if match:
        age_range = (int(match.group(1)), int(match.group(2)))
        if age_range in _AGE_CLASS_CANONICAL:
            return _AGE_CLASS_CANONICAL[age_range]

    if "teen" in lowered:
        return "Ages 13-16"

    return raw


def find_class_by_name(db: Session, class_name: object | None) -> Class | None:
    name = resolve_class_alias(class_name)
    return db.query(Class).filter(func.lower(Class.name) == name.lower()).first()


def find_parent_by_phone(db: Session, phone: str) -> Parent | None:
    target = normalize_phone(phone)
    if len(target) < 7:
        return None
    for parent in db.query(Parent).options(joinedload(Parent.children)).all():
        if normalize_phone(parent.phone) == target:
            return parent
    return None


def _sync_parent_details(
    parent: Parent,
    *,
    first_name: str,
    last_name: str,
    phone: str,
    alternative_phone: str | None,
    email: str | None,
    address: str | None,
) -> None:
    parent.first_name = first_name
    parent.last_name = last_name
    parent.phone = phone
    if alternative_phone:
        parent.alternative_phone = alternative_phone
    if email:
        parent.email = email
    if address:
        parent.address = address


def get_or_create_parent(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    phone: str,
    alternative_phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    parent_id: uuid.UUID | None = None,
) -> tuple[Parent, bool]:
    """Return (parent, created). Reuses an existing parent matched by phone or parent_id."""
    if parent_id:
        parent = db.query(Parent).filter(Parent.id == parent_id).first()
        if not parent:
            raise ValueError("Parent not found")
        _sync_parent_details(
            parent,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            alternative_phone=alternative_phone,
            email=email,
            address=address,
        )
        return parent, False

    existing = find_parent_by_phone(db, phone)
    if existing:
        _sync_parent_details(
            existing,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            alternative_phone=alternative_phone,
            email=email,
            address=address,
        )
        return existing, False

    parent = Parent(
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        alternative_phone=alternative_phone,
        email=email,
        address=address,
    )
    db.add(parent)
    db.flush()
    return parent, True


def get_service_for_date(db: Session, target: date) -> Service | None:
    return (
        db.query(Service)
        .filter(Service.service_date == target)
        .order_by(Service.created_at.asc())
        .first()
    )


def get_service_by_id(db: Session, service_id: uuid.UUID) -> Service | None:
    return db.query(Service).filter(Service.id == service_id).first()


def get_next_tag_number(db: Session, service_id: uuid.UUID) -> str:
    """Assign the next tag in check-in order for this service (001, 002, ...)."""
    count = db.query(Attendance).filter(Attendance.service_id == service_id).count()
    return f"{count + 1:03d}"


def _pickup_stats_by_child_id(db: Session, child_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[int, int]]:
    if not child_ids:
        return {}
    contacts = (
        db.query(AuthorizedPickupContact)
        .filter(AuthorizedPickupContact.child_id.in_(child_ids))
        .all()
    )
    stats: dict[uuid.UUID, list[int]] = {}
    for contact in contacts:
        bucket = stats.setdefault(contact.child_id, [0, 0])
        bucket[0] += 1
        if contact.has_photo:
            bucket[1] += 1
    return {child_id: (counts[0], counts[1]) for child_id, counts in stats.items()}


def search_children(
    db: Session,
    query: str = "",
    limit: int = 50,
    include_inactive: bool = False,
    missing_photos_only: bool = False,
) -> list[dict]:
    base_query = (
        db.query(Child)
        .join(Parent)
        .join(Class)
        .options(joinedload(Child.parent), joinedload(Child.class_))
    )
    if not include_inactive:
        base_query = base_query.filter(Child.is_active.is_(True))

    trimmed = query.strip()
    if trimmed:
        search_term = f"%{trimmed}%"
        base_query = base_query.filter(
            or_(
                Child.first_name.ilike(search_term),
                Child.last_name.ilike(search_term),
                Child.child_code.ilike(search_term),
                Parent.first_name.ilike(search_term),
                Parent.last_name.ilike(search_term),
                Parent.phone.ilike(search_term),
                func.concat(Child.first_name, " ", Child.last_name).ilike(search_term),
            ),
        )

    fetch_limit = limit * 4 if missing_photos_only else limit
    children = (
        base_query.order_by(Child.first_name, Child.last_name)
        .limit(fetch_limit)
        .all()
    )
    stats = _pickup_stats_by_child_id(db, [child.id for child in children])

    results: list[dict] = []
    for child in children:
        contact_count, photo_count = stats.get(child.id, (0, 0))
        has_pickup_photo = photo_count > 0
        if missing_photos_only and has_pickup_photo:
            continue
        results.append(
            {
                "id": str(child.id),
                "child_code": child.child_code,
                "first_name": child.first_name,
                "last_name": child.last_name,
                "class_name": child.class_.name,
                "parent_name": child.parent.full_name,
                "parent_phone": child.parent.phone,
                "is_active": child.is_active,
                "pickup_contact_count": contact_count,
                "pickup_photo_count": photo_count,
                "has_pickup_photo": has_pickup_photo,
            }
        )
        if len(results) >= limit:
            break
    return results


def get_child_detail(db: Session, child_id: uuid.UUID) -> dict | None:
    child = (
        db.query(Child)
        .options(joinedload(Child.parent), joinedload(Child.class_))
        .filter(Child.id == child_id)
        .first()
    )
    if not child:
        return None

    total_visits = db.query(Attendance).filter(Attendance.child_id == child_id).count()
    last_attendance = (
        db.query(Attendance)
        .join(Service)
        .filter(Attendance.child_id == child_id)
        .order_by(Attendance.check_in_time.desc())
        .first()
    )

    today = date.today()
    today_attendances = (
        db.query(Attendance)
        .join(Service)
        .options(joinedload(Attendance.service))
        .filter(Attendance.child_id == child_id, Service.service_date == today)
        .order_by(Attendance.check_in_time.desc())
        .all()
    )
    active_today = next((a for a in today_attendances if not a.checked_out), None)
    latest_today = today_attendances[0] if today_attendances else None

    if active_today:
        current_status = "checked_in"
    elif latest_today:
        current_status = "checked_out"
    else:
        current_status = "not_present"

    return {
        "id": str(child.id),
        "child_code": child.child_code,
        "first_name": child.first_name,
        "last_name": child.last_name,
        "gender": child.gender.value,
        "date_of_birth": child.date_of_birth,
        "parent_id": str(child.parent_id),
        "class_id": str(child.class_id),
        "medical_notes": child.medical_notes,
        "registration_date": child.registration_date,
        "is_active": child.is_active,
        "qr_code_data": child.qr_code_data,
        "created_at": child.created_at.isoformat(),
        "updated_at": child.updated_at.isoformat(),
        "parent": {
            "id": str(child.parent.id),
            "first_name": child.parent.first_name,
            "last_name": child.parent.last_name,
            "phone": child.parent.phone,
            "alternative_phone": child.parent.alternative_phone,
            "email": child.parent.email,
            "address": child.parent.address,
            "created_at": child.parent.created_at.isoformat(),
        },
        "class_name": child.class_.name,
        "total_visits": total_visits,
        "last_attendance_date": last_attendance.check_in_time.isoformat() if last_attendance else None,
        "current_status": current_status,
        "today_tag_number": active_today.tag_number if active_today else None,
        "today_service_name": active_today.service.service_name if active_today else None,
    }


def get_dashboard_stats(db: Session, target_date: date | None = None) -> dict:
    target = target_date or date.today()
    service_ids = [
        s.id for s in db.query(Service.id).filter(Service.service_date == target).all()
    ]

    total_children = db.query(Child).filter(Child.is_active.is_(True)).count()

    children_present = 0
    currently_checked_in = 0
    already_checked_out = 0
    if service_ids:
        children_present = (
            db.query(Attendance).filter(Attendance.service_id.in_(service_ids)).count()
        )
        currently_checked_in = (
            db.query(Attendance)
            .filter(Attendance.service_id.in_(service_ids), Attendance.checked_out.is_(False))
            .count()
        )
        already_checked_out = (
            db.query(Attendance)
            .filter(Attendance.service_id.in_(service_ids), Attendance.checked_out.is_(True))
            .count()
        )

    workers_present = 0
    if service_ids:
        workers_present = (
            db.query(WorkerAttendance)
            .filter(WorkerAttendance.service_id.in_(service_ids))
            .count()
        )

    month_start = target.replace(day=1)
    new_children = (
        db.query(Child)
        .filter(Child.registration_date >= month_start, Child.registration_date <= target)
        .count()
    )

    week_start = target - timedelta(days=target.weekday())
    week_end = week_start + timedelta(days=6)
    weekly_services = (
        db.query(Service.id)
        .filter(Service.service_date >= week_start, Service.service_date <= week_end)
        .all()
    )
    service_ids = [s.id for s in weekly_services]
    avg_weekly = 0.0
    if service_ids:
        total_weekly = (
            db.query(Attendance).filter(Attendance.service_id.in_(service_ids)).count()
        )
        avg_weekly = round(total_weekly / len(service_ids), 1)

    return {
        "total_children": total_children,
        "children_present_today": children_present,
        "workers_present_today": workers_present,
        "new_children_this_month": new_children,
        "average_weekly_attendance": avg_weekly,
        "currently_checked_in": currently_checked_in,
        "already_checked_out": already_checked_out,
    }


def get_dashboard_charts(
    db: Session, period: str = "weekly", target_date: date | None = None
) -> dict:
    target = target_date or date.today()

    if period == "monthly":
        start = target.replace(day=1)
        end = target
        delta = timedelta(days=1)
    elif period == "yearly":
        start = target.replace(month=1, day=1)
        end = target
        delta = timedelta(days=30)
    else:
        start = target - timedelta(days=6)
        end = target
        delta = timedelta(days=1)

    attendance_trend = []
    current = start
    while current <= end:
        service = db.query(Service).filter(Service.service_date == current).first()
        count = 0
        if service:
            count = db.query(Attendance).filter(Attendance.service_id == service.id).count()
        attendance_trend.append({"label": current.strftime("%b %d"), "value": count})
        current += delta

    class_distribution = []
    classes = db.query(Class).order_by(Class.min_age).all()
    for cls in classes:
        count = db.query(Child).filter(Child.class_id == cls.id, Child.is_active.is_(True)).count()
        class_distribution.append({"label": cls.name, "value": count})

    worker_trend = []
    current = start
    while current <= end:
        service = db.query(Service).filter(Service.service_date == current).first()
        count = 0
        if service:
            count = (
                db.query(WorkerAttendance)
                .filter(WorkerAttendance.service_id == service.id)
                .count()
            )
        worker_trend.append({"label": current.strftime("%b %d"), "value": count})
        current += delta

    registrations = []
    current = start
    while current <= end:
        count = (
            db.query(Child)
            .filter(Child.registration_date == current)
            .count()
        )
        registrations.append({"label": current.strftime("%b %d"), "value": count})
        current += delta

    return {
        "attendance_trend": attendance_trend,
        "class_distribution": class_distribution,
        "worker_attendance_trend": worker_trend,
        "new_registrations_trend": registrations,
    }

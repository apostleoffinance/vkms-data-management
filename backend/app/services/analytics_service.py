from datetime import date, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models.attendance import Attendance
from app.models.child import Child
from app.models.class_model import Class
from app.models.service import Service
from app.models.worker_attendance import WorkerAttendance
from app.services.child_service import get_dashboard_charts, get_dashboard_stats


def resolve_period_range(
    period: str,
    target_date: date,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[date, date]:
    if start_date and end_date:
        return start_date, end_date
    if period == "daily":
        return target_date, target_date
    if period == "weekly":
        week_start = target_date - timedelta(days=target_date.weekday())
        return week_start, week_start + timedelta(days=6)
    if period == "monthly":
        return target_date.replace(day=1), target_date
    if period == "quarterly":
        quarter_start_month = ((target_date.month - 1) // 3) * 3 + 1
        return target_date.replace(month=quarter_start_month, day=1), target_date
    if period == "yearly":
        return target_date.replace(month=1, day=1), target_date
    return target_date, target_date


def _period_label(period: str, start: date, end: date) -> str:
    if period == "daily":
        return end.strftime("%B %d, %Y")
    if period == "weekly":
        return f"{start.strftime('%b %d')} – {end.strftime('%b %d, %Y')}"
    if period == "monthly":
        return end.strftime("%B %Y")
    if period == "quarterly":
        quarter = (end.month - 1) // 3 + 1
        return f"Q{quarter} {end.year}"
    if period == "yearly":
        return str(end.year)
    return end.isoformat()


def _service_ids_in_range(db: Session, start: date, end: date) -> list:
    return [
        s.id
        for s in db.query(Service.id)
        .filter(Service.service_date >= start, Service.service_date <= end)
        .all()
    ]


MIN_GROWTH_BASELINE = 10


def _previous_service_date(db: Session, before: date) -> date | None:
    row = (
        db.query(Service.service_date)
        .filter(Service.service_date < before)
        .distinct()
        .order_by(Service.service_date.desc())
        .first()
    )
    return row[0] if row else None


def _attendance_count_for_dates(db: Session, start: date, end: date) -> int:
    service_ids = _service_ids_in_range(db, start, end)
    if not service_ids:
        return 0
    return db.query(Attendance).filter(Attendance.service_id.in_(service_ids)).count()


def _children_at_service(db: Session, service_date: date) -> set:
    service_ids = _service_ids_in_range(db, service_date, service_date)
    if not service_ids:
        return set()
    return {
        row[0]
        for row in db.query(Attendance.child_id)
        .filter(Attendance.service_id.in_(service_ids))
        .distinct()
        .all()
    }


def _recent_service_dates(db: Session, up_to: date, count: int = 2) -> list[date]:
    rows = (
        db.query(Service.service_date)
        .filter(Service.service_date <= up_to)
        .distinct()
        .order_by(Service.service_date.desc())
        .limit(count)
        .all()
    )
    return [row[0] for row in rows]


def get_children_absent_two_services(db: Session, target_date: date) -> list[dict]:
    recent_dates = _recent_service_dates(db, target_date, 2)
    if len(recent_dates) < 2:
        return []

    recent_service_ids = [
        s.id
        for s in db.query(Service.id).filter(Service.service_date.in_(recent_dates)).all()
    ]
    cutoff = min(recent_dates)

    active_children = (
        db.query(Child)
        .options(joinedload(Child.parent), joinedload(Child.class_))
        .filter(Child.is_active.is_(True))
        .all()
    )

    absent: list[dict] = []
    for child in active_children:
        attended_recent = (
            db.query(Attendance.id)
            .filter(
                Attendance.child_id == child.id,
                Attendance.service_id.in_(recent_service_ids),
            )
            .first()
        )
        if attended_recent:
            continue

        last_attendance = (
            db.query(Attendance, Service.service_date)
            .join(Service)
            .filter(Attendance.child_id == child.id)
            .order_by(Service.service_date.desc())
            .first()
        )
        last_date = last_attendance[1] if last_attendance else None

        if last_date is None and child.registration_date >= cutoff:
            continue
        if last_date is not None and last_date >= cutoff:
            continue

        absent.append(
            {
                "child_name": child.full_name,
                "child_code": child.child_code,
                "class_name": child.class_.name,
                "parent_name": child.parent.full_name,
                "phone": child.parent.phone,
                "email": child.parent.email or "",
                "last_attendance": last_date.isoformat() if last_date else "Never",
            }
        )

    absent.sort(key=lambda row: row["last_attendance"])
    return absent


def _retention_metrics(db: Session, period: str, start: date, end: date) -> dict:
    empty = {
        "returning_count": 0,
        "first_check_in_ever_count": 0,
        "retention_rate_pct": None,
        "period_attendance_total": 0,
        "unique_children_present": 0,
        "retention_note": None,
    }
    service_ids = _service_ids_in_range(db, start, end)
    if not service_ids:
        return empty

    period_child_ids = {
        row[0]
        for row in db.query(Attendance.child_id)
        .filter(Attendance.service_id.in_(service_ids))
        .distinct()
        .all()
    }

    if period == "daily":
        prev_date = _previous_service_date(db, start)
        returning = 0
        first_check_in_ever = 0
        retention_rate = None
        retention_note = None

        if prev_date:
            prev_children = _children_at_service(db, prev_date)
            returning = len(period_child_ids & prev_children)
            if prev_children:
                retention_rate = round(returning / len(prev_children) * 100, 1)
            retention_note = f"Compared to previous service on {prev_date.strftime('%b %d, %Y')}"
        else:
            retention_note = "No prior service to compare against"

        for child_id in period_child_ids:
            has_prior = (
                db.query(Attendance.id)
                .join(Service)
                .filter(
                    Attendance.child_id == child_id,
                    Service.service_date < start,
                )
                .first()
            )
            if not has_prior:
                first_check_in_ever += 1
    else:
        first_check_in_ever = 0
        returning = 0
        for child_id in period_child_ids:
            has_prior = (
                db.query(Attendance.id)
                .join(Service)
                .filter(
                    Attendance.child_id == child_id,
                    Service.service_date < start,
                )
                .first()
            )
            if has_prior:
                returning += 1
            else:
                first_check_in_ever += 1

        retention_rate = None
        retention_note = None
        if period in ("monthly", "quarterly", "yearly"):
            prev_start, prev_end = _previous_period_range(period, start, end)
            prev_service_ids = _service_ids_in_range(db, prev_start, prev_end)
            if prev_service_ids:
                prev_children = {
                    row[0]
                    for row in db.query(Attendance.child_id)
                    .filter(Attendance.service_id.in_(prev_service_ids))
                    .distinct()
                    .all()
                }
                if prev_children:
                    retained = len(prev_children & period_child_ids)
                    retention_rate = round(retained / len(prev_children) * 100, 1)
                    retention_note = f"Compared to previous {period} period"

    total_attendance = (
        db.query(Attendance).filter(Attendance.service_id.in_(service_ids)).count()
    )

    return {
        "returning_count": returning,
        "first_check_in_ever_count": first_check_in_ever,
        "retention_rate_pct": retention_rate,
        "period_attendance_total": total_attendance,
        "unique_children_present": len(period_child_ids),
        "retention_note": retention_note,
    }


def _previous_period_range(period: str, start: date, end: date) -> tuple[date, date]:
    if period == "monthly":
        prev_end = start - timedelta(days=1)
        return prev_end.replace(day=1), prev_end
    if period == "quarterly":
        prev_end = start - timedelta(days=1)
        q_start_month = ((prev_end.month - 1) // 3) * 3 + 1
        return prev_end.replace(month=q_start_month, day=1), prev_end
    if period == "yearly":
        prev_year = end.year - 1
        return date(prev_year, 1, 1), date(prev_year, 12, 31)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - (end - start)
    return prev_start, prev_end


def _class_breakdown_present(db: Session, service_ids: list) -> list[dict]:
    if not service_ids:
        return []

    classes = db.query(Class).order_by(Class.min_age).all()
    breakdown: list[dict] = []
    for cls in classes:
        registered = (
            db.query(Child).filter(Child.class_id == cls.id, Child.is_active.is_(True)).count()
        )
        present = (
            db.query(Attendance)
            .join(Child)
            .filter(
                Attendance.service_id.in_(service_ids),
                Child.class_id == cls.id,
            )
            .count()
        )
        breakdown.append(
            {
                "class_name": cls.name,
                "present": present,
                "registered": registered,
            }
        )
    return breakdown


def _workers_on_duty(db: Session, service_ids: list) -> list[dict]:
    if not service_ids:
        return []
    records = (
        db.query(WorkerAttendance)
        .options(joinedload(WorkerAttendance.worker), joinedload(WorkerAttendance.service))
        .filter(WorkerAttendance.service_id.in_(service_ids))
        .order_by(WorkerAttendance.check_in_time.asc())
        .all()
    )
    return [
        {
            "worker_name": r.worker.full_name,
            "check_in": r.check_in_time.strftime("%H:%M"),
            "service_date": r.service.service_date.isoformat(),
        }
        for r in records
    ]


def _attendance_growth(
    db: Session, period: str, start: date, end: date, current_count: int
) -> dict:
    """Compare attendance to a sensible baseline; omit pct when baseline is too small."""
    if period == "daily":
        prev_date = _previous_service_date(db, start)
        if not prev_date:
            return {
                "attendance_growth_pct": None,
                "attendance_growth_vs": None,
                "attendance_growth_note": "No previous service to compare",
            }
        prev_count = _attendance_count_for_dates(db, prev_date, prev_date)
        vs_label = f"previous service ({prev_date.strftime('%b %d, %Y')})"
    else:
        prev_start, prev_end = _previous_period_range(period, start, end)
        prev_count = _attendance_count_for_dates(db, prev_start, prev_end)
        if not prev_count:
            return {
                "attendance_growth_pct": None,
                "attendance_growth_vs": None,
                "attendance_growth_note": "No attendance data for previous period",
            }
        vs_label = f"previous {period} period"

    if prev_count < MIN_GROWTH_BASELINE:
        return {
            "attendance_growth_pct": None,
            "attendance_growth_vs": vs_label,
            "attendance_growth_note": (
                f"Growth not shown: baseline had only {prev_count} check-ins "
                f"(minimum {MIN_GROWTH_BASELINE} required)"
            ),
        }

    growth = round((current_count - prev_count) / prev_count * 100, 1)
    if abs(growth) > 500:
        return {
            "attendance_growth_pct": None,
            "attendance_growth_vs": vs_label,
            "attendance_growth_note": (
                f"Growth not shown: change from {prev_count} to {current_count} "
                f"check-ins is too large for a meaningful percentage"
            ),
        }

    return {
        "attendance_growth_pct": growth,
        "attendance_growth_vs": vs_label,
        "attendance_growth_note": None,
    }


def build_executive_metrics(
    db: Session,
    period: str = "daily",
    target_date: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    target = target_date or date.today()
    start, end = resolve_period_range(period, target, start_date, end_date)
    period_service_ids = _service_ids_in_range(db, start, end)

    stats = get_dashboard_stats(db, end if period == "daily" else target)
    chart_period = "weekly" if period in ("daily", "weekly") else "monthly"
    if period in ("quarterly", "yearly"):
        chart_period = "yearly" if period == "yearly" else "monthly"
    charts = get_dashboard_charts(db, chart_period, end)

    service = db.query(Service).filter(Service.service_date == end).first()
    service_name = service.service_name if service else "No service scheduled"

    retention = _retention_metrics(db, period, start, end)
    absent_list = get_children_absent_two_services(db, end)
    class_breakdown = _class_breakdown_present(db, period_service_ids)
    workers = _workers_on_duty(db, period_service_ids)

    children_present = retention["unique_children_present"]
    if period == "daily":
        children_present = stats["children_present_today"]
    if period == "daily":
        workers_present = stats["workers_present_today"]
    else:
        workers_present = len({w["worker_name"] for w in workers})

    total_registered = stats["total_children"]
    check_in_rate = round(children_present / total_registered * 100, 1) if total_registered else 0.0
    checkout_done = stats["already_checked_out"] if period == "daily" else None
    checkout_rate = None
    if period == "daily" and children_present > 0 and checkout_done is not None:
        checkout_rate = round(checkout_done / children_present * 100, 1)

    worker_ratio = None
    if children_present > 0 and workers_present > 0:
        worker_ratio = round(children_present / workers_present, 1)

    growth = _attendance_growth(
        db, period, start, end, retention["period_attendance_total"]
    )

    return {
        "report_period": period,
        "period_label": _period_label(period, start, end),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "service_name": service_name,
        "kpis": {
            "registered_children": total_registered,
            "children_present": children_present,
            "workers_present": workers_present,
            "new_registrations_this_month": stats["new_children_this_month"],
            "average_weekly_attendance": stats["average_weekly_attendance"],
            "check_in_rate_pct": check_in_rate,
            "check_out_completion_pct": checkout_rate,
            "currently_checked_in": stats["currently_checked_in"] if period == "daily" else None,
            "attendance_growth_pct": growth["attendance_growth_pct"],
            "attendance_growth_vs": growth["attendance_growth_vs"],
            "attendance_growth_note": growth["attendance_growth_note"],
            "worker_to_child_ratio": worker_ratio,
        },
        "retention": retention,
        "class_breakdown": class_breakdown,
        "workers_on_duty": workers,
        "absent_two_services": absent_list,
        "absent_two_services_count": len(absent_list),
        "charts": {
            "attendance_trend": charts["attendance_trend"],
            "class_distribution": charts["class_distribution"],
            "worker_trend": charts["worker_attendance_trend"],
        },
    }


def metrics_for_ai(metrics: dict) -> dict:
    """Strip PII before sending to an external LLM."""
    retention = metrics["retention"]
    kpis = metrics["kpis"]
    period = metrics["report_period"]

    returning_label = (
        "returned_from_previous_service"
        if period == "daily"
        else "returning_children_with_prior_attendance"
    )

    return {
        "report_period": period,
        "period_label": metrics["period_label"],
        "service_name": metrics["service_name"],
        "metric_definitions": {
            "registered_children": "Total active children in the database (not event registration)",
            "children_present": "Children checked in during this period",
            "check_in_rate_pct": "children_present / registered_children",
            returning_label: retention["returning_count"],
            "first_check_in_ever_count": (
                "Children whose very first check-in ever was during this period "
                "(NOT the same as first-time church visitors)"
            ),
            "retention_rate_pct": (
                retention["retention_note"]
                or "Percentage of previous-period attendees who also attended this period"
            ),
            "attendance_growth_pct": (
                "Only present when baseline is reliable; otherwise see attendance_growth_note"
            ),
        },
        "kpis": kpis,
        "retention": {
            "returning_count": retention["returning_count"],
            "returning_label": returning_label,
            "first_check_in_ever_count": retention["first_check_in_ever_count"],
            "retention_rate_pct": retention["retention_rate_pct"],
            "retention_note": retention["retention_note"],
            "unique_children_present": retention["unique_children_present"],
        },
        "class_breakdown": metrics["class_breakdown"],
        "absent_two_services_count": metrics["absent_two_services_count"],
        "workers_on_duty_count": len(metrics["workers_on_duty"]),
        "charts": metrics["charts"],
    }

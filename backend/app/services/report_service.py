import csv
import io
from datetime import date, timedelta

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session, joinedload

from app.models.attendance import Attendance
from app.models.child import Child
from app.models.service import Service
from app.models.worker_attendance import WorkerAttendance


def _get_date_range(report_type: str, start_date: date | None, end_date: date | None) -> tuple[date, date]:
    today = date.today()
    if start_date and end_date:
        return start_date, end_date
    if report_type == "daily":
        return today, today
    if report_type == "weekly":
        week_start = today - timedelta(days=today.weekday())
        return week_start, week_start + timedelta(days=6)
    if report_type == "monthly":
        month_start = today.replace(day=1)
        return month_start, today
    return today, today


def get_attendance_report(
    db: Session,
    report_type: str = "daily",
    start_date: date | None = None,
    end_date: date | None = None,
    class_id: str | None = None,
) -> list[dict]:
    start, end = _get_date_range(report_type, start_date, end_date)
    services = (
        db.query(Service)
        .filter(Service.service_date >= start, Service.service_date <= end)
        .all()
    )
    service_ids = [s.id for s in services]
    if not service_ids:
        return []

    query = (
        db.query(Attendance)
        .join(Child)
        .options(
            joinedload(Attendance.child).joinedload(Child.parent),
            joinedload(Attendance.child).joinedload(Child.class_),
            joinedload(Attendance.service),
        )
        .filter(Attendance.service_id.in_(service_ids))
    )
    if class_id:
        query = query.filter(Child.class_id == class_id)

    records = query.order_by(Attendance.check_in_time.desc()).all()
    return [
        {
            "date": r.service.service_date.isoformat(),
            "service": r.service.service_name,
            "child_code": r.child.child_code,
            "child_name": r.child.full_name,
            "class_name": r.child.class_.name,
            "parent_name": r.child.parent.full_name,
            "tag_number": r.tag_number,
            "check_in": r.check_in_time.isoformat(),
            "check_out": r.check_out_time.isoformat() if r.check_out_time else "",
            "checked_out": "Yes" if r.checked_out else "No",
            "notes": r.notes or "",
        }
        for r in records
    ]


def get_worker_attendance_report(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    start, end = _get_date_range("weekly", start_date, end_date)
    services = (
        db.query(Service)
        .filter(Service.service_date >= start, Service.service_date <= end)
        .all()
    )
    service_ids = [s.id for s in services]
    if not service_ids:
        return []

    records = (
        db.query(WorkerAttendance)
        .options(joinedload(WorkerAttendance.worker), joinedload(WorkerAttendance.service))
        .filter(WorkerAttendance.service_id.in_(service_ids))
        .order_by(WorkerAttendance.check_in_time.desc())
        .all()
    )
    return [
        {
            "date": r.service.service_date.isoformat(),
            "service": r.service.service_name,
            "worker_name": r.worker.full_name,
            "check_in": r.check_in_time.isoformat(),
        }
        for r in records
    ]


def get_child_attendance_history(db: Session, child_id: str) -> list[dict]:
    records = (
        db.query(Attendance)
        .join(Service)
        .options(joinedload(Attendance.service))
        .filter(Attendance.child_id == child_id)
        .order_by(Attendance.check_in_time.desc())
        .all()
    )
    return [
        {
            "date": r.service.service_date.isoformat(),
            "service": r.service.service_name,
            "tag_number": r.tag_number,
            "check_in": r.check_in_time.isoformat(),
            "check_out": r.check_out_time.isoformat() if r.check_out_time else "",
            "checked_out": "Yes" if r.checked_out else "No",
            "notes": r.notes or "",
        }
        for r in records
    ]


def export_csv(data: list[dict]) -> bytes:
    if not data:
        return b""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    return output.getvalue().encode("utf-8")


def export_excel(data: list[dict], sheet_name: str = "Report") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    if data:
        headers = list(data[0].keys())
        ws.append(headers)
        for row in data:
            ws.append([row.get(h, "") for h in headers])
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def export_pdf(data: list[dict], title: str = "VKMS Report") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

    if data:
        headers = list(data[0].keys())
        table_data = [headers] + [[str(row.get(h, "")) for h in headers] for row in data]
        table = Table(table_data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a0a0a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFFBEB")]),
                ]
            )
        )
        elements.append(table)

    doc.build(elements)
    return buffer.getvalue()

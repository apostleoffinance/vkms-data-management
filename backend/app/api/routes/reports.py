from datetime import date

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.core.deps import DbSession, VerifiedUser
from app.services.report_service import (
    export_csv,
    export_excel,
    export_pdf,
    get_attendance_report,
    get_child_attendance_history,
    get_worker_attendance_report,
)

router = APIRouter()


@router.get("/attendance")
def attendance_report(
    db: DbSession,
    current_user: VerifiedUser,
    report_type: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    class_id: str | None = Query(default=None),
) -> list[dict]:
    return get_attendance_report(db, report_type, start_date, end_date, class_id)


@router.get("/worker-attendance")
def worker_attendance_report(
    db: DbSession,
    current_user: VerifiedUser,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> list[dict]:
    return get_worker_attendance_report(db, start_date, end_date)


@router.get("/child/{child_id}")
def child_attendance_report(
    child_id: str,
    db: DbSession,
    current_user: VerifiedUser,
) -> list[dict]:
    return get_child_attendance_history(db, child_id)


@router.get("/export")
def export_report(
    db: DbSession,
    current_user: VerifiedUser,
    report_type: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    format: str = Query(default="csv", pattern="^(csv|excel|pdf)$"),
    report: str = Query(default="attendance", pattern="^(attendance|worker)$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    class_id: str | None = Query(default=None),
) -> Response:
    if report == "worker":
        data = get_worker_attendance_report(db, start_date, end_date)
        filename = f"worker_attendance_{report_type}"
    else:
        data = get_attendance_report(db, report_type, start_date, end_date, class_id)
        filename = f"attendance_{report_type}"

    if format == "excel":
        content = export_excel(data, sheet_name=report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename += ".xlsx"
    elif format == "pdf":
        content = export_pdf(data, title=f"VKMS {report.title()} Report")
        media_type = "application/pdf"
        filename += ".pdf"
    else:
        content = export_csv(data)
        media_type = "text/csv"
        filename += ".csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

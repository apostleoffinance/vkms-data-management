from datetime import date

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.core.deps import DbSession, VerifiedUser
from app.services.ai_summary_service import generate_executive_summary
from app.services.analytics_service import build_executive_metrics, metrics_for_ai
from app.services.executive_report_service import generate_executive_report_pdf
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


@router.get("/executive")
def executive_report_preview(
    db: DbSession,
    current_user: VerifiedUser,
    period: str = Query(
        default="daily",
        pattern="^(daily|weekly|monthly|quarterly|yearly)$",
    ),
    target_date: date | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> dict:
    metrics = build_executive_metrics(db, period, target_date, start_date, end_date)
    ai_metrics = metrics_for_ai(metrics)
    summary = generate_executive_summary(ai_metrics)
    return {
        "metrics": metrics,
        "summary": summary,
    }


@router.get("/executive/export")
def executive_report_export(
    db: DbSession,
    current_user: VerifiedUser,
    period: str = Query(
        default="daily",
        pattern="^(daily|weekly|monthly|quarterly|yearly)$",
    ),
    target_date: date | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> Response:
    content = generate_executive_report_pdf(db, period, target_date, start_date, end_date)
    label = (target_date or date.today()).isoformat()
    filename = f"vkms_executive_report_{period}_{label}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

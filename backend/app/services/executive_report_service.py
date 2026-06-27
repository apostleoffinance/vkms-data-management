import io
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.ai_summary_service import generate_executive_summary
from app.services.analytics_service import build_executive_metrics, metrics_for_ai


def _chart_image(labels: list[str], values: list[int], title: str, color: str = "#F59E0B") -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(6, 2.5))
    ax.bar(labels, values, color=color, edgecolor="#0a0a0a", linewidth=0.5)
    ax.set_title(title, fontsize=10, fontweight="bold")
    ax.tick_params(axis="x", labelrotation=45, labelsize=7)
    ax.tick_params(axis="y", labelsize=7)
    fig.tight_layout()
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=120, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return buffer


def _bullet_list(items: list[str], style: ParagraphStyle) -> list:
    elements = []
    for item in items:
        elements.append(Paragraph(f"• {item}", style))
        elements.append(Spacer(1, 4))
    return elements


def _kpi_table(kpis: dict[str, Any]) -> Table:
    rows = [
        ["Registered Children", str(kpis.get("registered_children", 0))],
        ["Children Present", str(kpis.get("children_present", 0))],
        ["Workers Present", str(kpis.get("workers_present", 0))],
        ["Check-in Rate", f"{kpis.get('check_in_rate_pct', 0)}%"],
        ["New Registrations (Month)", str(kpis.get("new_registrations_this_month", 0))],
        ["Avg Weekly Attendance", str(kpis.get("average_weekly_attendance", 0))],
    ]
    if kpis.get("check_out_completion_pct") is not None:
        rows.append(["Check-out Completion", f"{kpis['check_out_completion_pct']}%"])
    if kpis.get("attendance_growth_pct") is not None:
        vs = kpis.get("attendance_growth_vs", "")
        rows.append(["Attendance Growth", f"{kpis['attendance_growth_pct']}% vs {vs}"])
    elif kpis.get("attendance_growth_note"):
        rows.append(["Attendance Growth", kpis["attendance_growth_note"]])
    if kpis.get("worker_to_child_ratio") is not None:
        rows.append(["Children per Worker", str(kpis["worker_to_child_ratio"])])

    table = Table(rows, colWidths=[3.5 * inch, 2 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFBEB")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ]
        )
    )
    return table


def generate_executive_report_pdf(
    db,
    period: str = "daily",
    target_date=None,
    start_date=None,
    end_date=None,
) -> bytes:
    metrics = build_executive_metrics(db, period, target_date, start_date, end_date)
    ai_input = metrics_for_ai(metrics)
    summary = generate_executive_summary(ai_input)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=20,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors.HexColor("#666666"),
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=8,
        textColor=colors.HexColor("#0a0a0a"),
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        spaceAfter=6,
    )

    elements = [
        Paragraph("Votage Kids", title_style),
        Paragraph("Executive Ministry Report", subtitle_style),
        Paragraph(metrics["period_label"], subtitle_style),
        Paragraph(f"Service: {metrics['service_name']}", body_style),
        Spacer(1, 8),
        Paragraph("Executive Summary", heading_style),
        Paragraph(summary["executive_summary"], body_style),
        Spacer(1, 6),
        Paragraph("KPI Summary", heading_style),
        _kpi_table(metrics["kpis"]),
        Spacer(1, 10),
    ]

    retention = metrics["retention"]
    is_daily = metrics["report_period"] == "daily"
    returning_label = (
        "Returned From Previous Service" if is_daily else "Returning Children"
    )
    retention_rows = [
        [returning_label, str(retention["returning_count"])],
        ["First Check-in Ever (System)", str(retention["first_check_in_ever_count"])],
        ["Unique Children Present", str(retention["unique_children_present"])],
    ]
    if retention["retention_rate_pct"] is not None:
        note = retention.get("retention_note") or ""
        retention_rows.append(
            ["Retention Rate", f"{retention['retention_rate_pct']}% ({note})"]
        )
    elif retention.get("retention_note"):
        retention_rows.append(["Retention Note", retention["retention_note"]])
    ret_table = Table(retention_rows, colWidths=[3.5 * inch, 2 * inch])
    ret_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    elements.extend([Paragraph("Retention Analysis", heading_style), ret_table, Spacer(1, 10)])

    trend = metrics["charts"]["attendance_trend"]
    if trend and any(p["value"] for p in trend):
        labels = [p["label"] for p in trend]
        values = [p["value"] for p in trend]
        img_buf = _chart_image(labels, values, "Attendance Trend")
        elements.extend(
            [
                Paragraph("Attendance Trend", heading_style),
                Image(img_buf, width=5.5 * inch, height=2.2 * inch),
                Spacer(1, 10),
            ]
        )

    class_dist = metrics["charts"]["class_distribution"]
    if class_dist:
        labels = [p["label"] for p in class_dist]
        values = [p["value"] for p in class_dist]
        img_buf = _chart_image(labels, values, "Registered Children by Class", "#10B981")
        elements.extend(
            [
                Paragraph("Class Distribution (Registered)", heading_style),
                Image(img_buf, width=5.5 * inch, height=2.2 * inch),
                Spacer(1, 10),
            ]
        )

    if metrics["class_breakdown"]:
        elements.append(Paragraph("Class Attendance Breakdown", heading_style))
        cb_rows = [["Class", "Present", "Registered"]]
        cb_rows.extend(
            [[r["class_name"], str(r["present"]), str(r["registered"])] for r in metrics["class_breakdown"]]
        )
        cb_table = Table(cb_rows, colWidths=[2.5 * inch, 1.5 * inch, 1.5 * inch], repeatRows=1)
        cb_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a0a0a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ]
            )
        )
        elements.extend([cb_table, Spacer(1, 10)])

    if metrics["workers_on_duty"]:
        elements.append(Paragraph("Workers on Duty", heading_style))
        w_rows = [["Worker", "Check-in", "Date"]]
        w_rows.extend(
            [
                [w["worker_name"], w["check_in"], w["service_date"]]
                for w in metrics["workers_on_duty"]
            ]
        )
        w_table = Table(w_rows, colWidths=[2.5 * inch, 1.2 * inch, 1.8 * inch], repeatRows=1)
        w_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a0a0a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ]
            )
        )
        elements.extend([w_table, Spacer(1, 10)])

    absent = metrics["absent_two_services"]
    elements.append(
        Paragraph(
            f"Follow-up: Absent 2+ Consecutive Services ({len(absent)})",
            heading_style,
        )
    )
    if absent:
        a_rows = [["Child", "Class", "Parent", "Phone", "Last Attendance"]]
        a_rows.extend(
            [
                [
                    r["child_name"],
                    r["class_name"],
                    r["parent_name"],
                    r["phone"],
                    r["last_attendance"],
                ]
                for r in absent
            ]
        )
        a_table = Table(
            a_rows,
            colWidths=[1.3 * inch, 0.9 * inch, 1.2 * inch, 1.0 * inch, 1.1 * inch],
            repeatRows=1,
        )
        a_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DC2626")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTSIZE", (0, 0), (-1, -1), 7),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FEF2F2")]),
                ]
            )
        )
        elements.append(a_table)
    else:
        elements.append(Paragraph("No children require follow-up at this time.", body_style))

    elements.extend([Spacer(1, 10), Paragraph("Key Insights", heading_style)])
    elements.extend(_bullet_list(summary["key_insights"], body_style))
    elements.extend([Paragraph("Recommendations", heading_style)])
    elements.extend(_bullet_list(summary["recommendations"], body_style))

    doc.build(elements)
    return buffer.getvalue()

import json
import logging
import re

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


def _fallback_summary(metrics: dict) -> dict:
    kpis = metrics.get("kpis", {})
    retention = metrics.get("retention", {})
    period = metrics.get("period_label", "this period")
    present = kpis.get("children_present", 0)
    workers = kpis.get("workers_present", 0)
    absent_count = metrics.get("absent_two_services_count", 0)
    growth = kpis.get("attendance_growth_pct")
    growth_text = f" Attendance changed by {growth}% compared to the previous period." if growth is not None else ""

    return {
        "executive_summary": (
            f"This report covers {period}. {present} children were present with "
            f"{workers} workers on duty.{growth_text} "
            f"{retention.get('first_time_visitors', 0)} first-time visitors were recorded, "
            f"and {absent_count} children have been absent for the last two services and may "
            f"need follow-up."
        ),
        "key_insights": [
            f"{present} children attended during {period}.",
            f"Worker-to-child ratio: 1:{kpis.get('worker_to_child_ratio', 'N/A')}.",
            f"{retention.get('returning_count', 0)} returning children in this period.",
            f"{absent_count} children absent for 2+ consecutive services.",
        ],
        "recommendations": [
            "Follow up with families of absent children listed in this report.",
            "Review worker staffing against attendance levels.",
            "Celebrate and welcome first-time visitors.",
        ],
    }


def _parse_json_response(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    return None


def generate_executive_summary(metrics: dict) -> dict:
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY not set; using template summary")
        return _fallback_summary(metrics)

    prompt = f"""You are writing an executive ministry report for Votage Kids children's church.

Based on the metrics below, write a warm, professional report for pastors and ministry leaders.

Return ONLY valid JSON with these keys:
- "executive_summary": string, 2-3 paragraphs
- "key_insights": array of 3-5 short bullet strings
- "recommendations": array of 3-5 actionable bullet strings

Do not invent numbers. Use only the data provided. Do not include personal contact details.

Metrics:
{json.dumps(metrics, indent=2)}
"""

    url = GEMINI_API_URL.format(model=settings.GEMINI_MODEL)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            parsed = _parse_json_response(text)
            if parsed and all(k in parsed for k in ("executive_summary", "key_insights", "recommendations")):
                return parsed
            logger.warning("Gemini returned unexpected shape; using fallback")
    except Exception:
        logger.exception("Gemini API call failed; using fallback")

    return _fallback_summary(metrics)

import json
import logging
import re

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

AI_INSTRUCTIONS = """
Important rules:
- Use ONLY numbers from the metrics JSON. Do not invent or extrapolate.
- "registered_children" is total active children in the database, NOT event registration.
- "first_check_in_ever_count" means first time checked in on VKMS — NOT first-time church visitors.
- If attendance_growth_pct is null, do NOT mention growth percentages; refer to attendance_growth_note instead.
- Never describe growth above 100% as "astounding" or "remarkable" unless attendance_growth_pct is provided and reasonable.
- If retention_rate_pct is null, do NOT mention a retention percentage.
- Be warm and professional, but factual and restrained.
- Never include personal names, phone numbers, or other identifying details about children, parents, or workers.
"""


def _fallback_summary(metrics: dict) -> dict:
    kpis = metrics.get("kpis", {})
    retention = metrics.get("retention", {})
    period = metrics.get("period_label", "this period")
    present = kpis.get("children_present", 0)
    workers = kpis.get("workers_present", 0)
    absent_count = metrics.get("absent_two_services_count", 0)
    growth = kpis.get("attendance_growth_pct")
    growth_vs = kpis.get("attendance_growth_vs")
    growth_note = kpis.get("attendance_growth_note")

    if growth is not None and growth_vs:
        growth_text = f" Attendance changed by {growth}% vs {growth_vs}."
    elif growth_note:
        growth_text = f" {growth_note}."
    else:
        growth_text = ""

    returning_label = retention.get("returning_label", "returning_count")
    returning = retention.get("returning_count", 0)
    first_check_in = retention.get("first_check_in_ever_count", 0)
    retention_rate = retention.get("retention_rate_pct")
    retention_note = retention.get("retention_note") or ""

    retention_text = ""
    if retention_rate is not None:
        retention_text = f" Retention rate: {retention_rate}% ({retention_note})."

    return {
        "executive_summary": (
            f"This report covers {period}. {present} children were present with "
            f"{workers} workers on duty.{growth_text}"
            f" {returning} children returned from the previous service period and "
            f"{first_check_in} had their first-ever check-in on the system."
            f"{retention_text} "
            f"{absent_count} children have been absent for the last two services and may "
            f"need follow-up."
        ),
        "key_insights": [
            f"{present} children attended during {period}.",
            f"Worker-to-child ratio: 1:{kpis.get('worker_to_child_ratio', 'N/A')}.",
            f"{returning} {returning_label.replace('_', ' ')}.",
            f"{first_check_in} first-ever system check-ins (not necessarily new visitors).",
            f"{absent_count} children absent for 2+ consecutive services.",
        ],
        "recommendations": [
            "Download follow-up contacts separately and call families of children absent 2+ services.",
            "Review worker staffing against attendance levels.",
            "Welcome children checking in for the first time on the system.",
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

{AI_INSTRUCTIONS}

Return ONLY valid JSON with these keys:
- "executive_summary": string, 2-3 paragraphs
- "key_insights": array of 3-5 short bullet strings
- "recommendations": array of 3-5 actionable bullet strings

Do not include personal contact details.

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

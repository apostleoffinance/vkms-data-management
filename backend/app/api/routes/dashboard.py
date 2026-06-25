from datetime import date

from fastapi import APIRouter, Query

from app.core.deps import DbSession, VerifiedUser
from app.schemas.dashboard import DashboardCharts, DashboardStats
from app.services.child_service import get_dashboard_charts, get_dashboard_stats

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    db: DbSession,
    current_user: VerifiedUser,
    target_date: date | None = Query(default=None),
) -> DashboardStats:
    stats = get_dashboard_stats(db, target_date)
    return DashboardStats(**stats)


@router.get("/charts", response_model=DashboardCharts)
def dashboard_charts(
    db: DbSession,
    current_user: VerifiedUser,
    period: str = Query(default="weekly", pattern="^(weekly|monthly|yearly)$"),
    target_date: date | None = Query(default=None),
) -> DashboardCharts:
    charts = get_dashboard_charts(db, period, target_date)
    return DashboardCharts(**charts)

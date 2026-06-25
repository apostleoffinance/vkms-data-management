from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_children: int
    children_present_today: int
    workers_present_today: int
    new_children_this_month: int
    average_weekly_attendance: float
    currently_checked_in: int
    already_checked_out: int


class ChartDataPoint(BaseModel):
    label: str
    value: int


class DashboardCharts(BaseModel):
    attendance_trend: list[ChartDataPoint]
    class_distribution: list[ChartDataPoint]
    worker_attendance_trend: list[ChartDataPoint]
    new_registrations_trend: list[ChartDataPoint]

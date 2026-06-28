from fastapi import APIRouter

from app.api.routes import (
    attendance,
    auth,
    authorized_pickups,
    children,
    classes,
    dashboard,
    parents,
    reports,
    services,
    users,
    worker_attendance,
    workers,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(children.router, prefix="/children", tags=["Children"])
api_router.include_router(classes.router, prefix="/classes", tags=["Classes"])
api_router.include_router(parents.router, prefix="/parents", tags=["Parents"])
api_router.include_router(services.router, prefix="/services", tags=["Services"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
api_router.include_router(
    authorized_pickups.router, prefix="/authorized-pickups", tags=["Authorized Pickup"]
)
api_router.include_router(workers.router, prefix="/workers", tags=["Workers"])
api_router.include_router(worker_attendance.router, prefix="/worker-attendance", tags=["Worker Attendance"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("child_id", "service_id", name="uq_child_service_attendance"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("children.id"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), nullable=False, index=True
    )
    tag_number: Mapped[str] = mapped_column(String(10), nullable=False)
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checked_out_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child = relationship("Child", back_populates="attendance_records")
    service = relationship("Service", back_populates="attendance_records")
    checked_out_by_user = relationship("User", foreign_keys=[checked_out_by])

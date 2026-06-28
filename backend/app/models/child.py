import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import pg_enum


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Child(Base):
    __tablename__ = "children"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    gender: Mapped[Gender] = mapped_column(pg_enum(Gender, "gender"), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parents.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    medical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    qr_code_data: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    parent = relationship("Parent", back_populates="children")
    class_ = relationship("Class", back_populates="children")
    attendance_records = relationship("Attendance", back_populates="child")
    authorized_pickup_contacts = relationship(
        "AuthorizedPickupContact", back_populates="child", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

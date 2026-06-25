import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_age: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_age: Mapped[int] = mapped_column(Integer, nullable=False, default=18)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    children = relationship("Child", back_populates="class_")

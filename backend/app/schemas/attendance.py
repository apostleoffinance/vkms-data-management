from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ServiceCreate(BaseModel):
    service_name: str = Field(min_length=1, max_length=100)
    service_date: date


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    service_name: str
    service_date: date
    created_at: str


class CheckInRequest(BaseModel):
    child_id: str
    service_id: str | None = None
    dropped_off_contact_id: str
    notes: str | None = None


class CheckOutRequest(BaseModel):
    tag_number: str = Field(min_length=1, max_length=10)
    service_id: str | None = None
    picked_up_contact_id: str


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    child_name: str
    child_code: str
    class_name: str
    parent_name: str
    service_id: str
    tag_number: str
    check_in_time: datetime
    check_out_time: datetime | None
    checked_out: bool
    checked_out_by_name: str | None
    dropped_off_contact_id: str | None = None
    dropped_off_contact_name: str | None = None
    picked_up_contact_id: str | None = None
    picked_up_contact_name: str | None = None
    notes: str | None


class TagPrintResponse(BaseModel):
    tag_number: str
    child_name: str
    class_name: str
    check_in_time: datetime
    child_code: str


class WorkerAttendanceRequest(BaseModel):
    worker_id: str
    service_id: str | None = None


class WorkerAttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    worker_id: str
    worker_name: str
    service_id: str
    check_in_time: datetime

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class KioskServiceResponse(BaseModel):
    id: str
    service_name: str
    service_date: date


class KioskClassOption(BaseModel):
    id: str
    name: str
    min_age: int
    max_age: int


class KioskChildStatus(BaseModel):
    id: str
    child_code: str
    full_name: str
    class_name: str
    checked_in_today: bool
    tag_number: str | None = None
    checked_out: bool = False
    check_in_time: datetime | None = None


class KioskLookupRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=20)


class KioskLookupResponse(BaseModel):
    parent_name: str
    phone: str
    children: list[KioskChildStatus]


class KioskCheckInRequest(BaseModel):
    child_id: str


class KioskRegisterRequest(BaseModel):
    child_first_name: str = Field(min_length=1, max_length=100)
    child_last_name: str = Field(min_length=1, max_length=100)
    gender: str = Field(pattern="^(male|female|other)$")
    date_of_birth: date
    parent_first_name: str = Field(min_length=1, max_length=100)
    parent_last_name: str = Field(min_length=1, max_length=100)
    parent_phone: str = Field(min_length=7, max_length=20)
    parent_email: EmailStr | None = None
    medical_notes: str | None = None


class KioskChildPreview(BaseModel):
    child: KioskChildStatus
    service_name: str


class KioskTagResponse(BaseModel):
    tag_number: str
    child_name: str
    class_name: str
    child_code: str
    check_in_time: datetime
    service_name: str
    already_checked_in: bool = False

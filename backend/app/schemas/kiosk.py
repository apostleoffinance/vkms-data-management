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
    ready_for_pickup: bool = False


class KioskLookupRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=20)


class KioskLookupResponse(BaseModel):
    parent_name: str
    phone: str
    children: list[KioskChildStatus]


class KioskCheckInRequest(BaseModel):
    child_id: str
    phone: str = Field(min_length=7, max_length=20)
    photo_base64: str | None = None


class KioskPickupPerson(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=20)
    relationship: str = Field(default="Guardian", min_length=1, max_length=50)
    photo_base64: str = Field(min_length=10)


class KioskRegisterRequest(BaseModel):
    child_first_name: str = Field(min_length=1, max_length=100)
    child_last_name: str = Field(min_length=1, max_length=100)
    gender: str = Field(pattern="^(male|female|other)$")
    date_of_birth: date
    parent_first_name: str = Field(min_length=1, max_length=100)
    parent_last_name: str = Field(min_length=1, max_length=100)
    parent_phone: str = Field(min_length=7, max_length=20)
    parent_email: EmailStr | None = None
    parent_photo_base64: str = Field(min_length=10)
    medical_notes: str | None = None
    additional_pickup: KioskPickupPerson | None = None


class KioskAddPickupRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=20)
    child_id: str
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    contact_phone: str = Field(min_length=7, max_length=20)
    relationship: str = Field(default="Guardian", min_length=1, max_length=50)
    photo_base64: str = Field(min_length=10)


class KioskPickupContactOption(BaseModel):
    id: str
    full_name: str
    relationship: str
    has_photo: bool


class KioskCheckOutRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=20)
    child_id: str
    picked_up_contact_id: str
    photo_base64: str | None = None


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


class KioskCheckOutResponse(BaseModel):
    child_name: str
    tag_number: str
    class_name: str
    pickup_person_name: str
    check_out_time: datetime
    service_name: str
    already_checked_out: bool = False

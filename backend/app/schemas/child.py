from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.authorized_pickup import AuthorizedPickupCreate


class ParentBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=20)
    alternative_phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    address: str | None = None


class ParentResponse(ParentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: str


class ClassBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    min_age: int = Field(ge=0, le=25)
    max_age: int = Field(ge=0, le=25)


class ClassCreate(ClassBase):
    pass


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    min_age: int | None = Field(default=None, ge=0, le=25)
    max_age: int | None = Field(default=None, ge=0, le=25)


class ClassResponse(ClassBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: str


class ChildCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    gender: str = Field(pattern="^(male|female|other)$")
    date_of_birth: date
    class_id: str
    parent_first_name: str = Field(min_length=1, max_length=100)
    parent_last_name: str = Field(min_length=1, max_length=100)
    parent_phone: str = Field(min_length=7, max_length=20)
    parent_alternative_phone: str | None = Field(default=None, max_length=20)
    parent_email: EmailStr | None = None
    parent_address: str | None = None
    parent_id: str | None = None
    medical_notes: str | None = None
    authorized_pickups: list[AuthorizedPickupCreate] | None = None


class ChildUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    gender: str | None = Field(default=None, pattern="^(male|female|other)$")
    date_of_birth: date | None = None
    class_id: str | None = None
    medical_notes: str | None = None
    is_active: bool | None = None


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_code: str
    first_name: str
    last_name: str
    gender: str
    date_of_birth: date
    parent_id: str
    class_id: str
    medical_notes: str | None
    registration_date: date
    is_active: bool
    qr_code_data: str | None
    created_at: str
    updated_at: str
    parent_linked: bool = False


class ChildDetailResponse(ChildResponse):
    parent: ParentResponse
    class_name: str
    total_visits: int
    last_attendance_date: str | None
    current_status: str
    today_tag_number: str | None = None
    today_service_name: str | None = None


class ParentLookupChild(BaseModel):
    id: str
    child_code: str
    full_name: str
    class_name: str
    is_active: bool


class ParentLookupResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    phone: str
    alternative_phone: str | None
    email: str | None
    address: str | None
    children: list[ParentLookupChild]


class ChildSearchResult(BaseModel):
    id: str
    child_code: str
    first_name: str
    last_name: str
    class_name: str
    parent_name: str
    parent_phone: str
    is_active: bool
    pickup_contact_count: int = 0
    pickup_photo_count: int = 0
    has_pickup_photo: bool = False

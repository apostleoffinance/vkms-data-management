from pydantic import BaseModel, ConfigDict, Field


class AuthorizedPickupCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=20)
    relationship: str = Field(default="Parent", min_length=1, max_length=50)
    is_primary: bool = False
    photo_base64: str | None = None


class AuthorizedPickupUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    relationship: str | None = Field(default=None, min_length=1, max_length=50)
    is_primary: bool | None = None


class AuthorizedPickupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    first_name: str
    last_name: str
    full_name: str
    phone: str
    relationship: str
    is_primary: bool
    has_photo: bool
    created_at: str
    updated_at: str

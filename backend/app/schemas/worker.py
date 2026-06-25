from pydantic import BaseModel, ConfigDict, Field


class WorkerCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)


class WorkerUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class WorkerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: str
    phone: str | None
    is_active: bool
    created_at: str

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

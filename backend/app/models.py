from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field

from .security import MAX_PASSWORD_BYTES

# Mongo's ObjectId is not a JSON type, so serialise it as a string on the way out.
ObjectIdStr = Annotated[str, BeforeValidator(str)]


def _password_field(**kwargs):
    return Field(min_length=8, max_length=MAX_PASSWORD_BYTES, **kwargs)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = _password_field()
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_BYTES)


class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: ObjectIdStr = Field(validation_alias="_id")
    email: EmailStr
    name: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class EntryValue(BaseModel):
    value: float = Field(ge=0, le=1_000_000)


class EntryDelta(BaseModel):
    delta: float = Field(default=0, ge=-1_000_000, le=1_000_000)


class Entry(BaseModel):
    module: str
    date: date
    value: float


class ModuleProgress(BaseModel):
    key: str
    title: str
    icon: str
    color: str
    unit: str
    target: float
    step: float
    description: str
    value: float
    # Clamped at 1.0 so one overachieving module cannot mask the others.
    ratio: float
    completed: bool


class DailySummary(BaseModel):
    date: date
    score: int
    completed_count: int
    module_count: int
    modules: list[ModuleProgress]

from datetime import date, datetime
from typing import Annotated, Literal

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
    refresh_token: str
    token_type: str = "bearer"
    user: User


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    # Optional: when present, only this device's refresh token is revoked, so a
    # sign-out here doesn't end the user's sessions on other devices.
    refresh_token: str | None = None


class EntryValue(BaseModel):
    value: float = Field(ge=0, le=1_000_000)


class EntryDelta(BaseModel):
    delta: float = Field(default=0, ge=-1_000_000, le=1_000_000)


class Entry(BaseModel):
    module: str
    date: date
    value: float


class BrushSlotUpdate(BaseModel):
    # A brush day has two named slots; the client toggles them individually so
    # "did the morning, skipped the evening" is distinguishable from a bare count.
    slot: Literal["morning", "evening"]
    done: bool = True


class BrushStatus(BaseModel):
    date: date
    morning: bool
    evening: bool
    target: int
    value: int
    complete: bool
    streak: int
    best_streak: int
    next_milestone: int | None
    # Set only on the write that just completed the day and landed on a
    # milestone (7, 30, 100…); the client uses it to fire the confetti.
    milestone: int | None = None
    just_completed: bool = False


Sex = Literal["erkek", "kadin"]
ActivityLevel = Literal["sedanter", "hafif", "orta", "aktif", "cok_aktif"]
WeightGoal = Literal["ver", "koru", "al"]


class SporProfileUpdate(BaseModel):
    height_cm: float | None = Field(default=None, gt=50, le=260)
    sex: Sex | None = None
    activity_level: ActivityLevel | None = None
    goal: WeightGoal | None = None
    target_weight_kg: float | None = Field(default=None, gt=20, le=500)
    # Asya-Pasifik BMI/bel eşiklerini kullan (fazla kilolu ≥23, obez ≥27.5).
    asian_thresholds: bool | None = None


class ParqSubmit(BaseModel):
    # PAR-Q+ kısa tarama: 7 evet/hayır. Herhangi biri evet → hekime danış işareti.
    answers: list[bool] = Field(min_length=7, max_length=7)


class BodyMetricInput(BaseModel):
    weight_kg: float = Field(gt=20, le=500)
    waist_cm: float | None = Field(default=None, gt=30, le=300)


class WorkoutItemInput(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    sets: int | None = Field(default=None, ge=1, le=50)
    reps: int | None = Field(default=None, ge=1, le=500)
    duration_sec: int | None = Field(default=None, ge=1, le=36_000)


class WorkoutInput(BaseModel):
    items: list[WorkoutItemInput] = Field(min_length=1, max_length=40)


class TargetUpdate(BaseModel):
    # Zero would make the completion ratio undefined, so the floor is exclusive.
    target: float = Field(gt=0, le=1_000_000)


class ModuleTarget(BaseModel):
    key: str
    title: str
    unit: str
    target: float
    default_target: float
    is_custom: bool


class ModuleProgress(BaseModel):
    key: str
    title: str
    icon: str
    color: str
    unit: str
    target: float
    default_target: float
    is_custom_target: bool
    step: float
    steps: list[float]
    # En çok dokunulan kademe; arayüzde en büyük alanı o alır.
    favorite_step: float
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


class StoreApp(BaseModel):
    key: str
    title: str
    icon: str
    color: str
    category: str
    description: str
    about: str
    unit: str
    target: float
    installed: bool


class OrderUpdate(BaseModel):
    order: list[str] = Field(min_length=1, max_length=100)


class WeekDay(BaseModel):
    date: date
    score: int
    completed_count: int
    module_count: int
    is_today: bool

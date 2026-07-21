from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, model_validator

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


# --- Okuma / Kütüphane modülü ---
Shelf = Literal["reading", "to_read", "finished"]


class BookInput(BaseModel):
    """Kütüphaneye kitap ekleme. Aramadan/tarayıcıdan gelen alanlar ya da
    tamamen manuel giriş — hiçbir kaynak bulunamadığında kullanıcı en azından
    başlık + (varsa) ISBN girerek kitabını ekleyebilmeli."""

    # Manuel girişte ISBN olmayabilir; olduğunda 13 hane beklenir ama zorlanmaz
    # (kullanıcı elle yazarken hata yapabilir, checksum'ı istemci uyarır).
    isbn13: str | None = Field(default=None, max_length=13)
    isbn10: str | None = Field(default=None, max_length=13)
    title: str = Field(min_length=1, max_length=300)
    subtitle: str | None = Field(default=None, max_length=300)
    authors: list[str] = Field(default_factory=list, max_length=10)
    cover_url: str | None = Field(default=None, max_length=500)
    cover_source: str | None = Field(default=None, max_length=32)
    page_count: int | None = Field(default=None, ge=1, le=50_000)
    published_year: int | None = Field(default=None, ge=0, le=2100)
    publisher: str | None = Field(default=None, max_length=200)
    subjects: list[str] = Field(default_factory=list, max_length=12)
    language: str | None = Field(default=None, max_length=16)
    description: str | None = Field(default=None, max_length=4000)
    source: str | None = Field(default=None, max_length=32)
    shelf: Shelf = "to_read"


class BookUpdate(BaseModel):
    shelf: Shelf | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=4000)
    # Rafı elle değiştirmeden başlama/bitirme tarihini düzeltmek için (opsiyonel).
    started_at: date | None = None
    finished_at: date | None = None


class ReadingSessionInput(BaseModel):
    """Bir okuma oturumu. Süre VEYA sayfa aralığı — ikisinden en az biri zorunlu
    (araştırma §5). Süre günlük puana, sayfa istatistiğe/yıllık hedefe akar."""

    book_key: str | None = Field(default=None, max_length=64)
    duration_min: int | None = Field(default=None, ge=1, le=1440)
    pages_from: int | None = Field(default=None, ge=0, le=50_000)
    pages_to: int | None = Field(default=None, ge=0, le=50_000)

    @model_validator(mode="after")
    def _need_progress(self):
        has_pages = self.pages_from is not None and self.pages_to is not None
        if self.duration_min is None and not has_pages:
            raise ValueError("Süre ya da sayfa aralığından en az biri gerekli")
        if has_pages and self.pages_to < self.pages_from:
            raise ValueError("Bitiş sayfası başlangıçtan küçük olamaz")
        return self


class ReadingGoalUpdate(BaseModel):
    # Yıllık okuma challenge'ı. Araştırma: düşük, ulaşılabilir başlangıç (ör. 12).
    target_books: int | None = Field(default=None, ge=1, le=1000)
    target_pages: int | None = Field(default=None, ge=1, le=1_000_000)


# --- Yemek / Beslenme modülü ---
MealType = Literal["kahvalti", "ogle", "aksam", "atistirma"]
# Fotoğraf/arama/barkod/elle giriş — atıf ve doğruluk izlenebilirliği için (rapor 4).
FoodSource = Literal["local", "openfoodfacts", "usda_fdc", "vision_llm", "manual"]


class NutritionProfileUpdate(BaseModel):
    # Yalnızca `age` beslenmeye özeldir; diğer alanlar spor profiliyle paylaşılır
    # (paylaşarak tekrar sorma). weight_kg verilirse bugünün ölçümü olarak yazılır.
    age: int | None = Field(default=None, ge=10, le=120)
    sex: Sex | None = None
    height_cm: float | None = Field(default=None, gt=50, le=260)
    activity_level: ActivityLevel | None = None
    goal: WeightGoal | None = None
    target_weight_kg: float | None = Field(default=None, gt=20, le=500)
    weight_kg: float | None = Field(default=None, gt=20, le=500)


class MealItemInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    qty_g: float = Field(gt=0, le=5000)
    kcal: float = Field(ge=0, le=20_000)
    protein_g: float = Field(default=0, ge=0, le=2000)
    carb_g: float = Field(default=0, ge=0, le=2000)
    fat_g: float = Field(default=0, ge=0, le=2000)
    source: FoodSource = "manual"
    source_ref: str | None = Field(default=None, max_length=64)
    brand: str | None = Field(default=None, max_length=120)
    barcode: str | None = Field(default=None, max_length=32)
    # Fotoğraf tahmini öğeleri için: puana/güvene izlenebilirlik.
    estimated: bool = False
    confidence: float | None = Field(default=None, ge=0, le=1)


class MealAddInput(BaseModel):
    meal_type: MealType
    items: list[MealItemInput] = Field(min_length=1, max_length=30)


class MealItemPatch(BaseModel):
    # Düzelt-onayla akışı: porsiyon/kalori elle düzeltilebilir.
    meal_type: MealType | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    qty_g: float | None = Field(default=None, gt=0, le=5000)
    kcal: float | None = Field(default=None, ge=0, le=20_000)
    protein_g: float | None = Field(default=None, ge=0, le=2000)
    carb_g: float | None = Field(default=None, ge=0, le=2000)
    fat_g: float | None = Field(default=None, ge=0, le=2000)


class PhotoEstimateInput(BaseModel):
    # KVKK: fotoğraf buluta gider. Açık onay olmadan işlenmez.
    consent: bool = False
    # data URL ya da çıplak base64. Ham fotoğraf SAKLANMAZ (yalnızca hash).
    image_base64: str = Field(min_length=16, max_length=15_000_000)
    note: str | None = Field(default=None, max_length=200)


# --- Genel kullanıcı profili (modüller arası paylaşılan vücut bilgileri) ---
class ProfileUpdate(BaseModel):
    """Kişiye ait, modüllerin TEKRAR sormadığı vücut bilgileri. Paylaşılan alanlar
    spor_profiles'e, yaş nutrition_profiles'e, kilo/bel o günün body_metrics'ine
    yazılır — böylece spor/yemek aynı veriyi okur."""

    age: int | None = Field(default=None, ge=10, le=120)
    sex: Sex | None = None
    height_cm: float | None = Field(default=None, gt=50, le=260)
    activity_level: ActivityLevel | None = None
    goal: WeightGoal | None = None
    target_weight_kg: float | None = Field(default=None, gt=20, le=500)
    asian_thresholds: bool | None = None
    # Verilirse bugünün ölçümü olarak body_metrics'e yazılır (timeline'a düşer).
    weight_kg: float | None = Field(default=None, gt=20, le=500)
    waist_cm: float | None = Field(default=None, gt=30, le=300)


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
    coming_soon: bool = False


class OrderUpdate(BaseModel):
    order: list[str] = Field(min_length=1, max_length=100)


class WeekDay(BaseModel):
    date: date
    score: int
    completed_count: int
    module_count: int
    is_today: bool

"""Egzersiz kütüphanesi ve sağlık sabitleri (spor modülü).

Egzersiz METİN verisi free-exercise-db (Unlicense/kamu malı) + 2024 Adult
Compendium MET değerlerinden türetildi; araştırma raporu docs/features/spor/
report.md. GÖRSELLER telif açısından güvensiz olduğu için bundle'lanmaz —
istemci kategori bazlı kendi vektör ikonunu çizer.

Sağlık eşikleri (BMI, bel çevresi, güvenli kilo verme, WHO aktivite) birincil
kaynaklardan (WHO, CDC, NHS, ACSM) alındı; hepsi GENEL bilgidir, kişiye özel
tıbbi reçete değildir.
"""

import json
from functools import lru_cache
from pathlib import Path

_DATA = Path(__file__).resolve().parent / "data" / "exercises.json"

# Kategori meta: sıralama + istemci için okunur başlık/ikon anahtarı.
CATEGORY_ORDER: tuple[str, ...] = (
    "isinma",
    "kuvvet",
    "kardiyo",
    "denge",
    "esneklik",
    "soguma",
)
CATEGORY_LABELS: dict[str, str] = {
    "isinma": "Isınma",
    "kuvvet": "Kuvvet",
    "kardiyo": "Kardiyo",
    "denge": "Denge",
    "esneklik": "Esneklik",
    "soguma": "Soğuma",
}
DIFFICULTY_LABELS: dict[str, str] = {
    "baslangic": "Başlangıç",
    "orta": "Orta",
    "ileri": "İleri",
}
EQUIPMENT_LABELS: dict[str, str] = {
    "yok": "Ekipmansız",
    "mat": "Mat",
    "sandalye": "Sandalye",
    "dambil": "Dambıl",
    "direnc_bandi": "Direnç bandı",
}


@lru_cache(maxsize=1)
def all_exercises() -> list[dict]:
    data = json.loads(_DATA.read_text(encoding="utf-8"))
    return data


@lru_cache(maxsize=1)
def _by_key() -> dict[str, dict]:
    return {e["key"]: e for e in all_exercises()}


def get_exercise(key: str) -> dict | None:
    return _by_key().get(key)


def filter_exercises(
    *,
    category: str | None = None,
    equipment: str | None = None,
    difficulty: str | None = None,
    low_impact_only: bool = False,
) -> list[dict]:
    result = all_exercises()
    if category:
        result = [e for e in result if e["category"] == category]
    if equipment:
        result = [e for e in result if e["equipment"] == equipment]
    if difficulty:
        result = [e for e in result if e["difficulty"] == difficulty]
    if low_impact_only:
        result = [e for e in result if e["low_impact"]]
    return result


# --- MET / kalori (2024 Adult Compendium) ---
# kcal = MET × kg × saat. Süre verilmeyen (set/tekrar) hareketlerde süre kabaca
# tahmin edilir: her set ≈ tekrar×3 sn iş + 30 sn dinlenme.
def exercise_seconds(exercise: dict, sets: int | None = None, reps: int | None = None,
                     duration_sec: int | None = None) -> int:
    default = exercise.get("default", {})
    if duration_sec is not None:
        return max(0, int(duration_sec))
    if "duration_sec" in default and sets is None and reps is None:
        return int(default["duration_sec"])
    s = int(sets if sets is not None else default.get("sets", 3))
    r = int(reps if reps is not None else default.get("reps", 10))
    return s * (r * 3 + 30)


def item_calories(exercise: dict, seconds: int, weight_kg: float) -> float:
    met = float(exercise.get("met", 3.0))
    return met * weight_kg * (seconds / 3600.0)


# --- Sağlık sabitleri (kaynaklar report.md) ---

# WHO yetişkin BMI eşikleri (kg/m²). (min_dahil, ...) — üst sınır bir sonrakinin altı.
def bmi_category(bmi: float, asian: bool = False) -> str:
    if asian:
        # WHO Asya-Pasifik önerisi: fazla kilolu ≥23, obez ≥27.5.
        if bmi < 18.5:
            return "zayif"
        if bmi < 23:
            return "normal"
        if bmi < 27.5:
            return "fazla_kilolu"
        return "obez"
    if bmi < 18.5:
        return "zayif"
    if bmi < 25:
        return "normal"
    if bmi < 30:
        return "fazla_kilolu"
    if bmi < 35:
        return "obez_1"
    if bmi < 40:
        return "obez_2"
    return "obez_3"


BMI_LABELS: dict[str, str] = {
    "zayif": "Zayıf",
    "normal": "Normal",
    "fazla_kilolu": "Fazla kilolu",
    "obez": "Obez",
    "obez_1": "Obez (Sınıf I)",
    "obez_2": "Obez (Sınıf II)",
    "obez_3": "Obez (Sınıf III)",
}

# Bel çevresi risk eşikleri (cm) — WHO/NIH. (artmis, yuksek)
WAIST_THRESHOLDS = {
    "erkek": (94.0, 102.0),
    "kadin": (80.0, 88.0),
}
WAIST_THRESHOLDS_ASIAN = {
    "erkek": (90.0, 100.0),
    "kadin": (80.0, 90.0),
}


def waist_risk(waist_cm: float, sex: str, asian: bool = False) -> str:
    table = WAIST_THRESHOLDS_ASIAN if asian else WAIST_THRESHOLDS
    thresholds = table.get(sex)
    if not thresholds:
        return "bilinmiyor"
    increased, high = thresholds
    if waist_cm >= high:
        return "yuksek"
    if waist_cm >= increased:
        return "artmis"
    return "dusuk"


# Güvenli kilo verme: haftada 0.5–1 kg (CDC/NHS). Üst sınır uygulanır.
SAFE_WEEKLY_LOSS_MIN_KG = 0.5
SAFE_WEEKLY_LOSS_MAX_KG = 1.0

# WHO haftalık aktivite hedefi (yetişkin 18–64).
WHO_WEEKLY_MODERATE_MIN = 150  # dakika, orta şiddet
WHO_WEEKLY_MODERATE_TARGET = 300  # üst fayda eşiği
WHO_WEEKLY_STRENGTH_DAYS = 2

# Egzersizi DURDUR — kırmızı bayraklar (kaynak: Healthline/Banner/Baptist Health).
RED_FLAGS: tuple[str, ...] = (
    "Göğüs ağrısı, baskı veya sıkışma (kola, çeneye, sırta yayılabilir)",
    "Orantısız/anormal nefes darlığı",
    "Baş dönmesi, bayılacak gibi olma veya denge kaybı",
    "Düzensiz ya da çarpıntılı kalp atışı",
    "Soğuk terleme veya bulantı",
)

# PAR-Q+ temelli kısa ön tarama (herhangi biri "evet" ise hekime danış).
PARQ_QUESTIONS: tuple[str, ...] = (
    "Doktorunuz kalbinizde bir sorun olduğunu ve yalnızca önerilen fiziksel aktiviteyi yapmanız gerektiğini söyledi mi?",
    "Fiziksel aktivite sırasında göğsünüzde ağrı hissediyor musunuz?",
    "Son bir ayda dinlenirken göğüs ağrınız oldu mu?",
    "Baş dönmesi nedeniyle dengenizi kaybediyor veya bayılıyor musunuz?",
    "Fiziksel aktiviteyle kötüleşebilecek bir kemik/eklem sorununuz var mı?",
    "Doktorunuz şu an tansiyon veya kalp için ilaç veriyor mu?",
    "Fiziksel aktivite yapmamanız için başka bir neden biliyor musunuz?",
)

MEDICAL_DISCLAIMER = (
    "Bu içerik kanıta dayalı GENEL bilgidir, kişiye özel tıbbi reçete değildir. "
    "Hareketsizseniz, kronik bir hastalığınız (kalp, diyabet, böbrek), gebeliğiniz "
    "veya belirtileriniz (göğüs ağrısı, nefes darlığı) varsa egzersize başlamadan "
    "önce bir sağlık/spor uzmanına danışın."
)

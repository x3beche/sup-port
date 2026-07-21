"""Beslenme hesapları ve sabitleri (yemek modülü).

Kapsam: günlük kalori/makro hedefi (Mifflin-St Jeor BMR → TDEE → hedefe göre
ayar), GÜVENLİ alt sınırlar (yeme bozukluğu koruması), AMDR makro dağılımı ve
yerel besin tablosu + Open Food Facts eşlemesi. Araştırma raporu
``docs/features/yemek/research.md``.

Tüm eşikler birincil kaynaklardan (Mifflin ve ark. 1990 PMID 2305711, NIH/CDC
kalori tabanları, IOM/DRI AMDR, WHO) alındı; hepsi GENEL bilgidir, kişiye özel
tıbbi/diyet reçetesi değildir (bkz. ``DISCLAIMER``).
"""

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

_DATA = Path(__file__).resolve().parent / "data" / "foods.json"

# --- Öğün türleri ------------------------------------------------------------
# Günlük öğün sayacı (puan) bu türlerden ≥1 öğe içeren farklı türleri sayar.
MEAL_TYPES: tuple[str, ...] = ("kahvalti", "ogle", "aksam", "atistirma")
MEAL_LABELS: dict[str, str] = {
    "kahvalti": "Kahvaltı",
    "ogle": "Öğle",
    "aksam": "Akşam",
    "atistirma": "Atıştırma",
}


def is_meal_type(value: str) -> bool:
    return value in MEAL_LABELS


# --- Aktivite katsayıları (TDEE) --------------------------------------------
# Anahtarlar spor_profiles ile ortak (paylaşılan profil). Katsayılar araştırma
# raporu Başlık 3.2 (Harris-Benedict/Mifflin geleneği).
ACTIVITY_FACTORS: dict[str, float] = {
    "sedanter": 1.2,     # hareketsiz, masa başı
    "hafif": 1.375,      # 1–3 gün/hafta
    "orta": 1.55,        # 3–5 gün/hafta
    "aktif": 1.725,      # 6–7 gün/hafta
    "cok_aktif": 1.9,    # ağır iş / 2x antrenman
}
ACTIVITY_LABELS: dict[str, str] = {
    "sedanter": "Hareketsiz (masa başı)",
    "hafif": "Hafif (1–3 gün/hafta)",
    "orta": "Orta (3–5 gün/hafta)",
    "aktif": "Yüksek (6–7 gün/hafta)",
    "cok_aktif": "Çok yüksek (ağır iş / 2x antrenman)",
}
DEFAULT_ACTIVITY = "hafif"

# --- Hedef ayarı (kcal/gün) --------------------------------------------------
# Güvenli kilo verme: ~500 kcal açık ≈ 0,5 kg/hafta. Açık 500–750'yi aşmasın.
DEFICIT_KCAL = 500
MAX_DEFICIT_KCAL = 750
# Kilo alma: +250 ile +500 arası; orta bir değer.
SURPLUS_KCAL = 300
# 1 kg yağ dokusu ≈ 7700 kcal (haftalık değişim tahmini için).
KCAL_PER_KG = 7700

# --- Güvenli asgari kalori tabanları (NIH/CDC, tıbbi gözetim olmadan) --------
FLOOR_KCAL: dict[str, int] = {"kadin": 1200, "erkek": 1500}

# --- Makro sabitleri (AMDR, IOM/DRI) ----------------------------------------
KCAL_PER_G = {"protein": 4.0, "carb": 4.0, "fat": 9.0}
# AMDR — enerjinin yüzdesi (alt, üst).
AMDR = {
    "carb": (0.45, 0.65),
    "protein": (0.10, 0.35),
    "fat": (0.20, 0.35),
}
# Varsayılan hipokalorik dağılım (rapor 3.4): %50 karb / %20 protein / %30 yağ.
DEFAULT_FAT_RATIO = 0.30
DEFAULT_PROTEIN_RATIO = 0.20
# Kilo verirken kas korumak için protein üst banda: ~1,8 g/kg (1,6–2,2 aralığı).
PROTEIN_G_PER_KG_CUT = 1.8

DISCLAIMER = (
    "Bu bilgiler kanıta dayalı GENEL önerilerdir, kişiye özel diyet reçetesi "
    "değildir. Kronik bir hastalığınız, gebeliğiniz veya özel beslenme "
    "ihtiyacınız varsa bir hekime ya da kayıtlı diyetisyene danışın."
)
# Yeme bozukluğu koruması — nötr, kaynaklı dil (rapor 3.5).
EATING_DISORDER_NOTE = (
    "Sağlıklı kilo değişimi yavaş ve süreklidir. Çok düşük kalori hedefleri "
    "veya hızlı kilo kaybı riskli olabilir; kısıtlayıcı beslenme düşünceleri "
    "seni zorluyorsa bir sağlık uzmanından destek al."
)
PHOTO_ESTIMATE_NOTE = (
    "Fotoğraftan kalori bir TAHMİNDİR, kesin değildir. Porsiyon hatası "
    "büyüktür; değerleri kaydetmeden önce kontrol edip düzelt."
)


# --- BMR / TDEE / hedef ------------------------------------------------------
def bmr_mifflin(sex: str, weight_kg: float, height_cm: float, age: int) -> float:
    """Mifflin-St Jeor bazal metabolizma hızı (kcal/gün).

    Erkek: 10*kg + 6.25*cm − 5*yaş + 5
    Kadın: 10*kg + 6.25*cm − 5*yaş − 161
    """
    base = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age
    return base + (5 if sex == "erkek" else -161)


def tdee(bmr: float, activity_level: str | None) -> float:
    factor = ACTIVITY_FACTORS.get(activity_level or DEFAULT_ACTIVITY, ACTIVITY_FACTORS[DEFAULT_ACTIVITY])
    return bmr * factor


def _macro_grams(target_kcal: float, goal: str | None, weight_kg: float | None) -> dict:
    """Hedef kaloriyi makro gramlarına böler.

    Yağ ~%30 sabit; kilo verirken protein 1,8 g/kg'a çekilir (kas koruma), aksi
    halde ~%20. Karbonhidrat kalanı alır. Protein AMDR (%10–35) içine kelepçelenir.
    """
    fat_kcal = DEFAULT_FAT_RATIO * target_kcal

    if goal == "ver" and weight_kg:
        protein_g = PROTEIN_G_PER_KG_CUT * weight_kg
        protein_kcal = protein_g * KCAL_PER_G["protein"]
    else:
        protein_kcal = DEFAULT_PROTEIN_RATIO * target_kcal

    # Proteini AMDR bandına kelepçele; karb negatif kalmasın.
    lo, hi = AMDR["protein"]
    protein_kcal = min(max(protein_kcal, lo * target_kcal), hi * target_kcal)
    carb_kcal = max(0.0, target_kcal - fat_kcal - protein_kcal)

    return {
        "protein_g": round(protein_kcal / KCAL_PER_G["protein"]),
        "carb_g": round(carb_kcal / KCAL_PER_G["carb"]),
        "fat_g": round(fat_kcal / KCAL_PER_G["fat"]),
    }


REQUIRED_TARGET_FIELDS = ("sex", "age", "height_cm", "weight_kg")


def daily_targets(
    *,
    sex: str | None,
    age: int | None,
    height_cm: float | None,
    weight_kg: float | None,
    activity_level: str | None,
    goal: str | None,
) -> dict:
    """Günlük kalori/makro hedefi. Eksik alanları ``missing`` ile bildirir.

    Deterministik ve kaynaklı; asgari kalori tabanı uygulanırsa ``floor_applied``
    ve nötr bir ``warning`` döner (yeme bozukluğu koruması).
    """
    values = {"sex": sex, "age": age, "height_cm": height_cm, "weight_kg": weight_kg}
    missing = [f for f in REQUIRED_TARGET_FIELDS if not values.get(f)]
    if missing:
        return {"has_data": False, "missing": missing}

    goal = goal or "koru"
    bmr = bmr_mifflin(sex, weight_kg, height_cm, age)
    maintenance = tdee(bmr, activity_level)

    if goal == "ver":
        raw_target = maintenance - DEFICIT_KCAL
    elif goal == "al":
        raw_target = maintenance + SURPLUS_KCAL
    else:
        raw_target = maintenance

    floor = FLOOR_KCAL.get(sex, FLOOR_KCAL["kadin"])
    floor_applied = raw_target < floor
    target_kcal = max(raw_target, floor)

    warning = None
    if floor_applied:
        warning = (
            f"Hesaplanan hedef güvenli alt sınırın ({floor} kcal/gün) altına düştü; "
            "taban uygulandı. Daha yavaş ver ve aktiviteyi artır. " + EATING_DISORDER_NOTE
        )

    # Uygulanan gerçek açık/fazla (taban sonrası) ve haftalık değişim tahmini.
    delta = target_kcal - maintenance  # ver'de negatif
    weekly_change_kg = round(delta * 7 / KCAL_PER_KG, 2)

    macros = _macro_grams(target_kcal, goal, weight_kg)
    return {
        "has_data": True,
        "missing": [],
        "goal": goal,
        "bmr": round(bmr),
        "maintenance_kcal": round(maintenance),
        "target_kcal": round(target_kcal),
        "floor_kcal": floor,
        "floor_applied": floor_applied,
        "weekly_change_kg": weekly_change_kg,
        "warning": warning,
        **macros,
        # AMDR referans yüzdeleri (arayüz "genel aralık" gösterebilsin).
        "amdr": {k: [round(lo * 100), round(hi * 100)] for k, (lo, hi) in AMDR.items()},
    }


# --- Besin tablosu (yerel referans + Open Food Facts eşlemesi) --------------
@lru_cache(maxsize=1)
def all_foods() -> list[dict]:
    return json.loads(_DATA.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _by_barcode() -> dict[str, dict]:
    return {f["barcode"]: f for f in all_foods() if f.get("barcode")}


def _fold(text: str) -> str:
    """Türkçe duyarsız arama için normalize: küçült + aksan/işaret sadeleştir."""
    lowered = (text or "").casefold()
    # İ/ı inceliklerini de kapsaması için Unicode ayrıştırıp birleşik işaretleri at.
    stripped = "".join(
        c for c in unicodedata.normalize("NFKD", lowered) if not unicodedata.combining(c)
    )
    return stripped.replace("ı", "i").replace("ş", "s").replace("ğ", "g").replace("ç", "c")


def search_foods(query: str, limit: int = 20) -> list[dict]:
    """Yerel tabloda ada/eş anlamlıya göre arama (önce tam sonra kısmi eşleşme)."""
    q = _fold(query).strip()
    if not q:
        return []
    starts: list[dict] = []
    contains: list[dict] = []
    for food in all_foods():
        haystacks = [food["name"], *food.get("aliases", [])]
        folded = [_fold(h) for h in haystacks]
        if any(h == q or h.startswith(q) for h in folded):
            starts.append(food)
        elif any(q in h for h in folded):
            contains.append(food)
    return (starts + contains)[:limit]


def get_food_by_barcode(barcode: str) -> dict | None:
    return _by_barcode().get(barcode)


def map_off_product(barcode: str, product: dict) -> dict | None:
    """Open Food Facts ürün yanıtını yerel besin şemasına çevirir (100 g başına).

    OFF nutriments değerleri 100 g başınadır. Enerji yoksa kayıt kullanışsızdır → None.
    """
    n = product.get("nutriments") or {}
    kcal = n.get("energy-kcal_100g")
    if kcal is None:
        return None
    return {
        "key": f"off:{barcode}",
        "name": product.get("product_name") or "Bilinmeyen ürün",
        "brand": product.get("brands"),
        "barcode": barcode,
        "per": "100g",
        "kcal": round(float(kcal), 1),
        "protein_g": _num(n.get("proteins_100g")),
        "carb_g": _num(n.get("carbohydrates_100g")),
        "fat_g": _num(n.get("fat_100g")),
        "default_serving_g": _serving_grams(product.get("serving_size")),
        "source": "openfoodfacts",
        "source_ref": barcode,
        # ODbL atıf yükümlülüğü — arayüzde gösterilecek.
        "attribution": "Open Food Facts (openfoodfacts.org), ODbL",
    }


def _num(value) -> float | None:
    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        return None


def _serving_grams(serving_size) -> float | None:
    """"30 g", "1 porsiyon (240 ml)" gibi metinden gram sayısını çıkarır."""
    if not isinstance(serving_size, str):
        return None
    import re

    match = re.search(r"(\d+(?:[.,]\d+)?)\s*(g|ml)", serving_size.lower())
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def scale_nutrients(food: dict, qty_g: float) -> dict:
    """100 g başına değerleri verilen gram miktarına ölçekler."""
    factor = qty_g / 100.0
    return {
        "kcal": round((food.get("kcal") or 0) * factor, 1),
        "protein_g": round((food.get("protein_g") or 0) * factor, 1),
        "carb_g": round((food.get("carb_g") or 0) * factor, 1),
        "fat_g": round((food.get("fat_g") or 0) * factor, 1),
    }

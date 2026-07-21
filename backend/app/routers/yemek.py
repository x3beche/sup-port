"""Yemek / Beslenme modülü — öğün kaydı, besin arama/barkod, günlük hedef, foto-tahmin.

Günlük puan hâlâ ``entries`` koleksiyonundan (module="meal", target=3 öğün)
okunur; her yazımda entries değeri = o gün ≥1 öğe içeren FARKLI öğün türü sayısı
(kahvaltı/öğle/akşam/atıştırma) olarak eşitlenir. Böylece /summary ve
/summary/week değişmeden çalışır; buradaki uçlar "ne yendiği" + kalori/makro
zenginliğini ekler.

Tasarım: her öğe ayrı ``meals`` belgesidir (öğün türüne göre gruplanır) → CRUD
(_id ile düzenle/sil) kolaydır. Profil (boy/cinsiyet/aktivite/hedef) spor
modülüyle PAYLAŞILIR (paylaşarak tekrar sorma); yalnızca yaş beslenmeye özeldir.

Beslenme bilgileri GENELDİR, kişiye özel diyet reçetesi değildir (bkz.
nutrition.DISCLAIMER). Yeme bozukluğu koruması gömülüdür (asgari kalori tabanı,
nötr dil). Fotoğraf-tahmini KESİN DEĞİLDİR ve ham fotoğraf SAKLANMAZ (KVKK).
"""

import base64
import binascii
import hashlib
from datetime import date as date_type, datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..llm import llm_available, nutrition_estimate_llm
from ..models import (
    MealAddInput,
    MealItemPatch,
    NutritionProfileUpdate,
    PhotoEstimateInput,
)
from ..modules import MODULES_BY_KEY
from .. import nutrition as nut

router = APIRouter(prefix="/api/yemek", tags=["yemek"])

MODULE_KEY = "meal"
# Fotoğraf tahmininde tek sayı yerine aralık: araştırma ±%25 önerir (rapor 2.2).
PHOTO_RANGE_RATIO = 0.25
MAX_IMAGE_BYTES = 12 * 1024 * 1024


def _meals():
    return get_db()["meals"]


def _entries():
    return get_db()["entries"]


def _nutri_profiles():
    return get_db()["nutrition_profiles"]


def _spor_profiles():
    return get_db()["spor_profiles"]


def _body_metrics():
    return get_db()["body_metrics"]


def _resolve_date(value: date_type | None) -> str:
    return (value or datetime.now(timezone.utc).date()).isoformat()


def _meal_target() -> int:
    module = MODULES_BY_KEY.get(MODULE_KEY)
    return int(module.target) if module else 3


# ---------------------------------------------------------------- meta
@router.get("/meta")
async def yemek_meta(_user: dict = Depends(current_user)):
    """İstemci için öğün türleri, aktivite seçenekleri, makro/güvenlik metinleri."""
    return {
        "meal_types": [{"key": k, "label": nut.MEAL_LABELS[k]} for k in nut.MEAL_TYPES],
        "activity_levels": [
            {"key": k, "label": nut.ACTIVITY_LABELS[k], "factor": nut.ACTIVITY_FACTORS[k]}
            for k in nut.ACTIVITY_FACTORS
        ],
        "amdr": {k: [round(lo * 100), round(hi * 100)] for k, (lo, hi) in nut.AMDR.items()},
        "floor_kcal": nut.FLOOR_KCAL,
        "meal_target": _meal_target(),
        "disclaimer": nut.DISCLAIMER,
        "eating_disorder_note": nut.EATING_DISORDER_NOTE,
        "photo_note": nut.PHOTO_ESTIMATE_NOTE,
        # Besin kaynağı atıfları (lisans/izlenebilirlik — rapor 1.2).
        "sources": {
            "openfoodfacts": "Open Food Facts (openfoodfacts.org), ODbL",
            "local": "Genel referans besin değerleri (kompozisyon tabloları)",
        },
        "llm_available": llm_available(),
    }


# ---------------------------------------------------------------- profil
async def _latest_weight(user_id) -> float | None:
    cursor = _body_metrics().find({"user_id": user_id}).sort("date", -1).limit(1)
    docs = [d async for d in cursor]
    return float(docs[0]["weight_kg"]) if docs else None


async def _profile_doc(user_id) -> dict:
    shared = await _spor_profiles().find_one({"user_id": user_id}) or {}
    nutri = await _nutri_profiles().find_one({"user_id": user_id}) or {}
    weight = await _latest_weight(user_id)
    return {
        "age": nutri.get("age"),
        "sex": shared.get("sex"),
        "height_cm": shared.get("height_cm"),
        "activity_level": shared.get("activity_level"),
        "goal": shared.get("goal"),
        "target_weight_kg": shared.get("target_weight_kg"),
        "weight_kg": weight,
        "has_body_metrics": weight is not None,
    }


@router.get("/profile")
async def get_profile(user: dict = Depends(current_user)):
    return await _profile_doc(user["_id"])


@router.put("/profile")
async def update_profile(payload: NutritionProfileUpdate, user: dict = Depends(current_user)):
    uid = user["_id"]
    now = datetime.now(timezone.utc)
    data = payload.model_dump(exclude_none=True)

    # Yaş beslenmeye özel.
    if "age" in data:
        await _nutri_profiles().find_one_and_update(
            {"user_id": uid},
            {"$set": {"age": data["age"], "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    # Boy/cinsiyet/aktivite/hedef spor profiliyle PAYLAŞILIR.
    shared = {k: data[k] for k in ("sex", "height_cm", "activity_level", "goal", "target_weight_kg") if k in data}
    if shared:
        await _spor_profiles().find_one_and_update(
            {"user_id": uid},
            {"$set": {**shared, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    # Kilo verildiyse bugünün ölçümü olarak yaz (BMR hesabı için, spor ile ortak).
    if "weight_kg" in data:
        day = _resolve_date(None)
        await _body_metrics().find_one_and_update(
            {"user_id": uid, "date": day},
            {"$set": {"weight_kg": data["weight_kg"], "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    return await _profile_doc(uid)


async def _compute_targets(user_id) -> dict:
    shared = await _spor_profiles().find_one({"user_id": user_id}) or {}
    nutri = await _nutri_profiles().find_one({"user_id": user_id}) or {}
    weight = await _latest_weight(user_id)
    return nut.daily_targets(
        sex=shared.get("sex"),
        age=nutri.get("age"),
        height_cm=shared.get("height_cm"),
        weight_kg=weight,
        activity_level=shared.get("activity_level"),
        goal=shared.get("goal"),
    )


# ---------------------------------------------------------------- besin arama/barkod
@router.get("/foods/search")
async def search_foods(
    q: str = Query(min_length=1, max_length=80),
    limit: int = Query(default=20, ge=1, le=50),
    _user: dict = Depends(current_user),
):
    """Yerel referans tablosunda arama (önce yerel — hız + gizlilik; rapor 1.3)."""
    foods = nut.search_foods(q, limit=limit)
    return {"query": q, "count": len(foods), "foods": foods}


async def _fetch_off(barcode: str) -> dict | None:
    """Open Food Facts canlı barkod çağrısı — best-effort, hatada None.

    Yalnızca yerel tabloda yoksa çağrılır. Özel User-Agent zorunlu; kısa timeout.
    """
    if not settings.off_api_enabled:
        return None
    import httpx

    url = (
        f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        "?fields=product_name,brands,nutriments,serving_size"
    )
    headers = {"User-Agent": settings.off_user_agent}
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            resp = await client.get(url, headers=headers)
        data = resp.json()
    except Exception:
        return None
    if data.get("status") != 1:  # 0 = bulunamadı
        return None
    return nut.map_off_product(barcode, data.get("product") or {})


@router.get("/foods/barcode/{code}")
async def barcode_lookup(code: str, _user: dict = Depends(current_user)):
    code = code.strip()
    if not code.isdigit():
        raise HTTPException(status_code=422, detail="Barkod yalnızca rakamlardan oluşmalı")
    local = nut.get_food_by_barcode(code)
    if local:
        return {"found": True, "food": local}
    off = await _fetch_off(code)
    if off:
        return {"found": True, "food": off}
    raise HTTPException(
        status_code=404,
        detail="Ürün bulunamadı. Elle ekleyebilir ya da arama/foto ile deneyebilirsin.",
    )


# ---------------------------------------------------------------- öğün kaydı
async def _sync_meal_entry(user_id, day: str) -> int:
    """O günün öğün sayısını (≥1 öğe içeren farklı türler) entries'e yaz."""
    types = await _meals().distinct("meal_type", {"user_id": user_id, "date": day})
    count = len(types)
    now = datetime.now(timezone.utc)
    await _entries().find_one_and_update(
        {"user_id": user_id, "module": MODULE_KEY, "date": day},
        {"$set": {"value": float(count), "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return count


def _item_public(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "meal_type": doc["meal_type"],
        "name": doc["name"],
        "brand": doc.get("brand"),
        "barcode": doc.get("barcode"),
        "qty_g": doc["qty_g"],
        "kcal": doc["kcal"],
        "protein_g": doc.get("protein_g", 0.0),
        "carb_g": doc.get("carb_g", 0.0),
        "fat_g": doc.get("fat_g", 0.0),
        "source": doc.get("source", "manual"),
        "source_ref": doc.get("source_ref"),
        "estimated": bool(doc.get("estimated", False)),
        "confidence": doc.get("confidence"),
    }


def _round_macros(m: dict) -> dict:
    return {
        "kcal": round(m["kcal"]),
        "protein_g": round(m["protein_g"], 1),
        "carb_g": round(m["carb_g"], 1),
        "fat_g": round(m["fat_g"], 1),
    }


async def _day_payload(user_id, day: str) -> dict:
    cursor = _meals().find({"user_id": user_id, "date": day}).sort("created_at", 1)
    groups: dict[str, dict] = {}
    totals = {"kcal": 0.0, "protein_g": 0.0, "carb_g": 0.0, "fat_g": 0.0}
    async for doc in cursor:
        item = _item_public(doc)
        group = groups.setdefault(
            item["meal_type"],
            {
                "meal_type": item["meal_type"],
                "label": nut.MEAL_LABELS[item["meal_type"]],
                "items": [],
                "subtotal": {"kcal": 0.0, "protein_g": 0.0, "carb_g": 0.0, "fat_g": 0.0},
            },
        )
        group["items"].append(item)
        for key in totals:
            group["subtotal"][key] += float(item[key])
            totals[key] += float(item[key])

    ordered = []
    for mtype in nut.MEAL_TYPES:
        if mtype in groups:
            g = groups[mtype]
            g["subtotal"] = _round_macros(g["subtotal"])
            ordered.append(g)

    return {
        "date": day,
        "meals": ordered,
        "totals": _round_macros(totals),
        "meal_count": len(ordered),
        "meal_target": _meal_target(),
    }


@router.get("/meals")
async def list_meals(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    return await _day_payload(user["_id"], _resolve_date(date))


@router.post("/meals")
async def add_meal(
    payload: MealAddInput,
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    now = datetime.now(timezone.utc)
    docs = []
    for item in payload.items:
        docs.append(
            {
                "user_id": user["_id"],
                "date": day,
                "meal_type": payload.meal_type,
                "name": item.name,
                "brand": item.brand,
                "barcode": item.barcode,
                "qty_g": round(item.qty_g, 1),
                "kcal": round(item.kcal, 1),
                "protein_g": round(item.protein_g, 1),
                "carb_g": round(item.carb_g, 1),
                "fat_g": round(item.fat_g, 1),
                "source": item.source,
                "source_ref": item.source_ref,
                "estimated": item.estimated,
                "confidence": item.confidence,
                "created_at": now,
            }
        )
    await _meals().insert_many(docs)
    await _sync_meal_entry(user["_id"], day)
    return await _day_payload(user["_id"], day)


def _oid_or_404(item_id: str) -> ObjectId:
    try:
        return ObjectId(item_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Öğe bulunamadı") from None


@router.patch("/meals/{item_id}")
async def patch_meal(
    item_id: str,
    payload: MealItemPatch,
    user: dict = Depends(current_user),
):
    oid = _oid_or_404(item_id)
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Güncellenecek alan yok")
    for key in ("qty_g", "kcal", "protein_g", "carb_g", "fat_g"):
        if key in updates:
            updates[key] = round(float(updates[key]), 1)
    updates["updated_at"] = datetime.now(timezone.utc)

    doc = await _meals().find_one_and_update(
        {"_id": oid, "user_id": user["_id"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Öğe bulunamadı")
    # Öğün türü değişmiş olabilir → gün sayısını yeniden eşitle.
    await _sync_meal_entry(user["_id"], doc["date"])
    return _item_public(doc)


@router.delete("/meals/{item_id}")
async def delete_meal(item_id: str, user: dict = Depends(current_user)):
    oid = _oid_or_404(item_id)
    doc = await _meals().find_one_and_delete({"_id": oid, "user_id": user["_id"]})
    if doc is None:
        raise HTTPException(status_code=404, detail="Öğe bulunamadı")
    await _sync_meal_entry(user["_id"], doc["date"])
    return await _day_payload(user["_id"], doc["date"])


# ---------------------------------------------------------------- günlük özet
@router.get("/summary")
async def daily_summary(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    payload = await _day_payload(user["_id"], day)
    target = await _compute_targets(user["_id"])

    result = {
        **payload,
        "target": target,
        "notes": {
            "disclaimer": nut.DISCLAIMER,
            "eating_disorder": nut.EATING_DISORDER_NOTE,
            "photo": nut.PHOTO_ESTIMATE_NOTE,
        },
    }
    if target.get("has_data"):
        consumed = payload["totals"]["kcal"]
        target_kcal = target["target_kcal"]
        result["remaining_kcal"] = round(target_kcal - consumed)
        result["kcal_ratio"] = round(min(consumed / target_kcal, 1.0), 3) if target_kcal else 0.0
    return result


# ---------------------------------------------------------------- foto-tahmin
def _decode_image(image_base64: str) -> tuple[bytes, str]:
    """data URL ya da çıplak base64 → (bytes, media_type). Geçersizse 400."""
    media_type = "image/jpeg"
    payload = image_base64.strip()
    if payload.startswith("data:"):
        header, _, b64 = payload.partition(",")
        if not b64:
            raise HTTPException(status_code=400, detail="Geçersiz görüntü verisi")
        # data:image/png;base64,....
        mime = header[5:].split(";")[0]
        if mime:
            media_type = mime
        payload = b64
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Geçersiz base64 görüntü") from None
    if not raw:
        raise HTTPException(status_code=400, detail="Boş görüntü")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Görüntü çok büyük (en fazla 12 MB)")
    return raw, media_type


@router.post("/meals/estimate")
async def estimate_meal(
    payload: PhotoEstimateInput,
    user: dict = Depends(current_user),
):
    """Öğün fotoğrafından kalori/makro TAHMİNİ. Ham fotoğraf SAKLANMAZ.

    Sonuç bir "taslak"tır: kullanıcı düzeltip onaylayınca /meals'e yazılır.
    """
    # KVKK: fotoğraf buluta gider — açık onay olmadan işleme.
    if not payload.consent:
        raise HTTPException(
            status_code=400,
            detail="Fotoğrafı işlemek için açık onay gerekli (fotoğraf buluttaki bir modele gönderilir).",
        )

    raw, media_type = _decode_image(payload.image_base64)
    # Yalnızca denetim/dedup için hash; ham fotoğraf saklanmaz.
    photo_hash = "sha256:" + hashlib.sha256(raw).hexdigest()

    if not llm_available():
        raise HTTPException(
            status_code=503,
            detail="Fotoğraf tahmin servisi şu an kullanılamıyor. Arama, barkod veya elle giriş kullan.",
        )

    estimate = await nutrition_estimate_llm(raw, media_type, payload.note)
    if estimate is None:
        raise HTTPException(
            status_code=502,
            detail="Fotoğraf tahmini yapılamadı. Lütfen tekrar dene ya da elle gir.",
        )

    total = estimate["total_kcal"]
    return {
        "photo_hash": photo_hash,
        "estimated": True,
        "source": "vision_llm",
        "items": estimate["items"],
        "total_kcal": total,
        "confidence": estimate["confidence"],
        # Tek sayı yerine aralık (±%25) — belirsizliği görünür kıl.
        "range_kcal": [round(total * (1 - PHOTO_RANGE_RATIO)), round(total * (1 + PHOTO_RANGE_RATIO))],
        "note": nut.PHOTO_ESTIMATE_NOTE,
    }

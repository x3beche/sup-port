"""Genel kullanıcı profili — vücut bilgileri (yaş, cinsiyet, boy, kilo, hedef) ve
kilo/BMI analiz timeline'ı.

Amaç: kullanıcı bu bilgileri BİR KEZ girer; modüller (spor, yemek, ...) tekrar
tekrar sormaz — hepsi aynı paylaşılan profili okur. Paylaşılan alanlar
``spor_profiles``te, yaş ``nutrition_profiles``te, kilo/bel ZAMANLA
``body_metrics``te (timeline) tutulur. Bu uç üçünü tek yüzeyde birleştirir; spor
ve yemek uçları aynı koleksiyonları okuduğundan tutarlılık otomatiktir.
"""

from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pymongo import ReturnDocument

from .. import exercises as ex
from ..db import get_db
from ..deps import current_user
from ..models import ProfileUpdate

router = APIRouter(prefix="/api/profile", tags=["profile"])

# spor_profiles'te tutulan paylaşılan alanlar (yaş hariç — o nutrition_profiles'te).
_SHARED_FIELDS = ("sex", "height_cm", "activity_level", "goal", "target_weight_kg", "asian_thresholds")


def _spor_profiles():
    return get_db()["spor_profiles"]


def _nutri_profiles():
    return get_db()["nutrition_profiles"]


def _metrics():
    return get_db()["body_metrics"]


def _bmi(weight_kg: float | None, height_cm: float | None) -> float | None:
    if not weight_kg or not height_cm:
        return None
    h = height_cm / 100.0
    return round(weight_kg / (h * h), 1)


async def _latest_metric(user_id) -> dict | None:
    cursor = _metrics().find({"user_id": user_id}).sort("date", -1).limit(1)
    docs = [d async for d in cursor]
    return docs[0] if docs else None


async def _merged(user_id) -> dict:
    shared = await _spor_profiles().find_one({"user_id": user_id}) or {}
    nutri = await _nutri_profiles().find_one({"user_id": user_id}) or {}
    latest = await _latest_metric(user_id)

    height = shared.get("height_cm")
    asian = bool(shared.get("asian_thresholds", False))
    weight = latest.get("weight_kg") if latest else None
    waist = latest.get("waist_cm") if latest else None
    bmi = _bmi(weight, height)
    category = ex.bmi_category(bmi, asian) if bmi is not None else None

    return {
        "age": nutri.get("age"),
        "sex": shared.get("sex"),
        "height_cm": height,
        "activity_level": shared.get("activity_level"),
        "goal": shared.get("goal"),
        "target_weight_kg": shared.get("target_weight_kg"),
        "asian_thresholds": asian,
        "weight_kg": weight,
        "waist_cm": waist,
        "bmi": bmi,
        "bmi_category": category,
        "bmi_label": ex.BMI_LABELS.get(category) if category else None,
        "measured_at": latest.get("date") if latest else None,
        "has_body_info": bool(height or weight or nutri.get("age")),
    }


@router.get("")
async def get_profile(user: dict = Depends(current_user)):
    return await _merged(user["_id"])


@router.put("")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(current_user)):
    uid = user["_id"]
    now = datetime.now(timezone.utc)
    data = payload.model_dump(exclude_none=True)

    shared = {k: v for k, v in data.items() if k in _SHARED_FIELDS}
    if shared:
        await _spor_profiles().find_one_and_update(
            {"user_id": uid},
            {"$set": {**shared, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    if "age" in data:
        await _nutri_profiles().find_one_and_update(
            {"user_id": uid},
            {"$set": {"age": data["age"], "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    # Kilo/bel → o günün ölçümü (timeline'a düşer). Aynı gün tekrar girilirse üzerine yazılır.
    metric_set = {}
    if "weight_kg" in data:
        metric_set["weight_kg"] = data["weight_kg"]
    if "waist_cm" in data:
        metric_set["waist_cm"] = data["waist_cm"]
    if metric_set:
        day = now.date().isoformat()
        await _metrics().find_one_and_update(
            {"user_id": uid, "date": day},
            {"$set": {**metric_set, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    return await _merged(uid)


@router.get("/timeline")
async def timeline(
    days: int = Query(default=180, ge=7, le=730),
    user: dict = Depends(current_user),
):
    """Kilo + BMI analiz zaman çizelgesi (body_metrics'ten). Modüller arası ortak."""
    shared = await _spor_profiles().find_one({"user_id": user["_id"]}) or {}
    height = shared.get("height_cm")
    asian = bool(shared.get("asian_thresholds", False))

    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days - 1)
    cursor = _metrics().find(
        {"user_id": user["_id"], "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    ).sort("date", 1)

    points = []
    async for d in cursor:
        bmi = _bmi(d.get("weight_kg"), height)
        points.append({
            "date": d["date"],
            "weight_kg": d.get("weight_kg"),
            "waist_cm": d.get("waist_cm"),
            "bmi": bmi,
            "bmi_category": ex.bmi_category(bmi, asian) if bmi is not None else None,
        })

    first = points[0]["weight_kg"] if points else None
    last = points[-1]["weight_kg"] if points else None
    trend = round(last - first, 1) if (first is not None and last is not None) else None
    return {"count": len(points), "trend_kg": trend, "points": points}

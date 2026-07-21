"""Spor / Egzersiz modülü — kütüphane, vücut takibi (BMI), antrenman ve hedef.

Günlük puan ``entries`` (module="workout", birim=dk) üzerinden hesaplanır; her
antrenman kaydı o günün toplam aktif dakikasını entries'e yazar, böylece /summary
değişmeden çalışır. Zengin veri (profil, ölçümler, antrenmanlar) kendi
koleksiyonlarında tutulur.

Sağlık bilgileri GENELDİR, kişiye özel tıbbi tavsiye değildir (bkz.
exercises.MEDICAL_DISCLAIMER).
"""

from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from ..db import get_db
from ..deps import current_user
from ..llm import spor_recommendation_llm
from ..models import (
    BodyMetricInput,
    ParqSubmit,
    SporProfileUpdate,
    WorkoutInput,
)
from .. import exercises as ex

router = APIRouter(prefix="/api/spor", tags=["spor"])

MODULE_KEY = "workout"
DEFAULT_WEIGHT_KG = 70.0  # ölçüm yoksa kalori tahmini için nötr varsayım


def _profiles():
    return get_db()["spor_profiles"]


def _metrics():
    return get_db()["body_metrics"]


def _workouts():
    return get_db()["workouts"]


def _entries():
    return get_db()["entries"]


def _resolve_date(value: date_type | None) -> str:
    return (value or datetime.now(timezone.utc).date()).isoformat()


# ---------------------------------------------------------------- kütüphane
def _exercise_public(e: dict) -> dict:
    """İstemciye giden egzersiz — telifli görsel alanı çıkarılır."""
    return {
        "key": e["key"],
        "name_tr": e["name_tr"],
        "name_en": e["name_en"],
        "category": e["category"],
        "category_label": ex.CATEGORY_LABELS.get(e["category"], e["category"]),
        "muscle_groups": e["muscle_groups"],
        "equipment": e["equipment"],
        "equipment_label": ex.EQUIPMENT_LABELS.get(e["equipment"], e["equipment"]),
        "difficulty": e["difficulty"],
        "difficulty_label": ex.DIFFICULTY_LABELS.get(e["difficulty"], e["difficulty"]),
        "low_impact": e["low_impact"],
        "met": e["met"],
        "default": e.get("default", {}),
        "steps": e["steps"],
        "cautions": e.get("cautions", []),
    }


@router.get("/exercises")
async def list_exercises(
    category: str | None = None,
    equipment: str | None = None,
    difficulty: str | None = None,
    low_impact: bool = False,
    _user: dict = Depends(current_user),
):
    items = ex.filter_exercises(
        category=category,
        equipment=equipment,
        difficulty=difficulty,
        low_impact_only=low_impact,
    )
    return {
        "categories": [
            {"key": c, "label": ex.CATEGORY_LABELS[c]} for c in ex.CATEGORY_ORDER
        ],
        "count": len(items),
        "exercises": [_exercise_public(e) for e in items],
    }


@router.get("/exercises/{key}")
async def exercise_detail(key: str, _user: dict = Depends(current_user)):
    e = ex.get_exercise(key)
    if e is None:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen egzersiz: {key}")
    return {**_exercise_public(e), "red_flags": list(ex.RED_FLAGS)}


@router.get("/meta")
async def spor_meta(_user: dict = Depends(current_user)):
    """İstemci için etiketler, güvenlik metinleri ve hedefler."""
    return {
        "categories": [{"key": c, "label": ex.CATEGORY_LABELS[c]} for c in ex.CATEGORY_ORDER],
        "equipment": [{"key": k, "label": v} for k, v in ex.EQUIPMENT_LABELS.items()],
        "difficulty": [{"key": k, "label": v} for k, v in ex.DIFFICULTY_LABELS.items()],
        "red_flags": list(ex.RED_FLAGS),
        "parq_questions": list(ex.PARQ_QUESTIONS),
        "disclaimer": ex.MEDICAL_DISCLAIMER,
        "who": {
            "weekly_moderate_min": ex.WHO_WEEKLY_MODERATE_MIN,
            "weekly_moderate_target": ex.WHO_WEEKLY_MODERATE_TARGET,
            "weekly_strength_days": ex.WHO_WEEKLY_STRENGTH_DAYS,
        },
        "safe_weekly_loss_kg": [ex.SAFE_WEEKLY_LOSS_MIN_KG, ex.SAFE_WEEKLY_LOSS_MAX_KG],
    }


# ---------------------------------------------------------------- profil
_PROFILE_FIELDS = ("height_cm", "sex", "activity_level", "goal", "target_weight_kg", "asian_thresholds")


def _profile_public(doc: dict | None) -> dict:
    doc = doc or {}
    return {
        "height_cm": doc.get("height_cm"),
        "sex": doc.get("sex"),
        "activity_level": doc.get("activity_level"),
        "goal": doc.get("goal"),
        "target_weight_kg": doc.get("target_weight_kg"),
        "asian_thresholds": bool(doc.get("asian_thresholds", False)),
        "parq_completed": bool(doc.get("parq_completed", False)),
        "parq_flagged": bool(doc.get("parq_flagged", False)),
    }


async def _get_profile(user_id) -> dict | None:
    return await _profiles().find_one({"user_id": user_id})


@router.get("/profile")
async def get_profile(user: dict = Depends(current_user)):
    return _profile_public(await _get_profile(user["_id"]))


@router.put("/profile")
async def update_profile(payload: SporProfileUpdate, user: dict = Depends(current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None and k in _PROFILE_FIELDS}
    now = datetime.now(timezone.utc)
    doc = await _profiles().find_one_and_update(
        {"user_id": user["_id"]},
        {"$set": {**updates, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _profile_public(doc)


@router.post("/parq")
async def submit_parq(payload: ParqSubmit, user: dict = Depends(current_user)):
    # Herhangi bir "evet" hekime danışma işareti koyar; kullanım engellenmez ama
    # istemci uyarı gösterir.
    flagged = any(payload.answers)
    now = datetime.now(timezone.utc)
    doc = await _profiles().find_one_and_update(
        {"user_id": user["_id"]},
        {
            "$set": {
                "parq_completed": True,
                "parq_flagged": flagged,
                "parq_answers": payload.answers,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _profile_public(doc)


# ---------------------------------------------------------------- vücut ölçümü
def _bmi(weight_kg: float, height_cm: float | None) -> float | None:
    if not height_cm:
        return None
    h = height_cm / 100.0
    return round(weight_kg / (h * h), 1)


def _metric_public(doc: dict, profile: dict | None) -> dict:
    profile = profile or {}
    height = profile.get("height_cm")
    asian = bool(profile.get("asian_thresholds", False))
    sex = profile.get("sex")
    bmi = _bmi(doc["weight_kg"], height)
    out = {
        "date": doc["date"],
        "weight_kg": doc["weight_kg"],
        "waist_cm": doc.get("waist_cm"),
        "bmi": bmi,
        "bmi_category": ex.bmi_category(bmi, asian) if bmi is not None else None,
    }
    if bmi is not None:
        out["bmi_label"] = ex.BMI_LABELS.get(out["bmi_category"], "")
    if doc.get("waist_cm") is not None and sex:
        out["waist_risk"] = ex.waist_risk(doc["waist_cm"], sex, asian)
    return out


async def _latest_metric(user_id) -> dict | None:
    cursor = _metrics().find({"user_id": user_id}).sort("date", -1).limit(1)
    docs = [d async for d in cursor]
    return docs[0] if docs else None


async def _latest_weight(user_id) -> float:
    latest = await _latest_metric(user_id)
    return float(latest["weight_kg"]) if latest else DEFAULT_WEIGHT_KG


@router.post("/metrics")
async def add_metric(
    payload: BodyMetricInput,
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    now = datetime.now(timezone.utc)
    set_fields = {"weight_kg": payload.weight_kg, "updated_at": now}
    if payload.waist_cm is not None:
        set_fields["waist_cm"] = payload.waist_cm
    doc = await _metrics().find_one_and_update(
        {"user_id": user["_id"], "date": day},
        {"$set": set_fields, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _metric_public(doc, await _get_profile(user["_id"]))


@router.get("/metrics")
async def list_metrics(
    days: int = Query(default=90, ge=1, le=365),
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    end = date_type.fromisoformat(_resolve_date(date))
    start = end - timedelta(days=days - 1)
    profile = await _get_profile(user["_id"])
    cursor = _metrics().find(
        {"user_id": user["_id"], "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    ).sort("date", 1)
    return [_metric_public(d, profile) async for d in cursor]


@router.get("/metrics/summary")
async def metrics_summary(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    profile = await _get_profile(user["_id"])
    latest = await _latest_metric(user["_id"])
    if latest is None:
        return {"has_data": False, "profile": _profile_public(profile)}

    # Eğilim: bilinen en eski ölçüme göre değişim (kg).
    oldest_cursor = _metrics().find({"user_id": user["_id"]}).sort("date", 1).limit(1)
    oldest = [d async for d in oldest_cursor]
    trend_kg = round(latest["weight_kg"] - oldest[0]["weight_kg"], 1) if oldest else 0.0

    current = _metric_public(latest, profile)
    result = {
        "has_data": True,
        "profile": _profile_public(profile),
        "current": current,
        "trend_kg": trend_kg,
        "safe_weekly_loss_kg": [ex.SAFE_WEEKLY_LOSS_MIN_KG, ex.SAFE_WEEKLY_LOSS_MAX_KG],
    }
    # Hedef kilo verilmişse güvenli süreyi (hafta) ve uyarıyı hesapla.
    target = (profile or {}).get("target_weight_kg")
    if target and latest["weight_kg"] > target:
        to_lose = latest["weight_kg"] - target
        result["target_weight_kg"] = target
        result["to_lose_kg"] = round(to_lose, 1)
        # 0.5–1 kg/hafta güvenli aralık → min/max hafta.
        result["safe_min_weeks"] = round(to_lose / ex.SAFE_WEEKLY_LOSS_MAX_KG, 1)
        result["safe_max_weeks"] = round(to_lose / ex.SAFE_WEEKLY_LOSS_MIN_KG, 1)
    return result


# ---------------------------------------------------------------- antrenman
async def _sync_workout_entry(user_id, day: str) -> int:
    """O günün toplam aktif dakikasını entries'e yaz; günlük puan bunu okur."""
    cursor = _workouts().find({"user_id": user_id, "date": day}, projection={"duration_min": 1})
    total = 0
    async for w in cursor:
        total += int(w.get("duration_min", 0))
    now = datetime.now(timezone.utc)
    await _entries().find_one_and_update(
        {"user_id": user_id, "module": MODULE_KEY, "date": day},
        {"$set": {"value": float(total), "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return total


@router.post("/workouts")
async def log_workout(
    payload: WorkoutInput,
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    weight = await _latest_weight(user["_id"])

    resolved_items = []
    total_seconds = 0
    total_calories = 0.0
    has_strength = False
    for item in payload.items:
        exercise = ex.get_exercise(item.key)
        if exercise is None:
            raise HTTPException(status_code=404, detail=f"Bilinmeyen egzersiz: {item.key}")
        seconds = ex.exercise_seconds(exercise, item.sets, item.reps, item.duration_sec)
        calories = ex.item_calories(exercise, seconds, weight)
        total_seconds += seconds
        total_calories += calories
        if exercise["category"] == "kuvvet":
            has_strength = True
        resolved_items.append({
            "key": item.key,
            "name_tr": exercise["name_tr"],
            "category": exercise["category"],
            "sets": item.sets,
            "reps": item.reps,
            "duration_sec": item.duration_sec,
            "seconds": seconds,
            "calories": round(calories, 1),
        })

    duration_min = round(total_seconds / 60)
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user["_id"],
        "date": day,
        "items": resolved_items,
        "duration_min": duration_min,
        "calories": round(total_calories),
        "has_strength": has_strength,
        "weight_kg": weight,
        "created_at": now,
    }
    result = await _workouts().insert_one(doc)
    day_total = await _sync_workout_entry(user["_id"], day)

    return {
        "id": str(result.inserted_id),
        "date": day,
        "items": resolved_items,
        "duration_min": duration_min,
        "calories": round(total_calories),
        "has_strength": has_strength,
        "day_total_min": day_total,
    }


@router.get("/workouts")
async def list_workouts(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    cursor = _workouts().find({"user_id": user["_id"], "date": day}).sort("created_at", 1)
    workouts = []
    async for w in cursor:
        workouts.append({
            "id": str(w["_id"]),
            "date": w["date"],
            "items": w.get("items", []),
            "duration_min": w.get("duration_min", 0),
            "calories": w.get("calories", 0),
            "has_strength": w.get("has_strength", False),
        })
    total_min = sum(w["duration_min"] for w in workouts)
    total_cal = sum(w["calories"] for w in workouts)
    return {"date": day, "workouts": workouts, "total_min": total_min, "total_calories": total_cal}


@router.get("/weekly")
async def weekly_goal(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    """WHO haftalık hedefe ilerleme: aktif dakika + kuvvet günü."""
    end = date_type.fromisoformat(_resolve_date(date))
    start = end - timedelta(days=6)
    cursor = _workouts().find(
        {"user_id": user["_id"], "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    )
    total_min = 0
    strength_days: set[str] = set()
    async for w in cursor:
        total_min += int(w.get("duration_min", 0))
        if w.get("has_strength"):
            strength_days.add(w["date"])

    moderate_min = ex.WHO_WEEKLY_MODERATE_MIN
    return {
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "active_minutes": total_min,
        "moderate_target": moderate_min,
        "moderate_upper": ex.WHO_WEEKLY_MODERATE_TARGET,
        "minutes_ratio": round(min(total_min / moderate_min, 1.0), 3) if moderate_min else 0.0,
        "strength_days": len(strength_days),
        "strength_target": ex.WHO_WEEKLY_STRENGTH_DAYS,
        "met_goal": total_min >= moderate_min and len(strength_days) >= ex.WHO_WEEKLY_STRENGTH_DAYS,
    }


# ---------------------------------------------------------------- öneri
def _rule_recommendation(profile: dict | None, latest: dict | None) -> dict:
    """BMI/hedef temelli deterministik, kaynaklı öneri. LLM yoksa da çalışır."""
    profile = profile or {}
    height = profile.get("height_cm")
    asian = bool(profile.get("asian_thresholds", False))
    goal = profile.get("goal")

    bmi = _bmi(latest["weight_kg"], height) if latest and height else None
    category = ex.bmi_category(bmi, asian) if bmi is not None else None

    # Fazla kilolu/obez ya da başlangıç → düşük etkili öncelik, yüksek etkili gizle.
    overweight = category in {"fazla_kilolu", "obez", "obez_1", "obez_2", "obez_3"}
    avoid_high_impact = overweight or goal == "ver"

    focus = []
    notes = []
    if overweight:
        focus = ["Düşük etkili kardiyo", "Sandalye/bant kuvvet", "Günlük yürüyüş"]
        notes.append(
            "Fazla kiloda eklem yükü arttığı için zıplama/koşu yerine yürüyüş, "
            "sabit bisiklet ve sandalye egzersizleri önerilir (JOSPT 2018)."
        )
        notes.append("%5–10 kilo kaybı bile diz ağrısını ve metabolik riski azaltır.")
    elif category == "normal":
        focus = ["Kuvvet (tüm kas grupları)", "Orta şiddet kardiyo", "Esneklik/denge"]
    else:
        focus = ["Kademeli kuvvet", "Orta şiddet kardiyo"]

    if goal == "ver":
        notes.append(
            "Güvenli kilo verme haftada 0.5–1 kg'dır (CDC/NHS); günde ~500–750 kcal açık."
        )

    # Önerilen egzersizler: profile uygun (düşük etkili, başlangıç) küçük bir set.
    pool = ex.filter_exercises(low_impact_only=avoid_high_impact)
    picks = []
    for cat in ("isinma", "kuvvet", "kardiyo", "soguma"):
        for e in pool:
            if e["category"] == cat and e["difficulty"] in ("baslangic", "orta"):
                picks.append(e["key"])
                break
    return {
        "source": "rule",
        "bmi": bmi,
        "bmi_category": category,
        "bmi_label": ex.BMI_LABELS.get(category) if category else None,
        "focus": focus,
        "recommended_exercise_keys": picks,
        "avoid_high_impact": avoid_high_impact,
        "weekly_minutes_target": ex.WHO_WEEKLY_MODERATE_MIN,
        "weekly_strength_days": ex.WHO_WEEKLY_STRENGTH_DAYS,
        "notes": notes,
        "disclaimer": ex.MEDICAL_DISCLAIMER,
    }


@router.get("/recommendation")
async def recommendation(
    llm: bool = Query(default=True, description="Varsa LLM ile doğal dil özeti üret"),
    user: dict = Depends(current_user),
):
    profile = await _get_profile(user["_id"])
    latest = await _latest_metric(user["_id"])
    base = _rule_recommendation(profile, latest)

    if llm:
        summary = await spor_recommendation_llm(base, profile, latest)
        if summary:
            base["summary"] = summary
            base["source"] = "rule+llm"
    return base

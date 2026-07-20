from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from ..db import get_db
from ..deps import current_user
from ..models import (
    DailySummary,
    EntryDelta,
    EntryValue,
    ModuleProgress,
    ModuleTarget,
    OrderUpdate,
    TargetUpdate,
    WeekDay,
)
from ..modules import MODULES, MODULES_BY_KEY, module_list
from ..targets import (
    custom_targets,
    effective_target,
    favorite_step,
    ordered_modules,
    usage_field,
)

router = APIRouter(prefix="/api", tags=["tracker"])


def _entries():
    return get_db()["entries"]


def _users():
    return get_db()["users"]


def _module_or_404(key: str):
    module = MODULES_BY_KEY.get(key)
    if module is None:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen modül: {key}")
    return module


def _resolve_date(value: date_type | None) -> str:
    # A habit day is a local calendar day, so the client sends its own date. The
    # server's UTC date is only a fallback.
    resolved = value or datetime.now(timezone.utc).date()
    return resolved.isoformat()


@router.get("/modules")
async def list_modules(_user: dict = Depends(current_user)):
    return module_list()


@router.get("/targets", response_model=list[ModuleTarget])
async def list_targets(user: dict = Depends(current_user)):
    overrides = custom_targets(user)
    return [
        ModuleTarget(
            key=module.key,
            title=module.title,
            unit=module.unit,
            target=overrides.get(module.key, module.target),
            default_target=module.target,
            is_custom=module.key in overrides,
        )
        for module in MODULES
    ]


@router.put("/targets/{module_key}", response_model=ModuleTarget)
async def set_target(
    module_key: str,
    payload: TargetUpdate,
    user: dict = Depends(current_user),
):
    module = _module_or_404(module_key)
    await _users().update_one(
        {"_id": user["_id"]},
        {"$set": {f"targets.{module.key}": payload.target}},
    )
    return ModuleTarget(
        key=module.key,
        title=module.title,
        unit=module.unit,
        target=payload.target,
        default_target=module.target,
        is_custom=payload.target != module.target,
    )


@router.delete("/targets/{module_key}", response_model=ModuleTarget)
async def reset_target(module_key: str, user: dict = Depends(current_user)):
    module = _module_or_404(module_key)
    await _users().update_one(
        {"_id": user["_id"]},
        {"$unset": {f"targets.{module.key}": ""}},
    )
    return ModuleTarget(
        key=module.key,
        title=module.title,
        unit=module.unit,
        target=module.target,
        default_target=module.target,
        is_custom=False,
    )


@router.get("/summary", response_model=DailySummary)
async def daily_summary(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    cursor = _entries().find({"user_id": user["_id"], "date": day})
    values = {doc["module"]: doc["value"] async for doc in cursor}
    overrides = custom_targets(user)

    progress: list[ModuleProgress] = []
    for module in ordered_modules(user, MODULES):
        value = float(values.get(module.key, 0))
        target = overrides.get(module.key, module.target)
        ratio = min(value / target, 1.0) if target else 0.0
        progress.append(
            ModuleProgress(
                key=module.key,
                title=module.title,
                icon=module.icon,
                color=module.color,
                unit=module.unit,
                target=target,
                default_target=module.target,
                is_custom_target=module.key in overrides,
                step=module.step,
                steps=list(module.step_options()),
                favorite_step=favorite_step(user, module),
                description=module.description,
                value=value,
                ratio=ratio,
                completed=ratio >= 1.0,
            )
        )

    score = round(sum(p.ratio for p in progress) / len(progress) * 100) if progress else 0
    return DailySummary(
        date=date_type.fromisoformat(day),
        score=score,
        completed_count=sum(1 for p in progress if p.completed),
        module_count=len(progress),
        modules=progress,
    )


@router.put("/entries/{module_key}")
async def set_entry(
    module_key: str,
    payload: EntryValue,
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    module = _module_or_404(module_key)
    day = _resolve_date(date)
    now = datetime.now(timezone.utc)

    doc = await _entries().find_one_and_update(
        {"user_id": user["_id"], "module": module.key, "date": day},
        {
            "$set": {"value": payload.value, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return {"module": module.key, "date": day, "value": doc["value"]}


@router.post("/entries/{module_key}/add")
async def add_to_entry(
    module_key: str,
    payload: EntryDelta,
    date: date_type | None = None,
    used_step: float | None = Query(default=None, description="Dokunulan kademe"),
    user: dict = Depends(current_user),
):
    module = _module_or_404(module_key)
    day = _resolve_date(date)
    now = datetime.now(timezone.utc)
    delta = payload.delta if payload.delta else module.step

    doc = await _entries().find_one_and_update(
        {"user_id": user["_id"], "module": module.key, "date": day},
        {"$inc": {"value": delta}, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    # Only a tap on one of the offered steps counts; a debounced burst arrives as
    # a multiple, and the client reports which step produced it.
    if used_step is not None and used_step in module.step_options():
        await _users().update_one(
            {"_id": user["_id"]},
            {"$inc": {usage_field(module.key, used_step): 1}},
        )

    # $inc can drive the counter negative, which no habit metric should be.
    if doc["value"] < 0:
        doc = await _entries().find_one_and_update(
            {"_id": doc["_id"]},
            {"$set": {"value": 0.0}},
            return_document=ReturnDocument.AFTER,
        )
    return {"module": module.key, "date": day, "value": doc["value"]}


@router.get("/history/{module_key}")
async def module_history(
    module_key: str,
    days: int = Query(default=7, ge=1, le=90),
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    module = _module_or_404(module_key)
    target = effective_target(user, module)
    end = date_type.fromisoformat(_resolve_date(date))
    start = end - timedelta(days=days - 1)

    cursor = _entries().find(
        {
            "user_id": user["_id"],
            "module": module.key,
            "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        }
    )
    values = {doc["date"]: doc["value"] async for doc in cursor}

    # Gaps are real days with no activity, so return a dense series the chart can
    # draw without having to guess which days are missing.
    return [
        {
            "date": (day := (start + timedelta(days=offset)).isoformat()),
            "value": float(values.get(day, 0)),
            "target": target,
        }
        for offset in range(days)
    ]


@router.get("/summary/week", response_model=list[WeekDay])
async def weekly_summary(
    days: int = Query(default=7, ge=2, le=31),
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    """Haftalık grafik için kesintisiz günlük puan serisi."""
    end = date_type.fromisoformat(_resolve_date(date))
    start = end - timedelta(days=days - 1)

    cursor = _entries().find(
        {
            "user_id": user["_id"],
            "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        }
    )
    by_day: dict[str, dict[str, float]] = {}
    async for doc in cursor:
        by_day.setdefault(doc["date"], {})[doc["module"]] = doc["value"]

    overrides = custom_targets(user)
    today = end.isoformat()

    result: list[WeekDay] = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).isoformat()
        values = by_day.get(day, {})
        ratios = []
        completed = 0
        for module in MODULES:
            target = overrides.get(module.key, module.target)
            ratio = min(float(values.get(module.key, 0)) / target, 1.0) if target else 0.0
            ratios.append(ratio)
            if ratio >= 1.0:
                completed += 1
        result.append(
            WeekDay(
                date=date_type.fromisoformat(day),
                score=round(sum(ratios) / len(ratios) * 100) if ratios else 0,
                completed_count=completed,
                module_count=len(MODULES),
                is_today=day == today,
            )
        )
    return result


@router.get("/order", response_model=list[str])
async def get_order(user: dict = Depends(current_user)):
    return [m.key for m in ordered_modules(user, MODULES)]


@router.put("/order", response_model=list[str])
async def set_order(payload: OrderUpdate, user: dict = Depends(current_user)):
    """Izgaradaki modül sırasını kaydeder."""
    unknown = [key for key in payload.order if key not in MODULES_BY_KEY]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Bilinmeyen modül: {', '.join(unknown)}",
        )

    # Duplicates would make the grid render a module twice.
    if len(set(payload.order)) != len(payload.order):
        raise HTTPException(status_code=400, detail="Sıralamada tekrar eden modül var")

    await _users().update_one(
        {"_id": user["_id"]},
        {"$set": {"module_order": payload.order}},
    )
    return [m.key for m in ordered_modules({**user, "module_order": payload.order}, MODULES)]

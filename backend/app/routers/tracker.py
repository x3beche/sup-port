from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from ..db import get_db
from ..deps import current_user
from ..models import DailySummary, EntryDelta, EntryValue, ModuleProgress
from ..modules import MODULES, MODULES_BY_KEY, module_list

router = APIRouter(prefix="/api", tags=["tracker"])


def _entries():
    return get_db()["entries"]


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


@router.get("/summary", response_model=DailySummary)
async def daily_summary(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    cursor = _entries().find({"user_id": user["_id"], "date": day})
    values = {doc["module"]: doc["value"] async for doc in cursor}

    progress: list[ModuleProgress] = []
    for module in MODULES:
        value = float(values.get(module.key, 0))
        ratio = min(value / module.target, 1.0) if module.target else 0.0
        progress.append(
            ModuleProgress(
                **{
                    "key": module.key,
                    "title": module.title,
                    "icon": module.icon,
                    "color": module.color,
                    "unit": module.unit,
                    "target": module.target,
                    "step": module.step,
                    "description": module.description,
                    "value": value,
                    "ratio": ratio,
                    "completed": ratio >= 1.0,
                }
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
            "target": module.target,
        }
        for offset in range(days)
    ]

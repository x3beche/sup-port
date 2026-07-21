"""Diş fırçalama modülü — sabah/akşam yuvaları ve seri (streak) hesabı.

Günlük puan hâlâ ``entries`` koleksiyonundan (module="brush", target=2)
okunur; bu yüzden her yuva yazımında entries değeri = tamamlanan yuva sayısı
(0/1/2) olarak eşitlenir. Böylece /summary ve /summary/week hiç değişmeden
çalışmaya devam eder, buradaki uçlar yalnızca "hangi yuva" bilgisini ve seriyi
ekler.
"""

from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pymongo import ReturnDocument

from ..db import get_db
from ..deps import current_user
from ..models import BrushSlotUpdate, BrushStatus
from ..modules import MODULES_BY_KEY

router = APIRouter(prefix="/api/brush", tags=["brush"])

MODULE_KEY = "brush"
# Kutlama tetikleyen seri eşikleri. İlk birkaçı sık ki kullanıcı erken bir
# başarı hissi alsın; sonrası seyrekleşir.
MILESTONES: tuple[int, ...] = (3, 7, 14, 30, 60, 100, 150, 200, 365)


def _brush_days():
    return get_db()["brush_days"]


def _entries():
    return get_db()["entries"]


def _users():
    return get_db()["users"]


def _target() -> int:
    module = MODULES_BY_KEY.get(MODULE_KEY)
    return int(module.target) if module else 2


def _resolve_date(value: date_type | None) -> str:
    # Alışkanlık günü yerel takvim günüdür; istemci kendi tarihini gönderir,
    # sunucunun UTC tarihi yalnızca yedektir.
    return (value or datetime.now(timezone.utc).date()).isoformat()


def _current_streak(complete: set[str], anchor: date_type) -> int:
    """`anchor` (bugün) merkezli arka arkaya tam gün sayısı.

    Bugün henüz tamamlanmadıysa seri dünden geriye sayılır — böylece gün içinde
    henüz fırçalamadın diye kurduğun seri sıfır görünmez.
    """
    start = anchor if anchor.isoformat() in complete else anchor - timedelta(days=1)
    streak = 0
    day = start
    while day.isoformat() in complete:
        streak += 1
        day -= timedelta(days=1)
    return streak


def _best_streak(complete: set[str]) -> int:
    if not complete:
        return 0
    days = sorted(date_type.fromisoformat(d) for d in complete)
    best = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if cur - prev == timedelta(days=1) else 1
        best = max(best, run)
    return best


def _next_milestone(streak: int) -> int | None:
    return next((m for m in MILESTONES if m > streak), None)


async def _complete_days(user_id) -> set[str]:
    # `complete` is denormalised onto each doc so this reads as a covered scan of
    # the (user_id, complete, date) index — no document fetch, no boolean filter
    # in memory. Streak/best-streak both build on this one query.
    cursor = _brush_days().find(
        {"user_id": user_id, "complete": True},
        projection={"date": 1, "_id": 0},
    )
    return {doc["date"] async for doc in cursor}


async def _sync_entry(user_id, day: str, value: int) -> None:
    """entries değerini yuva sayısıyla eşitle ki günlük puan doğru kalsın."""
    now = datetime.now(timezone.utc)
    await _entries().find_one_and_update(
        {"user_id": user_id, "module": MODULE_KEY, "date": day},
        {
            "$set": {"value": float(value), "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


async def _status_for(user: dict, day: str) -> BrushStatus:
    doc = await _brush_days().find_one({"user_id": user["_id"], "date": day})
    morning = bool(doc and doc.get("morning"))
    evening = bool(doc and doc.get("evening"))
    value = int(morning) + int(evening)

    complete = await _complete_days(user["_id"])
    streak = _current_streak(complete, date_type.fromisoformat(day))
    return BrushStatus(
        date=date_type.fromisoformat(day),
        morning=morning,
        evening=evening,
        target=_target(),
        value=value,
        complete=value >= _target(),
        streak=streak,
        best_streak=_best_streak(complete),
        next_milestone=_next_milestone(streak),
    )


@router.get("/status", response_model=BrushStatus)
async def brush_status(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    return await _status_for(user, _resolve_date(date))


@router.put("/slot", response_model=BrushStatus)
async def set_slot(
    payload: BrushSlotUpdate,
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    now = datetime.now(timezone.utc)

    before = await _brush_days().find_one({"user_id": user["_id"], "date": day})
    was_complete = bool(before and before.get("complete"))

    # First write the toggled slot, then read back to derive `complete` from the
    # authoritative post-write state (the other slot may already be set).
    doc = await _brush_days().find_one_and_update(
        {"user_id": user["_id"], "date": day},
        {
            "$set": {payload.slot: payload.done, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    complete = bool(doc.get("morning")) and bool(doc.get("evening"))
    value = int(bool(doc.get("morning"))) + int(bool(doc.get("evening")))
    if bool(doc.get("complete")) != complete:
        await _brush_days().update_one({"_id": doc["_id"]}, {"$set": {"complete": complete}})
    await _sync_entry(user["_id"], day, value)

    status = await _status_for(user, day)
    # Kutlama yalnızca bu yazımın günü tamamladığı anda tetiklenir; zaten tam
    # olan bir güne dokunmak yeniden konfeti atmasın.
    just_completed = status.complete and not was_complete
    status.just_completed = just_completed
    if just_completed and status.streak in MILESTONES:
        status.milestone = status.streak
    return status

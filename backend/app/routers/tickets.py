from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query, status as http_status
from pymongo import ReturnDocument

from ..db import get_db
from ..models import Status, Ticket, TicketCreate, TicketUpdate

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _collection():
    return get_db()["tickets"]


def _object_id(ticket_id: str) -> ObjectId:
    try:
        return ObjectId(ticket_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Geçersiz id") from None


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=list[Ticket])
async def list_tickets(
    status: Status | None = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    query = {"status": status.value} if status else {}
    cursor = _collection().find(query).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@router.get("/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str):
    doc = await _collection().find_one({"_id": _object_id(ticket_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return doc


@router.post("", response_model=Ticket, status_code=http_status.HTTP_201_CREATED)
async def create_ticket(payload: TicketCreate):
    now = _now()
    doc = {
        "title": payload.title.strip(),
        "description": payload.description,
        "status": Status.open.value,
        "created_at": now,
        "updated_at": now,
    }
    result = await _collection().insert_one(doc)
    return {**doc, "_id": result.inserted_id}


@router.patch("/{ticket_id}", response_model=Ticket)
async def update_ticket(ticket_id: str, payload: TicketUpdate):
    changes = payload.changes()
    if not changes:
        raise HTTPException(status_code=400, detail="Güncellenecek alan yok")
    if "status" in changes:
        changes["status"] = changes["status"].value
    if "title" in changes:
        changes["title"] = changes["title"].strip()
    changes["updated_at"] = _now()

    doc = await _collection().find_one_and_update(
        {"_id": _object_id(ticket_id)},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    return doc


@router.delete("/{ticket_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    result = await _collection().delete_one({"_id": _object_id(ticket_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")

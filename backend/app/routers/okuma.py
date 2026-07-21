"""Okuma / Kütüphane modülü — metadata proxy, raflar, oturum, yıllık hedef, istatistik.

Günlük puan ``entries`` (module="reading", birim=dk) üzerinden hesaplanır; her
okuma oturumu o günün toplam dakikasını entries'e yazar, böylece /summary
değişmeden çalışır. Zengin veri (kitaplar, oturumlar, hedefler) kendi
koleksiyonlarında tutulur (bkz. module-data-architecture).

Metadata birincil Google Books (ISBN-13, country=TR), yedek Open Library; ikisi
de backend proxy + MongoDB önbellek arkasından, User-Agent + iletişim
e-postasıyla çağrılır (gizlilik + rate-limit). Kapaklar yalnızca URL olarak
tutulur, GÖRSELİN bit'leri saklanmaz (telif). Kaynak bulunamazsa manuel giriş
fallback'i devrededir. Ayrıntı: docs/features/okuma/research.md
"""

from collections import Counter
from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from .. import books
from ..db import get_db
from ..deps import current_user
from ..llm import okuma_insight_llm
from ..models import BookInput, BookUpdate, ReadingGoalUpdate, ReadingSessionInput

router = APIRouter(prefix="/api/okuma", tags=["okuma"])

MODULE_KEY = "reading"
DEFAULT_TARGET_BOOKS = 12  # araştırma §5: düşük, ulaşılabilir başlangıç hedefi
SHELF_LABELS: dict[str, str] = {
    "reading": "Okuyorum",
    "to_read": "Okuyacağım",
    "finished": "Bitirdim",
}
MILESTONES: tuple[int, ...] = (3, 7, 14, 30, 60, 100, 200, 365)


def _books():
    return get_db()["reading_books"]


def _sessions():
    return get_db()["reading_sessions"]


def _goals():
    return get_db()["reading_goals"]


def _cache():
    return get_db()["book_cache"]


def _entries():
    return get_db()["entries"]


def _resolve_date(value: date_type | None) -> str:
    return (value or datetime.now(timezone.utc).date()).isoformat()


# ---------------------------------------------------------------- meta
@router.get("/meta")
async def okuma_meta(_user: dict = Depends(current_user)):
    """İstemci için raf etiketleri, kapak atıfı ve hedef varsayılanı."""
    return {
        "shelves": [{"key": k, "label": v} for k, v in SHELF_LABELS.items()],
        "default_target_books": DEFAULT_TARGET_BOOKS,
        "cover_attribution": books.COVER_ATTRIBUTION,
        "cover_attribution_url": books.COVER_ATTRIBUTION_URL,
    }


# ---------------------------------------------------------------- metadata proxy
async def _cached_lookup(isbn13: str) -> dict | None:
    """ISBN → normalize kitap. Önce MongoDB önbelleği, sonra canlı sorgu."""
    cached = await _cache().find_one({"isbn13": isbn13}, projection={"_id": 0, "book": 1})
    if cached and cached.get("book"):
        return cached["book"]

    book = await books.lookup_isbn(isbn13)
    if book:
        # Metadata olgusaldır; kapak URL'i saklanır ama GÖRSEL saklanmaz.
        await _cache().update_one(
            {"isbn13": isbn13},
            {"$set": {"book": book, "cached_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    return book


@router.get("/lookup")
async def lookup(isbn: str = Query(..., min_length=8, max_length=20), _user: dict = Depends(current_user)):
    """Barkod/elle ISBN → tek kitap. Bulunamazsa 404 (istemci manuel girişe düşer)."""
    code = books.clean_isbn(isbn)
    if not books.is_book_isbn13(code):
        raise HTTPException(
            status_code=422,
            detail="Geçersiz ISBN — 978/979 ile başlayan 13 haneli bir kitap barkodu bekleniyor.",
        )
    book = await _cached_lookup(code)
    if book is None:
        raise HTTPException(
            status_code=404,
            detail="Bu ISBN için kayıt bulunamadı. Kitabı elle ekleyebilirsin.",
        )
    return book


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=12, ge=1, le=40),
    _user: dict = Depends(current_user),
):
    results = await books.search_books(q, limit=limit)
    return {"query": q, "count": len(results), "results": results}


# ---------------------------------------------------------------- kütüphane (raflar)
def _book_public(doc: dict) -> dict:
    return {
        "book_key": doc["book_key"],
        "isbn13": doc.get("isbn13"),
        "isbn10": doc.get("isbn10"),
        "title": doc["title"],
        "subtitle": doc.get("subtitle"),
        "authors": doc.get("authors", []),
        "cover_url": doc.get("cover_url"),
        "cover_source": doc.get("cover_source"),
        "page_count": doc.get("page_count"),
        "published_year": doc.get("published_year"),
        "publisher": doc.get("publisher"),
        "subjects": doc.get("subjects", []),
        "language": doc.get("language"),
        "description": doc.get("description"),
        "source": doc.get("source"),
        "shelf": doc.get("shelf", "to_read"),
        "rating": doc.get("rating"),
        "notes": doc.get("notes"),
        "started_at": doc.get("started_at"),
        "finished_at": doc.get("finished_at"),
        "added_at": doc.get("added_at").isoformat() if doc.get("added_at") else None,
    }


def _make_book_key(payload: BookInput, user_id) -> str:
    isbn13 = books.clean_isbn(payload.isbn13)
    if books.is_book_isbn13(isbn13):
        return f"book_{isbn13}"
    # ISBN'siz manuel giriş: kullanıcı içinde başlık+yazardan kararlı bir anahtar
    # türet (aynı kitabı iki kez eklemesin), ObjectId'ye gerek yok.
    slug = "".join(ch for ch in payload.title.lower() if ch.isalnum())[:40]
    author = (payload.authors[0].lower().replace(" ", "") if payload.authors else "")[:20]
    return f"manual_{slug}_{author}" or f"manual_{slug}"


@router.get("/books")
async def list_books(
    shelf: str | None = Query(default=None),
    user: dict = Depends(current_user),
):
    query: dict = {"user_id": user["_id"]}
    if shelf in SHELF_LABELS:
        query["shelf"] = shelf
    cursor = _books().find(query).sort("added_at", -1)
    items = [_book_public(d) async for d in cursor]

    # Raf sayacı: boş raflar da 0 görünsün.
    counts = {k: 0 for k in SHELF_LABELS}
    count_cursor = _books().find({"user_id": user["_id"]}, projection={"shelf": 1, "_id": 0})
    async for d in count_cursor:
        s = d.get("shelf", "to_read")
        if s in counts:
            counts[s] += 1
    return {"counts": counts, "books": items}


@router.post("/books")
async def add_book(payload: BookInput, user: dict = Depends(current_user)):
    now = datetime.now(timezone.utc)
    book_key = _make_book_key(payload, user["_id"])
    isbn13 = books.clean_isbn(payload.isbn13) or None

    # Kapak verilmediyse ama geçerli bir kitap ISBN'i varsa Open Library kapağını
    # (yalnızca URL) türet — elle/barkodla eklenen kitap da kapaklı görünür.
    cover = payload.cover_url
    cover_source = payload.cover_source
    if not cover and isbn13 and books.is_book_isbn13(isbn13):
        cover = books.cover_url(isbn13)
        cover_source = "openlibrary"

    fields = {
        "isbn13": isbn13,
        "isbn10": books.clean_isbn(payload.isbn10) or None,
        "title": payload.title.strip(),
        "subtitle": payload.subtitle,
        "authors": payload.authors,
        "cover_url": cover,
        "cover_source": cover_source,
        "page_count": payload.page_count,
        "published_year": payload.published_year,
        "publisher": payload.publisher,
        "subjects": payload.subjects,
        "language": payload.language,
        "description": payload.description,
        "source": payload.source or "manual",
        "shelf": payload.shelf,
        "updated_at": now,
    }
    # Bitirilmiş rafına doğrudan eklenirse bitiş tarihini bugüne al (yıllık hedef
    # bundan türer). Diğer raflarda started_at'i okumaya başlayınca işaretle.
    set_on_insert = {"created_at": now, "added_at": now, "rating": None, "notes": None}
    if payload.shelf == "finished":
        set_on_insert["finished_at"] = _resolve_date(None)
    elif payload.shelf == "reading":
        set_on_insert["started_at"] = _resolve_date(None)

    doc = await _books().find_one_and_update(
        {"user_id": user["_id"], "book_key": book_key},
        {"$set": fields, "$setOnInsert": set_on_insert},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _book_public(doc)


@router.patch("/books/{book_key}")
async def update_book(book_key: str, payload: BookUpdate, user: dict = Depends(current_user)):
    existing = await _books().find_one({"user_id": user["_id"], "book_key": book_key})
    if existing is None:
        raise HTTPException(status_code=404, detail="Kitap kütüphanende yok.")

    now = datetime.now(timezone.utc)
    updates: dict = {"updated_at": now}
    unset: dict = {}
    if payload.rating is not None:
        updates["rating"] = payload.rating
    if payload.notes is not None:
        updates["notes"] = payload.notes
    if payload.started_at is not None:
        updates["started_at"] = payload.started_at.isoformat()

    if payload.shelf is not None:
        updates["shelf"] = payload.shelf
        # Rafı "bitirdim"e taşımak bitiş tarihini bugüne alır (kullanıcı elle
        # tarih vermediyse); rafı bitmişten çıkarmak tarihi temizler ki yıllık
        # sayaç şişmesin.
        if payload.shelf == "finished":
            updates["finished_at"] = (
                payload.finished_at.isoformat() if payload.finished_at else _resolve_date(None)
            )
            if not existing.get("started_at"):
                updates["started_at"] = existing.get("started_at") or _resolve_date(None)
        else:
            if existing.get("finished_at"):
                unset["finished_at"] = ""
            if payload.shelf == "reading" and not existing.get("started_at"):
                updates["started_at"] = _resolve_date(None)
    elif payload.finished_at is not None:
        updates["finished_at"] = payload.finished_at.isoformat()

    change: dict = {"$set": updates}
    if unset:
        change["$unset"] = unset
    doc = await _books().find_one_and_update(
        {"user_id": user["_id"], "book_key": book_key},
        change,
        return_document=ReturnDocument.AFTER,
    )
    return _book_public(doc)


@router.delete("/books/{book_key}", status_code=204)
async def delete_book(book_key: str, user: dict = Depends(current_user)):
    await _books().delete_one({"user_id": user["_id"], "book_key": book_key})


# ---------------------------------------------------------------- oturumlar
async def _sync_reading_entry(user_id, day: str) -> int:
    """O günün toplam okuma dakikasını entries'e yaz; günlük puan bunu okur."""
    cursor = _sessions().find(
        {"user_id": user_id, "date": day}, projection={"duration_min": 1, "_id": 0}
    )
    total = 0
    async for s in cursor:
        total += int(s.get("duration_min") or 0)
    now = datetime.now(timezone.utc)
    await _entries().find_one_and_update(
        {"user_id": user_id, "module": MODULE_KEY, "date": day},
        {"$set": {"value": float(total), "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return total


@router.post("/sessions")
async def log_session(
    payload: ReadingSessionInput,
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    now = datetime.now(timezone.utc)
    pages = None
    if payload.pages_from is not None and payload.pages_to is not None:
        pages = payload.pages_to - payload.pages_from

    doc = {
        "user_id": user["_id"],
        "date": day,
        "book_key": payload.book_key,
        "duration_min": payload.duration_min,
        "pages_from": payload.pages_from,
        "pages_to": payload.pages_to,
        "pages": pages,
        "created_at": now,
    }
    result = await _sessions().insert_one(doc)
    day_total_min = await _sync_reading_entry(user["_id"], day)

    return {
        "id": str(result.inserted_id),
        "date": day,
        "book_key": payload.book_key,
        "duration_min": payload.duration_min,
        "pages": pages,
        "day_total_min": day_total_min,
    }


@router.get("/sessions")
async def list_sessions(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = _resolve_date(date)
    cursor = _sessions().find({"user_id": user["_id"], "date": day}).sort("created_at", 1)
    sessions = []
    total_min = 0
    total_pages = 0
    async for s in cursor:
        sessions.append({
            "id": str(s["_id"]),
            "book_key": s.get("book_key"),
            "duration_min": s.get("duration_min"),
            "pages": s.get("pages"),
        })
        total_min += int(s.get("duration_min") or 0)
        total_pages += int(s.get("pages") or 0)
    return {"date": day, "sessions": sessions, "total_min": total_min, "total_pages": total_pages}


# ---------------------------------------------------------------- yıllık hedef
async def _completed_this_year(user_id, year: int) -> int:
    """shelf==finished ve finished_at yılı == year olan kitap sayısı."""
    lo, hi = f"{year}-01-01", f"{year}-12-31"
    return await _books().count_documents(
        {"user_id": user_id, "shelf": "finished", "finished_at": {"$gte": lo, "$lte": hi}}
    )


def _current_year() -> int:
    return datetime.now(timezone.utc).year


@router.get("/goal")
async def get_goal(
    year: int | None = Query(default=None, ge=2000, le=2100),
    user: dict = Depends(current_user),
):
    year = year or _current_year()
    doc = await _goals().find_one({"user_id": user["_id"], "year": year})
    target_books = (doc or {}).get("target_books", DEFAULT_TARGET_BOOKS)
    target_pages = (doc or {}).get("target_pages")
    completed = await _completed_this_year(user["_id"], year)
    ratio = min(completed / target_books, 1.0) if target_books else 0.0
    return {
        "year": year,
        "target_books": target_books,
        "completed_books": completed,
        "target_pages": target_pages,
        "ratio": round(ratio, 3),
        "is_custom": bool(doc),
    }


@router.put("/goal")
async def set_goal(
    payload: ReadingGoalUpdate,
    year: int | None = Query(default=None, ge=2000, le=2100),
    user: dict = Depends(current_user),
):
    year = year or _current_year()
    now = datetime.now(timezone.utc)
    updates: dict = {"updated_at": now}
    if payload.target_books is not None:
        updates["target_books"] = payload.target_books
    if payload.target_pages is not None:
        updates["target_pages"] = payload.target_pages
    await _goals().find_one_and_update(
        {"user_id": user["_id"], "year": year},
        {"$set": updates, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return await get_goal(year=year, user=user)


# ---------------------------------------------------------------- istatistik
def _reading_streak(session_days: set[str], anchor: date_type) -> int:
    """`anchor` merkezli arka arkaya okuma günü. Bugün henüz okumadıysa dünden
    geriye sayılır — gün içinde seri sıfır görünmesin (bkz. brush)."""
    start = anchor if anchor.isoformat() in session_days else anchor - timedelta(days=1)
    streak = 0
    day = start
    while day.isoformat() in session_days:
        streak += 1
        day -= timedelta(days=1)
    return streak


@router.get("/stats")
async def stats(
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    year = _current_year()
    end = date_type.fromisoformat(_resolve_date(date))

    # Bitirilen kitaplar → sayı, sayfa, yazar/tür agregasyonu, ortalama puan.
    finished_cursor = _books().find({"user_id": user["_id"], "shelf": "finished"})
    finished = 0
    total_pages_finished = 0
    authors: Counter = Counter()
    subjects: Counter = Counter()
    ratings: list[int] = []
    async for b in finished_cursor:
        finished += 1
        total_pages_finished += int(b.get("page_count") or 0)
        for a in b.get("authors", []):
            authors[a] += 1
        for s in b.get("subjects", []):
            subjects[s] += 1
        if b.get("rating"):
            ratings.append(int(b["rating"]))

    # Oturumlar → toplam süre/sayfa, aylık ritim, okuma günü serisi.
    total_min = 0
    total_pages_sessions = 0
    session_days: set[str] = set()
    monthly: Counter = Counter()
    sess_cursor = _sessions().find({"user_id": user["_id"]})
    async for s in sess_cursor:
        total_min += int(s.get("duration_min") or 0)
        total_pages_sessions += int(s.get("pages") or 0)
        d = s.get("date")
        if d:
            session_days.add(d)
            monthly[d[:7]] += int(s.get("duration_min") or 0)

    streak = _reading_streak(session_days, end)
    best = _best_run(session_days)

    # Son 6 ay ritim (dakika), eskiden yeniye.
    months = []
    cursor_month = end.replace(day=1)
    seq = []
    for _ in range(6):
        seq.append(cursor_month.isoformat()[:7])
        # bir önceki ayın son gününe git
        cursor_month = (cursor_month - timedelta(days=1)).replace(day=1)
    for key in reversed(seq):
        months.append({"month": key, "minutes": int(monthly.get(key, 0))})

    return {
        "finished_count": finished,
        "finished_this_year": await _completed_this_year(user["_id"], year),
        "total_pages": total_pages_sessions or total_pages_finished,
        "total_minutes": total_min,
        "top_authors": [{"name": a, "count": c} for a, c in authors.most_common(5)],
        "top_subjects": [{"name": s, "count": c} for s, c in subjects.most_common(5)],
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "monthly": months,
        "streak": streak,
        "best_streak": best,
        "next_milestone": next((m for m in MILESTONES if m > streak), None),
    }


def _best_run(days: set[str]) -> int:
    if not days:
        return 0
    ordered = sorted(date_type.fromisoformat(d) for d in days)
    best = run = 1
    for prev, cur in zip(ordered, ordered[1:]):
        run = run + 1 if cur - prev == timedelta(days=1) else 1
        best = max(best, run)
    return best


# ---------------------------------------------------------------- öneri / içgörü
def _rule_insight(goal: dict, stats_data: dict, day: date_type) -> dict:
    """Yıllık hedefe kalınan tempoya göre deterministik, nazik içgörü.

    Araştırma §5: hedef gerçekçi tutulmalı; aşırı oyunlaştırma değil, ilerleme
    görselleştirmesi merkezde. Streak baskı aracı değil, bilgi olarak sunulur.
    """
    target = goal.get("target_books") or DEFAULT_TARGET_BOOKS
    completed = goal.get("completed_books", 0)
    # Yılın ne kadarı geçti → beklenen tempo.
    day_of_year = day.timetuple().tm_yday
    year_fraction = day_of_year / 366.0
    expected = target * year_fraction
    on_track = completed >= expected - 0.5

    notes = []
    if completed >= target:
        headline = f"{target} kitaplık yıllık hedefini tamamladın 🎉"
        notes.append("Dilersen hedefi biraz yükseltebilir ya da olduğu gibi keyfine bakabilirsin.")
    elif on_track:
        headline = f"Hedefinde iyi gidiyorsun — {completed}/{target} kitap."
        notes.append("Bu tempoyla yıl sonu hedefini tutarsın. İstikrar, hızdan önemli.")
    else:
        remaining = max(target - completed, 0)
        weeks_left = max(round((366 - day_of_year) / 7), 1)
        headline = f"{completed}/{target} kitap — hedefe {remaining} kitap kaldı."
        notes.append(
            f"Yıl sonuna ~{weeks_left} hafta var. Hedefi zorlayıcı buluyorsan "
            "düşürmek de bir seçenek; ulaşılabilir hedef motivasyonu korur."
        )
    if stats_data.get("streak", 0) >= 3:
        notes.append(f"{stats_data['streak']} gündür okuyorsun — güzel bir ritim.")

    return {
        "source": "rule",
        "headline": headline,
        "on_track": on_track,
        "completed_books": completed,
        "target_books": target,
        "notes": notes,
    }


@router.get("/insight")
async def insight(
    llm: bool = Query(default=False, description="Varsa LLM ile doğal dil özeti üret"),
    date: date_type | None = None,
    user: dict = Depends(current_user),
):
    day = date_type.fromisoformat(_resolve_date(date))
    goal = await get_goal(year=day.year, user=user)
    stats_data = await stats(date=date, user=user)
    base = _rule_insight(goal, stats_data, day)

    if llm:
        summary = await okuma_insight_llm(base, stats_data)
        if summary:
            base["summary"] = summary
            base["source"] = "rule+llm"
    return base

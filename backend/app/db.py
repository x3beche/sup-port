import certifi
from pymongo import ASCENDING, AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from .config import settings

_client: AsyncMongoClient | None = None
_db: AsyncDatabase | None = None


def _uses_tls(uri: str) -> bool:
    # mongodb+srv:// implies TLS; a plain mongodb:// only uses it when asked.
    # Passing tlsCAFile to a non-TLS connection is a configuration error, which
    # is exactly what a local CI mongo container would hit.
    lowered = uri.lower()
    return lowered.startswith("mongodb+srv://") or "tls=true" in lowered or "ssl=true" in lowered


async def connect() -> AsyncDatabase:
    global _client, _db
    tls_options = {"tlsCAFile": certifi.where()} if _uses_tls(settings.mongo_uri) else {}
    _client = AsyncMongoClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=8000,
        # BSON has no timezone, so without this reads come back naive and the
        # client sees a different shape than the one POST returned.
        tz_aware=True,
        **tls_options,
    )
    await _client.admin.command("ping")
    _db = _client[settings.db_name]
    await _ensure_indexes(_db)
    return _db


async def _ensure_indexes(db: AsyncDatabase) -> None:
    # Two accounts on one email would make login ambiguous.
    await db["users"].create_index([("email", ASCENDING)], unique=True)
    # One row per user/module/day is what makes upserts idempotent.
    await db["entries"].create_index(
        [("user_id", ASCENDING), ("module", ASCENDING), ("date", ASCENDING)],
        unique=True,
    )
    # /summary ve /summary/week bir kullanıcının bir tarih aralığındaki TÜM
    # modüllerini modülden bağımsız çeker; module ortada olan tekil indeks bu
    # aralığı tarayamıyordu. Bu destek indeksi o sıcak yolu aralık taramasına
    # çevirir (anasayfa her açılışta ikisini de çağırır).
    await db["entries"].create_index([("user_id", ASCENDING), ("date", ASCENDING)])
    # Diş fırçalama yuvaları: bir kullanıcı/gün için tek belge, upsert idempotent.
    await db["brush_days"].create_index(
        [("user_id", ASCENDING), ("date", ASCENDING)],
        unique=True,
    )
    # Seri hesabı yalnızca "tam" günlerin tarihlerini ister. complete belgeye
    # denormalize edildiği için bu indeks sorguyu kapalı tarama (covered) yapar:
    # belge okunmaz, tarih doğrudan indeksten gelir.
    await db["brush_days"].create_index(
        [("user_id", ASCENDING), ("complete", ASCENDING), ("date", ASCENDING)],
    )
    # Revoked tokens are only useful until they expire on their own, so Mongo
    # drops each entry at its own expires_at instead of the list growing forever.
    await db["revoked_tokens"].create_index("expires_at", expireAfterSeconds=0)
    # Refresh tokens self-expire the same way; the TTL keeps the rotation ledger
    # from accumulating dead single-use entries.
    await db["refresh_tokens"].create_index("expires_at", expireAfterSeconds=0)
    # Reuse-detection revokes an entire user's chain, so that lookup needs an index.
    await db["refresh_tokens"].create_index([("user_id", ASCENDING)])


def get_db() -> AsyncDatabase:
    if _db is None:
        raise RuntimeError("Veritabanına bağlanılmadı — önce connect() çağır.")
    return _db


async def ping() -> None:
    if _client is None:
        raise RuntimeError("Veritabanına bağlanılmadı — önce connect() çağır.")
    await _client.admin.command("ping")


async def close() -> None:
    global _client, _db
    if _client is not None:
        await _client.close()
    _client = None
    _db = None

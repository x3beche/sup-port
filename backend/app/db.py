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
    # Spor: profil kullanıcı başına tek belge.
    await db["spor_profiles"].create_index([("user_id", ASCENDING)], unique=True)
    # Vücut ölçümü: kullanıcı/gün tek belge (upsert), tarih aralığı sorgusu için sıralı.
    await db["body_metrics"].create_index(
        [("user_id", ASCENDING), ("date", ASCENDING)],
        unique=True,
    )
    # Antrenmanlar: günde birden çok olabilir; kullanıcı+tarih aralık sorgusu
    # (günlük liste, haftalık hedef) bu indeksi kullanır.
    await db["workouts"].create_index([("user_id", ASCENDING), ("date", ASCENDING)])
    # Yemek: her öğe ayrı belge (öğün türüne göre gruplanır). Günlük liste ve
    # öğün-sayısı rollup'ı kullanıcı+tarih aralık sorgusuyla okur.
    await db["meals"].create_index([("user_id", ASCENDING), ("date", ASCENDING)])
    # Beslenme profili (yalnızca yaş; gerisi spor_profiles ile paylaşılır):
    # kullanıcı başına tek belge.
    await db["nutrition_profiles"].create_index([("user_id", ASCENDING)], unique=True)
    # Okuma kütüphanesi: kullanıcı başına kitap tekil (book_key), upsert idempotent.
    await db["reading_books"].create_index(
        [("user_id", ASCENDING), ("book_key", ASCENDING)],
        unique=True,
    )
    # Raf listesi ve yıllık hedef türetimi (finished + finished_at.year) bu sıralı
    # indeksi kullanır; shelf denormalize olduğu için raf filtresi indeksten gelir.
    await db["reading_books"].create_index(
        [("user_id", ASCENDING), ("shelf", ASCENDING), ("finished_at", ASCENDING)],
    )
    # Okuma oturumları: günde birden çok olabilir; günlük toplam (puan senkronu) ve
    # istatistik/ritim sorguları kullanıcı+tarih aralığını tarar.
    await db["reading_sessions"].create_index([("user_id", ASCENDING), ("date", ASCENDING)])
    # Yıllık okuma hedefi: kullanıcı+yıl tek belge, upsert idempotent.
    await db["reading_goals"].create_index(
        [("user_id", ASCENDING), ("year", ASCENDING)],
        unique=True,
    )
    # Kitap metadata önbelleği (kullanıcılar arası ortak, olgusal/CC0 veri): ISBN
    # tekil. Katalog nadiren değiştiği için TTL yok — hem hız hem rate-limit koruması.
    await db["book_cache"].create_index([("isbn13", ASCENDING)], unique=True)
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

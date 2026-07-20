import certifi
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from .config import settings

_client: AsyncMongoClient | None = None
_db: AsyncDatabase | None = None


async def connect() -> AsyncDatabase:
    global _client, _db
    _client = AsyncMongoClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=8000,
        tlsCAFile=certifi.where(),
        # BSON has no timezone, so without this reads come back naive and the
        # client sees a different shape than the one POST returned.
        tz_aware=True,
    )
    await _client.admin.command("ping")
    _db = _client[settings.db_name]
    return _db


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

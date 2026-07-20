"""Çıkış yapılan oturumların token kara listesi.

JWT durumsuzdur: imza geçerli olduğu sürece sunucu onu kabul eder. Çıkışın
gerçekten bir anlamı olması için iptal edilen token'ın jti'si burada tutulur.
Kayıtlar token'ın kendi son kullanma tarihinde TTL indeksiyle otomatik silinir,
yani liste süresiz büyümez.
"""

from datetime import datetime

from .db import get_db
from .security import TokenClaims

COLLECTION = "revoked_tokens"


def _collection():
    return get_db()[COLLECTION]


async def revoke(claims: TokenClaims) -> None:
    await _collection().update_one(
        {"_id": claims.jti},
        {"$set": {"expires_at": claims.expires_at, "revoked_at": datetime.now(claims.expires_at.tzinfo)}},
        upsert=True,
    )


async def is_revoked(jti: str) -> bool:
    return await _collection().find_one({"_id": jti}, {"_id": 1}) is not None

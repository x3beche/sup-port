"""Refresh token kayıtları: rotation + yeniden-kullanım (replay) tespiti.

Her refresh token'ın jti'si burada bir kayıt tutar. Yenileme sırasında kayıt
ATOMİK olarak silinir (`consume`) ve yeni bir refresh token üretilip yeni jti
saklanır — yani her refresh token yalnızca BİR kez kullanılabilir (rotation).

Zaten tüketilmiş bir jti ile gelen, imzası hâlâ geçerli bir refresh token
çalınmış/tekrar oynatılmış demektir; bu durumda o kullanıcının tüm refresh
zinciri iptal edilir (`revoke_all`), böylece hırsız da meşru kullanıcı da
yeniden giriş yapmak zorunda kalır.

Kayıtlar kendi `expires_at` tarihlerinde TTL indeksiyle (bkz. db.py) otomatik
silinir, yani koleksiyon süresiz büyümez.
"""

from datetime import datetime

from .db import get_db

COLLECTION = "refresh_tokens"


def _collection():
    return get_db()[COLLECTION]


async def store(jti: str, user_id: str, expires_at: datetime) -> None:
    await _collection().insert_one(
        {
            "_id": jti,
            "user_id": user_id,
            "expires_at": expires_at,
            "created_at": datetime.now(expires_at.tzinfo),
        }
    )


async def consume(jti: str) -> bool:
    """jti'yi atomik olarak siler. Kayıt gerçekten vardıysa True döner (yani
    geçerli ve ilk kez kullanılıyor); yoksa False (süresi dolmuş ya da zaten
    kullanılmış = olası replay)."""
    doc = await _collection().find_one_and_delete({"_id": jti})
    return doc is not None


async def revoke(jti: str) -> None:
    await _collection().delete_one({"_id": jti})


async def revoke_all(user_id: str) -> None:
    await _collection().delete_many({"user_id": user_id})

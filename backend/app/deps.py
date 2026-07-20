from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import get_db
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Geçersiz veya eksik oturum",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if credentials is None:
        raise UNAUTHORIZED

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise UNAUTHORIZED

    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise UNAUTHORIZED from None

    # A token stays cryptographically valid after the account is deleted, so the
    # user has to still exist.
    user = await get_db()["users"].find_one({"_id": oid})
    if user is None:
        raise UNAUTHORIZED
    return user

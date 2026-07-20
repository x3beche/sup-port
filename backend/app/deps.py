from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import get_db
from .revocation import is_revoked
from .security import TokenClaims, decode_access_token

bearer = HTTPBearer(auto_error=False)

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Geçersiz veya eksik oturum",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> TokenClaims:
    if credentials is None:
        raise UNAUTHORIZED

    claims = decode_access_token(credentials.credentials)
    if claims is None:
        raise UNAUTHORIZED

    # A signed token stays cryptographically valid after logout, so the denylist
    # is what actually ends the session.
    if await is_revoked(claims.jti):
        raise UNAUTHORIZED

    return claims


async def current_user(claims: TokenClaims = Depends(current_claims)) -> dict:
    try:
        oid = ObjectId(claims.user_id)
    except (InvalidId, TypeError):
        raise UNAUTHORIZED from None

    # A token also outlives account deletion, so the user has to still exist.
    user = await get_db()["users"].find_one({"_id": oid})
    if user is None:
        raise UNAUTHORIZED
    return user

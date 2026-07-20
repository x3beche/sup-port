import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

# bcrypt silently truncates at 72 bytes, so reject longer input instead of
# letting two different passwords hash to the same value.
MAX_PASSWORD_BYTES = 72


@dataclass(frozen=True)
class TokenClaims:
    user_id: str
    # Unique per token, so a single session can be revoked without touching the
    # user's other devices.
    jti: str
    expires_at: datetime


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(days=settings.access_token_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenClaims | None:
    """Returns the token's claims, or None when it is invalid or expired."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None

    sub, jti, exp = payload.get("sub"), payload.get("jti"), payload.get("exp")
    if not isinstance(sub, str) or not isinstance(exp, (int, float)):
        return None
    # Tokens issued before revocation existed have no jti and cannot be revoked
    # individually, so they are refused outright rather than trusted forever.
    if not isinstance(jti, str):
        return None

    return TokenClaims(
        user_id=sub,
        jti=jti,
        expires_at=datetime.fromtimestamp(exp, tz=timezone.utc),
    )

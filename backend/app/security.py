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


# Precomputed hash of an unguessable value. Verifying an incoming password against
# it spends the same bcrypt time as a real check, so an unknown-email login costs
# as long as a wrong-password one and latency can't reveal which emails exist.
_DUMMY_HASH = bcrypt.hashpw(b"timing-equalizer-not-a-real-password", bcrypt.gensalt())


def dummy_verify(password: str) -> None:
    """Runs a throwaway bcrypt compare to keep login timing constant."""
    try:
        bcrypt.checkpw(password.encode("utf-8"), _DUMMY_HASH)
    except ValueError:
        pass


# Short-lived access tokens plus long-lived, rotating refresh tokens: a stolen
# access token is only useful for minutes, and the refresh token is single-use.
ACCESS_TYPE = "access"
REFRESH_TYPE = "refresh"


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return _encode(
        {
            "sub": user_id,
            "jti": uuid.uuid4().hex,
            "typ": ACCESS_TYPE,
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_minutes),
        }
    )


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at); the caller persists jti for rotation."""
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(days=settings.refresh_token_days)
    token = _encode(
        {
            "sub": user_id,
            "jti": jti,
            "typ": REFRESH_TYPE,
            "iat": now,
            "exp": expires_at,
        }
    )
    return token, jti, expires_at


def _decode(token: str, expected_type: str) -> TokenClaims | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None

    sub, jti, exp = payload.get("sub"), payload.get("jti"), payload.get("exp")
    # Access tokens issued before the refresh split carried no "typ"; treat a
    # missing type as access so those sessions keep working until they expire.
    typ = payload.get("typ", ACCESS_TYPE)
    if not isinstance(sub, str) or not isinstance(exp, (int, float)):
        return None
    # Tokens issued before revocation existed have no jti and cannot be revoked
    # individually, so they are refused outright rather than trusted forever.
    if not isinstance(jti, str):
        return None
    # A refresh token must never be accepted where an access token is expected
    # (and vice versa), even though both are signed with the same key.
    if typ != expected_type:
        return None

    return TokenClaims(
        user_id=sub,
        jti=jti,
        expires_at=datetime.fromtimestamp(exp, tz=timezone.utc),
    )


def decode_access_token(token: str) -> TokenClaims | None:
    """Returns the access token's claims, or None when invalid/expired/wrong-type."""
    return _decode(token, ACCESS_TYPE)


def decode_refresh_token(token: str) -> TokenClaims | None:
    """Returns the refresh token's claims, or None when invalid/expired/wrong-type."""
    return _decode(token, REFRESH_TYPE)

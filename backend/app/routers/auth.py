from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.errors import DuplicateKeyError

from ..db import get_db
from ..deps import current_claims, current_user
from ..models import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    User,
)
from ..ratelimit import SlidingWindowLimiter, client_ip, enforce
from ..refresh import consume as consume_refresh
from ..refresh import revoke as revoke_refresh
from ..refresh import revoke_all as revoke_all_refresh
from ..refresh import store as store_refresh
from ..revocation import revoke as revoke_access
from ..security import (
    TokenClaims,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    dummy_verify,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Brute-force / credential-stuffing throttles. Per-email caps guesses against a
# single account (proxy-independent); per-IP caps sign-up spam and enumeration
# sweeps. See ratelimit.py for the storage caveat under multi-worker deploys.
_FIVE_MIN = 5 * 60
_ONE_HOUR = 60 * 60
_login_ip_limiter = SlidingWindowLimiter(max_hits=30, window_seconds=_FIVE_MIN)
_login_email_limiter = SlidingWindowLimiter(max_hits=10, window_seconds=_FIVE_MIN)
_register_ip_limiter = SlidingWindowLimiter(max_hits=10, window_seconds=_ONE_HOUR)


UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Oturum yenilenemedi, tekrar giriş yap",
)


def _normalise_email(email: str) -> str:
    return email.strip().lower()


async def _issue_tokens(user: User) -> AuthResponse:
    """Yeni bir access + refresh token çifti üretir ve refresh'i rotation için
    kaydeder. register/login/refresh üçü de buradan çıkar."""
    access = create_access_token(user.id)
    refresh_token, jti, expires_at = create_refresh_token(user.id)
    await store_refresh(jti, user.id, expires_at)
    return AuthResponse(access_token=access, refresh_token=refresh_token, user=user)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request):
    enforce(_register_ip_limiter, f"register-ip:{client_ip(request)}")
    doc = {
        "email": _normalise_email(payload.email),
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = await get_db()["users"].insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta zaten kayıtlı",
        ) from None

    user = User.model_validate({**doc, "_id": result.inserted_id})
    return await _issue_tokens(user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request):
    email = _normalise_email(payload.email)
    # Throttle before touching the DB: a coarse per-IP cap plus a tighter per-email
    # cap that directly limits guesses against one account.
    enforce(_login_ip_limiter, f"login-ip:{client_ip(request)}")
    enforce(_login_email_limiter, f"login-email:{email}")

    user = await get_db()["users"].find_one({"email": email})

    # Same response — and same bcrypt cost — whether the email is unknown or the
    # password is wrong, so neither the body nor the latency can enumerate accounts.
    if user is None:
        dummy_verify(payload.password)
        valid = False
    else:
        valid = verify_password(payload.password, user["password_hash"])

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya parola hatalı",
        )

    # A legitimate user who just fixed their password shouldn't stay locked out.
    _login_email_limiter.reset(f"login-email:{email}")
    parsed = User.model_validate(user)
    return await _issue_tokens(parsed)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest):
    """Refresh token'ı yeni bir access + refresh çiftiyle takas eder (rotation).

    Refresh token tek kullanımlıktır: burada tüketilir ve yenisi verilir. Zaten
    tüketilmiş bir jti ile gelen geçerli imzalı token replay/çalıntı sayılır ve
    kullanıcının TÜM refresh zinciri iptal edilir.
    """
    claims = decode_refresh_token(payload.refresh_token)
    if claims is None:
        raise UNAUTHORIZED

    # Atomic single-use: succeeds once. A second use of the same jti lands here as
    # False → the token was already rotated, so treat it as theft and burn the chain.
    if not await consume_refresh(claims.jti):
        await revoke_all_refresh(claims.user_id)
        raise UNAUTHORIZED

    try:
        oid = ObjectId(claims.user_id)
    except (InvalidId, TypeError):
        raise UNAUTHORIZED from None
    user = await get_db()["users"].find_one({"_id": oid})
    if user is None:
        raise UNAUTHORIZED

    return await _issue_tokens(User.model_validate(user))


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    claims: TokenClaims = Depends(current_claims),
    payload: LogoutRequest | None = None,
):
    """Bu oturumun token'larını iptal eder; diğer cihazlardaki oturumlar etkilenmez.

    Access token denylist'e alınır; istekle birlikte refresh token da gelirse o
    da rotation defterinden silinir, böylece kopyalanmış bir refresh token bile
    çıkıştan sonra yenileme yapamaz.
    """
    await revoke_access(claims)
    if payload and payload.refresh_token:
        rc = decode_refresh_token(payload.refresh_token)
        # Only revoke a refresh token that belongs to the same session's user.
        if rc is not None and rc.user_id == claims.user_id:
            await revoke_refresh(rc.jti)

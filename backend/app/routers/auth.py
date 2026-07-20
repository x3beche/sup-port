from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from ..db import get_db
from ..deps import current_user
from ..models import AuthResponse, LoginRequest, RegisterRequest, User
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalise_email(email: str) -> str:
    return email.strip().lower()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
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
    return AuthResponse(access_token=create_access_token(user.id), user=user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    user = await get_db()["users"].find_one({"email": _normalise_email(payload.email)})

    # Same response whether the email is unknown or the password is wrong, so the
    # endpoint cannot be used to enumerate registered accounts.
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya parola hatalı",
        )

    parsed = User.model_validate(user)
    return AuthResponse(access_token=create_access_token(parsed.id), user=parsed)


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return user

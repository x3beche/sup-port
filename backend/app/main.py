import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close, connect, ping
from .routers import auth, tracker

logger = logging.getLogger("sup-port")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect()
    print(f"MongoDB bağlandı — db: {settings.db_name}")
    yield
    await close()


app = FastAPI(title="sup-port API", version="0.2.0", lifespan=lifespan)

# The Expo web client and the S23 both call this API from a different origin.
# Native builds send no Origin (CORS is browser-only); the web client is what
# this governs. Defaults to "*" for dev — pin CORS_ORIGINS in production.
# Credentials stay off: auth is a Bearer header, not a cookie, and "*" + creds
# is an invalid (and unsafe) combination anyway.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Host-header injection koruması. Varsayılan "*" (dev) → no-op; production'da
# ALLOWED_HOSTS ile kendi alan adına sabitlenir.
if settings.allowed_hosts != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

# Savunma derinliği: temel güvenlik başlıkları. Asıl TLS/HSTS sonlandırması ters
# proxy'de olmalı, ama proxy yanlış yapılandırılsa bile bu başlıklar gitsin.
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    # HTTP yanıtında tarayıcı bunu yok sayar; HTTPS'te 6 ay + alt alan adları.
    "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response


app.include_router(auth.router)
app.include_router(tracker.router)


@app.get("/health")
async def health():
    try:
        await ping()
    except Exception:
        # Detail goes to the logs, not the response: raw driver errors can carry
        # host/credential fragments an unauthenticated caller shouldn't see.
        logger.exception("health check failed")
        return JSONResponse(status_code=503, content={"status": "error"})
    return {"status": "ok", "db": settings.db_name}


@app.get("/version")
async def version():
    """Çalışan container'ın derlendiği/deploy edildiği git SHA'sını bildirir.

    Deploy workflow GIT_SHA ortam değişkenini her redeploy'da yeni commit'e
    ayarlar; bu uç, Portainer'ın çağrıyı kabul etmesinin ötesinde canlı
    backend'in gerçekten yeni kodu aldığını doğrulamak için kullanılır.
    """
    sha = os.environ.get("GIT_SHA", "unknown")
    short = sha[:7] if sha and sha != "unknown" else "unknown"
    return {"sha": sha, "short_sha": short}

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close, connect, ping
from .routers import auth, tracker


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect()
    print(f"MongoDB bağlandı — db: {settings.db_name}")
    yield
    await close()


app = FastAPI(title="sup-port API", version="0.2.0", lifespan=lifespan)

# The Expo web client and the S23 both call this API from a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tracker.router)


@app.get("/health")
async def health():
    try:
        await ping()
    except Exception as err:
        return JSONResponse(
            status_code=503, content={"status": "error", "message": str(err)}
        )
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

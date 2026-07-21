"""Android uygulama güncelleme bilgisi (self-update için).

Uygulama GitHub API'sine DEĞİL, bu uca bağlanır: dağıtımın kontrolü bizde kalır
(zorunlu güvenlik güncellemesi, aşamalı yayınım, GitHub rate-limitinden bağımsızlık,
ileride repoyu private yapabilme). Büyük APK dosyasını yine GitHub CDN servis eder
(apk_url release asset'ine işaret eder) — sunucu bant genişliği harcanmaz.

Uç GitHub'ın son release'ini sunucu tarafında (httpx) çekip önbelleğe alır; gelen
istek sayısı ne olursa olsun GitHub'a en fazla TTL'de bir gidilir. Kimlik doğrulama
gerektirmez (sürüm bilgisi hassas değil; giriş öncesi de kontrol edilebilsin diye).
"""

import os
import time

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/app", tags=["app-update"])

GITHUB_REPO = os.getenv("GITHUB_REPO", "x3beche/sup-port")
CACHE_TTL_SECONDS = 600  # GitHub'a en fazla 10 dakikada bir git

# time.monotonic scriptlerde değil, normal runtime'da güvenli.
_cache: dict = {"data": None, "ts": 0.0}


def _normalize(release: dict) -> dict:
    apk = next(
        (
            a.get("browser_download_url")
            for a in release.get("assets", [])
            if str(a.get("name", "")).endswith(".apk")
        ),
        None,
    )
    return {
        "version": str(release.get("tag_name") or "").lstrip("v"),
        "apk_url": apk,
        "release_url": release.get("html_url"),
        "notes": release.get("body") or "",
        "published_at": release.get("published_at"),
    }


@router.get("/latest")
async def latest_release():
    now = time.monotonic()
    if _cache["data"] and now - _cache["ts"] < CACHE_TTL_SECONDS:
        return _cache["data"]

    url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers={"Accept": "application/vnd.github+json"})
            resp.raise_for_status()
            data = _normalize(resp.json())
        _cache["data"] = data
        _cache["ts"] = now
        return data
    except Exception:
        # GitHub erişilemezse/limitli ise bayat da olsa önbelleği ver.
        if _cache["data"]:
            return _cache["data"]
        return JSONResponse(status_code=503, content={"error": "release bilgisi alınamadı"})

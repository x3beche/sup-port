"""Süreç-içi (in-memory) kayan pencere hız sınırlayıcı.

Kaba kuvvet ve credential-stuffing'e karşı auth uçlarını korur. Yeni bağımlılık
eklememek için yalnızca standart kütüphane kullanır.

Durum PROCESS BAŞINADIR. Buradaki tek-container dağıtımı için yeterli; API
birden çok worker/replica'ya ölçeklenirse limit worker sayısıyla çarpılır, o
durumda paylaşımlı bir depoya (Redis) taşınmalı.
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import HTTPException, Request, status

from .config import settings

# Bellek sınırsız büyümesin: bu kadar hit'te bir boşalmış anahtarları temizle.
_PRUNE_EVERY = 512


class SlidingWindowLimiter:
    """Anahtar başına `window` saniyede en fazla `max_hits` isteğe izin verir."""

    def __init__(self, max_hits: int, window_seconds: float) -> None:
        self.max_hits = max_hits
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._ops = 0

    def hit(self, key: str) -> float | None:
        """İsteği kaydeder. İzin varsa None; sınır aşıldıysa saniye cinsinden
        beklenmesi gereken süreyi döner (bu durumda istek sayıya EKLENMEZ)."""
        now = time.monotonic()
        cutoff = now - self.window

        bucket = self._hits.get(key)
        if bucket is None:
            bucket = self._hits[key] = deque()
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        self._ops += 1
        if self._ops >= _PRUNE_EVERY:
            self._prune(now)

        if len(bucket) >= self.max_hits:
            # En eski hit pencereden çıkınca yeni denemeye yer açılır.
            return bucket[0] + self.window - now
        bucket.append(now)
        return None

    def reset(self, key: str) -> None:
        """Bir anahtarın sayacını sıfırlar (örn. başarılı girişten sonra)."""
        self._hits.pop(key, None)

    def _prune(self, now: float) -> None:
        cutoff = now - self.window
        self._ops = 0
        for key in list(self._hits.keys()):
            bucket = self._hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if not bucket:
                del self._hits[key]


def client_ip(request: Request) -> str:
    """İstek sahibinin IP'si.

    Bu başlıklar istemci tarafından taklit edilebildiği için yalnızca
    `TRUST_FORWARDED_FOR` açıkken (önümüzde güvenilen bir proxy olduğunu
    bildiğimizde) dikkate alınır; aksi halde soket IP'si kullanılır.

    ÖNEMLİ: Güvenilen proxy (ör. Nginx Proxy Manager) gerçek istemciyi
    `X-Real-IP`'ye yazar ve `X-Forwarded-For`'un SONUNA ekler. Bu yüzden
    X-Real-IP tercih edilir, yoksa XFF'nin EN SAĞDAKİ girdisi alınır. XFF'nin
    en solu istemci-kontrollüdür (proxy onu olduğu gibi taşır) — asla ona
    güvenilmez, aksi halde saldırgan sahte bir başlıkla IP limitini atlatır.
    """
    if settings.trust_forwarded_for:
        real = request.headers.get("x-real-ip")
        if real and real.strip():
            return real.strip()
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded and forwarded.strip():
            # Proxy'nin eklediği gerçek istemci en sağdadır.
            return forwarded.split(",")[-1].strip()
    client = request.client
    return client.host if client else "unknown"


def enforce(limiter: SlidingWindowLimiter, key: str) -> None:
    """Sınır aşıldıysa Retry-After başlıklı 429 fırlatır."""
    if not settings.rate_limit_enabled:
        return
    retry_after = limiter.hit(key)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla deneme. Lütfen biraz sonra tekrar dene.",
            headers={"Retry-After": str(max(1, int(retry_after + 0.999)))},
        )

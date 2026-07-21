import os
from pathlib import Path

import yaml

# config.yaml lives at the repo root and is gitignored, so the credentials never
# ship in the app bundle. Env vars win so deploys can override without a file.
CONFIG_PATH = Path(
    os.getenv("CONFIG_PATH", Path(__file__).resolve().parents[2] / "config.yaml")
)


def _env_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _csv_list(raw: object) -> list[str]:
    """Virgülle ayrılmış dize ya da liste → temizlenmiş liste. Boş/whitespace
    girdi ["*"]'a düşer: aksi halde boş bir allow-list TÜM istekleri reddederek
    API'yi kilitlerdi (fail-open değil ama en azından fail-safe-open)."""
    if isinstance(raw, str):
        items = [item.strip() for item in raw.split(",") if item.strip()]
    elif isinstance(raw, list):
        items = [str(item).strip() for item in raw if str(item).strip()]
    else:
        items = []
    return items or ["*"]


def _read_config_file() -> dict:
    try:
        return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except FileNotFoundError:
        return {}
    except yaml.YAMLError as err:
        raise RuntimeError(f"config.yaml ayrıştırılamadı ({CONFIG_PATH}): {err}") from err


class Settings:
    def __init__(self) -> None:
        data = _read_config_file()
        self.mongo_uri: str | None = os.getenv("MONGODB_URI") or data.get("mongodb_uri")
        self.db_name: str | None = os.getenv("DB_NAME") or data.get("db_name")
        self.port: int = int(os.getenv("PORT", "4000"))

        # A rotating secret would invalidate every issued token on restart, so this
        # must be a stable value kept out of git.
        self.jwt_secret: str | None = os.getenv("JWT_SECRET") or data.get("jwt_secret")
        self.jwt_algorithm = "HS256"
        # Short access token + long rotating refresh token. A stolen access token
        # expires in minutes; the refresh token is single-use and revocable.
        self.access_token_minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
        self.refresh_token_days = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))

        # Native app makes no CORS preflight (no Origin header); only the web
        # client does. Default is permissive for dev, but production should pin
        # this to the web origin(s): CORS_ORIGINS=https://app.example.com,https://...
        self.cors_origins: list[str] = _csv_list(
            os.getenv("CORS_ORIGINS") or data.get("cors_origins")
        )

        # Host allow-list (Host-header injection koruması). Varsayılan dev için
        # "*"; production'da kendi alan adına sabitle: ALLOWED_HOSTS=api.example.com
        self.allowed_hosts: list[str] = _csv_list(
            os.getenv("ALLOWED_HOSTS") or data.get("allowed_hosts")
        )

        # Only honour X-Forwarded-For for rate-limit keying when a trusted proxy
        # sits in front; otherwise the header is client-spoofable and would let an
        # attacker rotate fake IPs to dodge the limiter. See ratelimit.client_ip.
        self.trust_forwarded_for: bool = _env_bool(
            os.getenv("TRUST_FORWARDED_FOR"), bool(data.get("trust_forwarded_for", False))
        )

        # LLM (OpenRouter, OpenAI uyumlu) — öneri/özet üretimi için. Opsiyonel:
        # yoksa LLM özellikleri devre dışı kalır, uygulama yine açılır. Model
        # ucuz tutulur (girdi+çıktı 1M'de < 0.50 USD).
        self.openrouter_api_key: str | None = (
            os.getenv("OPENROUTER_API_KEY") or data.get("openrouter_api_key")
        )
        self.openrouter_model: str = (
            os.getenv("OPENROUTER_MODEL")
            or data.get("openrouter_model")
            or "google/gemini-2.5-flash-lite"
        )
        self.openrouter_base_url: str = (
            os.getenv("OPENROUTER_BASE_URL")
            or data.get("openrouter_base_url")
            or "https://openrouter.ai/api/v1"
        )

        # Rate limiting is on by default (production). Test/CI turns it off so a
        # suite that registers many users from one IP isn't throttled.
        self.rate_limit_enabled: bool = _env_bool(
            os.getenv("RATE_LIMIT_ENABLED"), bool(data.get("rate_limit_enabled", True))
        )

        if not self.mongo_uri or not self.db_name:
            raise RuntimeError(
                f"mongodb_uri ve db_name gerekli. {CONFIG_PATH} dosyasına ekle ya da "
                "MONGODB_URI / DB_NAME ortam değişkenlerini tanımla."
            )
        if not self.jwt_secret:
            raise RuntimeError(
                f"jwt_secret gerekli. {CONFIG_PATH} dosyasına ekle ya da JWT_SECRET "
                "ortam değişkenini tanımla. Üretmek için: "
                "python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )


settings = Settings()

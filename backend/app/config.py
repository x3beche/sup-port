import os
from pathlib import Path

import yaml

# config.yaml lives at the repo root and is gitignored, so the credentials never
# ship in the app bundle. Env vars win so deploys can override without a file.
CONFIG_PATH = Path(
    os.getenv("CONFIG_PATH", Path(__file__).resolve().parents[2] / "config.yaml")
)


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

        if not self.mongo_uri or not self.db_name:
            raise RuntimeError(
                f"mongodb_uri ve db_name gerekli. {CONFIG_PATH} dosyasına ekle ya da "
                "MONGODB_URI / DB_NAME ortam değişkenlerini tanımla."
            )


settings = Settings()

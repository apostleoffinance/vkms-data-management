from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Repo root .env first, then backend/.env overrides (when running from backend/)
    model_config = SettingsConfigDict(
        env_file=(_BACKEND_DIR.parent / ".env", _BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Votage Kids Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://vkms:vkms_secret@localhost:5432/vkms_db"

    JWT_SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    CORS_ORIGINS: str = "http://localhost:3000"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    RATE_LIMIT: str = "100/minute"

    DEFAULT_ADMIN_EMAIL: str = "admin@votagekids.org"
    DEFAULT_ADMIN_PASSWORD: str = "Admin123!"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    KIOSK_ENABLED: bool = True
    KIOSK_TOKEN: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

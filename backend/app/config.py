from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

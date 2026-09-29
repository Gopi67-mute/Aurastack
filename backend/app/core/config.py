from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ — app/core/config.py -> app/core -> app -> backend.
# Resolved from __file__, not the process CWD: uvicorn started from the repo
# root would otherwise load the frontend's .env (which has no MONGODB_URI) and
# fail with a confusing ValidationError.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    mongodb_uri: str
    mongodb_db_name: str = "aurastack"

    clerk_jwt_issuer: str
    clerk_secret_key: str | None = None
    jwt_audience: str | None = None

    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str
    mongodb_db_name: str = "aurastack"

    clerk_jwt_issuer: str
    clerk_secret_key: str | None = None
    jwt_audience: str | None = None

    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()

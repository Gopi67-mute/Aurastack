from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ — app/core/config.py -> app/core -> app -> backend.
# Resolved from __file__, not the process CWD: uvicorn started from the repo
# root would otherwise load the frontend's .env (which has no MONGODB_URI) and
# fail with a confusing ValidationError.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]

#: How long a "generating" project may go without finishing before reads treat
#: the attempt as dead and allow a retry. Deliberately not an environment
#: variable: it must stay above the generation timeout, which Settings enforces.
GENERATION_LEASE_SECONDS = 120


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

    ai_provider: Literal["deterministic", "gemini"] = "deterministic"
    # Upper bound is the lease: a provider call can then never outlive the
    # window in which its project is reported as actively generating.
    # The default leaves headroom over a typical Gemini curriculum (~20s).
    ai_generation_timeout_seconds: float = Field(default=60, gt=0, lt=GENERATION_LEASE_SECONDS)

    # Backend-only secret: SecretStr keeps it out of reprs, logs and errors.
    # Only required when AI_PROVIDER=gemini; must never reach the mobile app.
    gemini_api_key: SecretStr | None = Field(default=None, validate_default=True)
    gemini_model: str = Field(default="gemini-3.5-flash", min_length=1)

    @field_validator("gemini_api_key")
    @classmethod
    def _require_gemini_key(cls, value: SecretStr | None, info: ValidationInfo) -> SecretStr | None:
        # Fails at startup rather than on the first project created.
        if info.data.get("ai_provider") == "gemini" and (
            value is None or not value.get_secret_value().strip()
        ):
            raise ValueError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()

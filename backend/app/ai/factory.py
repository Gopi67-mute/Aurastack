from app.ai.deterministic_provider import DeterministicProvider
from app.ai.gemini_provider import GeminiProvider
from app.ai.provider import AIProvider
from app.core.config import Settings


def create_provider(settings: Settings) -> AIProvider:
    """The provider selected by `AI_PROVIDER`.

    Settings already restricts the value to known providers, and requires
    GEMINI_API_KEY for Gemini, so misconfiguration fails at startup rather
    than here.
    """

    if settings.ai_provider == "deterministic":
        return DeterministicProvider()
    if settings.ai_provider == "gemini":
        if settings.gemini_api_key is None:  # Unreachable after Settings validation; narrows the type.
            raise ValueError("GEMINI_API_KEY is not configured")
        return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)
    raise ValueError(f"Unsupported AI provider: {settings.ai_provider}")

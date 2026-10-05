"""Opt-in smoke test against the real Gemini API.

Skipped unless explicitly enabled, so the normal suite and CI never call
Gemini or need a key. It never touches MongoDB. Run it with:

    GEMINI_LIVE_TEST=1 GEMINI_API_KEY=... pytest tests/test_gemini_live.py
"""

import os

import pytest
from pydantic import SecretStr

from app.ai.gemini_provider import GeminiProvider
from app.ai.provider import CurriculumRequest
from app.ai.schemas import parse_curriculum_output
from app.core.config import Settings

_ENABLED = os.environ.get("GEMINI_LIVE_TEST") == "1"
_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

pytestmark = [
    pytest.mark.skipif(not _ENABLED, reason="live Gemini test: set GEMINI_LIVE_TEST=1 to run"),
    pytest.mark.skipif(not _API_KEY, reason="live Gemini test: GEMINI_API_KEY is not set"),
]


@pytest.mark.asyncio
async def test_gemini_generates_a_valid_project_specific_curriculum() -> None:
    model = os.environ.get("GEMINI_MODEL") or Settings.model_fields["gemini_model"].default
    provider = GeminiProvider(api_key=SecretStr(_API_KEY), model=model)

    raw = await provider.generate_curriculum(
        CurriculumRequest(
            project_name="Recipe Box",
            description="A small web app to save recipes and plan weekly meals.",
            platforms=("web",),
            tech_stack=(),
        )
    )

    output = parse_curriculum_output(raw)  # Raises unless it satisfies CurriculumOutputV1.
    text = " ".join(f"{topic.title} {topic.description}" for topic in output.topics).lower()
    assert any(word in text for word in ("recipe", "meal")), "curriculum is not project-specific"

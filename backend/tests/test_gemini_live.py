"""Opt-in smoke tests against the real Gemini API: curriculum and blueprint.

Skipped unless explicitly enabled, so the normal suite and CI never call
Gemini or need a key. It never touches MongoDB. Run it with:

    GEMINI_LIVE_TEST=1 GEMINI_API_KEY=... pytest tests/test_gemini_live.py
"""

import os
import time

import pytest
from pydantic import SecretStr

from app.ai.gemini_provider import GeminiProvider
from app.ai.provider import BlueprintRequest, CurriculumRequest, CurriculumTopicSummary
from app.ai.schemas import parse_blueprint_output, parse_curriculum_output
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


@pytest.mark.asyncio
async def test_gemini_generates_a_valid_curriculum_consistent_blueprint() -> None:
    model = os.environ.get("GEMINI_MODEL") or Settings.model_fields["gemini_model"].default
    timeout = Settings.model_fields["ai_generation_timeout_seconds"].default
    provider = GeminiProvider(api_key=SecretStr(_API_KEY), model=model)
    curriculum = (
        CurriculumTopicSummary(1, "Planning the Recipe Box architecture", "Map screens, API and data."),
        CurriculumTopicSummary(2, "Modelling recipes and ingredients in MongoDB", "Design the documents."),
        CurriculumTopicSummary(3, "Building the recipe API with FastAPI", "Builds on the data model."),
        CurriculumTopicSummary(4, "Recipe list and detail screens in React", "Consume the recipe API."),
        CurriculumTopicSummary(5, "Weekly meal planner calendar", "Assign recipes to days."),
        CurriculumTopicSummary(6, "Generating a shopping list from the meal plan", "Aggregate ingredients."),
    )

    started = time.monotonic()
    raw = await provider.generate_blueprint(
        BlueprintRequest(
            project_name="Recipe Box",
            description="A small web app to save recipes and plan weekly meals.",
            platforms=("web",),
            tech_stack=("React", "FastAPI", "MongoDB"),
            curriculum=curriculum,
        )
    )
    latency = time.monotonic() - started

    output = parse_blueprint_output(raw)  # Raises unless it satisfies BlueprintOutputV2.
    stack = [choice.name.casefold() for choice in output.tech_stack]
    print(
        f"\nGemini blueprint: model={model} latency={latency:.1f}s tech_stack={len(output.tech_stack)} "
        f"components={len(output.architecture.components)} phases={len(output.roadmap)}"
    )
    print(f"  stack: {[choice.name for choice in output.tech_stack]}")
    print(f"  phases: {[phase.title for phase in output.roadmap]}")

    assert latency < timeout, f"blueprint took {latency:.1f}s, over the {timeout}s generation timeout"
    text = raw.casefold()
    assert any(word in text for word in ("recipe", "meal")), "blueprint is not project-specific"
    for chosen in ("react", "fastapi", "mongodb"):
        assert any(chosen in name for name in stack), f"user tech stack entry {chosen} was dropped"
    # A concept only the curriculum mentions: the blueprint must reflect it.
    assert "shopping" in text, "blueprint does not reflect the curriculum"

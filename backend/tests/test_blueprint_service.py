"""BlueprintService: the blueprint lifecycle, independent of the curriculum's."""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from google.genai import types

from app.ai.deterministic_provider import DeterministicProvider
from app.ai.prompts import BLUEPRINT_PROMPT_VERSION, build_blueprint_prompt
from app.ai.provider import BlueprintRequest, CurriculumTopicSummary
from app.ai.schemas import BLUEPRINT_SCHEMA_VERSION
from app.schemas.project import ProjectCreateRequest, ProjectUpdateRequest
from app.services.activity_service import ActivityService
from app.services.blueprint_service import (
    BlueprintClaim,
    BlueprintConflictError,
    BlueprintService,
)
from app.services.generation_service import (
    FAILURE_INTERNAL_ERROR,
    FAILURE_INVALID_OUTPUT,
    FAILURE_PROVIDER_ERROR,
    FAILURE_TIMEOUT,
    GenerationService,
)
from app.services.learning_service import LearningService
from app.services.project_service import GENERATION_LEASE, ProjectNotFoundError, ProjectService
from tests.fakes import (
    FakeActivityRepository,
    FakeBlueprintRepository,
    FakeLearningRepository,
    FakeProjectRepository,
)
from tests.test_blueprint_schemas import VALID_OUTPUT, _blueprint, _phase
from tests.test_gemini_provider import API_KEY, FakeGemini, _provider, _quota_error, _raising, _response, _returning

USER = "user-a"
PROJECT_TEXT = ("Private Venture", "confidential plan")


class StaticProvider:
    """Returns fixed raw output; records the requests it receives."""

    name = "static"
    model: str | None = "static-model-1"

    def __init__(self, raw: str = VALID_OUTPUT) -> None:
        self.raw = raw
        self.requests: list[BlueprintRequest] = []

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        self.requests.append(request)
        return self.raw


class SlowProvider:
    name = "slow"
    model: str | None = None

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        await asyncio.sleep(10)
        return VALID_OUTPUT


class BrokenProvider:
    name = "broken"
    model: str | None = None

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        raise RuntimeError("upstream exploded with api_key=sk-secret")


class Harness:
    def __init__(self, provider: Any = None, timeout_seconds: float = 5) -> None:
        self.projects = FakeProjectRepository()
        self.learning = FakeLearningRepository()
        self.activity = FakeActivityRepository()
        self.blueprints = FakeBlueprintRepository()
        self.project_service = ProjectService(self.projects, self.learning, self.activity, self.blueprints)
        self.learning_service = LearningService(self.projects, self.learning, ActivityService(self.activity))
        self.generation = GenerationService(
            self.projects, self.learning, DeterministicProvider(), timeout_seconds=5
        )
        self.service = BlueprintService(
            self.projects,
            self.learning,
            self.blueprints,
            provider or DeterministicProvider(),
            timeout_seconds=timeout_seconds,
        )

    async def ready_project(self, **overrides: Any) -> str:
        payload = {"title": "Grocery Tracker", "description": "a mobile app", "platforms": ["android"]}
        payload.update(overrides)
        _, claim = await self.project_service.create_project(USER, ProjectCreateRequest(**payload))
        await self.generation.run(claim)
        assert self.project(claim.project_id)["status"] == "ready"
        return claim.project_id

    async def generated(self, project_id: str) -> BlueprintClaim:
        _, claim = await self.service.claim(USER, project_id)
        await self.service.run(claim)
        return claim

    def project(self, project_id: str) -> dict[str, Any]:
        return self.projects._docs[project_id]

    def doc(self, project_id: str) -> dict[str, Any]:
        return self.blueprints._docs[project_id]

    def set_provider(self, provider: Any) -> None:
        self.service._provider = provider


def _ago(delta: timedelta) -> str:
    return (datetime.now(timezone.utc) - delta).isoformat()


def _expire(harness: Harness, project_id: str) -> None:
    harness.doc(project_id)["started_at"] = _ago(GENERATION_LEASE + timedelta(seconds=1))


async def _project_snapshot(harness: Harness, project_id: str) -> tuple[Any, ...]:
    """Everything about the project the blueprint lifecycle must never change."""

    project = harness.project(project_id)
    learning = await harness.learning_service.get_project_learning(USER, project_id)
    return (
        project["status"],
        dict(project["curriculum"]),
        dict(project["generation"]),
        project.get("tech_stack"),
        [(topic.id, topic.status) for topic in learning.topics],
        (await harness.project_service.get_project(USER, project_id)).model_dump(),
    )


# --- success path -----------------------------------------------------------


@pytest.mark.asyncio
async def test_missing_then_generating_then_ready() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    assert (await harness.service.get_blueprint(USER, project_id)).status == "missing"

    claimed, claim = await harness.service.claim(USER, project_id)

    assert claimed.status == "generating" and claimed.blueprint is None
    assert (claim.attempt, claim.curriculum_version) == (1, 1)
    assert (await harness.service.get_blueprint(USER, project_id)).status == "generating"

    await harness.service.run(claim)

    blueprint = await harness.service.get_blueprint(USER, project_id)
    assert blueprint.status == "ready"
    assert blueprint.blueprint is not None
    assert "Grocery Tracker" in blueprint.blueprint.summary
    doc = harness.doc(project_id)
    assert blueprint.generatedAt == doc["meta"]["generated_at"] == doc["completed_at"]
    assert doc["status"] == "ready"
    assert doc["failure_reason"] is None
    assert doc["schema_version"] == BLUEPRINT_SCHEMA_VERSION == "2.0"
    assert doc["meta"] == {
        "attempt": 1,
        "curriculum_version": 1,
        "schema_version": "2.0",
        "prompt_version": BLUEPRINT_PROMPT_VERSION,
        "source": "deterministic",
        "model": None,
        "generated_at": doc["meta"]["generated_at"],
    }


@pytest.mark.asyncio
async def test_blueprint_follows_the_saved_curriculum() -> None:
    harness = Harness()
    project_id = await harness.ready_project()

    await harness.generated(project_id)

    learning = await harness.learning_service.get_project_learning(USER, project_id)
    blueprint = (await harness.service.get_blueprint(USER, project_id)).blueprint
    assert blueprint is not None
    # Every topic is applied in a phase, in learning order, under its saved title.
    linked = [(item.topicOrder, item.topicTitle) for phase in blueprint.roadmap for item in phase.learning]
    assert linked == [(topic.order, topic.title) for topic in learning.topics]


@pytest.mark.asyncio
async def test_provider_receives_project_facts_and_curriculum_summaries_only() -> None:
    provider = StaticProvider()
    harness = Harness(provider)
    project_id = await harness.ready_project(platforms=["web", "ios"])
    await harness.project_service.update_project(USER, project_id, ProjectUpdateRequest(techStack=["Expo"]))

    await harness.generated(project_id)

    learning = await harness.learning_service.get_project_learning(USER, project_id)
    [request] = provider.requests
    assert request == BlueprintRequest(
        project_name="Grocery Tracker",
        description="a mobile app",
        platforms=("web", "ios"),
        tech_stack=("Expo",),
        curriculum=tuple(
            CurriculumTopicSummary(topic.order, topic.title, topic.description)
            for topic in learning.topics
        ),
    )
    # Lesson content never reaches the provider's prompt. (The deterministic
    # library reuses `what` as the topic description, so it is not checked.)
    prompt = build_blueprint_prompt(request)
    for topic in learning.topics:
        for section in (topic.content.how, topic.content.example, topic.content.apply):
            assert section not in prompt


@pytest.mark.asyncio
async def test_generated_tech_stack_never_overwrites_the_users_tech_stack() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.project_service.update_project(USER, project_id, ProjectUpdateRequest(techStack=["Expo"]))

    await harness.generated(project_id)

    assert harness.project(project_id)["tech_stack"] == ["Expo"]
    assert (await harness.project_service.get_project(USER, project_id)).techStack == ["Expo"]
    generated = (await harness.service.get_blueprint(USER, project_id)).blueprint
    assert generated is not None and len(generated.techStack) > 1


@pytest.mark.asyncio
async def test_output_is_normalised_before_persistence() -> None:
    raw = _blueprint()
    choice = raw["tech_stack"][1]
    raw["tech_stack"] = [
        {**choice, "category": category, "name": name}
        for category, name in (
            ("other", "Sentry"),
            ("database", "MongoDB"),
            ("frontend", "Expo"),
            ("frontend", "NativeWind"),
            ("backend", "FastAPI"),
        )
    ]

    def phase(order: int, title: str, depends_on: list[int], topic_order: int | None) -> dict[str, Any]:
        learning = [] if topic_order is None else [{"topic_order": topic_order, "application": "a"}]
        return {**_phase(order), "title": title, "depends_on": depends_on, "learning": learning}

    raw["roadmap"] = [phase(9, "Release", [3, 5], 2), phase(3, "Setup", [], 1), phase(5, "Core", [3], None)]
    harness = Harness(StaticProvider(json.dumps(raw)))
    project_id = await harness.ready_project()
    topics = (await harness.learning_service.get_project_learning(USER, project_id)).topics

    await harness.generated(project_id)

    stored = harness.doc(project_id)["blueprint"]
    assert [(c["category"], c["name"]) for c in stored["tech_stack"]] == [
        ("frontend", "Expo"),
        ("frontend", "NativeWind"),
        ("backend", "FastAPI"),
        ("database", "MongoDB"),
        ("other", "Sentry"),
    ]
    # Renumbered 1..n, with dependencies renumbered to the same phases.
    assert [(p["order"], p["title"], p["depends_on"]) for p in stored["roadmap"]] == [
        (1, "Setup", []),
        (2, "Core", [1]),
        (3, "Release", [1, 2]),
    ]
    # Learning links carry the saved curriculum's titles.
    assert stored["roadmap"][0]["learning"] == [
        {"topic_order": 1, "application": "a", "topic_title": topics[0].title}
    ]
    assert stored["roadmap"][2]["learning"][0]["topic_title"] == topics[1].title
    # Persisted snake_case, without the provider's schema_version.
    assert set(stored) == {"summary", "assumptions", "tech_stack", "architecture", "roadmap"}
    assert stored["architecture"]["components"][0]["connections"] == [
        {"target": "api", "interaction": "HTTPS JSON with a session token."}
    ]
    assert set(stored["architecture"]) == {
        "style", "overview", "components", "flows", "failure_modes", "tradeoffs"
    }
    assert harness.doc(project_id)["meta"]["source"] == "static"
    assert harness.doc(project_id)["meta"]["model"] == "static-model-1"


@pytest.mark.asyncio
async def test_learning_links_outside_the_saved_curriculum_are_rejected() -> None:
    raw = _blueprint()
    raw["roadmap"][0]["learning"] = [{"topic_order": 99, "application": "a"}]
    harness = Harness(StaticProvider(json.dumps(raw)))
    project_id, before = await _failing_run(harness)

    await _assert_failed(harness, project_id, FAILURE_INVALID_OUTPUT, before)


# --- failure path -----------------------------------------------------------


async def _assert_failed(harness: Harness, project_id: str, reason: str, before: tuple[Any, ...]) -> None:
    doc = harness.doc(project_id)
    assert doc["status"] == "failed"
    assert doc["failure_reason"] == reason
    assert doc["completed_at"] is not None
    assert doc["blueprint"] is None and doc["meta"] is None
    client = await harness.service.get_blueprint(USER, project_id)
    assert (client.status, client.blueprint, client.generatedAt) == ("failed", None, None)
    # A blueprint failure never touches the project, its curriculum or progress.
    assert await _project_snapshot(harness, project_id) == before


async def _failing_run(harness: Harness) -> tuple[str, tuple[Any, ...]]:
    project_id = await harness.ready_project()
    topic = (await harness.learning_service.get_project_learning(USER, project_id)).topics[0]
    await harness.learning_service.complete_topic(USER, project_id, topic.id)
    before = await _project_snapshot(harness, project_id)
    _, claim = await harness.service.claim(USER, project_id)
    await asyncio.wait_for(harness.service.run(claim), timeout=2)
    return project_id, before


@pytest.mark.asyncio
async def test_timeout_fails_the_blueprint_only() -> None:
    harness = Harness(SlowProvider(), timeout_seconds=0.05)
    project_id, before = await _failing_run(harness)

    await _assert_failed(harness, project_id, FAILURE_TIMEOUT, before)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "raw",
    [
        "not json at all",
        "```json\n" + VALID_OUTPUT + "\n```",
        json.dumps({**_blueprint(), "schema_version": "9.9"}),
        json.dumps({**_blueprint(), "warnings": ["an invented section"]}),
    ],
)
async def test_invalid_output_fails_the_blueprint_only(raw: str) -> None:
    harness = Harness(StaticProvider(raw))
    project_id, before = await _failing_run(harness)

    await _assert_failed(harness, project_id, FAILURE_INVALID_OUTPUT, before)


@pytest.mark.asyncio
async def test_provider_error_fails_safely() -> None:
    harness = Harness(BrokenProvider())
    project_id, before = await _failing_run(harness)

    await _assert_failed(harness, project_id, FAILURE_PROVIDER_ERROR, before)
    assert "sk-secret" not in json.dumps(harness.doc(project_id))


@pytest.mark.asyncio
async def test_unexpected_crash_fails_as_internal_error() -> None:
    harness = Harness()

    async def crash(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        raise RuntimeError("database cursor exploded")

    project_id = await harness.ready_project()
    before = await _project_snapshot(harness, project_id)
    _, claim = await harness.service.claim(USER, project_id)
    harness.learning.list_topics = crash  # type: ignore[method-assign]

    await harness.service.run(claim)

    del harness.learning.list_topics  # Restore the real method for the snapshot.
    await _assert_failed(harness, project_id, FAILURE_INTERNAL_ERROR, before)


@pytest.mark.asyncio
async def test_run_never_raises_even_if_failure_cannot_be_recorded() -> None:
    harness = Harness(BrokenProvider())
    project_id = await harness.ready_project()
    _, claim = await harness.service.claim(USER, project_id)

    async def db_down(*args: Any, **kwargs: Any) -> bool:
        raise ConnectionError("db down")

    harness.blueprints.finalize = db_down  # type: ignore[method-assign]

    await harness.service.run(claim)  # Must not raise.

    # Unrecorded, so the lease expiring is what makes it read failed.
    assert harness.doc(project_id)["status"] == "generating"
    _expire(harness, project_id)
    assert (await harness.service.get_blueprint(USER, project_id)).status == "failed"


@pytest.mark.asyncio
async def test_ambiguous_ready_finalize_keeps_the_blueprint() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    _, claim = await harness.service.claim(USER, project_id)
    original = harness.blueprints.finalize
    calls = 0

    async def finalize(*args: Any, **kwargs: Any) -> bool:
        nonlocal calls
        calls += 1
        applied = await original(*args, **kwargs)
        if calls == 1:
            raise ConnectionError("connection reset after the write was applied")
        return applied

    harness.blueprints.finalize = finalize  # type: ignore[method-assign]

    await harness.service.run(claim)

    assert harness.doc(project_id)["status"] == "ready"
    assert (await harness.service.get_blueprint(USER, project_id)).status == "ready"


# --- claims, retries and fencing --------------------------------------------


@pytest.mark.asyncio
async def test_concurrent_claims_allow_exactly_one_winner() -> None:
    harness = Harness()
    project_id = await harness.ready_project()

    results = await asyncio.gather(
        *(harness.service.claim(USER, project_id) for _ in range(5)), return_exceptions=True
    )

    claims = [result for result in results if not isinstance(result, BaseException)]
    conflicts = [result for result in results if isinstance(result, BlueprintConflictError)]
    assert len(claims) == 1
    assert len(conflicts) == 4
    assert {conflict.reason for conflict in conflicts} == {"generating"}
    assert harness.doc(project_id)["attempt"] == 1


@pytest.mark.asyncio
async def test_retry_after_failure_claims_the_next_attempt() -> None:
    harness = Harness(BrokenProvider())
    project_id = await harness.ready_project()
    first = await harness.generated(project_id)
    assert (await harness.service.get_blueprint(USER, project_id)).status == "failed"

    harness.set_provider(DeterministicProvider())
    retry = await harness.generated(project_id)

    assert retry.attempt == first.attempt + 1 == 2
    assert harness.doc(project_id)["meta"]["attempt"] == 2
    assert (await harness.service.get_blueprint(USER, project_id)).status == "ready"


@pytest.mark.asyncio
async def test_retry_after_expired_lease_is_allowed() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.service.claim(USER, project_id)
    _expire(harness, project_id)
    assert (await harness.service.get_blueprint(USER, project_id)).status == "failed"

    claimed, retry = await harness.service.claim(USER, project_id)

    assert claimed.status == "generating"
    assert retry.attempt == 2


@pytest.mark.asyncio
async def test_active_generation_rejects_a_new_claim() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.service.claim(USER, project_id)

    with pytest.raises(BlueprintConflictError) as excinfo:
        await harness.service.claim(USER, project_id)
    assert excinfo.value.reason == "generating"
    assert harness.doc(project_id)["attempt"] == 1


@pytest.mark.asyncio
async def test_ready_and_current_blueprint_rejects_a_new_claim() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.generated(project_id)

    with pytest.raises(BlueprintConflictError) as excinfo:
        await harness.service.claim(USER, project_id)
    assert excinfo.value.reason == "ready"
    assert harness.doc(project_id)["attempt"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("project_status", ["generating", "failed", "expired"])
async def test_project_that_is_not_ready_rejects_a_claim(project_status: str) -> None:
    harness = Harness()
    _, generation = await harness.project_service.create_project(
        USER, ProjectCreateRequest(title="P", description="d", platforms=["web"])
    )
    project = harness.project(generation.project_id)
    if project_status == "failed":
        project["status"] = "failed"
    if project_status == "expired":
        project["generation"]["started_at"] = _ago(GENERATION_LEASE + timedelta(seconds=1))

    with pytest.raises(BlueprintConflictError) as excinfo:
        await harness.service.claim(USER, generation.project_id)

    assert excinfo.value.reason == "project_not_ready"
    assert harness.blueprints._docs == {}
    assert (await harness.service.get_blueprint(USER, generation.project_id)).status == "missing"


@pytest.mark.asyncio
async def test_another_users_project_is_not_found() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.generated(project_id)

    with pytest.raises(ProjectNotFoundError):
        await harness.service.get_blueprint("user-b", project_id)
    with pytest.raises(ProjectNotFoundError):
        await harness.service.claim("user-b", project_id)
    assert harness.doc(project_id)["attempt"] == 1


@pytest.mark.asyncio
async def test_stale_attempt_can_never_finalize() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    _, stale = await harness.service.claim(USER, project_id)
    # The first worker stalls past its lease and a retry takes over.
    _expire(harness, project_id)
    _, current = await harness.service.claim(USER, project_id)

    await harness.service.run(stale)

    doc = harness.doc(project_id)
    assert (doc["status"], doc["attempt"], doc["blueprint"]) == ("generating", 2, None)

    await harness.service.run(current)

    assert harness.doc(project_id)["meta"]["attempt"] == current.attempt == 2
    assert (await harness.service.get_blueprint(USER, project_id)).status == "ready"


@pytest.mark.asyncio
async def test_stale_attempt_cannot_record_a_failure_over_the_current_one() -> None:
    harness = Harness(BrokenProvider())
    project_id = await harness.ready_project()
    _, stale = await harness.service.claim(USER, project_id)
    _expire(harness, project_id)
    _, current = await harness.service.claim(USER, project_id)

    await harness.service.run(stale)

    assert harness.doc(project_id)["status"] == "generating"
    assert harness.doc(project_id)["attempt"] == current.attempt


# --- curriculum versions ----------------------------------------------------


async def _regenerate_curriculum(harness: Harness, project_id: str) -> None:
    """The project gets a newer active curriculum, as a future regeneration would."""

    project = harness.project(project_id)
    project["status"] = "failed"
    _, retry = await harness.generation.claim_retry(USER, project_id)
    await harness.generation.run(retry)
    assert harness.project(project_id)["curriculum"]["version"] == 2


@pytest.mark.asyncio
async def test_blueprint_of_an_older_curriculum_reads_missing_and_regenerates() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.generated(project_id)

    await _regenerate_curriculum(harness, project_id)

    stale = await harness.service.get_blueprint(USER, project_id)
    assert (stale.status, stale.blueprint, stale.generatedAt) == ("missing", None, None)

    _, claim = await harness.service.claim(USER, project_id)
    assert (claim.attempt, claim.curriculum_version) == (2, 2)
    await harness.service.run(claim)

    assert harness.doc(project_id)["meta"]["curriculum_version"] == 2
    assert (await harness.service.get_blueprint(USER, project_id)).status == "ready"


@pytest.mark.asyncio
@pytest.mark.parametrize("legacy_version", [None, "1.0"], ids=["unrecorded", "older"])
async def test_blueprint_of_an_older_schema_version_reads_missing_and_regenerates(
    legacy_version: str | None,
) -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.generated(project_id)
    # A blueprint stored before the 2.0 upgrade: 1.0-shaped content, and no
    # top-level schema_version (or an older one).
    doc = harness.doc(project_id)
    doc["blueprint"] = {"summary": "s", "tech_stack": [], "architecture": {"data_flow": []}, "roadmap": []}
    doc.pop("schema_version")
    if legacy_version is not None:
        doc["schema_version"] = legacy_version

    stale = await harness.service.get_blueprint(USER, project_id)  # Never parses the 1.0 shape.
    assert (stale.status, stale.blueprint, stale.generatedAt) == ("missing", None, None)

    _, claim = await harness.service.claim(USER, project_id)
    assert claim.attempt == 2
    await harness.service.run(claim)

    assert harness.doc(project_id)["schema_version"] == BLUEPRINT_SCHEMA_VERSION
    ready = await harness.service.get_blueprint(USER, project_id)
    assert ready.status == "ready" and ready.blueprint is not None
    assert ready.blueprint.architecture.flows


@pytest.mark.asyncio
async def test_run_for_a_superseded_curriculum_writes_nothing() -> None:
    provider = StaticProvider()
    harness = Harness(provider)
    project_id = await harness.ready_project()
    _, claim = await harness.service.claim(USER, project_id)
    await _regenerate_curriculum(harness, project_id)

    await harness.service.run(claim)

    assert provider.requests == []
    assert harness.doc(project_id)["status"] == "generating"
    assert (await harness.service.get_blueprint(USER, project_id)).status == "missing"


# --- project deletion -------------------------------------------------------


@pytest.mark.asyncio
async def test_deleting_the_project_deletes_its_blueprint() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    await harness.generated(project_id)

    await harness.project_service.delete_project(USER, project_id)

    assert harness.blueprints._docs == {}


@pytest.mark.asyncio
async def test_run_for_a_deleted_project_leaves_nothing_behind() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    _, claim = await harness.service.claim(USER, project_id)
    await harness.project_service.delete_project(USER, project_id)

    await harness.service.run(claim)

    assert project_id not in harness.projects._docs
    assert harness.blueprints._docs == {}


@pytest.mark.asyncio
async def test_orphan_created_after_deletion_is_removed() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    # A POST passed its ownership check, then the project was deleted (its
    # cascade found no blueprint), then the claim created the document.
    await harness.project_service.delete_project(USER, project_id)
    orphan = await harness.blueprints.claim(
        project_id,
        USER,
        curriculum_version=1,
        schema_version=BLUEPRINT_SCHEMA_VERSION,
        expired_before=_ago(GENERATION_LEASE),
        started_at=_ago(timedelta(0)),
    )
    assert orphan is not None

    await harness.service.run(BlueprintClaim(USER, project_id, attempt=1, curriculum_version=1))

    assert harness.blueprints._docs == {}
    assert project_id not in harness.projects._docs


@pytest.mark.asyncio
async def test_deletion_during_generation_does_not_resurrect_anything() -> None:
    harness = Harness()
    project_id = await harness.ready_project()
    _, claim = await harness.service.claim(USER, project_id)

    class DeletingProvider(StaticProvider):
        async def generate_blueprint(self, request: BlueprintRequest) -> str:
            await harness.project_service.delete_project(USER, project_id)
            return await super().generate_blueprint(request)

    harness.set_provider(DeletingProvider())

    await harness.service.run(claim)

    assert project_id not in harness.projects._docs
    assert harness.blueprints._docs == {}


# --- client contract and logging --------------------------------------------


@pytest.mark.asyncio
async def test_internal_fields_never_reach_the_client() -> None:
    harness = Harness(BrokenProvider())
    project_id = await harness.ready_project()
    await harness.generated(project_id)
    failed = await harness.service.get_blueprint(USER, project_id)
    harness.set_provider(StaticProvider())
    await harness.generated(project_id)
    ready = await harness.service.get_blueprint(USER, project_id)

    for blueprint in (failed, ready):
        dumped = blueprint.model_dump()
        assert set(dumped) == {"status", "blueprint", "generatedAt"}
        text = json.dumps(dumped)
        for internal in (
            "user_id", "attempt", "failure_reason", "provider_error", "prompt_version",
            "static-model-1", "curriculum_version", "schema_version", "started_at", "source",
        ):
            assert internal not in text
    assert ready.blueprint is not None
    assert set(ready.blueprint.model_dump()) == {
        "summary", "assumptions", "techStack", "architecture", "roadmap"
    }
    assert ready.blueprint.architecture.components[0].connections[0].target == "api"
    assert ready.blueprint.techStack[0].alternatives[0].name == "Flutter"
    assert ready.blueprint.roadmap[1].dependsOn == [1]


@pytest.mark.asyncio
async def test_logs_carry_identifiers_but_never_project_text_or_provider_content(
    caplog: pytest.LogCaptureFixture,
) -> None:
    harness = Harness(StaticProvider(json.dumps({**_blueprint(), "summary": 7})))

    with caplog.at_level(logging.INFO, logger="app"):
        project_id = await harness.ready_project(title=PROJECT_TEXT[0], description=PROJECT_TEXT[1])
        first = await harness.generated(project_id)
        harness.set_provider(StaticProvider())
        second = await harness.generated(project_id)

    messages = [record.getMessage() for record in caplog.records]
    claimed = [m for m in messages if m.startswith("Blueprint generation claimed")]
    finished = [m for m in messages if m.startswith("Blueprint generation finished")]
    assert claimed == [
        f"Blueprint generation claimed: user_id={USER} project_id={project_id} attempt=1 curriculum_version=1",
        f"Blueprint generation claimed: user_id={USER} project_id={project_id} attempt=2 curriculum_version=1",
    ]
    assert finished[0].startswith(
        f"Blueprint generation finished: user_id={USER} project_id={project_id} attempt={first.attempt} "
        f"curriculum_version=1 provider=static model=static-model-1 outcome={FAILURE_INVALID_OUTPUT} duration_ms="
    )
    assert f"attempt={second.attempt} curriculum_version=1 provider=static" in finished[1]
    assert "outcome=ready" in finished[1]
    for text in (*PROJECT_TEXT, "A shared grocery list app", "Layered client-server", "List CRUD"):
        assert text not in caplog.text


# --- Gemini through the lifecycle -------------------------------------------


@pytest.mark.asyncio
async def test_gemini_blueprint_becomes_ready() -> None:
    harness = Harness(_provider(_returning(_response(VALID_OUTPUT))))
    project_id = await harness.ready_project()

    await harness.generated(project_id)

    meta = harness.doc(project_id)["meta"]
    assert (meta["source"], meta["model"]) == ("gemini", "gemini-test-model")
    assert (await harness.service.get_blueprint(USER, project_id)).status == "ready"


@pytest.mark.asyncio
async def test_slow_gemini_blueprint_times_out_and_closes_the_client() -> None:
    async def hang() -> types.GenerateContentResponse:
        await asyncio.sleep(10)
        return _response(VALID_OUTPUT)

    fake = FakeGemini(hang)
    harness = Harness(_provider(fake), timeout_seconds=0.05)
    project_id, before = await _failing_run(harness)

    await _assert_failed(harness, project_id, FAILURE_TIMEOUT, before)
    assert [client.closed for client in fake.clients] == [True]


@pytest.mark.asyncio
async def test_gemini_api_error_fails_without_leaking_secrets(caplog: pytest.LogCaptureFixture) -> None:
    harness = Harness(_provider(_raising(_quota_error())))

    with caplog.at_level(logging.DEBUG):
        project_id, before = await _failing_run(harness)

    await _assert_failed(harness, project_id, FAILURE_PROVIDER_ERROR, before)
    assert "429 RESOURCE_EXHAUSTED" in caplog.text
    assert API_KEY not in caplog.text
    assert API_KEY not in json.dumps(harness.doc(project_id))


@pytest.mark.asyncio
async def test_gemini_empty_and_invalid_output_fail_with_safe_codes() -> None:
    empty = Harness(_provider(_returning(_response(None))))
    project_id, before = await _failing_run(empty)
    await _assert_failed(empty, project_id, FAILURE_PROVIDER_ERROR, before)

    fenced = Harness(_provider(_returning(_response("```json\n" + VALID_OUTPUT + "\n```"))))
    project_id, before = await _failing_run(fenced)
    await _assert_failed(fenced, project_id, FAILURE_INVALID_OUTPUT, before)

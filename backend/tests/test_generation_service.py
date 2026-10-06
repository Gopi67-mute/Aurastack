"""GenerationService: the provider-agnostic curriculum generation lifecycle."""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import pytest

from app.ai.deterministic_provider import DeterministicProvider
from app.ai.provider import CurriculumRequest
from app.schemas.project import ProjectCreateRequest
from app.services.activity_service import ActivityService
from app.services.generation_service import (
    FAILURE_INTERNAL_ERROR,
    FAILURE_INVALID_OUTPUT,
    FAILURE_PROVIDER_ERROR,
    FAILURE_TIMEOUT,
    GenerationConflictError,
    GenerationService,
)
from app.services.learning_service import LearningService, TopicNotFoundError
from app.services.project_service import (
    GENERATION_LEASE,
    GenerationClaim,
    ProjectNotFoundError,
    ProjectService,
    project_from_doc,
)
from tests.fakes import FakeActivityRepository, FakeLearningRepository, FakeProjectRepository

USER = "user-a"
CONTENT = {
    "what": "What.",
    "why": "Why.",
    "how": "How.",
    "example": "Example.",
    "apply": "Apply.",
    "miniTask": None,
}


class StaticProvider:
    """Returns fixed raw output; records the requests it receives."""

    name = "static"
    model: str | None = "static-model-1"

    def __init__(self, raw: str) -> None:
        self.raw = raw
        self.requests: list[CurriculumRequest] = []

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        self.requests.append(request)
        return self.raw


class SlowProvider:
    name = "slow"
    model: str | None = None

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        await asyncio.sleep(10)
        return "{}"


class BrokenProvider:
    name = "broken"
    model: str | None = None

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        raise RuntimeError("upstream exploded with api_key=sk-secret")


def _raw(topics: list[dict[str, Any]]) -> str:
    return json.dumps({"schema_version": "1.0", "topics": topics})


class Harness:
    def __init__(self, provider: Any = None, timeout_seconds: float = 5) -> None:
        self.projects = FakeProjectRepository()
        self.learning = FakeLearningRepository()
        self.activity = FakeActivityRepository()
        self.project_service = ProjectService(self.projects, self.learning, self.activity)
        self.learning_service = LearningService(
            self.projects, self.learning, ActivityService(self.activity)
        )
        self.generation = GenerationService(
            self.projects,
            self.learning,
            provider or DeterministicProvider(),
            timeout_seconds=timeout_seconds,
        )

    async def create(self, **overrides: Any) -> GenerationClaim:
        payload = {"title": "Grocery Tracker", "description": "a mobile app", "platforms": ["android"]}
        payload.update(overrides)
        _, claim = await self.project_service.create_project(USER, ProjectCreateRequest(**payload))
        return claim

    def doc(self, project_id: str) -> dict[str, Any]:
        return self.projects._docs[project_id]


def _ago(delta: timedelta) -> str:
    return (datetime.now(timezone.utc) - delta).isoformat()


# --- success path -----------------------------------------------------------


@pytest.mark.asyncio
async def test_deterministic_provider_generates_ready_curriculum() -> None:
    harness = Harness()
    claim = await harness.create()
    assert harness.doc(claim.project_id)["status"] == "generating"
    assert harness.doc(claim.project_id)["curriculum"] is None

    await harness.generation.run(claim)

    doc = harness.doc(claim.project_id)
    assert doc["status"] == "ready"
    assert doc["generation"]["completed_at"] is not None
    assert doc["generation"]["failure_reason"] is None
    curriculum = doc["curriculum"]
    assert curriculum["version"] == 1
    assert curriculum["schema_version"] == "1.0"
    assert curriculum["source"] == "deterministic"
    assert curriculum["model"] is None
    assert curriculum["generated_at"] == doc["generation"]["completed_at"]

    learning = await harness.learning_service.get_project_learning(USER, claim.project_id)
    assert [topic.title for topic in learning.topics][:2] == [
        "Planning your architecture",
        "React fundamentals",
    ]


@pytest.mark.asyncio
async def test_topics_get_server_owned_uuid_ids_and_source_keys() -> None:
    harness = Harness()
    claim = await harness.create()

    await harness.generation.run(claim)

    stored = harness.learning.all_topics(claim.project_id)
    assert stored
    for topic in stored:
        UUID(topic["id"])
        assert topic["id"] != topic["source_key"]
        assert topic["curriculum_version"] == 1
    assert stored[0]["source_key"] == "architecture-planning"


@pytest.mark.asyncio
async def test_same_provider_key_gets_a_new_id_per_project() -> None:
    harness = Harness()
    first, second = await harness.create(), await harness.create()

    await harness.generation.run(first)
    await harness.generation.run(second)

    def ids(project_id: str) -> set[str]:
        return {topic["id"] for topic in harness.learning.all_topics(project_id)}

    assert ids(first.project_id).isdisjoint(ids(second.project_id))


@pytest.mark.asyncio
async def test_normalisation_renumbers_orders_and_keeps_provider_sequence() -> None:
    provider = StaticProvider(
        _raw(
            [
                {"title": "Second", "description": "d", "order": 9, "content": CONTENT},
                {"key": "first", "title": "First", "description": "d", "order": 3, "content": CONTENT},
            ]
        )
    )
    harness = Harness(provider)
    claim = await harness.create()

    await harness.generation.run(claim)

    learning = await harness.learning_service.get_project_learning(USER, claim.project_id)
    assert [(topic.title, topic.order) for topic in learning.topics] == [("First", 1), ("Second", 2)]
    stored = {topic["title"]: topic for topic in harness.learning.all_topics(claim.project_id)}
    assert stored["First"]["source_key"] == "first"
    assert stored["Second"]["source_key"] is None
    assert harness.doc(claim.project_id)["curriculum"]["model"] == "static-model-1"
    assert harness.doc(claim.project_id)["curriculum"]["source"] == "static"


@pytest.mark.asyncio
async def test_provider_receives_project_facts() -> None:
    provider = StaticProvider(_raw([{"title": "T", "description": "d", "order": 1, "content": CONTENT}]))
    harness = Harness(provider)
    claim = await harness.create(platforms=["web", "ios"])

    await harness.generation.run(claim)

    assert provider.requests == [
        CurriculumRequest(
            project_name="Grocery Tracker",
            description="a mobile app",
            platforms=("web", "ios"),
            tech_stack=(),
        )
    ]


# --- failure path -----------------------------------------------------------


def _assert_failed(harness: Harness, claim: GenerationClaim, reason: str) -> None:
    doc = harness.doc(claim.project_id)
    assert doc["status"] == "failed"
    assert doc["generation"]["failure_reason"] == reason
    assert doc["generation"]["completed_at"] is not None
    assert doc["curriculum"] is None
    assert harness.learning.all_topics(claim.project_id) == []
    assert project_from_doc(doc).status == "failed"


@pytest.mark.asyncio
async def test_provider_timeout_fails_the_project() -> None:
    harness = Harness(SlowProvider(), timeout_seconds=0.05)
    claim = await harness.create()

    await asyncio.wait_for(harness.generation.run(claim), timeout=2)

    _assert_failed(harness, claim, FAILURE_TIMEOUT)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "raw",
    [
        "not json at all",
        json.dumps({"schema_version": "9.9", "topics": []}),
        # A provider-supplied id is an unknown field and is rejected outright.
        _raw([{"id": "t1", "title": "T", "description": "d", "order": 1, "content": CONTENT}]),
    ],
)
async def test_invalid_provider_output_fails_the_project(raw: str) -> None:
    harness = Harness(StaticProvider(raw))
    claim = await harness.create()

    await harness.generation.run(claim)

    _assert_failed(harness, claim, FAILURE_INVALID_OUTPUT)


@pytest.mark.asyncio
async def test_provider_exception_fails_safely() -> None:
    harness = Harness(BrokenProvider())
    claim = await harness.create()

    await harness.generation.run(claim)

    _assert_failed(harness, claim, FAILURE_PROVIDER_ERROR)
    # The stored reason is a code, never the provider's message.
    assert "sk-secret" not in json.dumps(harness.doc(claim.project_id))


@pytest.mark.asyncio
async def test_persistence_error_fails_and_discards_partial_topics() -> None:
    harness = Harness()
    claim = await harness.create()
    original_insert = harness.learning.insert_topics

    async def insert_then_crash(topics: list[dict[str, Any]]) -> None:
        await original_insert(topics[:1])
        raise ConnectionError("lost connection mid-write")

    harness.learning.insert_topics = insert_then_crash  # type: ignore[method-assign]

    await harness.generation.run(claim)

    _assert_failed(harness, claim, FAILURE_INTERNAL_ERROR)


@pytest.mark.asyncio
async def test_project_deleted_between_topic_insert_and_finalize_leaves_nothing() -> None:
    harness = Harness()
    claim = await harness.create()
    original_insert = harness.learning.insert_topics

    async def insert_racing_delete(topics: list[dict[str, Any]]) -> None:
        # The user deletes the project while the worker's insert is in flight;
        # the topics land after the delete's own cleanup already ran.
        await harness.project_service.delete_project(USER, claim.project_id)
        await original_insert(topics)
        assert harness.learning.all_topics(claim.project_id)

    harness.learning.insert_topics = insert_racing_delete  # type: ignore[method-assign]

    await harness.generation.run(claim)

    assert claim.project_id not in harness.projects._docs
    assert harness.learning.all_topics(claim.project_id) == []


# --- ambiguous finalize -----------------------------------------------------


def _finalize_applies_then_raises(harness: Harness) -> None:
    """The first finalize is applied in the database, then the reply is lost."""

    original = harness.projects.finalize_generation
    calls = 0

    async def finalize(*args: Any, **kwargs: Any) -> bool:
        nonlocal calls
        calls += 1
        applied = await original(*args, **kwargs)
        if calls == 1:
            raise ConnectionError("connection reset after the write was applied")
        return applied

    harness.projects.finalize_generation = finalize  # type: ignore[method-assign]


@pytest.mark.asyncio
async def test_ambiguous_finalize_keeps_the_active_curriculum() -> None:
    harness = Harness()
    claim = await harness.create()
    _finalize_applies_then_raises(harness)

    await harness.generation.run(claim)

    doc = harness.doc(claim.project_id)
    assert doc["status"] == "ready"
    assert doc["curriculum"]["version"] == claim.attempt
    assert doc["generation"]["failure_reason"] is None
    learning = await harness.learning_service.get_project_learning(USER, claim.project_id)
    assert len(learning.topics) > 0


@pytest.mark.asyncio
async def test_ambiguous_finalize_after_a_retry_still_removes_older_versions() -> None:
    harness = Harness(BrokenProvider())
    first = await harness.create()
    await harness.generation.run(first)
    leftover = {
        "id": "leftover-topic",
        "project_id": first.project_id,
        "curriculum_version": first.attempt,
        "source_key": None,
        "title": "Left by attempt 1",
        "description": "d",
        "order": 1,
        "content": CONTENT,
        "created_at": _ago(timedelta(0)),
    }
    await harness.learning.insert_topics([leftover])
    _, retry = await harness.generation.claim_retry(USER, first.project_id)
    harness.generation._provider = DeterministicProvider()
    _finalize_applies_then_raises(harness)

    await harness.generation.run(retry)

    versions = {topic["curriculum_version"] for topic in harness.learning.all_topics(first.project_id)}
    assert versions == {retry.attempt}
    assert harness.doc(first.project_id)["status"] == "ready"


@pytest.mark.asyncio
async def test_finalize_that_raises_without_applying_still_fails_cleanly() -> None:
    harness = Harness()
    claim = await harness.create()
    original = harness.projects.finalize_generation
    calls = 0

    async def finalize(*args: Any, **kwargs: Any) -> bool:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise ConnectionError("lost before the write reached the server")
        return await original(*args, **kwargs)

    harness.projects.finalize_generation = finalize  # type: ignore[method-assign]

    await harness.generation.run(claim)

    _assert_failed(harness, claim, FAILURE_INTERNAL_ERROR)


@pytest.mark.asyncio
async def test_topics_are_kept_when_the_project_cannot_be_reread() -> None:
    harness = Harness()
    claim = await harness.create()
    original_finalize = harness.projects.finalize_generation
    original_get = harness.projects.get_by_id_for_user
    db_down = False

    async def finalize(*args: Any, **kwargs: Any) -> bool:
        nonlocal db_down
        if db_down:
            raise ConnectionError("db down")
        await original_finalize(*args, **kwargs)
        db_down = True  # The write applied; then the database became unreachable.
        raise ConnectionError("connection reset after the write was applied")

    async def get(*args: Any, **kwargs: Any) -> dict[str, Any] | None:
        if db_down:
            raise ConnectionError("db down")
        return await original_get(*args, **kwargs)

    harness.projects.finalize_generation = finalize  # type: ignore[method-assign]
    harness.projects.get_by_id_for_user = get  # type: ignore[method-assign]

    await harness.generation.run(claim)

    assert harness.doc(claim.project_id)["status"] == "ready"
    assert {topic["curriculum_version"] for topic in harness.learning.all_topics(claim.project_id)} == {
        claim.attempt
    }


# --- logging ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_generation_logs_claims_and_outcomes_with_ids_only(
    caplog: pytest.LogCaptureFixture,
) -> None:
    harness = Harness(BrokenProvider())

    with caplog.at_level(logging.INFO, logger="app"):
        claim = await harness.create(title="Private Venture", description="confidential plan")
        await harness.generation.run(claim)
        _, retry = await harness.generation.claim_retry(USER, claim.project_id)
        harness.generation._provider = StaticProvider(
            _raw([{"title": "T", "description": "d", "order": 1, "content": CONTENT}])
        )
        await harness.generation.run(retry)

    messages = [record.getMessage() for record in caplog.records]
    claims = [message for message in messages if message.startswith("Generation claimed")]
    finished = [message for message in messages if message.startswith("Generation finished")]
    pid = claim.project_id
    assert claims == [
        f"Generation claimed: trigger=create user_id={USER} project_id={pid} attempt=1",
        f"Generation claimed: trigger=retry user_id={USER} project_id={pid} attempt=2",
    ]
    assert len(finished) == 2
    assert finished[0].startswith(
        f"Generation finished: trigger=create user_id={USER} project_id={pid} attempt=1 "
        f"provider=broken model=None outcome={FAILURE_PROVIDER_ERROR} duration_ms="
    )
    assert finished[1].startswith(
        f"Generation finished: trigger=retry user_id={USER} project_id={pid} attempt=2 "
        "provider=static model=static-model-1 outcome=ready duration_ms="
    )
    for text in ("Private Venture", "confidential plan", "Grocery Tracker"):
        assert text not in caplog.text


@pytest.mark.asyncio
async def test_run_never_raises_even_if_failure_cannot_be_recorded() -> None:
    harness = Harness(BrokenProvider())
    claim = await harness.create()

    async def db_down(*args: Any, **kwargs: Any) -> bool:
        raise ConnectionError("db down")

    harness.projects.finalize_generation = db_down  # type: ignore[method-assign]

    await harness.generation.run(claim)  # Must not raise.

    # Unrecorded, so the lease expiring is what makes it retryable.
    assert harness.doc(claim.project_id)["status"] == "generating"


# --- lease, retry and claims ------------------------------------------------


@pytest.mark.asyncio
async def test_generating_project_past_its_lease_reads_as_failed() -> None:
    harness = Harness()
    claim = await harness.create()
    doc = harness.doc(claim.project_id)

    assert project_from_doc(doc).status == "generating"

    doc["generation"]["started_at"] = _ago(GENERATION_LEASE + timedelta(seconds=1))
    assert project_from_doc(doc).status == "failed"
    projects = await harness.project_service.list_projects(USER)
    assert projects[0].status == "failed"


@pytest.mark.asyncio
async def test_retry_of_failed_project_claims_next_attempt_and_version() -> None:
    harness = Harness(BrokenProvider())
    first = await harness.create()
    await harness.generation.run(first)

    project, retry = await harness.generation.claim_retry(USER, first.project_id)
    assert project.status == "generating"
    assert retry.attempt == first.attempt + 1

    harness.generation._provider = DeterministicProvider()
    await harness.generation.run(retry)

    doc = harness.doc(first.project_id)
    assert doc["status"] == "ready"
    assert doc["curriculum"]["version"] == retry.attempt
    assert {topic["curriculum_version"] for topic in harness.learning.all_topics(first.project_id)} == {
        retry.attempt
    }


@pytest.mark.asyncio
async def test_retry_of_stale_generation_is_allowed() -> None:
    harness = Harness()
    claim = await harness.create()
    harness.doc(claim.project_id)["generation"]["started_at"] = _ago(timedelta(minutes=5))

    _, retry = await harness.generation.claim_retry(USER, claim.project_id)

    assert retry.attempt == 2


@pytest.mark.asyncio
async def test_retry_of_active_generation_conflicts() -> None:
    harness = Harness()
    claim = await harness.create()

    with pytest.raises(GenerationConflictError) as excinfo:
        await harness.generation.claim_retry(USER, claim.project_id)
    assert excinfo.value.status == "generating"


@pytest.mark.asyncio
async def test_retry_of_ready_project_conflicts() -> None:
    harness = Harness()
    claim = await harness.create()
    await harness.generation.run(claim)

    with pytest.raises(GenerationConflictError) as excinfo:
        await harness.generation.claim_retry(USER, claim.project_id)
    assert excinfo.value.status == "ready"


@pytest.mark.asyncio
async def test_retry_of_another_users_project_is_not_found() -> None:
    harness = Harness(BrokenProvider())
    claim = await harness.create()
    await harness.generation.run(claim)

    with pytest.raises(ProjectNotFoundError):
        await harness.generation.claim_retry("user-b", claim.project_id)
    assert harness.doc(claim.project_id)["generation"]["attempt"] == 1


@pytest.mark.asyncio
async def test_concurrent_retries_claim_exactly_once() -> None:
    harness = Harness(BrokenProvider())
    claim = await harness.create()
    await harness.generation.run(claim)

    results = await asyncio.gather(
        *(harness.generation.claim_retry(USER, claim.project_id) for _ in range(5)),
        return_exceptions=True,
    )

    claims = [result for result in results if not isinstance(result, BaseException)]
    conflicts = [result for result in results if isinstance(result, GenerationConflictError)]
    assert len(claims) == 1
    assert len(conflicts) == 4
    assert harness.doc(claim.project_id)["generation"]["attempt"] == 2


@pytest.mark.asyncio
async def test_superseded_attempt_can_never_become_active() -> None:
    harness = Harness()
    stale = await harness.create()
    # The first worker stalls past its lease and a retry takes over.
    harness.doc(stale.project_id)["generation"]["started_at"] = _ago(timedelta(minutes=5))
    _, current = await harness.generation.claim_retry(USER, stale.project_id)

    # The stalled worker finishes late: it must not activate its curriculum.
    await harness.generation.run(stale)

    doc = harness.doc(stale.project_id)
    assert doc["status"] == "generating"
    assert doc["curriculum"] is None
    assert harness.learning.all_topics(stale.project_id) == []

    await harness.generation.run(current)

    assert harness.doc(stale.project_id)["curriculum"]["version"] == current.attempt
    assert {topic["curriculum_version"] for topic in harness.learning.all_topics(stale.project_id)} == {
        current.attempt
    }


@pytest.mark.asyncio
async def test_generation_for_a_deleted_project_leaves_nothing_behind() -> None:
    harness = Harness()
    claim = await harness.create()
    await harness.project_service.delete_project(USER, claim.project_id)

    await harness.generation.run(claim)

    assert harness.learning.all_topics(claim.project_id) == []


# --- active curriculum reads ------------------------------------------------


@pytest.mark.asyncio
async def test_learning_reads_only_the_active_curriculum_version() -> None:
    harness = Harness()
    claim = await harness.create()
    await harness.generation.run(claim)
    leftover = {
        "id": "leftover-topic",
        "project_id": claim.project_id,
        "curriculum_version": 99,
        "source_key": None,
        "title": "From a failed attempt",
        "description": "d",
        "order": 1,
        "content": CONTENT,
        "created_at": _ago(timedelta(0)),
    }
    await harness.learning.insert_topics([leftover])

    learning = await harness.learning_service.get_project_learning(USER, claim.project_id)
    overview = await harness.learning_service.list_learning(USER)

    assert "leftover-topic" not in {topic.id for topic in learning.topics}
    assert "leftover-topic" not in {topic.id for topic in overview[0].topics}
    with pytest.raises(TopicNotFoundError):
        await harness.learning_service.get_topic(USER, claim.project_id, "leftover-topic")
    with pytest.raises(TopicNotFoundError):
        await harness.learning_service.complete_topic(USER, claim.project_id, "leftover-topic")


@pytest.mark.asyncio
async def test_project_without_curriculum_has_no_topics() -> None:
    harness = Harness()
    claim = await harness.create()  # Still generating.

    learning = await harness.learning_service.get_project_learning(USER, claim.project_id)

    assert learning.topics == []


@pytest.mark.asyncio
async def test_generation_never_deletes_learning_progress() -> None:
    harness = Harness(BrokenProvider())
    claim = await harness.create()
    await harness.learning.upsert_progress(USER, claim.project_id, "legacy-topic", "completed", "t")

    await harness.generation.run(claim)
    _, retry = await harness.generation.claim_retry(USER, claim.project_id)
    harness.generation._provider = DeterministicProvider()
    await harness.generation.run(retry)

    progress = await harness.learning.get_progress(USER, claim.project_id, "legacy-topic")
    assert progress is not None and progress["status"] == "completed"

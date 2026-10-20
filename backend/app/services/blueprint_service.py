"""Project blueprint generation: its own lifecycle, independent of curriculum
generation.

    claim -> load project (must be ready) -> load active curriculum topics
        -> provider (with timeout) -> validate -> normalise -> fenced finalise

A blueprint belongs to one curriculum version of its project. The project
document is only ever read here: a blueprint failure never changes the
project's status, its curriculum or anyone's progress.

The provider's output is untrusted until it passes BlueprintOutputV2. The
finalise is fenced on the claimed attempt and curriculum version, so a stale
or superseded run can never overwrite the current blueprint.

Schema versions: each document records the BLUEPRINT_SCHEMA_VERSION it was
claimed under. One built under another version (e.g. a 1.0 blueprint after the
upgrade to 2.0) is stale exactly like one built for an older curriculum: it
reads "missing", is never parsed with the current shape, and the next claim
regenerates it. No data migration is needed.

Lost workers: like curriculum generation, a run is an in-memory FastAPI
BackgroundTask. If it is lost, the document stays "generating" until its lease
(GENERATION_LEASE) expires; reads then report "failed" and a new POST retries.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from app.ai.prompts import BLUEPRINT_PROMPT_VERSION
from app.ai.provider import AIProvider, BlueprintRequest, CurriculumTopicSummary
from app.ai.schemas import (
    BLUEPRINT_SCHEMA_VERSION,
    BlueprintOutputV2,
    InvalidBlueprintOutputError,
    parse_blueprint_output,
)
from app.repositories.blueprint_repository import BlueprintRepository
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.blueprint import (
    Architecture,
    ArchitectureComponent,
    Blueprint,
    BlueprintStatus,
    ComponentConnection,
    DataFlow,
    DataFlowStep,
    FailureMode,
    PhaseLearning,
    ProjectBlueprint,
    RoadmapPhase,
    TechAlternative,
    TechChoice,
)
from app.services.generation_service import (
    FAILURE_INTERNAL_ERROR,
    FAILURE_INVALID_OUTPUT,
    FAILURE_PROVIDER_ERROR,
    FAILURE_TIMEOUT,
)
from app.services.project_service import GENERATION_LEASE, ProjectNotFoundError, effective_status
from app.utils.learning_progress import active_curriculum_version

logger = logging.getLogger(__name__)

#: Fixed category order of a persisted tech stack (see normalize_blueprint).
TECH_CATEGORY_ORDER = (
    "frontend",
    "backend",
    "database",
    "authentication",
    "ai",
    "storage",
    "realtime",
    "infrastructure",
    "testing",
    "other",
)

#: Why a generation claim was refused.
BlueprintConflict = Literal["project_not_ready", "generating", "ready"]


@dataclass(frozen=True)
class BlueprintClaim:
    """The exclusive right to run one blueprint generation attempt.

    `attempt` and `curriculum_version` together are the fencing token checked
    when the result is persisted.
    """

    user_id: str
    project_id: str
    attempt: int
    curriculum_version: int


class BlueprintConflictError(Exception):
    """The project or its blueprint is not in a state that allows a new attempt."""

    def __init__(self, project_id: str, reason: BlueprintConflict) -> None:
        super().__init__(f"Blueprint of project {project_id} cannot be generated: {reason}")
        self.project_id = project_id
        self.reason = reason


class _BlueprintFailure(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class BlueprintService:
    def __init__(
        self,
        project_repo: ProjectRepository,
        learning_repo: LearningRepository,
        blueprint_repo: BlueprintRepository,
        provider: AIProvider,
        timeout_seconds: float,
    ) -> None:
        self._projects = project_repo
        self._learning = learning_repo
        self._blueprints = blueprint_repo
        self._provider = provider
        self._timeout_seconds = timeout_seconds

    async def get_blueprint(self, user_id: str, project_id: str) -> ProjectBlueprint:
        """The project's blueprint with its server-derived status.

        Raises ProjectNotFoundError when the caller does not own the project.
        """

        project = await self._projects.get_by_id_for_user(project_id, user_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        doc = await self._blueprints.get_for_project(project_id, user_id)
        return blueprint_from_doc(doc, project, datetime.now(timezone.utc))

    async def claim(self, user_id: str, project_id: str) -> tuple[ProjectBlueprint, BlueprintClaim]:
        """Claim a generation attempt: the first, a retry after a failure or an
        expired lease, or a regeneration for a newer curriculum version.

        Atomic: of several concurrent claims exactly one succeeds. Raises
        ProjectNotFoundError when the caller does not own the project, and
        BlueprintConflictError when the project is not ready, a generation is
        active, or the blueprint is already current.
        """

        now = datetime.now(timezone.utc)
        project = await self._projects.get_by_id_for_user(project_id, user_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        version = ready_curriculum_version(project, now)
        if version is None:
            raise BlueprintConflictError(project_id, "project_not_ready")

        doc = await self._blueprints.claim(
            project_id,
            user_id,
            curriculum_version=version,
            schema_version=BLUEPRINT_SCHEMA_VERSION,
            expired_before=(now - GENERATION_LEASE).isoformat(),
            started_at=now.isoformat(),
        )
        if doc is None:
            existing = await self._blueprints.get_for_project(project_id, user_id)
            status = blueprint_status(existing, project, now)
            # Anything but "ready" means a concurrent claim just won.
            raise BlueprintConflictError(project_id, "ready" if status == "ready" else "generating")

        claim = BlueprintClaim(
            user_id=user_id,
            project_id=project_id,
            attempt=doc["attempt"],
            curriculum_version=version,
        )
        # Ids only: never project names or text.
        logger.info(
            "Blueprint generation claimed: user_id=%s project_id=%s attempt=%s curriculum_version=%s",
            claim.user_id,
            claim.project_id,
            claim.attempt,
            claim.curriculum_version,
        )
        return blueprint_from_doc(doc, project, now), claim

    async def run(self, claim: BlueprintClaim) -> None:
        """Run one claimed attempt to completion. Intended as a background task.

        Never raises: every failure is logged and recorded on the blueprint as
        a retryable "failed" state. Only cancellation propagates, in which
        case the lease expiring makes the blueprint retryable instead.
        """

        started = time.monotonic()
        try:
            outcome = await self._generate(claim)
        except _BlueprintFailure as failure:
            outcome = await self._record_failure(claim, failure.reason)
        except Exception:
            logger.exception(
                "Blueprint generation crashed: user_id=%s project_id=%s attempt=%s",
                claim.user_id,
                claim.project_id,
                claim.attempt,
            )
            outcome = await self._record_failure(claim, FAILURE_INTERNAL_ERROR)

        # Ids, codes and timings only: never prompts, provider output or
        # project text, which may contain anything the user typed.
        logger.info(
            "Blueprint generation finished: user_id=%s project_id=%s attempt=%s "
            "curriculum_version=%s provider=%s model=%s outcome=%s duration_ms=%d",
            claim.user_id,
            claim.project_id,
            claim.attempt,
            claim.curriculum_version,
            self._provider.name,
            self._provider.model,
            outcome,
            (time.monotonic() - started) * 1000,
        )

    async def _generate(self, claim: BlueprintClaim) -> str:
        project = await self._projects.get_by_id_for_user(claim.project_id, claim.user_id)
        if project is None:
            # Deleted after the claim was made. The claim may have created the
            # document after the deletion's cascade ran: remove that orphan.
            await self._blueprints.delete_for_project(claim.project_id)
            return "project_deleted"
        if ready_curriculum_version(project, datetime.now(timezone.utc)) != claim.curriculum_version:
            return "superseded"

        topics = await self._learning.list_topics(claim.project_id, claim.curriculum_version)
        request = _request_from_docs(project, topics)
        output = await self._produce_blueprint(claim, request)
        topic_titles = {topic.order: topic.title for topic in request.curriculum}

        generated_at = datetime.now(timezone.utc).isoformat()
        finalized = await self._blueprints.finalize(
            claim.project_id,
            claim.user_id,
            claim.attempt,
            claim.curriculum_version,
            {
                "status": "ready",
                "blueprint": normalize_blueprint(output, topic_titles),
                "meta": {
                    "attempt": claim.attempt,
                    "curriculum_version": claim.curriculum_version,
                    "schema_version": output.schema_version,
                    "prompt_version": BLUEPRINT_PROMPT_VERSION,
                    "source": self._provider.name,
                    "model": self._provider.model,
                    "generated_at": generated_at,
                },
                "completed_at": generated_at,
                "failure_reason": None,
                "updated_at": generated_at,
            },
        )
        if finalized:
            return "ready"

        # Superseded by a newer attempt, or the project (and with it this
        # document) was deleted mid-run. Nothing was written either way.
        if await self._projects.get_by_id_for_user(claim.project_id, claim.user_id) is None:
            await self._blueprints.delete_for_project(claim.project_id)
            return "project_deleted"
        return "superseded"

    async def _produce_blueprint(
        self, claim: BlueprintClaim, request: BlueprintRequest
    ) -> BlueprintOutputV2:
        try:
            raw = await asyncio.wait_for(
                self._provider.generate_blueprint(request), timeout=self._timeout_seconds
            )
        except TimeoutError as exc:
            logger.warning(
                "Blueprint generation timed out after %ss: project_id=%s attempt=%s provider=%s",
                self._timeout_seconds,
                claim.project_id,
                claim.attempt,
                self._provider.name,
            )
            raise _BlueprintFailure(FAILURE_TIMEOUT) from exc
        except Exception as exc:
            logger.exception(
                "Blueprint provider failed: project_id=%s attempt=%s provider=%s",
                claim.project_id,
                claim.attempt,
                self._provider.name,
            )
            raise _BlueprintFailure(FAILURE_PROVIDER_ERROR) from exc

        try:
            # Phase learning may only reference this curriculum's topics.
            return parse_blueprint_output(raw, [topic.order for topic in request.curriculum])
        except InvalidBlueprintOutputError as exc:
            # The summary names failing fields only, never the output itself.
            logger.warning(
                "Blueprint output rejected: project_id=%s attempt=%s provider=%s detail=%s",
                claim.project_id,
                claim.attempt,
                self._provider.name,
                exc,
            )
            raise _BlueprintFailure(FAILURE_INVALID_OUTPUT) from exc

    async def _record_failure(self, claim: BlueprintClaim, reason: str) -> str:
        """Mark the attempt failed. Returns the outcome: `reason`, or
        "superseded" when the attempt is no longer current. Only the blueprint
        document is written; the project is never touched."""

        now = datetime.now(timezone.utc).isoformat()
        try:
            recorded = await self._blueprints.finalize(
                claim.project_id,
                claim.user_id,
                claim.attempt,
                claim.curriculum_version,
                {"status": "failed", "completed_at": now, "failure_reason": reason, "updated_at": now},
            )
        except Exception:
            # Unrecorded: the lease expiring still makes it read "failed".
            logger.exception(
                "Blueprint failure recording failed: project_id=%s attempt=%s",
                claim.project_id,
                claim.attempt,
            )
            return reason
        return reason if recorded else "superseded"


def ready_curriculum_version(project_doc: dict[str, Any], now: datetime) -> int | None:
    """The curriculum version a blueprint must match; None unless the project is ready."""

    if effective_status(project_doc, now) != "ready":
        return None
    return active_curriculum_version(project_doc)


def _lease_expired(doc: dict[str, Any], now: datetime) -> bool:
    # Mirrors the "generating" branch of BlueprintRepository.claim's filter.
    started_at = doc.get("started_at")
    return started_at is not None and datetime.fromisoformat(started_at) < now - GENERATION_LEASE


def blueprint_status(
    doc: dict[str, Any] | None, project_doc: dict[str, Any], now: datetime
) -> BlueprintStatus:
    """The status a client sees, derived on every read.

    "missing" when there is no document, the project is not ready, or the
    document belongs to another curriculum version or blueprint schema
    version: a stale blueprint is never reported as ready. A "generating"
    document past its lease reads "failed".
    """

    version = ready_curriculum_version(project_doc, now)
    if (
        doc is None
        or version is None
        or doc.get("curriculum_version") != version
        or doc.get("schema_version") != BLUEPRINT_SCHEMA_VERSION
    ):
        return "missing"
    if doc["status"] == "generating":
        return "failed" if _lease_expired(doc, now) else "generating"
    return doc["status"]


def blueprint_from_doc(
    doc: dict[str, Any] | None, project_doc: dict[str, Any], now: datetime
) -> ProjectBlueprint:
    """Content and its timestamp are returned only for a ready blueprint."""

    status = blueprint_status(doc, project_doc, now)
    if status != "ready" or doc is None:
        return ProjectBlueprint(status=status)
    return ProjectBlueprint(
        status="ready",
        generatedAt=doc["meta"]["generated_at"],
        blueprint=_blueprint_from_stored(doc["blueprint"]),
    )


def _blueprint_from_stored(stored: dict[str, Any]) -> Blueprint:
    """The persisted snake_case blueprint (see normalize_blueprint) in the
    client's camelCase shape."""

    architecture = stored["architecture"]
    return Blueprint(
        summary=stored["summary"],
        assumptions=stored["assumptions"],
        techStack=[
            TechChoice(
                category=choice["category"],
                name=choice["name"],
                purpose=choice["purpose"],
                rationale=choice["rationale"],
                alternatives=[TechAlternative(**alternative) for alternative in choice["alternatives"]],
                integrationNotes=choice["integration_notes"],
            )
            for choice in stored["tech_stack"]
        ],
        architecture=Architecture(
            style=architecture["style"],
            overview=architecture["overview"],
            components=[
                ArchitectureComponent(
                    key=component["key"],
                    name=component["name"],
                    kind=component["kind"],
                    responsibility=component["responsibility"],
                    connections=[ComponentConnection(**connection) for connection in component["connections"]],
                )
                for component in architecture["components"]
            ],
            flows=[
                DataFlow(name=flow["name"], steps=[DataFlowStep(**step) for step in flow["steps"]])
                for flow in architecture["flows"]
            ],
            failureModes=[FailureMode(**mode) for mode in architecture["failure_modes"]],
            tradeoffs=architecture["tradeoffs"],
        ),
        roadmap=[
            RoadmapPhase(
                order=phase["order"],
                title=phase["title"],
                goal=phase["goal"],
                rationale=phase["rationale"],
                tasks=phase["tasks"],
                deliverables=phase["deliverables"],
                acceptanceCriteria=phase["acceptance_criteria"],
                dependsOn=phase["depends_on"],
                techCategories=phase["tech_categories"],
                risks=phase["risks"],
                learning=[
                    PhaseLearning(
                        topicOrder=item["topic_order"],
                        topicTitle=item["topic_title"],
                        application=item["application"],
                    )
                    for item in phase["learning"]
                ],
            )
            for phase in stored["roadmap"]
        ],
    )


def normalize_blueprint(output: BlueprintOutputV2, topic_titles: dict[int, str]) -> dict[str, Any]:
    """Validated provider output as the persisted, snake_case blueprint.

    Roadmap phases are sorted by order and renumbered 1..n, with their
    dependencies renumbered to match; the tech stack is sorted into
    TECH_CATEGORY_ORDER, keeping the provider's order within a category.
    Each phase learning link gets its topic's title from `topic_titles` (the
    curriculum it was validated against). No generated content is changed.
    """

    blueprint = output.model_dump(exclude={"schema_version"})
    blueprint["tech_stack"].sort(key=lambda choice: TECH_CATEGORY_ORDER.index(choice["category"]))
    phases = sorted(blueprint["roadmap"], key=lambda phase: phase["order"])
    positions = {phase["order"]: position for position, phase in enumerate(phases, 1)}
    blueprint["roadmap"] = [
        {
            **phase,
            "order": positions[phase["order"]],
            "depends_on": sorted(positions[order] for order in phase["depends_on"]),
            "learning": [
                {**item, "topic_title": topic_titles[item["topic_order"]]} for item in phase["learning"]
            ],
        }
        for phase in phases
    ]
    return blueprint


def _request_from_docs(
    project_doc: dict[str, Any], topic_docs: list[dict[str, Any]]
) -> BlueprintRequest:
    # Topic summaries only: lesson content and progress are never sent.
    return BlueprintRequest(
        project_name=project_doc["name"],
        description=project_doc.get("description"),
        platforms=tuple(project_doc.get("platforms") or ()),
        tech_stack=tuple(project_doc.get("tech_stack") or ()),
        curriculum=tuple(
            CurriculumTopicSummary(
                order=topic["order"], title=topic["title"], description=topic["description"]
            )
            for topic in sorted(topic_docs, key=lambda topic: topic["order"])
        ),
    )

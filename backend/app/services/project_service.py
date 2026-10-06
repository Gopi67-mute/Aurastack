import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

from app.core.config import GENERATION_LEASE_SECONDS
from app.repositories.activity_repository import ActivityRepository
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import Project, ProjectCreateRequest, ProjectStatus, ProjectUpdateRequest
from app.utils.learning_progress import active_curriculum_version, learning_percent

_UPDATE_FIELD_MAP = {
    "name": "name",
    "description": "description",
    "platforms": "platforms",
    "techStack": "tech_stack",
    "iconKey": "icon_key",
}

logger = logging.getLogger(__name__)

GENERATION_LEASE = timedelta(seconds=GENERATION_LEASE_SECONDS)

#: Creating a project claims its first generation attempt.
INITIAL_GENERATION_ATTEMPT = 1

#: What claimed a generation attempt: project creation or a user retry.
GenerationTrigger = Literal["create", "retry"]


@dataclass(frozen=True)
class GenerationClaim:
    """The exclusive right to run one generation attempt of one project.

    `attempt` is the fencing token checked when the result is persisted, and
    doubles as the curriculum version that attempt writes: attempts only ever
    increase, so versions are unique and monotonic per project.
    """

    user_id: str
    project_id: str
    attempt: int
    #: Observability only; never affects how the attempt runs.
    trigger: GenerationTrigger


def log_generation_claim(claim: GenerationClaim) -> None:
    """One line per claimed attempt. Ids only: never project names or text."""

    logger.info(
        "Generation claimed: trigger=%s user_id=%s project_id=%s attempt=%s",
        claim.trigger,
        claim.user_id,
        claim.project_id,
        claim.attempt,
    )


class ProjectNotFoundError(Exception):
    def __init__(self, project_id: str) -> None:
        super().__init__(f"Project not found: {project_id}")
        self.project_id = project_id


class ProjectService:
    """Business logic for projects. Ownership is always enforced here:
    every read/write is scoped to the authenticated user's id.
    """

    def __init__(
        self,
        project_repo: ProjectRepository,
        learning_repo: LearningRepository,
        activity_repo: ActivityRepository,
    ) -> None:
        self._projects = project_repo
        self._learning = learning_repo
        self._activity = activity_repo

    async def list_projects(self, user_id: str) -> list[Project]:
        docs = await self._projects.list_for_user(user_id)
        return await self._with_progress(user_id, docs)

    async def get_project(self, user_id: str, project_id: str) -> Project:
        doc = await self._projects.get_by_id_for_user(project_id, user_id)
        if doc is None:
            raise ProjectNotFoundError(project_id)
        return (await self._with_progress(user_id, [doc]))[0]

    async def create_project(
        self, user_id: str, payload: ProjectCreateRequest
    ) -> tuple[Project, GenerationClaim]:
        """Persist a new project and claim its first generation attempt.

        Returns immediately with the project still "generating"; the caller
        runs the returned claim through GenerationService in the background.
        """

        project_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()

        doc = {
            "id": project_id,
            "user_id": user_id,
            "name": payload.title,
            "description": payload.description,
            "platforms": payload.platforms,
            "tech_stack": None,
            "status": "generating",
            "progress": 0,
            "icon_key": None,
            "generation": {
                "attempt": INITIAL_GENERATION_ATTEMPT,
                "started_at": now,
                "completed_at": None,
                "failure_reason": None,
            },
            # Null until a generation succeeds. Its presence also marks the
            # document as post-Phase 3.3 for the startup migration.
            "curriculum": None,
            "created_at": now,
            "updated_at": now,
        }
        await self._projects.insert(doc)

        claim = GenerationClaim(
            user_id=user_id,
            project_id=project_id,
            attempt=INITIAL_GENERATION_ATTEMPT,
            trigger="create",
        )
        log_generation_claim(claim)
        return project_from_doc(doc), claim

    async def update_project(
        self, user_id: str, project_id: str, payload: ProjectUpdateRequest
    ) -> Project:
        existing = await self._projects.get_by_id_for_user(project_id, user_id)
        if existing is None:
            raise ProjectNotFoundError(project_id)

        changes = payload.model_dump(exclude_unset=True)
        updates = {_UPDATE_FIELD_MAP[field]: value for field, value in changes.items()}

        if not updates:
            return (await self._with_progress(user_id, [existing]))[0]

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        doc = await self._projects.update(project_id, user_id, updates)
        if doc is None:
            raise ProjectNotFoundError(project_id)
        return (await self._with_progress(user_id, [doc]))[0]

    async def delete_project(self, user_id: str, project_id: str) -> None:
        deleted = await self._projects.delete(project_id, user_id)
        if not deleted:
            raise ProjectNotFoundError(project_id)
        await self._learning.delete_for_project(project_id)
        await self._activity.delete_for_project(project_id)

    async def _with_progress(self, user_id: str, docs: list[dict[str, Any]]) -> list[Project]:
        """Projects with their server-calculated learning progress.

        Progress is completed topics / topics of the project's active
        curriculum, using this user's completions only. It is derived on every
        read and never stored: the documents' legacy `progress` field is not
        read. A project that is not ready has no active curriculum to measure
        and reports 0.

        Two batched reads however many projects there are, never a pair per
        project. Completions of a superseded curriculum version cannot match
        an active topic id (every version gets fresh ids), so they never count.
        """

        now = datetime.now(timezone.utc)
        versions = {
            doc["id"]: version
            for doc in docs
            if effective_status(doc, now) == "ready"
            and (version := active_curriculum_version(doc)) is not None
        }

        topic_docs = await self._learning.list_topic_ids_for_projects(versions)
        progress_docs = await self._learning.list_progress_for_projects(user_id, list(versions))

        completed = {
            (doc["project_id"], doc["topic_id"])
            for doc in progress_docs
            if doc.get("status") == "completed"
        }
        totals: dict[str, int] = {}
        done: dict[str, int] = {}
        for topic_doc in topic_docs:
            project_id = topic_doc["project_id"]
            totals[project_id] = totals.get(project_id, 0) + 1
            if (project_id, topic_doc["id"]) in completed:
                done[project_id] = done.get(project_id, 0) + 1

        return [
            project_from_doc(
                doc,
                now,
                progress=learning_percent(done.get(doc["id"], 0), totals.get(doc["id"], 0)),
            )
            for doc in docs
        ]


def is_generation_expired(doc: dict[str, Any], now: datetime) -> bool:
    """True when a "generating" project has outlived its lease.

    Its worker is presumed dead (crash, restart, lost task), so the project
    is reported as failed and may be retried. Mirrors the retry claim's
    filter in ProjectRepository.claim_generation.
    """

    if doc.get("status") != "generating":
        return False
    started_at = (doc.get("generation") or {}).get("started_at")
    if started_at is None:
        return False
    return datetime.fromisoformat(started_at) < now - GENERATION_LEASE


def effective_status(doc: dict[str, Any], now: datetime) -> ProjectStatus:
    return "failed" if is_generation_expired(doc, now) else doc["status"]


def project_from_doc(
    doc: dict[str, Any], now: datetime | None = None, *, progress: int = 0
) -> Project:
    """`progress` is the server-calculated learning percentage (see
    ProjectService._with_progress); the default 0 is only right for a project
    that is not ready."""

    return Project(
        id=doc["id"],
        name=doc["name"],
        status=effective_status(doc, now or datetime.now(timezone.utc)),
        progress=progress,
        createdAt=doc["created_at"],
        description=doc.get("description"),
        platforms=doc.get("platforms"),
        techStack=doc.get("tech_stack"),
        iconKey=doc.get("icon_key"),
    )

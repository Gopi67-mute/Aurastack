from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.repositories.activity_repository import ActivityRepository
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import Project, ProjectCreateRequest, ProjectUpdateRequest
from app.services.curriculum_service import generate_project_topics

_UPDATE_FIELD_MAP = {
    "name": "name",
    "description": "description",
    "platforms": "platforms",
    "techStack": "tech_stack",
    "status": "status",
    "progress": "progress",
    "iconKey": "icon_key",
}


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
        return [_project_from_doc(doc) for doc in docs]

    async def get_project(self, user_id: str, project_id: str) -> Project:
        doc = await self._projects.get_by_id_for_user(project_id, user_id)
        if doc is None:
            raise ProjectNotFoundError(project_id)
        return _project_from_doc(doc)

    async def create_project(self, user_id: str, payload: ProjectCreateRequest) -> Project:
        project_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()

        doc = {
            "id": project_id,
            "user_id": user_id,
            "name": payload.title,
            "description": payload.description,
            "platforms": payload.platforms,
            "tech_stack": None,
            "status": "preparing",
            "progress": 0,
            "icon_key": None,
            "created_at": now,
            "updated_at": now,
        }
        await self._projects.insert(doc)

        topics = generate_project_topics(
            project_id=project_id,
            project_name=payload.title,
            tech_stack=None,
            platforms=payload.platforms,
            description=payload.description,
        )
        topic_docs = [{**topic, "created_at": now} for topic in topics]
        await self._learning.insert_topics(topic_docs)

        return _project_from_doc(doc)

    async def update_project(
        self, user_id: str, project_id: str, payload: ProjectUpdateRequest
    ) -> Project:
        existing = await self._projects.get_by_id_for_user(project_id, user_id)
        if existing is None:
            raise ProjectNotFoundError(project_id)

        changes = payload.model_dump(exclude_unset=True)
        updates = {_UPDATE_FIELD_MAP[field]: value for field, value in changes.items()}

        if not updates:
            return _project_from_doc(existing)

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        doc = await self._projects.update(project_id, user_id, updates)
        if doc is None:
            raise ProjectNotFoundError(project_id)
        return _project_from_doc(doc)

    async def delete_project(self, user_id: str, project_id: str) -> None:
        deleted = await self._projects.delete(project_id, user_id)
        if not deleted:
            raise ProjectNotFoundError(project_id)
        await self._learning.delete_for_project(project_id)
        await self._activity.delete_for_project(project_id)


def _project_from_doc(doc: dict[str, Any]) -> Project:
    return Project(
        id=doc["id"],
        name=doc["name"],
        status=doc["status"],
        progress=doc["progress"],
        createdAt=doc["created_at"],
        description=doc.get("description"),
        platforms=doc.get("platforms"),
        techStack=doc.get("tech_stack"),
        iconKey=doc.get("icon_key"),
    )

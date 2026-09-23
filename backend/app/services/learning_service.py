from datetime import datetime, timezone
from typing import Any

from app.repositories.activity_repository import ActivityRepository
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.learning import LearningTopic, ProjectLearning, TopicContent
from app.services.project_service import ProjectNotFoundError


class TopicNotFoundError(Exception):
    def __init__(self, topic_id: str) -> None:
        super().__init__(f"Topic not found: {topic_id}")
        self.topic_id = topic_id


class LearningService:
    def __init__(
        self,
        project_repo: ProjectRepository,
        learning_repo: LearningRepository,
        activity_repo: ActivityRepository,
    ) -> None:
        self._projects = project_repo
        self._learning = learning_repo
        self._activity = activity_repo

    async def get_project_learning(self, user_id: str, project_id: str) -> ProjectLearning:
        project_doc = await self._require_owned_project(user_id, project_id)

        topic_docs = await self._learning.list_topics(project_id)
        progress_by_topic = await self._learning.list_progress_for_project(user_id, project_id)

        topics = [
            _topic_from_docs(topic_doc, progress_by_topic.get(topic_doc["id"]))
            for topic_doc in topic_docs
        ]
        return ProjectLearning(
            projectId=project_id,
            projectName=project_doc["name"],
            iconKey=project_doc.get("icon_key"),
            createdAt=project_doc["created_at"],
            topics=topics,
        )

    async def get_topic(self, user_id: str, project_id: str, topic_id: str) -> LearningTopic:
        await self._require_owned_project(user_id, project_id)
        topic_doc = await self._require_topic(project_id, topic_id)
        progress = await self._learning.get_progress(user_id, project_id, topic_id)
        return _topic_from_docs(topic_doc, progress)

    async def complete_topic(self, user_id: str, project_id: str, topic_id: str) -> LearningTopic:
        """Idempotent: completing an already-completed topic returns its
        existing state unchanged and never records a second activity event.
        """

        project_doc = await self._require_owned_project(user_id, project_id)
        topic_doc = await self._require_topic(project_id, topic_id)

        existing_progress = await self._learning.get_progress(user_id, project_id, topic_id)
        if existing_progress is not None and existing_progress.get("status") == "completed":
            return _topic_from_docs(topic_doc, existing_progress)

        now = datetime.now(timezone.utc)
        completed_at = now.isoformat()
        await self._learning.upsert_progress(user_id, project_id, topic_id, "completed", completed_at)

        await self._activity.insert(
            {
                "id": f"learning-{project_id}-{topic_id}-{int(now.timestamp() * 1000)}",
                "user_id": user_id,
                "type": "learning",
                "description": f"Finished {topic_doc['title']} learning topic",
                "project_id": project_id,
                "project_name": project_doc["name"],
                "occurred_at": completed_at,
            }
        )

        return _topic_from_docs(topic_doc, {"status": "completed", "completed_at": completed_at})

    async def _require_owned_project(self, user_id: str, project_id: str) -> dict[str, Any]:
        project_doc = await self._projects.get_by_id_for_user(project_id, user_id)
        if project_doc is None:
            raise ProjectNotFoundError(project_id)
        return project_doc

    async def _require_topic(self, project_id: str, topic_id: str) -> dict[str, Any]:
        topic_doc = await self._learning.get_topic(project_id, topic_id)
        if topic_doc is None:
            raise TopicNotFoundError(topic_id)
        return topic_doc


def _topic_from_docs(topic_doc: dict[str, Any], progress_doc: dict[str, Any] | None) -> LearningTopic:
    status = progress_doc["status"] if progress_doc else "not_started"
    completed_at = progress_doc.get("completed_at") if progress_doc else None
    return LearningTopic(
        id=topic_doc["id"],
        projectId=topic_doc["project_id"],
        title=topic_doc["title"],
        description=topic_doc["description"],
        order=topic_doc["order"],
        status=status,
        completedAt=completed_at,
        content=TopicContent(**topic_doc["content"]),
    )

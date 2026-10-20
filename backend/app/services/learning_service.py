from datetime import datetime, timezone
from typing import Any

from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.learning import LearningTopic, ProjectLearning, TopicContent
from app.services.activity_service import ActivityService
from app.services.project_service import ProjectNotFoundError
from app.utils.learning_progress import active_curriculum_version


class TopicNotFoundError(Exception):
    def __init__(self, topic_id: str) -> None:
        super().__init__(f"Topic not found: {topic_id}")
        self.topic_id = topic_id


class LearningService:
    def __init__(
        self,
        project_repo: ProjectRepository,
        learning_repo: LearningRepository,
        activity_service: ActivityService,
    ) -> None:
        self._projects = project_repo
        self._learning = learning_repo
        self._activity = activity_service

    async def list_learning(self, user_id: str) -> list[ProjectLearning]:
        """Every owned project with its curriculum and the user's progress.

        Two batched reads rather than one pair per project, so the Home and
        Learning overviews stay a single request as the project count grows.
        """

        project_docs = await self._projects.list_for_user(user_id)
        project_ids = [doc["id"] for doc in project_docs]
        active_versions = {
            doc["id"]: version
            for doc in project_docs
            if (version := active_curriculum_version(doc)) is not None
        }

        topic_docs = await self._learning.list_topics_for_projects(active_versions)
        progress_docs = await self._learning.list_progress_for_projects(user_id, project_ids)

        topics_by_project: dict[str, list[dict[str, Any]]] = {}
        for topic_doc in topic_docs:
            topics_by_project.setdefault(topic_doc["project_id"], []).append(topic_doc)

        progress_by_key = {(doc["project_id"], doc["topic_id"]): doc for doc in progress_docs}

        return [
            ProjectLearning(
                projectId=project_doc["id"],
                projectName=project_doc["name"],
                iconKey=project_doc.get("icon_key"),
                createdAt=project_doc["created_at"],
                topics=[
                    _topic_from_docs(
                        topic_doc, progress_by_key.get((project_doc["id"], topic_doc["id"]))
                    )
                    for topic_doc in sorted(
                        topics_by_project.get(project_doc["id"], []),
                        key=lambda doc: doc["order"],
                    )
                ],
            )
            for project_doc in project_docs
        ]

    async def get_project_learning(self, user_id: str, project_id: str) -> ProjectLearning:
        project_doc = await self._require_owned_project(user_id, project_id)

        version = active_curriculum_version(project_doc)
        topic_docs = [] if version is None else await self._learning.list_topics(project_id, version)
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
        project_doc = await self._require_owned_project(user_id, project_id)
        topic_doc = await self._require_topic(project_doc, topic_id)
        progress = await self._learning.get_progress(user_id, project_id, topic_id)
        return _topic_from_docs(topic_doc, progress)

    async def complete_topic(self, user_id: str, project_id: str, topic_id: str) -> LearningTopic:
        """Complete a topic and record the qualifying activity it produces.

        Idempotent end to end: the first completion's `completedAt` wins, even
        between concurrent requests, and the activity is keyed on the
        completion itself, so retrying this request can never add a second
        qualifying activity or advance the streak twice.

        The activity write runs on both paths deliberately. If it ever fails
        the route returns an error, and because a retry reaches this same
        point the missing activity is repaired instead of being stranded
        behind an already-completed topic.
        """

        project_doc = await self._require_owned_project(user_id, project_id)
        topic_doc = await self._require_topic(project_doc, topic_id)

        completed_at = await self._learning.complete_progress(
            user_id, project_id, topic_id, datetime.now(timezone.utc).isoformat()
        )

        await self._activity.record_learning_completion(
            user_id=user_id,
            project_id=project_id,
            project_name=project_doc["name"],
            topic_id=topic_id,
            topic_title=topic_doc["title"],
            occurred_at=completed_at,
        )

        return _topic_from_docs(topic_doc, {"status": "completed", "completed_at": completed_at})

    async def _require_owned_project(self, user_id: str, project_id: str) -> dict[str, Any]:
        project_doc = await self._projects.get_by_id_for_user(project_id, user_id)
        if project_doc is None:
            raise ProjectNotFoundError(project_id)
        return project_doc

    async def _require_topic(self, project_doc: dict[str, Any], topic_id: str) -> dict[str, Any]:
        """A topic of the project's active curriculum only; anything left over
        from a failed or superseded generation attempt is not found."""

        version = active_curriculum_version(project_doc)
        topic_doc = (
            None
            if version is None
            else await self._learning.get_topic(project_doc["id"], version, topic_id)
        )
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

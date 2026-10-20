from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.project import ProjectIconKey

TopicStatus = Literal["not_started", "in_progress", "completed"]


class TopicContent(BaseModel):
    what: str
    why: str
    how: str
    example: str
    apply: str
    miniTask: Optional[str] = None


class LearningTopic(BaseModel):
    """Mirrors features/learning/types/learning.ts::LearningTopic exactly."""

    id: str
    projectId: str
    title: str
    description: str
    order: int
    status: TopicStatus
    completedAt: Optional[str] = None
    content: TopicContent


class ProjectLearning(BaseModel):
    """Mirrors features/learning/types/learning.ts::ProjectLearning exactly."""

    projectId: str
    projectName: str
    iconKey: Optional[ProjectIconKey] = None
    createdAt: str
    topics: list[LearningTopic]

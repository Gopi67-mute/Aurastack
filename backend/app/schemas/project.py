from typing import Literal, Optional

from pydantic import BaseModel, Field

ProjectStatus = Literal["preparing", "ready"]
ProjectIconKey = Literal["commerce", "chat", "web"]
ProjectPlatform = Literal["android", "ios", "web"]


class ProjectCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)
    platforms: list[ProjectPlatform] = Field(min_length=1)


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    platforms: Optional[list[ProjectPlatform]] = None
    techStack: Optional[list[str]] = None
    status: Optional[ProjectStatus] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    iconKey: Optional[ProjectIconKey] = None


class Project(BaseModel):
    """Mirrors features/projects/types/projects.ts::Project exactly."""

    id: str
    name: str
    status: ProjectStatus
    progress: int
    createdAt: str
    description: Optional[str] = None
    platforms: Optional[list[ProjectPlatform]] = None
    techStack: Optional[list[str]] = None
    iconKey: Optional[ProjectIconKey] = None

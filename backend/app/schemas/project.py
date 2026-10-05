from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# Server-owned lifecycle: only curriculum generation moves a project between
# these, never a client request.
ProjectStatus = Literal["generating", "ready", "failed"]
ProjectIconKey = Literal["commerce", "chat", "web"]
ProjectPlatform = Literal["android", "ios", "web"]


class ProjectCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)
    platforms: list[ProjectPlatform] = Field(min_length=1)


class ProjectUpdateRequest(BaseModel):
    # Unknown fields — notably `status` — are rejected rather than silently
    # dropped, so a client cannot believe it changed the lifecycle.
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    platforms: Optional[list[ProjectPlatform]] = None
    techStack: Optional[list[str]] = None
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

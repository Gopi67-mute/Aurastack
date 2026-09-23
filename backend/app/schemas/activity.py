from typing import Literal, Optional

from pydantic import BaseModel

ActivityType = Literal["task", "learning", "milestone"]


class ActivityEvent(BaseModel):
    """Mirrors features/progress/types/progress.ts::ActivityEvent exactly."""

    id: str
    type: ActivityType
    description: str
    projectId: Optional[str] = None
    projectName: Optional[str] = None
    occurredAt: str

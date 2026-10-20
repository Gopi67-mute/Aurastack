"""Learning progress arithmetic.

Pure helpers, free of MongoDB and FastAPI, so the figures every progress read
reports can be tested directly.
"""

import math
from typing import Any


def active_curriculum_version(project_doc: dict[str, Any]) -> int | None:
    """None until a generation has succeeded for the project."""

    curriculum = project_doc.get("curriculum")
    return curriculum["version"] if curriculum else None


def learning_percent(completed: int, total: int) -> int:
    """Completed / total topics as a whole percentage; 0 when there are no topics.

    Rounds half up, exactly like the client's getLearningPercent
    (features/home/utils/getLearningPercent.ts, JavaScript's Math.round), so
    a project's figure matches its Learning screen on every boundary:
    1 of 8 topics is 13%, where Python's round() would give 12.
    """

    if total <= 0:
        return 0
    value = completed / total * 100
    whole = math.floor(value)
    rounded = whole + 1 if value - whole >= 0.5 else whole
    return min(100, max(0, rounded))

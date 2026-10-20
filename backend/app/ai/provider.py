"""The boundary between AuraStack and whatever produces AI output.

Everything provider-specific (prompts, SDKs, models) lives behind this
protocol under app/ai/. The rest of the backend only ever sees the raw JSON a
provider returns, and validates it before use.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class CurriculumRequest:
    """The project facts a provider may use to build a curriculum."""

    project_name: str
    description: str | None
    platforms: tuple[str, ...]
    tech_stack: tuple[str, ...]


@dataclass(frozen=True)
class CurriculumTopicSummary:
    """One topic of a project's active curriculum, without its lesson content."""

    order: int
    title: str
    description: str


@dataclass(frozen=True)
class BlueprintRequest:
    """The project facts and curriculum outline a provider may use to build a
    technical blueprint. Never lesson content, progress or user profile data.

    `tech_stack` is the user's own project input (Project.tech_stack), not a
    previously generated blueprint.
    """

    project_name: str
    description: str | None
    platforms: tuple[str, ...]
    tech_stack: tuple[str, ...]
    curriculum: tuple[CurriculumTopicSummary, ...]


@dataclass(frozen=True)
class MentorTurn:
    """One earlier message of a mentor conversation, as the client sent it."""

    role: str  # "user" or "mentor"
    content: str


@dataclass(frozen=True)
class MentorBlueprintContext:
    """The parts of a ready blueprint the mentor may ground answers in, each
    already reduced to one line of text."""

    summary: str
    tech_stack: tuple[str, ...]
    architecture_style: str
    architecture_overview: str
    components: tuple[str, ...]
    roadmap: tuple[str, ...]


@dataclass(frozen=True)
class MentorLearningContext:
    """Progress through the project's active curriculum: topic titles only,
    never lesson content."""

    completed: tuple[str, ...]
    remaining: tuple[str, ...]


@dataclass(frozen=True)
class MentorProjectContext:
    """The facts of one project the caller owns. `blueprint` and `learning`
    are None when unavailable; `limitations` says why, so the mentor can
    explain gaps instead of filling them in.

    `tech_stack` is the user's own project input, not the blueprint's
    recommendation.
    """

    name: str
    description: str | None
    platforms: tuple[str, ...]
    tech_stack: tuple[str, ...]
    status: str
    blueprint: MentorBlueprintContext | None
    learning: MentorLearningContext | None
    limitations: tuple[str, ...]


@dataclass(frozen=True)
class MentorRequest:
    """The latest message, the conversation before it and, in project mode,
    the selected project's context (None for general mentoring)."""

    message: str
    history: tuple[MentorTurn, ...]
    project: MentorProjectContext | None


class AIProvider(Protocol):
    #: Stable identifier recorded as the output's `source`.
    name: str
    #: Model identifier recorded with the output; None when not model-backed.
    model: str | None

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        """Return the curriculum as a raw, untrusted JSON string.

        Must not persist anything and must not assign database identities;
        the caller validates and normalises the output.
        """
        ...

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        """Return the project blueprint as a raw, untrusted JSON string.

        Same obligations as generate_curriculum.
        """
        ...

    async def generate_mentor_reply(self, request: MentorRequest) -> str:
        """Return the mentor's answer as a raw, untrusted JSON string.

        Same obligations as generate_curriculum.
        """
        ...

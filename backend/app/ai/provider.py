"""The boundary between AuraStack and whatever produces a curriculum.

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


class AIProvider(Protocol):
    #: Stable identifier recorded as the curriculum's `source`.
    name: str
    #: Model identifier recorded with the curriculum; None when not model-backed.
    model: str | None

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        """Return the curriculum as a raw, untrusted JSON string.

        Must not persist anything and must not assign database identities;
        the caller validates and normalises the output.
        """
        ...

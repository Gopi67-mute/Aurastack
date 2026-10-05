import json

from app.ai.provider import CurriculumRequest
from app.ai.schemas import CURRICULUM_SCHEMA_VERSION
from app.services.curriculum_service import generate_project_topics


class DeterministicProvider:
    """Keyword-matched curriculum from the Phase 3.2 topic library.

    No model and no network: the same request always yields the same output.
    It still returns serialised JSON so it travels the exact path a real
    model's output will (parse, validate, normalise, persist).
    """

    name = "deterministic"
    model: str | None = None

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        topics = generate_project_topics(
            project_name=request.project_name,
            tech_stack=list(request.tech_stack),
            platforms=list(request.platforms),
            description=request.description,
        )
        return json.dumps({"schema_version": CURRICULUM_SCHEMA_VERSION, "topics": topics})

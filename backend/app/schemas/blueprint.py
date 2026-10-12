from typing import Literal, Optional

from pydantic import BaseModel

from app.ai.schemas import ComponentKind, TechCategory

#: Derived by the server on every read (see blueprint_service.blueprint_status);
#: never stored as such and never client-supplied.
BlueprintStatus = Literal["missing", "generating", "ready", "failed"]


class TechAlternative(BaseModel):
    name: str
    #: When to choose it instead, and what is given up.
    tradeoff: str


class TechChoice(BaseModel):
    category: TechCategory
    name: str
    #: Its role in this project.
    purpose: str
    #: Why it fits this project's requirements.
    rationale: str
    alternatives: list[TechAlternative]
    integrationNotes: Optional[str] = None


class ComponentConnection(BaseModel):
    #: Key of the component this one calls or reads from.
    target: str
    interaction: str


class ArchitectureComponent(BaseModel):
    key: str
    name: str
    kind: ComponentKind
    responsibility: str
    connections: list[ComponentConnection]


class DataFlowStep(BaseModel):
    #: Component keys; equal when a component acts on its own.
    actor: str
    target: str
    action: str


class DataFlow(BaseModel):
    name: str
    steps: list[DataFlowStep]


class FailureMode(BaseModel):
    scenario: str
    handling: str


class Architecture(BaseModel):
    style: str
    overview: str
    components: list[ArchitectureComponent]
    flows: list[DataFlow]
    failureModes: list[FailureMode]
    tradeoffs: list[str]


class PhaseLearning(BaseModel):
    """A curriculum topic applied in a roadmap phase. The title is the
    topic's title in the curriculum version the blueprint was built from."""

    topicOrder: int
    topicTitle: str
    application: str


class RoadmapPhase(BaseModel):
    order: int
    title: str
    goal: str
    rationale: str
    tasks: list[str]
    deliverables: list[str]
    acceptanceCriteria: list[str]
    #: Orders of the earlier phases this one builds on.
    dependsOn: list[int]
    techCategories: list[TechCategory]
    risks: list[str]
    learning: list[PhaseLearning]


class Blueprint(BaseModel):
    """The AI-generated technical blueprint. Its `techStack` is a
    recommendation and is distinct from the user's own Project.techStack."""

    summary: str
    #: What the blueprint relies on that the user did not state.
    assumptions: list[str]
    techStack: list[TechChoice]
    architecture: Architecture
    roadmap: list[RoadmapPhase]


class ProjectBlueprint(BaseModel):
    """A project's blueprint as the client sees it.

    `blueprint` and `generatedAt` are set only while `status` is "ready".
    Lifecycle internals (attempt, failure reason, provider, model, prompt and
    schema versions) are never exposed.
    """

    status: BlueprintStatus
    blueprint: Optional[Blueprint] = None
    generatedAt: Optional[str] = None

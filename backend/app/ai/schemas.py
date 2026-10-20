"""The versioned contracts every AI provider's output must satisfy: the
curriculum (CurriculumOutputV1), the project blueprint (BlueprintOutputV2) and
the mentor's answer (MentorOutputV1).

Kept separate from the MongoDB document and API schemas on purpose: this is
untrusted input. A provider's raw JSON is parsed and validated here before
anything is normalised or persisted, and nothing in it ever becomes a database
identity — topic ids are assigned by the server during normalisation.
"""

from typing import Annotated, Literal, Optional

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    model_validator,
)

CURRICULUM_SCHEMA_VERSION = "1.0"
#: Stored on each blueprint document: one generated under another version is
#: stale, hidden and regenerated, never read with this version's shape.
BLUEPRINT_SCHEMA_VERSION = "2.0"
MENTOR_SCHEMA_VERSION = "1.0"
MAX_TOPICS = 15
#: Longest mentor answer accepted from a provider, and so also the longest
#: earlier mentor turn a client may send back as conversation history.
MAX_MENTOR_REPLY_LENGTH = 6000

_MAX_TITLE_LENGTH = 120
_MAX_DESCRIPTION_LENGTH = 500
_MAX_SECTION_LENGTH = 2000
_MAX_KEY_LENGTH = 64
_MAX_NAME_LENGTH = 80
_MAX_SHORT_LENGTH = 240


def _collapse_whitespace(value: object) -> object:
    # Non-strings pass through untouched so strict validation rejects them.
    return " ".join(value.split()) if isinstance(value, str) else value


# Single-line text: internal runs of whitespace collapse to one space.
_Title = Annotated[
    str,
    BeforeValidator(_collapse_whitespace),
    StringConstraints(min_length=1, max_length=_MAX_TITLE_LENGTH),
]
_Description = Annotated[
    str,
    BeforeValidator(_collapse_whitespace),
    StringConstraints(min_length=1, max_length=_MAX_DESCRIPTION_LENGTH),
]
_Name = Annotated[
    str,
    BeforeValidator(_collapse_whitespace),
    StringConstraints(min_length=1, max_length=_MAX_NAME_LENGTH),
]
_Short = Annotated[
    str,
    BeforeValidator(_collapse_whitespace),
    StringConstraints(min_length=1, max_length=_MAX_SHORT_LENGTH),
]

# Body text: trimmed only, so line breaks inside an example survive.
_Section = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=_MAX_SECTION_LENGTH)
]

_Key = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=_MAX_KEY_LENGTH,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    ),
]


class _StrictModel(BaseModel):
    # `strict` stops silent coercion (e.g. "3" for an order); `forbid` stops a
    # provider inventing fields or sections the app does not know about.
    model_config = ConfigDict(extra="forbid", strict=True)


class TopicContentOutput(_StrictModel):
    """The fixed six sections of app.schemas.learning.TopicContent."""

    what: _Section
    why: _Section
    how: _Section
    example: _Section
    apply: _Section
    miniTask: Optional[_Section] = None


class CurriculumTopicOutput(_StrictModel):
    title: _Title
    description: _Description
    order: int = Field(ge=1)
    # Provenance only (stored as `source_key`); never a persisted identity.
    key: Optional[_Key] = None
    content: TopicContentOutput


class CurriculumOutputV1(_StrictModel):
    schema_version: Literal["1.0"]
    topics: list[CurriculumTopicOutput] = Field(min_length=1, max_length=MAX_TOPICS)

    @model_validator(mode="after")
    def _unique_orders_and_keys(self) -> "CurriculumOutputV1":
        orders = [topic.order for topic in self.topics]
        if len(set(orders)) != len(orders):
            raise ValueError("topic orders must be unique")

        keys = [topic.key for topic in self.topics if topic.key is not None]
        if len(set(keys)) != len(keys):
            raise ValueError("topic keys must be unique")
        return self


TechCategory = Literal[
    "frontend",
    "backend",
    "database",
    "authentication",
    "ai",
    "storage",
    "realtime",
    "infrastructure",
    "testing",
    "other",
]
ComponentKind = Literal["client", "service", "datastore", "external"]

_PositiveInt = Annotated[int, Field(ge=1)]


def _all_unique(values: list[object]) -> bool:
    return len(set(values)) == len(values)


class TechAlternativeOutput(_StrictModel):
    name: _Name
    #: When to choose it instead, and what is given up.
    tradeoff: _Short


class TechChoiceOutput(_StrictModel):
    category: TechCategory
    name: _Name
    #: Its role in this project.
    purpose: _Short
    #: Why it fits this project's requirements.
    rationale: _Short
    alternatives: list[TechAlternativeOutput] = Field(max_length=3)
    integration_notes: Optional[_Short] = None

    @model_validator(mode="after")
    def _distinct_alternatives(self) -> "TechChoiceOutput":
        names = [alternative.name.casefold() for alternative in self.alternatives]
        if not _all_unique(names):
            raise ValueError("tech alternatives must be unique")
        if self.name.casefold() in names:
            raise ValueError("a technology must not be its own alternative")
        return self


class ComponentConnectionOutput(_StrictModel):
    target: _Key
    #: What passes between the two components, and how.
    interaction: _Short


class ArchitectureComponentOutput(_StrictModel):
    key: _Key
    name: _Name
    kind: ComponentKind
    responsibility: _Short
    #: The components this one calls or reads from.
    connections: list[ComponentConnectionOutput] = Field(max_length=8)

    @model_validator(mode="after")
    def _valid_connections(self) -> "ArchitectureComponentOutput":
        targets = [connection.target for connection in self.connections]
        if not _all_unique(targets):
            raise ValueError("component connections must be unique")
        if self.key in targets:
            raise ValueError("a component must not connect to itself")
        return self


class DataFlowStepOutput(_StrictModel):
    actor: _Key
    #: May equal `actor` for work a component does on its own.
    target: _Key
    action: _Short


class DataFlowOutput(_StrictModel):
    #: The user journey this flow follows, e.g. "Place an order".
    name: _Title
    steps: list[DataFlowStepOutput] = Field(min_length=2, max_length=8)


class FailureModeOutput(_StrictModel):
    scenario: _Short
    handling: _Short


class ArchitectureOutput(_StrictModel):
    style: _Title
    overview: _Description
    components: list[ArchitectureComponentOutput] = Field(min_length=2, max_length=10)
    flows: list[DataFlowOutput] = Field(min_length=1, max_length=3)
    failure_modes: list[FailureModeOutput] = Field(min_length=1, max_length=5)
    tradeoffs: list[_Short] = Field(max_length=4)

    @model_validator(mode="after")
    def _consistent_components(self) -> "ArchitectureOutput":
        keys = [component.key for component in self.components]
        if not _all_unique(keys):
            raise ValueError("component keys must be unique")
        known = set(keys)
        if any(c.target not in known for component in self.components for c in component.connections):
            raise ValueError("every connection target must name a component key")
        if any(
            step.actor not in known or step.target not in known
            for flow in self.flows
            for step in flow.steps
        ):
            raise ValueError("every data flow step must name component keys")
        if not _all_unique([flow.name.casefold() for flow in self.flows]):
            raise ValueError("data flow names must be unique")
        return self


class PhaseLearningOutput(_StrictModel):
    """Links a roadmap phase to the curriculum topic it applies."""

    topic_order: _PositiveInt
    #: What the developer builds in this phase with that topic.
    application: _Short


class RoadmapPhaseOutput(_StrictModel):
    order: _PositiveInt
    title: _Title
    goal: _Short
    #: Why this phase matters, and why at this point.
    rationale: _Short
    tasks: list[_Short] = Field(min_length=2, max_length=8)
    deliverables: list[_Short] = Field(min_length=1, max_length=6)
    acceptance_criteria: list[_Short] = Field(min_length=1, max_length=6)
    #: Orders of the earlier phases this one builds on.
    depends_on: list[_PositiveInt] = Field(max_length=8)
    tech_categories: list[TechCategory] = Field(max_length=10)
    risks: list[_Short] = Field(max_length=3)
    learning: list[PhaseLearningOutput] = Field(max_length=4)

    @model_validator(mode="after")
    def _unique_references(self) -> "RoadmapPhaseOutput":
        if not _all_unique(list(self.depends_on)):
            raise ValueError("phase dependencies must be unique")
        if not _all_unique(list(self.tech_categories)):
            raise ValueError("phase tech categories must be unique")
        if not _all_unique([item.topic_order for item in self.learning]):
            raise ValueError("phase learning topics must be unique")
        return self


class BlueprintOutputV2(_StrictModel):
    schema_version: Literal["2.0"]
    summary: _Description
    #: Anything the blueprint relies on that the user did not state.
    assumptions: list[_Short] = Field(max_length=4)
    tech_stack: list[TechChoiceOutput] = Field(min_length=2, max_length=12)
    architecture: ArchitectureOutput
    roadmap: list[RoadmapPhaseOutput] = Field(min_length=2, max_length=8)

    @model_validator(mode="after")
    def _consistent_sections(self) -> "BlueprintOutputV2":
        choices = [(choice.category, choice.name.casefold()) for choice in self.tech_stack]
        if not _all_unique(choices):
            raise ValueError("tech stack entries must be unique per category")

        orders = [phase.order for phase in self.roadmap]
        if not _all_unique(orders):
            raise ValueError("roadmap phase orders must be unique")
        known_orders = set(orders)
        for phase in self.roadmap:
            if any(dependency >= phase.order for dependency in phase.depends_on):
                raise ValueError("a roadmap phase may only depend on earlier phases")
            if any(dependency not in known_orders for dependency in phase.depends_on):
                raise ValueError("every phase dependency must name a roadmap phase")

        # Both values are already validated (an int and a TechCategory), so
        # naming them never echoes free provider text.
        categories = {choice.category for choice in self.tech_stack}
        for phase in self.roadmap:
            for category in phase.tech_categories:
                if category not in categories:
                    raise ValueError(
                        f"roadmap phase {phase.order} tech category '{category}' "
                        "must appear in the tech stack"
                    )
        return self


class MentorOutputV1(_StrictModel):
    schema_version: Literal["1.0"]
    #: Plain text with optional ``` fenced code blocks; line breaks survive.
    reply: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MENTOR_REPLY_LENGTH),
    ]


class InvalidCurriculumOutputError(ValueError):
    """Provider output was not valid JSON or broke the curriculum contract.

    The message is safe to log: it names the failing locations and error
    types, never the provider's text itself.
    """


class InvalidBlueprintOutputError(ValueError):
    """Provider output was not valid JSON or broke the blueprint contract.

    Safe to log on the same terms as InvalidCurriculumOutputError.
    """


class InvalidMentorOutputError(ValueError):
    """Provider output was not valid JSON or broke the mentor contract.

    Safe to log on the same terms as InvalidCurriculumOutputError.
    """


def parse_mentor_output(raw: str) -> MentorOutputV1:
    """Parse and validate a provider's raw mentor JSON string.

    Raises InvalidMentorOutputError for malformed JSON and for any schema
    violation alike. Fenced or otherwise wrapped JSON is not scraped.
    """

    try:
        return MentorOutputV1.model_validate_json(raw)
    except ValidationError as exc:
        raise InvalidMentorOutputError(_safe_summary(exc)) from None


def parse_curriculum_output(raw: str) -> CurriculumOutputV1:
    """Parse and validate a provider's raw JSON string.

    Raises InvalidCurriculumOutputError for malformed JSON and for any
    schema violation alike, so callers handle one failure mode.
    """

    try:
        return CurriculumOutputV1.model_validate_json(raw)
    except ValidationError as exc:
        raise InvalidCurriculumOutputError(_safe_summary(exc)) from None


def parse_blueprint_output(raw: str, topic_orders: list[int] | None = None) -> BlueprintOutputV2:
    """Parse and validate a provider's raw blueprint JSON string.

    When `topic_orders` (the curriculum's topic orders) is given, every phase
    learning link must name one of them; None skips that check.

    Raises InvalidBlueprintOutputError for malformed JSON and for any schema
    violation alike. Fenced or otherwise wrapped JSON is not scraped.
    """

    try:
        output = BlueprintOutputV2.model_validate_json(raw)
    except ValidationError as exc:
        raise InvalidBlueprintOutputError(_safe_summary(exc)) from None

    if topic_orders is not None:
        known = set(topic_orders)
        for phase_index, phase in enumerate(output.roadmap):
            for item_index, item in enumerate(phase.learning):
                if item.topic_order not in known:
                    raise InvalidBlueprintOutputError(
                        f"roadmap.{phase_index}.learning.{item_index}.topic_order: "
                        "must be a curriculum topic"
                    )
    return output


def _safe_summary(exc: ValidationError) -> str:
    # Pydantic's messages describe the violated constraint, not the input,
    # and the input itself is excluded.
    summary = "; ".join(
        f"{'.'.join(str(part) for part in error['loc']) or '<root>'}: {error['msg']}"
        for error in exc.errors(include_input=False, include_url=False)[:10]
    )
    return f"{exc.error_count()} validation error(s): {summary}"

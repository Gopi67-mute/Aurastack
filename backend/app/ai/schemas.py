"""The versioned contract every AI provider's curriculum output must satisfy.

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
MAX_TOPICS = 15

_MAX_TITLE_LENGTH = 120
_MAX_DESCRIPTION_LENGTH = 500
_MAX_SECTION_LENGTH = 2000
_MAX_KEY_LENGTH = 64


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


class InvalidCurriculumOutputError(ValueError):
    """Provider output was not valid JSON or broke the curriculum contract.

    The message is safe to log: it names the failing locations and error
    types, never the provider's text itself.
    """


def parse_curriculum_output(raw: str) -> CurriculumOutputV1:
    """Parse and validate a provider's raw JSON string.

    Raises InvalidCurriculumOutputError for malformed JSON and for any
    schema violation alike, so callers handle one failure mode.
    """

    try:
        return CurriculumOutputV1.model_validate_json(raw)
    except ValidationError as exc:
        # Pydantic's messages describe the violated constraint, not the input,
        # and the input itself is excluded.
        summary = "; ".join(
            f"{'.'.join(str(part) for part in error['loc']) or '<root>'}: {error['msg']}"
            for error in exc.errors(include_input=False, include_url=False)[:10]
        )
        raise InvalidCurriculumOutputError(
            f"{exc.error_count()} validation error(s): {summary}"
        ) from None

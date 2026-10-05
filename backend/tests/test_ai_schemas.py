"""CurriculumOutputV1: the contract raw provider output must satisfy."""

import json
from typing import Any

import pytest

from app.ai.schemas import MAX_TOPICS, InvalidCurriculumOutputError, parse_curriculum_output


def _content(**overrides: Any) -> dict[str, Any]:
    content = {
        "what": "What it is.",
        "why": "Why it matters.",
        "how": "How it works.",
        "example": "An example.",
        "apply": "How to apply it.",
        "miniTask": "A small task.",
    }
    content.update(overrides)
    return content


def _topic(order: int = 1, **overrides: Any) -> dict[str, Any]:
    topic = {
        "key": f"topic-{order}",
        "title": f"Topic {order}",
        "description": "A description.",
        "order": order,
        "content": _content(),
    }
    topic.update(overrides)
    return topic


def _output(topics: list[dict[str, Any]] | None = None, **overrides: Any) -> str:
    payload: dict[str, Any] = {"schema_version": "1.0", "topics": topics or [_topic()]}
    payload.update(overrides)
    return json.dumps(payload)


def test_valid_output_parses() -> None:
    output = parse_curriculum_output(_output([_topic(1), _topic(2)]))

    assert output.schema_version == "1.0"
    assert [topic.order for topic in output.topics] == [1, 2]
    assert output.topics[0].content.miniTask == "A small task."


def test_key_and_mini_task_are_optional() -> None:
    topic = _topic(content=_content(miniTask=None))
    del topic["key"]

    output = parse_curriculum_output(_output([topic]))

    assert output.topics[0].key is None
    assert output.topics[0].content.miniTask is None


def test_whitespace_is_normalised() -> None:
    output = parse_curriculum_output(
        _output(
            [_topic(title="  Planning \n your   app ", content=_content(example="  line 1\nline 2  "))]
        )
    )

    assert output.topics[0].title == "Planning your app"
    # Body text keeps its internal line breaks.
    assert output.topics[0].content.example == "line 1\nline 2"


@pytest.mark.parametrize("raw", ["", "not json", '{"schema_version": "1.0", "topics": [', "[]", "null"])
def test_malformed_json_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(raw)


def test_unknown_top_level_field_is_rejected() -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output(extra="nope"))


def test_unknown_topic_field_is_rejected() -> None:
    # A provider can never smuggle in a persisted identity.
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(id="architecture-planning")]))


def test_invented_content_section_is_rejected() -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(content=_content(summary="extra section"))]))


@pytest.mark.parametrize("version", ["2.0", "1", 1.0, None])
def test_invalid_schema_version_is_rejected(version: object) -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output(schema_version=version))


def test_missing_schema_version_is_rejected() -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(json.dumps({"topics": [_topic()]}))


def test_empty_topic_list_is_rejected() -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(json.dumps({"schema_version": "1.0", "topics": []}))


def test_topic_count_upper_bound() -> None:
    at_limit = [_topic(order) for order in range(1, MAX_TOPICS + 1)]
    assert len(parse_curriculum_output(_output(at_limit)).topics) == MAX_TOPICS

    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([*at_limit, _topic(MAX_TOPICS + 1)]))


def test_duplicate_order_is_rejected() -> None:
    with pytest.raises(InvalidCurriculumOutputError, match="orders must be unique"):
        parse_curriculum_output(_output([_topic(1, key="a"), _topic(1, key="b")]))


def test_duplicate_key_is_rejected() -> None:
    with pytest.raises(InvalidCurriculumOutputError, match="keys must be unique"):
        parse_curriculum_output(_output([_topic(1, key="same"), _topic(2, key="same")]))


@pytest.mark.parametrize("key", ["Not A Slug", "under_score", "-leading", ""])
def test_malformed_key_is_rejected(key: str) -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(key=key)]))


@pytest.mark.parametrize("field", ["title", "description"])
@pytest.mark.parametrize("value", ["", "   ", None, 7])
def test_required_strings_must_be_non_blank_strings(field: str, value: object) -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(**{field: value})]))


@pytest.mark.parametrize("section", ["what", "why", "how", "example", "apply"])
def test_required_content_sections(section: str) -> None:
    missing = _content()
    del missing[section]
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(content=missing)]))

    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(content=_content(**{section: "  "}))]))


@pytest.mark.parametrize("order", [0, -1, "1", 1.5, True])
def test_order_must_be_a_positive_integer(order: object) -> None:
    with pytest.raises(InvalidCurriculumOutputError):
        parse_curriculum_output(_output([_topic(order=order)]))


def test_error_message_does_not_echo_provider_text() -> None:
    secret_like = "sk-provider-internal-detail"
    with pytest.raises(InvalidCurriculumOutputError) as excinfo:
        parse_curriculum_output(_output([_topic(title=secret_like, order="bad")]))

    assert secret_like not in str(excinfo.value)
    assert "order" in str(excinfo.value)

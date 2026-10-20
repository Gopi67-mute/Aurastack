from app.services.curriculum_service import generate_project_topics


def test_always_true_topics_included_regardless_of_stack() -> None:
    topics = generate_project_topics(
        project_name="Demo", tech_stack=None, platforms=None, description=None
    )
    keys = {topic["key"] for topic in topics}
    assert {"architecture-planning", "testing-basics", "deployment"} <= keys


def test_keyword_matching_includes_relevant_topics_only() -> None:
    topics = generate_project_topics(
        project_name="Demo",
        tech_stack=["FastAPI", "MongoDB"],
        platforms=None,
        description=None,
    )
    keys = {topic["key"] for topic in topics}
    assert "fastapi-async" in keys
    assert "mongodb-data-modeling" in keys
    assert "rest-api-design" in keys
    assert "react-fundamentals" not in keys
    assert "node-express" not in keys


def test_mobile_platform_matches_react_navigation_and_state_topics() -> None:
    topics = generate_project_topics(
        project_name="Demo", tech_stack=None, platforms=["android", "ios"], description=None
    )
    keys = {topic["key"] for topic in topics}
    assert "react-fundamentals" in keys
    assert "navigation-routing" in keys
    assert "state-management" in keys


def test_topics_are_ordered_sequentially_from_one() -> None:
    topics = generate_project_topics(
        project_name="Demo", tech_stack=["react native"], platforms=None, description=None
    )
    assert [topic["order"] for topic in topics] == list(range(1, len(topics) + 1))


def test_generation_is_deterministic() -> None:
    first = generate_project_topics(
        project_name="Demo", tech_stack=["fastapi"], platforms=["web"], description="a shop"
    )
    second = generate_project_topics(
        project_name="Demo", tech_stack=["fastapi"], platforms=["web"], description="a shop"
    )
    assert first == second


def test_project_name_is_interpolated_into_content() -> None:
    topics = generate_project_topics(
        project_name="Grocery Tracker", tech_stack=None, platforms=None, description=None
    )
    architecture = next(topic for topic in topics if topic["key"] == "architecture-planning")
    assert "Grocery Tracker" in architecture["content"]["why"]


def test_output_is_provider_shaped_with_no_persisted_identity() -> None:
    topics = generate_project_topics(
        project_name="Demo", tech_stack=None, platforms=["web"], description=None
    )
    for topic in topics:
        assert set(topic) == {"key", "title", "description", "order", "content"}

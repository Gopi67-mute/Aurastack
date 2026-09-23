from app.services.curriculum_service import generate_project_topics


def test_always_true_topics_included_regardless_of_stack() -> None:
    topics = generate_project_topics(
        project_id="p1", project_name="Demo", tech_stack=None, platforms=None, description=None
    )
    ids = {topic["id"] for topic in topics}
    assert {"architecture-planning", "testing-basics", "deployment"} <= ids


def test_keyword_matching_includes_relevant_topics_only() -> None:
    topics = generate_project_topics(
        project_id="p1",
        project_name="Demo",
        tech_stack=["FastAPI", "MongoDB"],
        platforms=None,
        description=None,
    )
    ids = {topic["id"] for topic in topics}
    assert "fastapi-async" in ids
    assert "mongodb-data-modeling" in ids
    assert "rest-api-design" in ids
    assert "react-fundamentals" not in ids
    assert "node-express" not in ids


def test_mobile_platform_matches_react_navigation_and_state_topics() -> None:
    topics = generate_project_topics(
        project_id="p1", project_name="Demo", tech_stack=None, platforms=["android", "ios"], description=None
    )
    ids = {topic["id"] for topic in topics}
    assert "react-fundamentals" in ids
    assert "navigation-routing" in ids
    assert "state-management" in ids


def test_topics_are_ordered_sequentially_from_one() -> None:
    topics = generate_project_topics(
        project_id="p1", project_name="Demo", tech_stack=["react native"], platforms=None, description=None
    )
    assert [topic["order"] for topic in topics] == list(range(1, len(topics) + 1))


def test_generation_is_deterministic() -> None:
    first = generate_project_topics(
        project_id="p1", project_name="Demo", tech_stack=["fastapi"], platforms=["web"], description="a shop"
    )
    second = generate_project_topics(
        project_id="p1", project_name="Demo", tech_stack=["fastapi"], platforms=["web"], description="a shop"
    )
    assert [topic["id"] for topic in first] == [topic["id"] for topic in second]


def test_project_name_is_interpolated_into_content() -> None:
    topics = generate_project_topics(
        project_id="p1", project_name="Grocery Tracker", tech_stack=None, platforms=None, description=None
    )
    architecture = next(topic for topic in topics if topic["id"] == "architecture-planning")
    assert "Grocery Tracker" in architecture["content"]["why"]

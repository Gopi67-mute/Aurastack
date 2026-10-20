from fastapi.testclient import TestClient


def _create_project(client: TestClient, **overrides: object) -> dict:
    payload = {"title": "App", "description": "mobile app", "platforms": ["android"]}
    payload.update(overrides)
    response = client.post("/api/v1/projects", json=payload)
    return response.json()["data"]


def _first_topic_id(client: TestClient, project_id: str) -> str:
    return client.get(f"/api/v1/projects/{project_id}/learning").json()["data"]["topics"][0]["id"]


def test_get_learning_returns_topics_in_order_with_default_status(client: TestClient) -> None:
    project = _create_project(client)
    response = client.get(f"/api/v1/projects/{project['id']}/learning")
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["projectId"] == project["id"]
    assert data["projectName"] == project["name"]
    topics = data["topics"]
    assert [topic["order"] for topic in topics] == list(range(1, len(topics) + 1))
    assert all(topic["status"] == "not_started" and topic["completedAt"] is None for topic in topics)


def test_list_learning_returns_every_owned_project_with_progress_applied(
    client: TestClient,
) -> None:
    first = _create_project(client, title="First")
    second = _create_project(client, title="Second")
    topic_id = _first_topic_id(client, first["id"])
    client.post(f"/api/v1/projects/{first['id']}/learning/{topic_id}/complete")

    data = client.get("/api/v1/learning").json()["data"]

    assert {entry["projectId"] for entry in data} == {first["id"], second["id"]}
    by_project = {entry["projectId"]: entry for entry in data}
    completed = [
        topic for topic in by_project[first["id"]]["topics"] if topic["status"] == "completed"
    ]
    assert [topic["id"] for topic in completed] == [topic_id]
    assert all(topic["status"] == "not_started" for topic in by_project[second["id"]]["topics"])
    # Still in learning order after the batched read.
    for entry in data:
        orders = [topic["order"] for topic in entry["topics"]]
        assert orders == sorted(orders)


def test_list_learning_excludes_other_users_projects(client: TestClient) -> None:
    _create_project(client)

    assert client.get("/api/v1/learning", headers={"x-test-user-id": "user-b"}).json()["data"] == []


def test_get_learning_for_unowned_project_returns_404(client: TestClient) -> None:
    project = _create_project(client)
    response = client.get(
        f"/api/v1/projects/{project['id']}/learning", headers={"x-test-user-id": "user-b"}
    )
    assert response.status_code == 404


def test_get_single_topic(client: TestClient) -> None:
    project = _create_project(client)
    topic_id = client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"][0]["id"]

    response = client.get(f"/api/v1/projects/{project['id']}/learning/{topic_id}")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == topic_id


def test_get_unknown_topic_returns_404(client: TestClient) -> None:
    project = _create_project(client)
    response = client.get(f"/api/v1/projects/{project['id']}/learning/does-not-exist")
    assert response.status_code == 404


def test_complete_topic_sets_completed_at_and_records_one_activity_event(
    client: TestClient, repos: dict[str, object]
) -> None:
    project = _create_project(client)
    topic_id = client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"][0]["id"]

    response = client.post(f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete")
    assert response.status_code == 200

    completed = response.json()["data"]
    assert completed["status"] == "completed"
    assert completed["completedAt"] is not None
    assert len(repos["activity"].events) == 1
    assert repos["activity"].events[0]["type"] == "learning"


def test_completing_a_topic_twice_is_idempotent(client: TestClient, repos: dict[str, object]) -> None:
    project = _create_project(client)
    topic_id = client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"][0]["id"]

    first = client.post(f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete").json()["data"]
    second = client.post(f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete").json()["data"]

    assert first["completedAt"] == second["completedAt"]
    assert len(repos["activity"].events) == 1


def test_complete_topic_for_unowned_project_returns_404(client: TestClient) -> None:
    project = _create_project(client)
    topic_id = client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"][0]["id"]

    response = client.post(
        f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete",
        headers={"x-test-user-id": "user-b"},
    )
    assert response.status_code == 404


def test_complete_unknown_topic_returns_404(client: TestClient) -> None:
    project = _create_project(client)
    response = client.post(f"/api/v1/projects/{project['id']}/learning/does-not-exist/complete")
    assert response.status_code == 404

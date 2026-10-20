from uuid import UUID

from fastapi.testclient import TestClient


def test_create_project_responds_generating_then_generates_curriculum(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"title": "Grocery Tracker", "description": "A mobile app to track groceries", "platforms": ["android", "ios"]},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True

    project = body["data"]
    assert project["name"] == "Grocery Tracker"
    # The response is sent before generation runs.
    assert project["status"] == "generating"
    assert project["progress"] == 0
    assert project["id"]
    assert project["createdAt"]

    # TestClient has run the background generation by now.
    assert client.get(f"/api/v1/projects/{project['id']}").json()["data"]["status"] == "ready"

    learning = client.get(f"/api/v1/projects/{project['id']}/learning")
    topics = learning.json()["data"]["topics"]
    titles = {topic["title"] for topic in topics}
    assert "Planning your architecture" in titles
    assert "React fundamentals" in titles
    assert all(topic["status"] == "not_started" for topic in topics)
    for topic in topics:
        UUID(topic["id"])  # Server-assigned, never the library key.


def test_create_project_rejects_empty_platforms(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects", json={"title": "Bad", "description": "no platforms", "platforms": []}
    )
    assert response.status_code == 422


def test_list_projects_is_scoped_to_the_authenticated_user(client: TestClient) -> None:
    client.post("/api/v1/projects", json={"title": "A", "description": "d", "platforms": ["web"]})

    own = client.get("/api/v1/projects")
    assert len(own.json()["data"]) == 1

    other = client.get("/api/v1/projects", headers={"x-test-user-id": "user-b"})
    assert other.json()["data"] == []


def test_get_project_not_owned_by_caller_returns_404(client: TestClient) -> None:
    created = client.post("/api/v1/projects", json={"title": "A", "description": "d", "platforms": ["web"]})
    project_id = created.json()["data"]["id"]

    response = client.get(f"/api/v1/projects/{project_id}", headers={"x-test-user-id": "user-b"})
    assert response.status_code == 404


def test_get_missing_project_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/projects/does-not-exist")
    assert response.status_code == 404


def test_update_project_only_changes_supplied_fields(client: TestClient) -> None:
    created = client.post("/api/v1/projects", json={"title": "A", "description": "d", "platforms": ["web"]})
    project_id = created.json()["data"]["id"]

    response = client.patch(f"/api/v1/projects/{project_id}", json={"name": "Renamed"})
    assert response.status_code == 200
    updated = response.json()["data"]
    assert updated["name"] == "Renamed"
    assert updated["description"] == "d"
    assert updated["platforms"] == ["web"]


def test_update_project_cannot_write_progress(
    client: TestClient, repos: dict[str, object]
) -> None:
    created = client.post("/api/v1/projects", json={"title": "A", "description": "d", "platforms": ["web"]})
    project_id = created.json()["data"]["id"]
    stored_before = dict(repos["project"]._docs[project_id])

    response = client.patch(f"/api/v1/projects/{project_id}", json={"progress": 50})

    assert response.status_code == 422
    assert repos["project"]._docs[project_id] == stored_before
    assert client.get(f"/api/v1/projects/{project_id}").json()["data"]["progress"] == 0


def test_update_project_cannot_change_lifecycle_status(
    client: TestClient, repos: dict[str, object]
) -> None:
    created = client.post("/api/v1/projects", json={"title": "A", "description": "d", "platforms": ["web"]})
    project_id = created.json()["data"]["id"]
    repos["project"]._docs[project_id]["status"] = "failed"

    response = client.patch(f"/api/v1/projects/{project_id}", json={"status": "ready"})

    assert response.status_code == 422
    assert repos["project"]._docs[project_id]["status"] == "failed"


def test_update_project_not_owned_returns_404(client: TestClient) -> None:
    created = client.post("/api/v1/projects", json={"title": "A", "description": "d", "platforms": ["web"]})
    project_id = created.json()["data"]["id"]

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Taken over"},
        headers={"x-test-user-id": "user-b"},
    )
    assert response.status_code == 404


def test_delete_project_cascades_learning_and_activity_data(
    client: TestClient, repos: dict[str, object]
) -> None:
    created = client.post(
        "/api/v1/projects", json={"title": "A", "description": "mobile app", "platforms": ["android"]}
    )
    project_id = created.json()["data"]["id"]
    topic_id = client.get(f"/api/v1/projects/{project_id}/learning").json()["data"]["topics"][0]["id"]
    client.post(f"/api/v1/projects/{project_id}/learning/{topic_id}/complete")

    delete_response = client.delete(f"/api/v1/projects/{project_id}")
    assert delete_response.status_code == 200

    assert client.get(f"/api/v1/projects/{project_id}").status_code == 404
    assert client.get(f"/api/v1/projects/{project_id}/learning").status_code == 404
    assert repos["activity"].events == []


def test_delete_missing_project_returns_404(client: TestClient) -> None:
    response = client.delete("/api/v1/projects/does-not-exist")
    assert response.status_code == 404

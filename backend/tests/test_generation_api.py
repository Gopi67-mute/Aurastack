"""Generation lifecycle over HTTP: create, failure, retry, ownership and auth."""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai.deterministic_provider import DeterministicProvider
from app.ai.provider import CurriculumRequest
from app.api import deps
from app.main import app
from app.middleware.auth import get_current_user_id

PROJECT = {"title": "Storefront", "description": "a web shop", "platforms": ["web"]}


class FlakyProvider:
    """Fails until `healthy` is flipped, like a provider outage that recovers."""

    name = "flaky"
    model: str | None = None

    def __init__(self) -> None:
        self.healthy = False
        self.calls = 0

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        self.calls += 1
        if not self.healthy:
            raise RuntimeError("provider unavailable")
        return await DeterministicProvider().generate_curriculum(request)


@pytest.fixture()
def provider(client: TestClient) -> Iterator[FlakyProvider]:
    flaky = FlakyProvider()
    app.dependency_overrides[deps.get_ai_provider] = lambda: flaky
    yield flaky


def _create(client: TestClient) -> dict[str, Any]:
    response = client.post("/api/v1/projects", json=PROJECT)
    assert response.status_code == 201
    return response.json()["data"]


def _status(client: TestClient, project_id: str, user: str = "user-a") -> str:
    response = client.get(f"/api/v1/projects/{project_id}", headers={"x-test-user-id": user})
    return response.json()["data"]["status"]


def _retry(client: TestClient, project_id: str, user: str = "user-a") -> Any:
    return client.post(
        f"/api/v1/projects/{project_id}/generation/retry", headers={"x-test-user-id": user}
    )


def test_create_requires_authentication(client: TestClient) -> None:
    del app.dependency_overrides[get_current_user_id]

    response = client.post("/api/v1/projects", json=PROJECT)

    assert response.status_code == 401


def test_retry_requires_authentication(client: TestClient) -> None:
    project = _create(client)
    del app.dependency_overrides[get_current_user_id]

    assert _retry(client, project["id"]).status_code == 401


def test_authenticated_create_generates_in_the_background(client: TestClient) -> None:
    project = _create(client)

    assert project["status"] == "generating"
    assert _status(client, project["id"]) == "ready"
    topics = client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"]
    assert topics


def test_failed_generation_is_reported_without_internal_details(
    client: TestClient, provider: FlakyProvider
) -> None:
    project = _create(client)

    response = client.get(f"/api/v1/projects/{project['id']}")

    data = response.json()["data"]
    assert data["status"] == "failed"
    # Lifecycle only: no failure reason, attempt, provider or model.
    assert set(data) == {
        "id", "name", "status", "progress", "createdAt",
        "description", "platforms", "techStack", "iconKey",
    }
    assert "provider unavailable" not in response.text
    assert client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"] == []


def test_retry_is_accepted_and_regenerates(client: TestClient, provider: FlakyProvider) -> None:
    project = _create(client)
    assert _status(client, project["id"]) == "failed"
    provider.healthy = True

    response = _retry(client, project["id"])

    assert response.status_code == 202
    body = response.json()
    assert body["success"] is True
    assert body["data"]["id"] == project["id"]
    assert body["data"]["status"] == "generating"
    assert _status(client, project["id"]) == "ready"
    assert client.get(f"/api/v1/projects/{project['id']}/learning").json()["data"]["topics"]
    assert provider.calls == 2


def test_retry_that_fails_again_stays_retryable(client: TestClient, provider: FlakyProvider) -> None:
    project = _create(client)

    assert _retry(client, project["id"]).status_code == 202
    assert _status(client, project["id"]) == "failed"
    assert _retry(client, project["id"]).status_code == 202
    assert provider.calls == 3


def test_retry_of_another_users_project_returns_404(
    client: TestClient, provider: FlakyProvider, repos: dict[str, Any]
) -> None:
    project = _create(client)

    response = _retry(client, project["id"], user="user-b")

    assert response.status_code == 404
    assert repos["project"]._docs[project["id"]]["generation"]["attempt"] == 1
    assert provider.calls == 1


def test_retry_of_missing_project_returns_404(client: TestClient) -> None:
    assert _retry(client, "does-not-exist").status_code == 404


def test_retry_while_generation_is_running_returns_409(
    client: TestClient, repos: dict[str, Any]
) -> None:
    project = _create(client)
    doc = repos["project"]._docs[project["id"]]
    doc["status"] = "generating"
    doc["generation"]["started_at"] = datetime.now(timezone.utc).isoformat()

    response = _retry(client, project["id"])

    assert response.status_code == 409
    assert doc["generation"]["attempt"] == 1


def test_retry_of_ready_project_returns_409(client: TestClient) -> None:
    project = _create(client)

    assert _retry(client, project["id"]).status_code == 409


def test_retry_after_the_lease_expired_is_accepted(
    client: TestClient, repos: dict[str, Any]
) -> None:
    project = _create(client)
    doc = repos["project"]._docs[project["id"]]
    doc["status"] = "generating"
    doc["generation"]["started_at"] = (
        datetime.now(timezone.utc) - timedelta(minutes=10)
    ).isoformat()
    assert _status(client, project["id"]) == "failed"

    response = _retry(client, project["id"])

    assert response.status_code == 202
    assert _status(client, project["id"]) == "ready"
    assert doc["generation"]["attempt"] == 2
    assert doc["curriculum"]["version"] == 2

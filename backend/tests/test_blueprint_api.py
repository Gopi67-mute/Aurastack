"""Blueprint endpoints over HTTP: status contract, generation, conflicts,
ownership, auth and the project delete cascade."""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai.deterministic_provider import DeterministicProvider
from app.ai.provider import BlueprintRequest
from app.api import deps
from app.main import app
from app.middleware.auth import get_current_user_id

PROJECT = {"title": "Storefront", "description": "a web shop", "platforms": ["web"]}
INTERNAL_FIELDS = (
    "user_id", "attempt", "failure_reason", "failureReason", "provider_error", "model",
    "prompt_version", "source", "curriculum_version", "schema_version", "started_at", "meta",
)


class FlakyBlueprintProvider(DeterministicProvider):
    """Curricula always work; blueprints fail until `healthy` is flipped."""

    name = "flaky"
    model: str | None = "flaky-model-1"

    def __init__(self) -> None:
        self.healthy = False
        self.calls = 0

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        self.calls += 1
        if not self.healthy:
            raise RuntimeError("blueprint provider unavailable")
        return await super().generate_blueprint(request)


@pytest.fixture()
def provider(client: TestClient) -> Iterator[FlakyBlueprintProvider]:
    flaky = FlakyBlueprintProvider()
    app.dependency_overrides[deps.get_ai_provider] = lambda: flaky
    yield flaky


def _ready_project(client: TestClient) -> str:
    response = client.post("/api/v1/projects", json=PROJECT)
    assert response.status_code == 201
    project_id = response.json()["data"]["id"]
    # TestClient has run the background curriculum generation by now.
    assert client.get(f"/api/v1/projects/{project_id}").json()["data"]["status"] == "ready"
    return project_id


def _get(client: TestClient, project_id: str, user: str = "user-a") -> httpx.Response:
    return client.get(f"/api/v1/projects/{project_id}/blueprint", headers={"x-test-user-id": user})


def _post(client: TestClient, project_id: str, user: str = "user-a") -> httpx.Response:
    return client.post(
        f"/api/v1/projects/{project_id}/blueprint/generation", headers={"x-test-user-id": user}
    )


def _data(response: httpx.Response) -> dict[str, Any]:
    assert response.status_code == 200
    return response.json()["data"]


def _assert_no_internals(response: httpx.Response) -> None:
    for field in INTERNAL_FIELDS:
        assert f'"{field}"' not in response.text


# --- authentication and ownership -------------------------------------------


def test_blueprint_endpoints_require_authentication(client: TestClient) -> None:
    project_id = _ready_project(client)
    del app.dependency_overrides[get_current_user_id]

    assert _get(client, project_id).status_code == 401
    assert _post(client, project_id).status_code == 401


def test_another_users_project_returns_404(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)

    assert _get(client, project_id, user="user-b").status_code == 404
    assert _post(client, project_id, user="user-b").status_code == 404
    assert repos["blueprint"]._docs == {}


def test_missing_project_returns_404(client: TestClient) -> None:
    assert _get(client, "does-not-exist").status_code == 404
    assert _post(client, "does-not-exist").status_code == 404


# --- reads ------------------------------------------------------------------


def test_get_missing(client: TestClient) -> None:
    project_id = _ready_project(client)

    response = _get(client, project_id)

    assert response.json()["success"] is True
    assert _data(response) == {"status": "missing", "blueprint": None, "generatedAt": None}


def test_get_generating(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    doc = repos["blueprint"]._docs[project_id]
    doc.update(status="generating", blueprint=None, started_at=datetime.now(timezone.utc).isoformat())

    assert _data(_get(client, project_id)) == {
        "status": "generating", "blueprint": None, "generatedAt": None
    }


def test_get_ready_returns_the_full_client_contract(client: TestClient) -> None:
    project_id = _ready_project(client)
    assert _post(client, project_id).status_code == 202

    response = _get(client, project_id)

    data = _data(response)
    assert set(data) == {"status", "blueprint", "generatedAt"}
    assert data["status"] == "ready"
    assert data["generatedAt"]
    blueprint = data["blueprint"]
    assert set(blueprint) == {"summary", "assumptions", "techStack", "architecture", "roadmap"}
    assert "Storefront" in blueprint["summary"]
    tech = blueprint["techStack"][0]
    assert set(tech) == {"category", "name", "purpose", "rationale", "alternatives", "integrationNotes"}
    assert all(set(alternative) == {"name", "tradeoff"} for alternative in tech["alternatives"])
    architecture = blueprint["architecture"]
    assert set(architecture) == {"style", "overview", "components", "flows", "failureModes", "tradeoffs"}
    assert set(architecture["components"][0]) == {"key", "name", "kind", "responsibility", "connections"}
    assert set(architecture["components"][0]["connections"][0]) == {"target", "interaction"}
    assert set(architecture["flows"][0]) == {"name", "steps"}
    assert set(architecture["flows"][0]["steps"][0]) == {"actor", "target", "action"}
    assert set(architecture["failureModes"][0]) == {"scenario", "handling"}
    phase = blueprint["roadmap"][0]
    assert set(phase) == {
        "order", "title", "goal", "rationale", "tasks", "deliverables", "acceptanceCriteria",
        "dependsOn", "techCategories", "risks", "learning",
    }
    assert set(phase["learning"][0]) == {"topicOrder", "topicTitle", "application"}
    assert [phase["order"] for phase in blueprint["roadmap"]] == list(
        range(1, len(blueprint["roadmap"]) + 1)
    )
    _assert_no_internals(response)


def test_get_failed_hides_the_failure_reason(
    client: TestClient, provider: FlakyBlueprintProvider
) -> None:
    project_id = _ready_project(client)
    assert _post(client, project_id).status_code == 202

    response = _get(client, project_id)

    assert _data(response) == {"status": "failed", "blueprint": None, "generatedAt": None}
    assert "unavailable" not in response.text
    _assert_no_internals(response)
    # The project itself is unaffected and its learning stays usable.
    assert client.get(f"/api/v1/projects/{project_id}").json()["data"]["status"] == "ready"
    assert client.get(f"/api/v1/projects/{project_id}/learning").json()["data"]["topics"]


def test_get_after_an_expired_lease_reads_failed(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    repos["blueprint"]._docs[project_id].update(
        status="generating",
        started_at=(datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
    )

    assert _data(_get(client, project_id))["status"] == "failed"


def test_get_stale_blueprint_reads_missing(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    assert _data(_get(client, project_id))["status"] == "ready"

    repos["project"]._docs[project_id]["curriculum"]["version"] = 2

    assert _data(_get(client, project_id)) == {"status": "missing", "blueprint": None, "generatedAt": None}


def test_blueprint_never_appears_in_project_reads(client: TestClient) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)

    for response in (client.get("/api/v1/projects"), client.get(f"/api/v1/projects/{project_id}")):
        assert "blueprint" not in response.text.lower()
        assert "architecture" not in response.text


# --- generation -------------------------------------------------------------


def test_post_is_accepted_and_generates(client: TestClient) -> None:
    project_id = _ready_project(client)

    response = _post(client, project_id)

    assert response.status_code == 202
    body = response.json()
    assert body["success"] is True
    assert body["data"] == {"status": "generating", "blueprint": None, "generatedAt": None}
    assert _data(_get(client, project_id))["status"] == "ready"


def test_post_retries_after_a_failure(client: TestClient, provider: FlakyBlueprintProvider) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    assert _data(_get(client, project_id))["status"] == "failed"
    provider.healthy = True

    assert _post(client, project_id).status_code == 202

    assert _data(_get(client, project_id))["status"] == "ready"
    assert provider.calls == 2


def test_post_retries_after_an_expired_lease(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    doc = repos["blueprint"]._docs[project_id]
    doc.update(
        status="generating",
        started_at=(datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
    )

    assert _post(client, project_id).status_code == 202
    assert doc["attempt"] == 2
    assert _data(_get(client, project_id))["status"] == "ready"


def test_post_regenerates_a_stale_blueprint(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    project = repos["project"]._docs[project_id]
    project["curriculum"]["version"] = 2
    for topic in repos["learning"].all_topics(project_id):
        topic["curriculum_version"] = 2

    assert _post(client, project_id).status_code == 202

    assert repos["blueprint"]._docs[project_id]["curriculum_version"] == 2
    assert _data(_get(client, project_id))["status"] == "ready"


def test_post_while_project_is_not_ready_returns_409(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    project = repos["project"]._docs[project_id]
    project["status"] = "generating"
    project["generation"]["started_at"] = datetime.now(timezone.utc).isoformat()

    response = _post(client, project_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Project curriculum is not ready yet"
    assert repos["blueprint"]._docs == {}
    assert _data(_get(client, project_id))["status"] == "missing"


def test_post_while_generation_is_active_returns_409(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    doc = repos["blueprint"]._docs[project_id]
    doc.update(status="generating", started_at=datetime.now(timezone.utc).isoformat())

    response = _post(client, project_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Blueprint generation is already in progress"
    assert doc["attempt"] == 1


def test_post_when_blueprint_is_current_returns_409(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)
    assert _post(client, project_id).status_code == 202

    response = _post(client, project_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Blueprint has already been generated"
    assert repos["blueprint"]._docs[project_id]["attempt"] == 1


def test_post_takes_no_body(client: TestClient, repos: dict[str, Any]) -> None:
    project_id = _ready_project(client)

    response = client.post(
        f"/api/v1/projects/{project_id}/blueprint/generation",
        json={"status": "ready", "blueprint": {"summary": "forged"}},
    )

    assert response.status_code == 202
    assert "forged" not in str(repos["blueprint"]._docs[project_id])


# --- project deletion -------------------------------------------------------


def test_deleting_the_project_cascades_to_its_blueprint(
    client: TestClient, repos: dict[str, Any]
) -> None:
    project_id = _ready_project(client)
    _post(client, project_id)
    assert project_id in repos["blueprint"]._docs

    assert client.delete(f"/api/v1/projects/{project_id}").status_code == 200

    assert repos["blueprint"]._docs == {}
    assert _get(client, project_id).status_code == 404
    assert _post(client, project_id).status_code == 404

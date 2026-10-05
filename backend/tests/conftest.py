import pytest
from fastapi import Header
from fastapi.testclient import TestClient

from app.api import deps
from app.core.config import Settings, get_settings
from app.main import app
from app.middleware.auth import get_current_user_id
from tests.fakes import FakeActivityRepository, FakeLearningRepository, FakeProjectRepository


def _fake_current_user_id(x_test_user_id: str = Header(default="user-a")) -> str:
    """Test-only auth override: identity comes from a header instead of a
    real Clerk JWT, so tests can simulate different users.
    """
    return x_test_user_id


def _test_settings() -> Settings:
    # Never reads backend/.env: tests must not depend on local secrets.
    return Settings(
        _env_file=None,
        mongodb_uri="mongodb://unused-in-tests",
        clerk_jwt_issuer="https://issuer.test",
        ai_provider="deterministic",
        ai_generation_timeout_seconds=5,
    )


@pytest.fixture()
def repos() -> dict[str, object]:
    return {
        "project": FakeProjectRepository(),
        "learning": FakeLearningRepository(),
        "activity": FakeActivityRepository(),
    }


@pytest.fixture()
def client(repos: dict[str, object]) -> TestClient:
    app.dependency_overrides[deps.get_project_repository] = lambda: repos["project"]
    app.dependency_overrides[deps.get_learning_repository] = lambda: repos["learning"]
    app.dependency_overrides[deps.get_activity_repository] = lambda: repos["activity"]
    app.dependency_overrides[get_current_user_id] = _fake_current_user_id
    app.dependency_overrides[get_settings] = _test_settings

    # Not entered as a context manager: this intentionally skips the app's
    # lifespan (no real MongoDB connection attempt), since every dependency
    # that would touch it is already overridden above.
    #
    # Starlette's TestClient runs background tasks before returning the
    # response, so a project's generation has finished by the time
    # `client.post("/api/v1/projects")` returns.
    test_client = TestClient(app)
    yield test_client

    app.dependency_overrides.clear()

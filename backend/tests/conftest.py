import pytest
from fastapi import Header
from fastapi.testclient import TestClient

from app.api import deps
from app.main import app
from app.middleware.auth import get_current_user_id
from tests.fakes import FakeActivityRepository, FakeLearningRepository, FakeProjectRepository


def _fake_current_user_id(x_test_user_id: str = Header(default="user-a")) -> str:
    """Test-only auth override: identity comes from a header instead of a
    real Clerk JWT, so tests can simulate different users.
    """
    return x_test_user_id


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

    # Not entered as a context manager: this intentionally skips the app's
    # lifespan (no real MongoDB connection attempt), since every dependency
    # that would touch it is already overridden above.
    test_client = TestClient(app)
    yield test_client

    app.dependency_overrides.clear()

"""Saved mentor conversations over HTTP: saving, reloading, ordering, retry
idempotency, storage failures, auth and per-user isolation."""

import asyncio
import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai.provider import MentorRequest
from app.api import deps
from app.main import app
from app.middleware.auth import get_current_user_id
from app.schemas.mentor import MentorChatRequest
from app.services.mentor_service import MentorService
from tests.fakes import FakeMentorConversationRepository
from tests.test_mentor_api import INTERNALS, PROJECT, RecordingProvider
from tests.test_mentor_service import FakeBlueprints, FakeLearning, FakeProjects, ScriptedProvider

CONVERSATION = "/api/v1/mentor/conversation"


class QueuedProvider(RecordingProvider):
    """Answers with each of `replies` in turn, then with `output`."""

    def __init__(self) -> None:
        super().__init__()
        self.replies: list[str] = []

    async def generate_mentor_reply(self, request: MentorRequest) -> str:
        if self.replies:
            self.output = json.dumps({"schema_version": "1.0", "reply": self.replies.pop(0)})
        return await super().generate_mentor_reply(request)


@pytest.fixture()
def provider(client: TestClient) -> Iterator[QueuedProvider]:
    queued = QueuedProvider()
    app.dependency_overrides[deps.get_ai_provider] = lambda: queued
    yield queued


@pytest.fixture()
def store(repos: dict[str, Any]) -> FakeMentorConversationRepository:
    return repos["mentor"]


def _headers(user: str) -> dict[str, str]:
    return {"x-test-user-id": user}


def _chat(
    client: TestClient, message_id: str, message: str, *, project_id: str | None = None, user: str = "user-a"
) -> httpx.Response:
    body: dict[str, Any] = {"messageId": message_id, "message": message}
    if project_id is not None:
        body["projectId"] = project_id
    return client.post("/api/v1/mentor/chat", json=body, headers=_headers(user))


def _history(client: TestClient, *, project_id: str | None = None, user: str = "user-a") -> httpx.Response:
    params = {"projectId": project_id} if project_id is not None else None
    return client.get(CONVERSATION, params=params, headers=_headers(user))


def _delete(client: TestClient, *, project_id: str | None = None, user: str = "user-a") -> httpx.Response:
    params = {"projectId": project_id} if project_id is not None else None
    return client.delete(CONVERSATION, params=params, headers=_headers(user))


def _turns(response: httpx.Response) -> list[tuple[str, str]]:
    assert response.status_code == 200, response.text
    return [(message["role"], message["content"]) for message in response.json()["data"]["messages"]]


def _project(client: TestClient, user: str = "user-a") -> str:
    response = client.post("/api/v1/projects", json=PROJECT, headers=_headers(user))
    assert response.status_code == 201
    return response.json()["data"]["id"]


# --- saving and restoring ---------------------------------------------------


def test_empty_history_is_an_empty_conversation(client: TestClient, provider: QueuedProvider) -> None:
    response = _history(client)

    assert response.status_code == 200
    assert response.json()["data"] == {"projectId": None, "messages": []}


def test_a_new_conversation_is_saved_and_survives_a_reload(
    client: TestClient, provider: QueuedProvider
) -> None:
    sent = _chat(client, "msg-00000001", "  What is DI?  ")
    assert sent.status_code == 200
    reply = sent.json()["data"]

    # A "reload": a fresh read with no client-held state at all.
    messages = _history(client).json()["data"]["messages"]

    assert [(m["id"], m["role"], m["content"]) for m in messages] == [
        ("msg-00000001", "user", "What is DI?"),
        (reply["messageId"], "mentor", "Start with the catalog API."),
    ]
    assert messages[0]["context"] is None
    assert messages[1]["context"] == reply["context"]
    assert all(message["createdAt"] for message in messages)


def test_later_messages_are_appended_in_order(client: TestClient, provider: QueuedProvider) -> None:
    provider.replies = ["First answer.", "Second answer.", "Third answer."]

    for index, question in enumerate(["One?", "Two?", "Three?"], start=1):
        assert _chat(client, f"msg-0000000{index}", question).status_code == 200

    assert _turns(_history(client)) == [
        ("user", "One?"),
        ("mentor", "First answer."),
        ("user", "Two?"),
        ("mentor", "Second answer."),
        ("user", "Three?"),
        ("mentor", "Third answer."),
    ]


def test_project_conversations_are_separate_from_general(
    client: TestClient, provider: QueuedProvider
) -> None:
    project_id = _project(client)

    _chat(client, "msg-general1", "General question")
    _chat(client, "msg-project1", "Project question", project_id=project_id)

    assert _turns(_history(client))[0] == ("user", "General question")
    project_history = _history(client, project_id=project_id).json()["data"]
    assert project_history["projectId"] == project_id
    assert [m["content"] for m in project_history["messages"]][0] == "Project question"
    assert project_history["messages"][1]["context"]["projectName"] == "Storefront"


# --- retries and failures ---------------------------------------------------


def test_retrying_a_saved_message_returns_the_saved_reply_without_duplicates(
    client: TestClient, provider: QueuedProvider
) -> None:
    first = _chat(client, "msg-retried1", "Help")
    # The client never saw `first` (e.g. its connection dropped) and retries.
    second = _chat(client, "msg-retried1", "Help")

    assert second.status_code == 200
    assert second.json()["data"] == first.json()["data"]
    assert len(provider.requests) == 1
    assert _turns(_history(client)) == [("user", "Help"), ("mentor", "Start with the catalog API.")]


def test_a_failed_reply_saves_nothing_and_its_retry_saves_once(
    client: TestClient, provider: QueuedProvider
) -> None:
    provider.error = RuntimeError("provider down")
    assert _chat(client, "msg-flaky001", "Help").status_code == 503
    assert _turns(_history(client)) == []

    provider.error = None
    assert _chat(client, "msg-flaky001", "Help").status_code == 200

    assert _turns(_history(client)) == [("user", "Help"), ("mentor", "Start with the catalog API.")]


def test_a_failed_save_is_a_safe_500_and_never_claims_success(
    client: TestClient, provider: QueuedProvider, store: FakeMentorConversationRepository
) -> None:
    store.failing.add("append_exchange")

    response = _chat(client, "msg-unsaved1", "Help")

    assert response.status_code == 500
    assert response.json()["detail"] == "Your message couldn't be saved. Please try again."
    assert "Start with the catalog API." not in response.text
    assert "No servers found" not in response.text
    store.failing.clear()
    assert _turns(_history(client)) == []


@pytest.mark.parametrize(
    ("method", "call", "detail"),
    [
        ("get", lambda client: _history(client), "Your conversation couldn't be loaded."),
        # The "already saved?" check fails before anything is generated.
        (
            "get",
            lambda client: _chat(client, "msg-unread01", "hi"),
            "Your message couldn't be saved. Please try again.",
        ),
        ("delete", lambda client: _delete(client), "Your conversation couldn't be deleted."),
    ],
)
def test_storage_errors_are_safe_500s(
    client: TestClient,
    provider: QueuedProvider,
    store: FakeMentorConversationRepository,
    method: str,
    call: Any,
    detail: str,
) -> None:
    store.failing.add(method)

    response = call(client)

    assert response.status_code == 500
    assert response.json()["detail"] == detail
    for marker in (*INTERNALS, "No servers found", "ServerSelectionTimeoutError"):
        assert marker not in response.text


@pytest.mark.asyncio
async def test_concurrent_requests_for_one_message_save_it_once() -> None:
    """Both pass the "already saved?" check before either saves; the loser
    returns the winner's saved reply instead of saving a second copy."""

    conversations = FakeMentorConversationRepository()
    provider = ScriptedProvider(delay=0.01)
    service = MentorService(
        FakeProjects(),  # type: ignore[arg-type]
        FakeBlueprints(),  # type: ignore[arg-type]
        FakeLearning([]),  # type: ignore[arg-type]
        conversations,  # type: ignore[arg-type]
        provider,  # type: ignore[arg-type]
        timeout_seconds=5,
    )
    request = MentorChatRequest(messageId="msg-concurrent", message="hi")

    first, second = await asyncio.gather(service.reply("owner", request), service.reply("owner", request))

    assert len(provider.requests) == 2
    assert first.messageId == second.messageId
    assert len(conversations.docs[("owner", "general")]["messages"]) == 2


# --- starting over ----------------------------------------------------------


def test_deleting_a_conversation_starts_over_and_is_idempotent(
    client: TestClient, provider: QueuedProvider
) -> None:
    project_id = _project(client)
    _chat(client, "msg-general1", "Keep me")
    _chat(client, "msg-project1", "Forget me", project_id=project_id)

    assert _delete(client, project_id=project_id).status_code == 200
    assert _delete(client, project_id=project_id).status_code == 200

    assert _turns(_history(client, project_id=project_id)) == []
    assert _turns(_history(client))[0] == ("user", "Keep me")


# --- authentication, ownership and isolation --------------------------------


@pytest.mark.parametrize("method", ["GET", "DELETE"])
def test_conversation_endpoints_require_authentication(
    client: TestClient, provider: QueuedProvider, method: str
) -> None:
    del app.dependency_overrides[get_current_user_id]

    assert client.request(method, CONVERSATION).status_code == 401


def test_users_never_see_each_others_general_conversation(
    client: TestClient, provider: QueuedProvider
) -> None:
    _chat(client, "msg-privatea", "A's secret question", user="user-a")

    assert _turns(_history(client, user="user-b")) == []
    _chat(client, "msg-privateb", "B's question", user="user-b")
    assert _delete(client, user="user-b").status_code == 200

    assert _turns(_history(client, user="user-a"))[0] == ("user", "A's secret question")


def test_another_users_project_conversation_cannot_be_read_or_deleted(
    client: TestClient, provider: QueuedProvider
) -> None:
    project_id = _project(client, user="user-a")
    _chat(client, "msg-privatea", "A's project question", project_id=project_id, user="user-a")

    read = _history(client, project_id=project_id, user="user-b")
    deleted = _delete(client, project_id=project_id, user="user-b")
    written = _chat(client, "msg-intruder", "inject", project_id=project_id, user="user-b")

    for response in (read, deleted, written):
        assert response.status_code == 404
        assert "A's project question" not in response.text
    assert _turns(_history(client, project_id=project_id, user="user-a"))[0] == (
        "user",
        "A's project question",
    )


def test_reusing_another_users_message_id_never_returns_their_reply(
    client: TestClient, provider: QueuedProvider
) -> None:
    provider.replies = ["Reply for A.", "Reply for B."]
    _chat(client, "msg-shared01", "A's question", user="user-a")

    response = _chat(client, "msg-shared01", "B's question", user="user-b")

    assert response.json()["data"]["reply"] == "Reply for B."
    assert _turns(_history(client, user="user-b")) == [("user", "B's question"), ("mentor", "Reply for B.")]


@pytest.mark.parametrize(
    "body",
    [
        {"message": "hi"},
        {"messageId": "", "message": "hi"},
        {"messageId": "short", "message": "hi"},
        {"messageId": "has spaces in it", "message": "hi"},
        {"messageId": "x" * 65, "message": "hi"},
        {"messageId": "$where:1==1", "message": "hi"},
    ],
)
def test_invalid_message_ids_are_rejected_before_the_model(
    client: TestClient, provider: QueuedProvider, body: dict[str, Any]
) -> None:
    response = client.post("/api/v1/mentor/chat", json=body)

    assert response.status_code == 422
    assert provider.requests == []


@pytest.mark.parametrize("project_id", ["", "p" * 65])
def test_invalid_project_ids_are_rejected(
    client: TestClient, provider: QueuedProvider, project_id: str
) -> None:
    assert client.get(CONVERSATION, params={"projectId": project_id}).status_code == 422
    assert client.delete(CONVERSATION, params={"projectId": project_id}).status_code == 422

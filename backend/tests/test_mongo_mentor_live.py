"""Opt-in mentor conversation checks against a real MongoDB (e.g. Atlas).

Confirms the real queries behave as FakeMentorConversationRepository does:
the unique `(user_id, context_key)` index, the idempotent upserting append
(including concurrent first writes), message ordering and trimming, deletion
and per-user isolation.

Skipped unless explicitly enabled. Like test_mongo_generation_live, it only
ever uses a freshly named temporary database whose collections are dropped
afterwards; application data is never touched. Run from backend/:

    MONGO_LIVE_TEST=1 pytest tests/test_mongo_mentor_live.py
"""

import asyncio
import os
from typing import Any

import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.mentor_conversation_repository import MentorConversationRepository
from tests.test_mongo_generation_live import _temporary_database

pytestmark = pytest.mark.skipif(
    os.environ.get("MONGO_LIVE_TEST") != "1",
    reason="live MongoDB test: set MONGO_LIVE_TEST=1 to run",
)

USER = "live-mentor-user"
NOW = "2026-10-11T00:00:00+00:00"


async def _repository(db: AsyncIOMotorDatabase) -> MentorConversationRepository:
    """With the unique index connect_to_mongo creates."""

    await db.mentor_conversations.create_index([("user_id", 1), ("context_key", 1)], unique=True)
    return MentorConversationRepository(db)


def _exchange(n: int) -> list[dict[str, Any]]:
    return [
        {"id": f"user-{n:04d}", "role": "user", "content": f"q{n}", "created_at": NOW},
        {"id": f"mentor-{n:04d}", "role": "mentor", "content": f"a{n}", "created_at": NOW},
    ]


async def _ids(repo: MentorConversationRepository, user: str = USER, key: str = "general") -> list[str]:
    doc = await repo.get(user, key)
    return [message["id"] for message in (doc or {}).get("messages", [])]


@pytest.mark.asyncio
async def test_exchanges_append_in_order_and_a_repeat_is_not_saved_twice() -> None:
    async with _temporary_database() as db:
        repo = await _repository(db)

        assert await repo.append_exchange(USER, "general", None, _exchange(1), now=NOW, max_messages=200)
        assert await repo.append_exchange(USER, "general", None, _exchange(2), now=NOW, max_messages=200)
        assert not await repo.append_exchange(USER, "general", None, _exchange(1), now=NOW, max_messages=200)

        assert await _ids(repo) == ["user-0001", "mentor-0001", "user-0002", "mentor-0002"]
        assert await db.mentor_conversations.count_documents({}) == 1


@pytest.mark.asyncio
async def test_concurrent_first_writes_of_different_messages_are_both_saved() -> None:
    async with _temporary_database() as db:
        repo = await _repository(db)

        results = await asyncio.gather(
            *(
                repo.append_exchange(USER, "project:p1", "p1", _exchange(n), now=NOW, max_messages=200)
                for n in range(8)
            )
        )

        assert results == [True] * 8
        ids = await _ids(repo, key="project:p1")
        assert sorted(ids) == sorted(m["id"] for n in range(8) for m in _exchange(n))
        # Each exchange stays together: a user message is followed by its reply.
        for index in range(0, len(ids), 2):
            assert ids[index + 1] == ids[index].replace("user-", "mentor-")


@pytest.mark.asyncio
async def test_concurrent_writes_of_the_same_message_save_it_once() -> None:
    async with _temporary_database() as db:
        repo = await _repository(db)

        results = await asyncio.gather(
            *(
                repo.append_exchange(USER, "general", None, _exchange(1), now=NOW, max_messages=200)
                for _ in range(8)
            )
        )

        assert results.count(True) == 1
        assert await _ids(repo) == ["user-0001", "mentor-0001"]


@pytest.mark.asyncio
async def test_only_the_newest_messages_are_kept() -> None:
    async with _temporary_database() as db:
        repo = await _repository(db)

        for n in range(4):
            await repo.append_exchange(USER, "general", None, _exchange(n), now=NOW, max_messages=4)

        assert await _ids(repo) == ["user-0002", "mentor-0002", "user-0003", "mentor-0003"]


@pytest.mark.asyncio
async def test_conversations_are_per_user_and_deleted_individually() -> None:
    async with _temporary_database() as db:
        repo = await _repository(db)
        await repo.append_exchange(USER, "general", None, _exchange(1), now=NOW, max_messages=200)
        await repo.append_exchange("other-user", "general", None, _exchange(1), now=NOW, max_messages=200)

        await repo.delete("other-user", "general")
        await repo.delete("other-user", "general")

        assert await repo.get("other-user", "general") is None
        assert await _ids(repo) == ["user-0001", "mentor-0001"]

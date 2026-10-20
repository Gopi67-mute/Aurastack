from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError


class MentorConversationRepository:
    """Reads and writes the `mentor_conversations` collection: at most one
    document per user and context, enforced by the unique
    `(user_id, context_key)` index that connect_to_mongo creates. Messages are
    embedded oldest first. No business rules live here.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.mentor_conversations

    async def get(self, user_id: str, context_key: str) -> dict[str, Any] | None:
        return await self._collection.find_one({"user_id": user_id, "context_key": context_key})

    async def append_exchange(
        self,
        user_id: str,
        context_key: str,
        project_id: str | None,
        messages: list[dict[str, Any]],
        *,
        now: str,
        max_messages: int,
    ) -> bool:
        """Append `messages` in one write, unless the first of them is already
        stored. Keeps only the newest `max_messages`.

        One upsert that only matches a conversation without that message id.
        When the conversation already holds it, the upsert's insert collides
        with the unique index. So does the loser of two concurrent first
        writes, which is why a collision is retried once: the second attempt
        appends to the now-existing document, or collides again because the
        message really is stored.

        Returns False when the message was already stored.
        """

        for _ in range(2):
            try:
                await self._collection.update_one(
                    {
                        "user_id": user_id,
                        "context_key": context_key,
                        "messages.id": {"$ne": messages[0]["id"]},
                    },
                    {
                        "$push": {"messages": {"$each": messages, "$slice": -max_messages}},
                        "$set": {"updated_at": now},
                        "$setOnInsert": {"project_id": project_id, "created_at": now},
                    },
                    upsert=True,
                )
                return True
            except DuplicateKeyError:
                continue
        return False

    async def delete(self, user_id: str, context_key: str) -> None:
        await self._collection.delete_one({"user_id": user_id, "context_key": context_key})

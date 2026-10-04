from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class ActivityRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.activity_events

    async def record(self, event: dict[str, Any]) -> bool:
        """Insert the event unless `(user_id, id)` already exists.

        A single upsert rather than read-then-insert, so two concurrent
        requests for the same logical event cannot both write. Backed by the
        unique `(user_id, id)` index created at startup.

        Returns True when this call created the event.
        """

        result = await self._collection.update_one(
            {"user_id": event["user_id"], "id": event["id"]},
            {"$setOnInsert": event},
            upsert=True,
        )
        return result.upserted_id is not None

    async def list_for_user(self, user_id: str, limit: int = 500) -> list[dict[str, Any]]:
        cursor = self._collection.find({"user_id": user_id}).sort("occurred_at", -1).limit(limit)
        return [doc async for doc in cursor]

    async def delete_for_project(self, project_id: str) -> None:
        await self._collection.delete_many({"project_id": project_id})

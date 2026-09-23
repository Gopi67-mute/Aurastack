from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class ActivityRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.activity_events

    async def insert(self, event: dict[str, Any]) -> None:
        await self._collection.insert_one(event)

    async def list_for_user(self, user_id: str, limit: int = 200) -> list[dict[str, Any]]:
        cursor = self._collection.find({"user_id": user_id}).sort("occurred_at", -1).limit(limit)
        return [doc async for doc in cursor]

    async def delete_for_project(self, project_id: str) -> None:
        await self._collection.delete_many({"project_id": project_id})

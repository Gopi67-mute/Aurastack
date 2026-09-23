from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class ProjectRepository:
    """Reads and writes MongoDB only. No business rules live here."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.projects

    async def list_for_user(self, user_id: str) -> list[dict[str, Any]]:
        cursor = self._collection.find({"user_id": user_id}).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def get_by_id_for_user(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        return await self._collection.find_one({"id": project_id, "user_id": user_id})

    async def insert(self, doc: dict[str, Any]) -> dict[str, Any]:
        await self._collection.insert_one(doc)
        return doc

    async def update(
        self, project_id: str, user_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        await self._collection.update_one({"id": project_id, "user_id": user_id}, {"$set": updates})
        return await self.get_by_id_for_user(project_id, user_id)

    async def delete(self, project_id: str, user_id: str) -> bool:
        result = await self._collection.delete_one({"id": project_id, "user_id": user_id})
        return result.deleted_count > 0

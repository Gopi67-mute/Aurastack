from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument


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

    async def claim_generation(
        self, project_id: str, user_id: str, *, expired_before: str, started_at: str
    ) -> dict[str, Any] | None:
        """Atomically start the next generation attempt of a retryable project.

        Retryable means failed, or still "generating" with a lease that began
        before `expired_before`. One `find_one_and_update`, so of several
        concurrent callers exactly one gets the document back and the rest
        get None. Returns the document after the claim.
        """

        return await self._collection.find_one_and_update(
            {
                "id": project_id,
                "user_id": user_id,
                "$or": [
                    {"status": "failed"},
                    {"status": "generating", "generation.started_at": {"$lt": expired_before}},
                ],
            },
            {
                "$inc": {"generation.attempt": 1},
                "$set": {
                    "status": "generating",
                    "generation.started_at": started_at,
                    "generation.completed_at": None,
                    "generation.failure_reason": None,
                    "updated_at": started_at,
                },
            },
            return_document=ReturnDocument.AFTER,
        )

    async def finalize_generation(
        self, project_id: str, user_id: str, attempt: int, updates: dict[str, Any]
    ) -> bool:
        """Apply `updates` only while `attempt` is still the current one.

        The attempt number is the fencing token: once a newer attempt has been
        claimed (or the project deleted), a stale run matches nothing.
        """

        result = await self._collection.update_one(
            {
                "id": project_id,
                "user_id": user_id,
                "status": "generating",
                "generation.attempt": attempt,
            },
            {"$set": updates},
        )
        return result.matched_count > 0

    async def list_without_curriculum_field(self) -> list[dict[str, Any]]:
        """Projects written before curriculum metadata existed (pre Phase 3.3)."""

        cursor = self._collection.find({"curriculum": {"$exists": False}})
        return [doc async for doc in cursor]

    async def update_if_without_curriculum_field(
        self, project_id: str, updates: dict[str, Any]
    ) -> bool:
        result = await self._collection.update_one(
            {"id": project_id, "curriculum": {"$exists": False}}, {"$set": updates}
        )
        return result.modified_count > 0

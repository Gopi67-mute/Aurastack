from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class BlueprintRepository:
    """Reads and writes the `project_blueprints` collection: at most one
    document per project, enforced by the unique `project_id` index that
    connect_to_mongo creates. No business rules live here.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.project_blueprints

    async def get_for_project(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        return await self._collection.find_one({"project_id": project_id, "user_id": user_id})

    async def claim(
        self,
        project_id: str,
        user_id: str,
        *,
        curriculum_version: int,
        schema_version: str,
        expired_before: str,
        started_at: str,
    ) -> dict[str, Any] | None:
        """Atomically start the next generation attempt of a project's blueprint.

        Claimable means: no document yet (attempt 1), or one that is failed,
        still "generating" with a lease that began before `expired_before`,
        or built for a curriculum version other than `curriculum_version` or
        a blueprint schema version other than `schema_version` (including a
        document from before schema versions were recorded).

        One upserting `find_one_and_update`. When a document exists but is not
        claimable, the upsert's insert collides with the unique `project_id`
        index; so does the loser of two concurrent first claims. Either way
        exactly one caller gets the document back and the rest get None.
        """

        try:
            return await self._collection.find_one_and_update(
                {
                    "project_id": project_id,
                    "user_id": user_id,
                    "$or": [
                        {"status": "failed"},
                        {"status": "generating", "started_at": {"$lt": expired_before}},
                        {"curriculum_version": {"$ne": curriculum_version}},
                        # $ne also matches documents without the field.
                        {"schema_version": {"$ne": schema_version}},
                    ],
                },
                {
                    "$inc": {"attempt": 1},
                    "$set": {
                        "status": "generating",
                        "curriculum_version": curriculum_version,
                        "schema_version": schema_version,
                        "started_at": started_at,
                        "completed_at": None,
                        "failure_reason": None,
                        "blueprint": None,
                        "meta": None,
                        "updated_at": started_at,
                    },
                    "$setOnInsert": {"created_at": started_at},
                },
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return None

    async def finalize(
        self,
        project_id: str,
        user_id: str,
        attempt: int,
        curriculum_version: int,
        updates: dict[str, Any],
    ) -> bool:
        """Apply `updates` only while this attempt, for this curriculum version,
        is still the current one. Never upserts, so a deleted project's
        blueprint cannot be recreated here.
        """

        result = await self._collection.update_one(
            {
                "project_id": project_id,
                "user_id": user_id,
                "status": "generating",
                "attempt": attempt,
                "curriculum_version": curriculum_version,
            },
            {"$set": updates},
        )
        return result.matched_count > 0

    async def delete_for_project(self, project_id: str) -> None:
        await self._collection.delete_many({"project_id": project_id})

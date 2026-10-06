from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument


class LearningRepository:
    """Reads and writes the topic catalog and per-user progress collections.

    Topic reads are always scoped to one curriculum version, so documents from
    a failed or superseded generation attempt are never returned.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._topics = db.learning_topics
        self._progress = db.learning_progress

    async def insert_topics(self, topics: list[dict[str, Any]]) -> None:
        if topics:
            await self._topics.insert_many(topics)

    async def list_topics(self, project_id: str, curriculum_version: int) -> list[dict[str, Any]]:
        cursor = self._topics.find(
            {"project_id": project_id, "curriculum_version": curriculum_version}
        ).sort("order", 1)
        return [doc async for doc in cursor]

    async def list_topics_for_projects(
        self, curriculum_versions: dict[str, int]
    ) -> list[dict[str, Any]]:
        """Topics of each project's given curriculum version, keyed project id -> version."""

        if not curriculum_versions:
            return []
        cursor = self._topics.find(
            {
                "$or": [
                    {"project_id": project_id, "curriculum_version": version}
                    for project_id, version in curriculum_versions.items()
                ]
            }
        ).sort("order", 1)
        return [doc async for doc in cursor]

    async def list_topic_ids_for_projects(
        self, curriculum_versions: dict[str, int]
    ) -> list[dict[str, Any]]:
        """`project_id` and `id` only of each project's given curriculum version.

        For counting topics without transferring their lesson content.
        """

        if not curriculum_versions:
            return []
        cursor = self._topics.find(
            {
                "$or": [
                    {"project_id": project_id, "curriculum_version": version}
                    for project_id, version in curriculum_versions.items()
                ]
            },
            {"_id": 0, "project_id": 1, "id": 1},
        )
        return [doc async for doc in cursor]

    async def get_topic(
        self, project_id: str, curriculum_version: int, topic_id: str
    ) -> dict[str, Any] | None:
        return await self._topics.find_one(
            {"project_id": project_id, "curriculum_version": curriculum_version, "id": topic_id}
        )

    async def has_topics(self, project_id: str) -> bool:
        return await self._topics.find_one({"project_id": project_id}, {"_id": 1}) is not None

    async def set_missing_curriculum_version(self, project_id: str, curriculum_version: int) -> None:
        """Stamp topics that predate curriculum versioning. Leaves ids untouched."""

        await self._topics.update_many(
            {"project_id": project_id, "curriculum_version": {"$exists": False}},
            {"$set": {"curriculum_version": curriculum_version}},
        )

    async def delete_topics_for_version(self, project_id: str, curriculum_version: int) -> None:
        await self._topics.delete_many(
            {"project_id": project_id, "curriculum_version": curriculum_version}
        )

    async def delete_topics_except_version(self, project_id: str, curriculum_version: int) -> None:
        await self._topics.delete_many(
            {"project_id": project_id, "curriculum_version": {"$ne": curriculum_version}}
        )

    async def list_progress_for_project(self, user_id: str, project_id: str) -> dict[str, dict[str, Any]]:
        cursor = self._progress.find({"user_id": user_id, "project_id": project_id})
        docs = [doc async for doc in cursor]
        return {doc["topic_id"]: doc for doc in docs}

    async def list_progress_for_projects(
        self, user_id: str, project_ids: list[str]
    ) -> list[dict[str, Any]]:
        if not project_ids:
            return []
        cursor = self._progress.find({"user_id": user_id, "project_id": {"$in": project_ids}})
        return [doc async for doc in cursor]

    async def get_progress(
        self, user_id: str, project_id: str, topic_id: str
    ) -> dict[str, Any] | None:
        return await self._progress.find_one(
            {"user_id": user_id, "project_id": project_id, "topic_id": topic_id}
        )

    async def complete_progress(
        self, user_id: str, project_id: str, topic_id: str, completed_at: str
    ) -> str:
        """Mark a topic completed; the first completion's timestamp wins.

        One atomic upsert, so concurrent completions of the same topic all
        resolve to whichever MongoDB applied first and none can overwrite its
        `completed_at`. Returns the stored `completed_at`.

        Two concurrent upserts that both find no document race on the unique
        (user_id, project_id, topic_id) index; MongoDB retries the loser as
        an update because the filter is exactly that index's equality match.
        """

        doc = await self._progress.find_one_and_update(
            {"user_id": user_id, "project_id": project_id, "topic_id": topic_id},
            [
                {
                    "$set": {
                        # Evaluated against the document as it was before
                        # this update, so `$status` is the previous status.
                        "completed_at": {
                            "$cond": [
                                {"$eq": ["$status", "completed"]},
                                {"$ifNull": ["$completed_at", {"$literal": completed_at}]},
                                {"$literal": completed_at},
                            ]
                        },
                        "status": "completed",
                    }
                }
            ],
            projection={"_id": 0, "completed_at": 1},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return doc["completed_at"]

    async def delete_for_project(self, project_id: str) -> None:
        await self._topics.delete_many({"project_id": project_id})
        await self._progress.delete_many({"project_id": project_id})

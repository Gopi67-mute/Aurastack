from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class LearningRepository:
    """Reads and writes the topic catalog and per-user progress collections."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._topics = db.learning_topics
        self._progress = db.learning_progress

    async def insert_topics(self, topics: list[dict[str, Any]]) -> None:
        if topics:
            await self._topics.insert_many(topics)

    async def list_topics(self, project_id: str) -> list[dict[str, Any]]:
        cursor = self._topics.find({"project_id": project_id}).sort("order", 1)
        return [doc async for doc in cursor]

    async def list_topics_for_projects(self, project_ids: list[str]) -> list[dict[str, Any]]:
        if not project_ids:
            return []
        cursor = self._topics.find({"project_id": {"$in": project_ids}}).sort("order", 1)
        return [doc async for doc in cursor]

    async def get_topic(self, project_id: str, topic_id: str) -> dict[str, Any] | None:
        return await self._topics.find_one({"project_id": project_id, "id": topic_id})

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

    async def upsert_progress(
        self, user_id: str, project_id: str, topic_id: str, status: str, completed_at: str | None
    ) -> None:
        await self._progress.update_one(
            {"user_id": user_id, "project_id": project_id, "topic_id": topic_id},
            {"$set": {"status": status, "completed_at": completed_at}},
            upsert=True,
        )

    async def delete_for_project(self, project_id: str) -> None:
        await self._topics.delete_many({"project_id": project_id})
        await self._progress.delete_many({"project_id": project_id})

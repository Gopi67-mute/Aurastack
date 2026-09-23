"""In-memory stand-ins for the Motor-backed repositories, matching their
async method signatures exactly, so services and routes can be tested without
a live MongoDB connection.
"""

from typing import Any


class FakeProjectRepository:
    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}

    async def list_for_user(self, user_id: str) -> list[dict[str, Any]]:
        docs = [doc for doc in self._docs.values() if doc["user_id"] == user_id]
        return sorted(docs, key=lambda doc: doc["created_at"], reverse=True)

    async def get_by_id_for_user(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        doc = self._docs.get(project_id)
        if doc is not None and doc["user_id"] == user_id:
            return doc
        return None

    async def insert(self, doc: dict[str, Any]) -> dict[str, Any]:
        self._docs[doc["id"]] = doc
        return doc

    async def update(
        self, project_id: str, user_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        doc = await self.get_by_id_for_user(project_id, user_id)
        if doc is None:
            return None
        doc.update(updates)
        return doc

    async def delete(self, project_id: str, user_id: str) -> bool:
        doc = await self.get_by_id_for_user(project_id, user_id)
        if doc is None:
            return False
        del self._docs[project_id]
        return True


class FakeLearningRepository:
    def __init__(self) -> None:
        self._topics: dict[str, list[dict[str, Any]]] = {}
        self._progress: dict[tuple[str, str, str], dict[str, Any]] = {}

    async def insert_topics(self, topics: list[dict[str, Any]]) -> None:
        for topic in topics:
            self._topics.setdefault(topic["project_id"], []).append(topic)

    async def list_topics(self, project_id: str) -> list[dict[str, Any]]:
        return sorted(self._topics.get(project_id, []), key=lambda topic: topic["order"])

    async def get_topic(self, project_id: str, topic_id: str) -> dict[str, Any] | None:
        for topic in self._topics.get(project_id, []):
            if topic["id"] == topic_id:
                return topic
        return None

    async def list_progress_for_project(self, user_id: str, project_id: str) -> dict[str, dict[str, Any]]:
        return {
            key[2]: value
            for key, value in self._progress.items()
            if key[0] == user_id and key[1] == project_id
        }

    async def get_progress(
        self, user_id: str, project_id: str, topic_id: str
    ) -> dict[str, Any] | None:
        return self._progress.get((user_id, project_id, topic_id))

    async def upsert_progress(
        self, user_id: str, project_id: str, topic_id: str, status: str, completed_at: str | None
    ) -> None:
        self._progress[(user_id, project_id, topic_id)] = {"status": status, "completed_at": completed_at}

    async def delete_for_project(self, project_id: str) -> None:
        self._topics.pop(project_id, None)
        for key in [key for key in self._progress if key[1] == project_id]:
            del self._progress[key]


class FakeActivityRepository:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def insert(self, event: dict[str, Any]) -> None:
        self.events.append(event)

    async def list_for_user(self, user_id: str, limit: int = 200) -> list[dict[str, Any]]:
        return [event for event in self.events if event["user_id"] == user_id][:limit]

    async def delete_for_project(self, project_id: str) -> None:
        self.events = [event for event in self.events if event["project_id"] != project_id]

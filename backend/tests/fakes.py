"""In-memory stand-ins for the Motor-backed repositories, matching their
async method signatures exactly, so services and routes can be tested without
a live MongoDB connection.
"""

from typing import Any


def _set_fields(doc: dict[str, Any], updates: dict[str, Any]) -> None:
    """Mongo `$set` semantics, including dotted paths into embedded documents."""

    for path, value in updates.items():
        target = doc
        *parents, leaf = path.split(".")
        for part in parents:
            target = target.setdefault(part, {})
        target[leaf] = value


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

    async def claim_generation(
        self, project_id: str, user_id: str, *, expired_before: str, started_at: str
    ) -> dict[str, Any] | None:
        # No await between the check and the write, so this is atomic under
        # asyncio exactly as find_one_and_update is in MongoDB.
        doc = await self.get_by_id_for_user(project_id, user_id)
        if doc is None:
            return None
        generation = doc.setdefault("generation", {})
        stale = (
            doc["status"] == "generating"
            and generation.get("started_at") is not None
            and generation["started_at"] < expired_before
        )
        if doc["status"] != "failed" and not stale:
            return None
        generation["attempt"] = generation.get("attempt", 0) + 1
        _set_fields(
            doc,
            {
                "status": "generating",
                "generation.started_at": started_at,
                "generation.completed_at": None,
                "generation.failure_reason": None,
                "updated_at": started_at,
            },
        )
        return doc

    async def finalize_generation(
        self, project_id: str, user_id: str, attempt: int, updates: dict[str, Any]
    ) -> bool:
        doc = await self.get_by_id_for_user(project_id, user_id)
        if (
            doc is None
            or doc["status"] != "generating"
            or doc.get("generation", {}).get("attempt") != attempt
        ):
            return False
        _set_fields(doc, updates)
        return True

    async def list_without_curriculum_field(self) -> list[dict[str, Any]]:
        return [doc for doc in self._docs.values() if "curriculum" not in doc]

    async def update_if_without_curriculum_field(
        self, project_id: str, updates: dict[str, Any]
    ) -> bool:
        doc = self._docs.get(project_id)
        if doc is None or "curriculum" in doc:
            return False
        _set_fields(doc, updates)
        return True


class FakeLearningRepository:
    def __init__(self) -> None:
        self._topics: dict[str, list[dict[str, Any]]] = {}
        self._progress: dict[tuple[str, str, str], dict[str, Any]] = {}

    def all_topics(self, project_id: str) -> list[dict[str, Any]]:
        """Test helper: every stored topic of a project, of any version."""

        return list(self._topics.get(project_id, []))

    async def insert_topics(self, topics: list[dict[str, Any]]) -> None:
        for topic in topics:
            self._topics.setdefault(topic["project_id"], []).append(topic)

    async def list_topics(self, project_id: str, curriculum_version: int) -> list[dict[str, Any]]:
        return sorted(
            (
                topic
                for topic in self._topics.get(project_id, [])
                if topic.get("curriculum_version") == curriculum_version
            ),
            key=lambda topic: topic["order"],
        )

    async def list_topics_for_projects(
        self, curriculum_versions: dict[str, int]
    ) -> list[dict[str, Any]]:
        return [
            topic
            for project_id, version in curriculum_versions.items()
            for topic in await self.list_topics(project_id, version)
        ]

    async def list_topic_ids_for_projects(
        self, curriculum_versions: dict[str, int]
    ) -> list[dict[str, Any]]:
        return [
            {"project_id": topic["project_id"], "id": topic["id"]}
            for topic in await self.list_topics_for_projects(curriculum_versions)
        ]

    async def get_topic(
        self, project_id: str, curriculum_version: int, topic_id: str
    ) -> dict[str, Any] | None:
        for topic in self._topics.get(project_id, []):
            if topic["id"] == topic_id and topic.get("curriculum_version") == curriculum_version:
                return topic
        return None

    async def has_topics(self, project_id: str) -> bool:
        return bool(self._topics.get(project_id))

    async def set_missing_curriculum_version(self, project_id: str, curriculum_version: int) -> None:
        for topic in self._topics.get(project_id, []):
            topic.setdefault("curriculum_version", curriculum_version)

    async def delete_topics_for_version(self, project_id: str, curriculum_version: int) -> None:
        self._topics[project_id] = [
            topic
            for topic in self._topics.get(project_id, [])
            if topic.get("curriculum_version") != curriculum_version
        ]

    async def delete_topics_except_version(self, project_id: str, curriculum_version: int) -> None:
        self._topics[project_id] = [
            topic
            for topic in self._topics.get(project_id, [])
            if topic.get("curriculum_version") == curriculum_version
        ]

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

    async def list_progress_for_projects(
        self, user_id: str, project_ids: list[str]
    ) -> list[dict[str, Any]]:
        return [
            value
            for key, value in self._progress.items()
            if key[0] == user_id and key[1] in project_ids
        ]

    async def complete_progress(
        self, user_id: str, project_id: str, topic_id: str, completed_at: str
    ) -> str:
        # No await between the check and the write, so this is atomic under
        # asyncio exactly as find_one_and_update is in MongoDB.
        key = (user_id, project_id, topic_id)
        existing = self._progress.get(key)
        if existing is not None and existing["status"] == "completed" and existing["completed_at"]:
            return existing["completed_at"]
        # Stores the filter fields too, matching Mongo's upsert behaviour of
        # copying equality filters into a newly inserted document.
        self._progress[key] = {
            "user_id": user_id,
            "project_id": project_id,
            "topic_id": topic_id,
            "status": "completed",
            "completed_at": completed_at,
        }
        return completed_at

    async def delete_for_project(self, project_id: str) -> None:
        self._topics.pop(project_id, None)
        for key in [key for key in self._progress if key[1] == project_id]:
            del self._progress[key]


class FakeActivityRepository:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def record(self, event: dict[str, Any]) -> bool:
        """Mirrors the unique `(user_id, id)` index the real collection has."""

        key = (event["user_id"], event["id"])
        if any((existing["user_id"], existing["id"]) == key for existing in self.events):
            return False
        self.events.append(event)
        return True

    async def list_for_user(self, user_id: str, limit: int = 500) -> list[dict[str, Any]]:
        matching = [event for event in self.events if event["user_id"] == user_id]
        matching.sort(key=lambda event: event["occurred_at"], reverse=True)
        return matching[:limit]

    async def delete_for_project(self, project_id: str) -> None:
        self.events = [event for event in self.events if event["project_id"] != project_id]

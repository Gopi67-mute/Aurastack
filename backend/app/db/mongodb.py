from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings


class _MongoState:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


_state = _MongoState()


async def connect_to_mongo() -> None:
    settings = get_settings()
    _state.client = AsyncIOMotorClient(settings.mongodb_uri)
    _state.db = _state.client[settings.mongodb_db_name]

    await _state.db.projects.create_index([("id", 1)], unique=True)
    await _state.db.projects.create_index([("user_id", 1), ("created_at", -1)])
    await _state.db.learning_topics.create_index([("project_id", 1), ("id", 1)], unique=True)
    # Active-curriculum reads: one project's topics of one version, in order.
    await _state.db.learning_topics.create_index(
        [("project_id", 1), ("curriculum_version", 1), ("order", 1)]
    )
    await _state.db.learning_progress.create_index(
        [("user_id", 1), ("project_id", 1), ("topic_id", 1)], unique=True
    )
    # Streak reads: newest-first scan of one user's activity.
    await _state.db.activity_events.create_index([("user_id", 1), ("occurred_at", -1)])
    await _state.db.activity_events.create_index([("project_id", 1)])
    # Idempotency: the activity id is deterministic per logical event
    # (see activity_service.learning_activity_id), so this is what stops a
    # retried completion creating a second qualifying activity.
    await _state.db.activity_events.create_index([("user_id", 1), ("id", 1)], unique=True)
    # One blueprint per project. Also what makes BlueprintRepository.claim
    # atomic: a second concurrent first claim collides here.
    await _state.db.project_blueprints.create_index([("project_id", 1)], unique=True)
    # One mentor conversation per user and context (general or one project).
    # Also what makes MentorConversationRepository.append_exchange idempotent.
    await _state.db.mentor_conversations.create_index(
        [("user_id", 1), ("context_key", 1)], unique=True
    )


async def close_mongo_connection() -> None:
    if _state.client is not None:
        _state.client.close()


def get_database() -> AsyncIOMotorDatabase:
    if _state.db is None:
        raise RuntimeError("Database not initialized; connect_to_mongo() must run at startup.")
    return _state.db

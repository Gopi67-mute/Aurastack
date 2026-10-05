from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.factory import create_provider
from app.ai.provider import AIProvider
from app.core.config import Settings, get_settings
from app.db.mongodb import get_database
from app.repositories.activity_repository import ActivityRepository
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.services.activity_service import ActivityService
from app.services.generation_service import GenerationService
from app.services.learning_service import LearningService
from app.services.project_service import ProjectService


def get_project_repository(db: AsyncIOMotorDatabase = Depends(get_database)) -> ProjectRepository:
    return ProjectRepository(db)


def get_learning_repository(db: AsyncIOMotorDatabase = Depends(get_database)) -> LearningRepository:
    return LearningRepository(db)


def get_activity_repository(db: AsyncIOMotorDatabase = Depends(get_database)) -> ActivityRepository:
    return ActivityRepository(db)


def get_activity_service(
    activity_repo: ActivityRepository = Depends(get_activity_repository),
) -> ActivityService:
    return ActivityService(activity_repo)


def get_project_service(
    project_repo: ProjectRepository = Depends(get_project_repository),
    learning_repo: LearningRepository = Depends(get_learning_repository),
    activity_repo: ActivityRepository = Depends(get_activity_repository),
) -> ProjectService:
    return ProjectService(project_repo, learning_repo, activity_repo)


def get_learning_service(
    project_repo: ProjectRepository = Depends(get_project_repository),
    learning_repo: LearningRepository = Depends(get_learning_repository),
    activity_service: ActivityService = Depends(get_activity_service),
) -> LearningService:
    return LearningService(project_repo, learning_repo, activity_service)


def get_ai_provider(settings: Settings = Depends(get_settings)) -> AIProvider:
    return create_provider(settings)


def get_generation_service(
    project_repo: ProjectRepository = Depends(get_project_repository),
    learning_repo: LearningRepository = Depends(get_learning_repository),
    provider: AIProvider = Depends(get_ai_provider),
    settings: Settings = Depends(get_settings),
) -> GenerationService:
    return GenerationService(
        project_repo,
        learning_repo,
        provider,
        timeout_seconds=settings.ai_generation_timeout_seconds,
    )

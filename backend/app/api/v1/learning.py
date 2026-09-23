from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_learning_service
from app.middleware.auth import get_current_user_id
from app.schemas.common import APIResponse
from app.schemas.learning import LearningTopic, ProjectLearning
from app.services.learning_service import LearningService, TopicNotFoundError
from app.services.project_service import ProjectNotFoundError

router = APIRouter(prefix="/projects/{project_id}/learning", tags=["learning"])


@router.get("", response_model=APIResponse[ProjectLearning])
async def get_project_learning(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: LearningService = Depends(get_learning_service),
) -> APIResponse[ProjectLearning]:
    try:
        learning = await service.get_project_learning(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    return APIResponse(success=True, message="Learning retrieved", data=learning)


@router.get("/{topic_id}", response_model=APIResponse[LearningTopic])
async def get_topic(
    project_id: str,
    topic_id: str,
    user_id: str = Depends(get_current_user_id),
    service: LearningService = Depends(get_learning_service),
) -> APIResponse[LearningTopic]:
    try:
        topic = await service.get_topic(user_id, project_id, topic_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    except TopicNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Topic not found") from exc
    return APIResponse(success=True, message="Topic retrieved", data=topic)


@router.post("/{topic_id}/complete", response_model=APIResponse[LearningTopic])
async def complete_topic(
    project_id: str,
    topic_id: str,
    user_id: str = Depends(get_current_user_id),
    service: LearningService = Depends(get_learning_service),
) -> APIResponse[LearningTopic]:
    try:
        topic = await service.complete_topic(user_id, project_id, topic_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    except TopicNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Topic not found") from exc
    return APIResponse(success=True, message="Topic completed", data=topic)

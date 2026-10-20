from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.api.deps import get_generation_service, get_project_service
from app.middleware.auth import get_current_user_id
from app.schemas.common import APIResponse
from app.schemas.project import Project, ProjectCreateRequest, ProjectUpdateRequest
from app.services.generation_service import GenerationConflictError, GenerationService
from app.services.project_service import ProjectNotFoundError, ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=APIResponse[list[Project]])
async def list_projects(
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
) -> APIResponse[list[Project]]:
    projects = await service.list_projects(user_id)
    return APIResponse(success=True, message="Projects retrieved", data=projects)


@router.post("", response_model=APIResponse[Project], status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
    generation: GenerationService = Depends(get_generation_service),
) -> APIResponse[Project]:
    """Responds with the project still "generating"; its curriculum is
    generated after the response is sent."""

    project, claim = await service.create_project(user_id, payload)
    background_tasks.add_task(generation.run, claim)
    return APIResponse(success=True, message="Project created", data=project)


@router.post(
    "/{project_id}/generation/retry",
    response_model=APIResponse[Project],
    status_code=status.HTTP_202_ACCEPTED,
)
async def retry_generation(
    project_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    generation: GenerationService = Depends(get_generation_service),
) -> APIResponse[Project]:
    """Restart generation of a failed (or stalled) project. 409 while a
    generation is still running or once the project is ready."""

    try:
        project, claim = await generation.claim_retry(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    except GenerationConflictError as exc:
        detail = (
            "Project generation is already in progress"
            if exc.status == "generating"
            else "Project has already been generated"
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail=detail) from exc

    background_tasks.add_task(generation.run, claim)
    return APIResponse(success=True, message="Project generation restarted", data=project)


@router.get("/{project_id}", response_model=APIResponse[Project])
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
) -> APIResponse[Project]:
    try:
        project = await service.get_project(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    return APIResponse(success=True, message="Project retrieved", data=project)


@router.patch("/{project_id}", response_model=APIResponse[Project])
async def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
) -> APIResponse[Project]:
    try:
        project = await service.update_project(user_id, project_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    return APIResponse(success=True, message="Project updated", data=project)


@router.delete("/{project_id}", response_model=APIResponse[None])
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
) -> APIResponse[None]:
    try:
        await service.delete_project(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    return APIResponse(success=True, message="Project deleted", data=None)

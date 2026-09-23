from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_project_service
from app.middleware.auth import get_current_user_id
from app.schemas.common import APIResponse
from app.schemas.project import Project, ProjectCreateRequest, ProjectUpdateRequest
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
    user_id: str = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
) -> APIResponse[Project]:
    project = await service.create_project(user_id, payload)
    return APIResponse(success=True, message="Project created", data=project)


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

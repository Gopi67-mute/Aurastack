from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.api.deps import get_blueprint_service
from app.middleware.auth import get_current_user_id
from app.schemas.blueprint import ProjectBlueprint
from app.schemas.common import APIResponse
from app.services.blueprint_service import BlueprintConflictError, BlueprintService
from app.services.project_service import ProjectNotFoundError

router = APIRouter(prefix="/projects", tags=["blueprints"])

_CONFLICT_DETAILS = {
    "project_not_ready": "Project curriculum is not ready yet",
    "generating": "Blueprint generation is already in progress",
    "ready": "Blueprint has already been generated",
}


@router.get("/{project_id}/blueprint", response_model=APIResponse[ProjectBlueprint])
async def get_blueprint(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    service: BlueprintService = Depends(get_blueprint_service),
) -> APIResponse[ProjectBlueprint]:
    """The project's blueprint and its status: missing, generating, ready or
    failed. Content is included only when ready."""

    try:
        blueprint = await service.get_blueprint(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    return APIResponse(success=True, message="Blueprint retrieved", data=blueprint)


@router.post(
    "/{project_id}/blueprint/generation",
    response_model=APIResponse[ProjectBlueprint],
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_blueprint(
    project_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    service: BlueprintService = Depends(get_blueprint_service),
) -> APIResponse[ProjectBlueprint]:
    """Start generating the blueprint: the first time, after a failure or an
    expired lease, or when the stored blueprint is stale for the project's
    current curriculum. Responds "generating"; the blueprint is generated
    after the response is sent. 409 when the project is not ready, a
    generation is already running, or the blueprint is current."""

    try:
        blueprint, claim = await service.claim(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
    except BlueprintConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=_CONFLICT_DETAILS[exc.reason]) from exc

    background_tasks.add_task(service.run, claim)
    return APIResponse(success=True, message="Blueprint generation started", data=blueprint)

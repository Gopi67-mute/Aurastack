from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_activity_service
from app.middleware.auth import get_current_user_id
from app.schemas.activity import MomentumState
from app.schemas.common import APIResponse
from app.services.activity_service import ActivityService
from app.utils.streak import UnknownTimezoneError

router = APIRouter(prefix="/momentum", tags=["momentum"])


@router.get("", response_model=APIResponse[MomentumState])
async def get_momentum(
    timezone: str = Query(
        default="UTC",
        description="IANA timezone the calendar days are resolved in, e.g. Asia/Kolkata.",
        max_length=64,
    ),
    user_id: str = Depends(get_current_user_id),
    service: ActivityService = Depends(get_activity_service),
) -> APIResponse[MomentumState]:
    try:
        momentum = await service.get_momentum(user_id, timezone)
    except UnknownTimezoneError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown timezone"
        ) from exc
    return APIResponse(success=True, message="Momentum retrieved", data=momentum)

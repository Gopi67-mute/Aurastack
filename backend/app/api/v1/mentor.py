from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_mentor_service
from app.middleware.auth import get_current_user_id
from app.schemas.common import APIResponse
from app.schemas.mentor import MentorChatRequest, MentorConversationOut, MentorReply, ProjectIdParam
from app.services.mentor_service import MentorService, MentorStorageError, MentorUnavailableError
from app.services.project_service import ProjectNotFoundError

router = APIRouter(prefix="/mentor", tags=["mentor"])

# Safe to show as-is: no provider, model or internal detail.
_UNAVAILABLE = {
    "timeout": (status.HTTP_504_GATEWAY_TIMEOUT, "Aura took too long to answer. Please try again."),
    "provider_error": (status.HTTP_503_SERVICE_UNAVAILABLE, "Aura is unavailable right now. Please try again."),
    "invalid_output": (status.HTTP_502_BAD_GATEWAY, "Aura couldn't produce a valid answer. Please try again."),
}


def _project_not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.post("/chat", response_model=APIResponse[MentorReply])
async def chat(
    payload: MentorChatRequest,
    user_id: str = Depends(get_current_user_id),
    service: MentorService = Depends(get_mentor_service),
) -> APIResponse[MentorReply]:
    """Answer one mentor message, grounded in `projectId` when given, and save
    the message and reply to the caller's conversation. Resending a saved
    `messageId` returns the saved reply. 404 when the project is not the
    caller's; 502/503/504 when the AI provider returns an unusable answer,
    fails or times out; 500 when the exchange could not be saved. Nothing is
    saved on any failure."""

    try:
        reply = await service.reply(user_id, payload)
    except ProjectNotFoundError as exc:
        raise _project_not_found() from exc
    except MentorUnavailableError as exc:
        code, detail = _UNAVAILABLE[exc.reason]
        raise HTTPException(code, detail=detail) from exc
    except MentorStorageError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Your message couldn't be saved. Please try again."
        ) from exc
    return APIResponse(success=True, message="Mentor replied", data=reply)


@router.get("/conversation", response_model=APIResponse[MentorConversationOut])
async def get_conversation(
    projectId: Optional[ProjectIdParam] = None,
    user_id: str = Depends(get_current_user_id),
    service: MentorService = Depends(get_mentor_service),
) -> APIResponse[MentorConversationOut]:
    """The caller's saved conversation for general mentoring, or for
    `projectId`; empty when there is none. 404 when the project is not the
    caller's; 500 when it could not be read."""

    try:
        conversation = await service.get_conversation(user_id, projectId)
    except ProjectNotFoundError as exc:
        raise _project_not_found() from exc
    except MentorStorageError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Your conversation couldn't be loaded."
        ) from exc
    return APIResponse(success=True, message="Conversation loaded", data=conversation)


@router.delete("/conversation", response_model=APIResponse[None])
async def delete_conversation(
    projectId: Optional[ProjectIdParam] = None,
    user_id: str = Depends(get_current_user_id),
    service: MentorService = Depends(get_mentor_service),
) -> APIResponse[None]:
    """Delete the caller's conversation for general mentoring, or for
    `projectId`, to start over. Succeeds when there is none. 404 when the
    project is not the caller's; 500 when it could not be deleted."""

    try:
        await service.delete_conversation(user_id, projectId)
    except ProjectNotFoundError as exc:
        raise _project_not_found() from exc
    except MentorStorageError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Your conversation couldn't be deleted."
        ) from exc
    return APIResponse(success=True, message="Conversation deleted", data=None)

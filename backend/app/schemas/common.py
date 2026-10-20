from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Standard response envelope used by every endpoint (AGENTS.md: RESPONSE STANDARDS)."""

    success: bool
    message: str
    data: Optional[T] = None
    errors: Optional[list[str]] = None
    metadata: Optional[dict[str, Any]] = None

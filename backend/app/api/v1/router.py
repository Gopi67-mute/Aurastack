from fastapi import APIRouter

from app.api.v1 import learning, projects

router = APIRouter(prefix="/api/v1")
router.include_router(projects.router)
router.include_router(learning.router)

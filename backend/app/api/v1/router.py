from fastapi import APIRouter

from app.api.v1 import blueprints, learning, mentor, momentum, projects

router = APIRouter(prefix="/api/v1")
router.include_router(projects.router)
router.include_router(blueprints.router)
router.include_router(learning.router)
router.include_router(learning.overview_router)
router.include_router(momentum.router)
router.include_router(mentor.router)

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as api_v1_router
from app.core.logging_config import configure_logging
from app.db.migrations import migrate_generation_lifecycle
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    db = get_database()
    await migrate_generation_lifecycle(ProjectRepository(db), LearningRepository(db))
    yield
    await close_mongo_connection()


app = FastAPI(title="AuraStack API", version="1.0.0", lifespan=lifespan)

# Dev-permissive CORS: Expo Go / web run from varying local origins. Tighten
# this to the deployed app origin(s) before production (Phase 3.2+).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Never leak stack traces or internal details to the client (AGENTS.md: ERROR HANDLING).
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Something went wrong. Please try again.",
            "data": None,
            "errors": ["internal_server_error"],
            "metadata": None,
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

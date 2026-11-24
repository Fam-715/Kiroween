import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.api import health, settings, tapes

DEFAULT_CORS_ORIGIN = "http://localhost:5173"


def get_cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGIN)
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or [DEFAULT_CORS_ORIGIN]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db.create_db_and_tables()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Cursed Cassette API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["*"],
        allow_headers=["*", "X-Listener-Id"],
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(tapes.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    return app


app = create_app()

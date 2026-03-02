import asyncio
import redis.asyncio as redis
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import router as api_router
from app.core.config import settings
from app.core.logging import get_logger
from app.core.db import engine
import app.core.redis as redis_module

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_module.redis_client = redis.from_url(
        settings.REDIS_URL, decode_responses=True
    )

    await redis_module.redis_client.ping()
    logger.info("Redis connected")

    # Connect to Postgres database on startup
    async with engine.connect() as conn:
        logger.info("Postgres connected")

    yield

    await redis_module.redis_client.aclose()
    logger.info("Redis disconnected")

    # Cleanly dispose of the Postgres connection pool
    await engine.dispose()
    logger.info("Postgres disconnected")


app = FastAPI(
    lifespan=lifespan,
    title="BlueBalls API",
    description="BlueBalls API",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api")

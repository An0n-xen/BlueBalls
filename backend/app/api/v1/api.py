from fastapi import APIRouter
from app.api.v1.routes.dataset import router as data_router

router = APIRouter(prefix="/v1")

router.include_router(data_router)

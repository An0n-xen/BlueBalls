from fastapi import APIRouter
from app.api.v1.routes.dataset import router as data_router
from app.api.v1.routes.charts import router as charts_router

router = APIRouter(prefix="/v1")

router.include_router(data_router)
router.include_router(charts_router)

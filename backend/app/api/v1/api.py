from fastapi import APIRouter
from app.api.v1.routes.dataset import router as data_router
from app.api.v1.routes.charts import router as charts_router
from app.api.v1.routes.column_bar import router as column_bar_router

router = APIRouter(prefix="/v1")

router.include_router(data_router)
router.include_router(charts_router)
router.include_router(column_bar_router)

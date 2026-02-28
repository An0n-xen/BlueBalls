from fastapi import APIRouter
from app.api.v1.routes.data_ingestion import router as data_ingestion_router

router = APIRouter(prefix="/v1")

router.include_router(data_ingestion_router)

@router.get("/")
def read_root():
    return {"Hello": "World"}

@router.get("/health")
def health_check():
    return {"status": "ok"}
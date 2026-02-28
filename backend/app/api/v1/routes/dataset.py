import io
import uuid
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, Table, Column, Integer, String, Float, MetaData, inspect
from fastapi import APIRouter, File, UploadFile, Response, Request, HTTPException, Depends
from app.services.dataset_service import upload_dataset, get_db_schema
from app.core.db import get_async_db

router = APIRouter(prefix="/dataset")

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db)
):
    return await upload_dataset(file)


@router.get("/{dataset_id}/schema")
async def get_dataset_schema(dataset_id: str, db: AsyncSession = Depends(get_async_db)):
    return await get_db_schema(dataset_id)
    

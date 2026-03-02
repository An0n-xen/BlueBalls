import io
import uuid
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, Table, Column, Integer, String, Float, MetaData, inspect
from fastapi import (
    APIRouter,
    File,
    UploadFile,
    Response,
    Request,
    HTTPException,
    Depends,
)
from app.services.dataset_service import upload_dataset, get_db_schema
from app.core.db import get_async_db, engine
from app.core.logging import get_logger
from app.core.rate_limit import get_rate_limit

logger = get_logger(__name__)
router = APIRouter(prefix="/dataset")


@router.post(
    "/upload", dependencies=[Depends(get_rate_limit(limit=10, window_size_seconds=60))]
)
async def upload_file(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_async_db)
):
    logger.info("Uploading file: %s", file.filename)
    return await upload_dataset(file, db)


@router.get(
    "/{dataset_id}/schema",
    dependencies=[Depends(get_rate_limit(limit=10, window_size_seconds=60))],
)
async def get_dataset_schema(dataset_id: str, db: AsyncSession = Depends(get_async_db)):
    logger.info("Getting schema for dataset: %s", dataset_id)
    return await get_db_schema(dataset_id)


@router.get(
    "/{dataset_id}/data",
    dependencies=[Depends(get_rate_limit(limit=10, window_size_seconds=60))],
)
async def get_dataset_data(
    dataset_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_async_db),
):
    logger.info(
        f"Getting data for dataset {dataset_id} (limit={limit}, offset={offset})"
    )
    try:
        # First verify the table exists
        columns = await get_db_schema(dataset_id)
        if not columns:
            raise HTTPException(status_code=404, detail="Dataset not found")

        async with engine.connect() as conn:
            # Query the dynamically created table safely
            # Note: Postgres allows table names in quotes
            query = f'SELECT * FROM "{dataset_id}" LIMIT :limit OFFSET :offset'

            # Use SQLAlchemy text for parameter binding
            result = await conn.execute(text(query), {"limit": limit, "offset": offset})
            rows = result.mappings().fetchall()

            # Count total for pagination
            count_query = f'SELECT COUNT(*) FROM "{dataset_id}"'
            count_result = await conn.execute(text(count_query))
            total_rows = count_result.scalar()

            data = [dict(row) for row in rows]

            return {
                "dataset_id": dataset_id,
                "total": total_rows,
                "limit": limit,
                "offset": offset,
                "data": data,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

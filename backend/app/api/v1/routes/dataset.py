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
from app.services.dataset_service import upload_dataset, get_db_schema, compute_kpi
from app.core.db import get_async_db, engine
from app.core.logging import get_logger
from app.core.rate_limit import get_rate_limit
from app.schemas.llm_schema import KpiComputeRequest

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


@router.post(
    "/{dataset_id}/kpi",
    dependencies=[Depends(get_rate_limit(limit=20, window_size_seconds=60))],
)
async def compute_dataset_kpi(
    dataset_id: str,
    request: KpiComputeRequest,
    db: AsyncSession = Depends(get_async_db),
):
    logger.info(
        "Computing KPI for dataset %s: %s(%s)",
        dataset_id,
        request.aggregation,
        request.kpi_column,
    )
    return await compute_kpi(
        dataset_id=dataset_id,
        kpi_column=request.kpi_column,
        aggregation=request.aggregation,
        date_column=request.date_column,
    )


@router.get(
    "/{dataset_id}/distinct-values",
    dependencies=[Depends(get_rate_limit(limit=10, window_size_seconds=60))],
)
async def get_distinct_values(
    dataset_id: str,
    db: AsyncSession = Depends(get_async_db),
):
    """Get distinct values and counts for each column in the dataset."""
    logger.info(f"Getting distinct values for dataset {dataset_id}")
    try:
        schema = await get_db_schema(dataset_id)
        if not schema:
            raise HTTPException(status_code=404, detail="Dataset not found")

        columns = schema.get("columns", [])
        result_columns = []
        async with engine.connect() as conn:
            for col in columns:
                col_name = col["name"]
                col_type = col.get("type", "unknown")
                try:
                    query = text(
                        f'SELECT "{col_name}" AS val, COUNT(*) AS cnt '
                        f'FROM "{dataset_id}" '
                        f'WHERE "{col_name}" IS NOT NULL '
                        f'GROUP BY "{col_name}" '
                        f"ORDER BY cnt DESC "
                        f"LIMIT 100"
                    )
                    rows = await conn.execute(query)
                    values = [
                        {"value": str(r.val), "count": r.cnt} for r in rows.fetchall()
                    ]
                    result_columns.append(
                        {
                            "name": col_name,
                            "type": col_type,
                            "distinct_count": len(values),
                            "values": values,
                        }
                    )
                except Exception as col_err:
                    logger.warning(
                        f"Error getting distinct values for {col_name}: {col_err}"
                    )
                    result_columns.append(
                        {
                            "name": col_name,
                            "type": col_type,
                            "distinct_count": 0,
                            "values": [],
                        }
                    )

        return {"dataset_id": dataset_id, "columns": result_columns}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching distinct values: {e}")
        raise HTTPException(status_code=500, detail=str(e))

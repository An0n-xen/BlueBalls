from app.core.db import engine
from app.core.logging import get_logger
from app.models.dataset_registry import DatasetRegistry
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import inspect
from app.core.db import engine

logger = get_logger(__name__)

def _get_columns(connection, dataset_id: str):
    inspector = inspect(connection)
    if not inspector.has_table(dataset_id):
        return None
    return [
        {"name": col["name"], "type": str(col["type"])}
        for col in inspector.get_columns(dataset_id)
    ]

async def handle_duplicate_content(dataset: DatasetRegistry, file_hash: str, db: AsyncSession) -> None:
    # check if the dataset already exists
    query = select(dataset).where(dataset.file_hash == file_hash)
    result = await db.execute(query)
    existing_dataset = result.scalar_one_or_none()
    return existing_dataset


async def handle_duplicate_name(dataset: DatasetRegistry, filename: str, db: AsyncSession):
    query = select(dataset).where(dataset.original_filename == filename)
    result = await db.execute(query)
    old_dataset = result.scalar_one_or_none()

    if old_dataset:
        logger.info(f"File updated. Dropping old table {old_dataset.table_name}")
        old_table_name = old_dataset.table_name

        # Actually drop the old table from the Postgres database!
        await db.execute(text(f"DROP TABLE IF EXISTS {old_table_name}"))

        await db.delete(old_dataset)
        await db.commit()


async def pull_db_schema(dataset_id: str):
    try:
        async with engine.connect() as conn:
            columns = await conn.run_sync(_get_columns, dataset_id)
            return columns
    except Exception as e:
        logger.error(f"Failed to pull schema: {e}")
        return None

async def pull_db_column_description(dataset_id: str, dataset_registry: DatasetRegistry):
    try:
        async with engine.begin() as conn:
            query = select(DatasetRegistry.column_descriptions).where(DatasetRegistry.table_name == dataset_id)
            result = await conn.execute(query)
            descriptions = result.scalar_one_or_none()
            
        descriptions = descriptions if descriptions else {}
        return descriptions

    except Exception as e:
        logger.error(f"Failed to pull schema description for dataset {dataset_id}: {e}")
        return None
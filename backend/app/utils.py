from app.core.db import engine
from app.core.logging import get_logger
from app.models.dataset_registry import DatasetRegistry
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)

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
import io
import uuid
import warnings
import pandas as pd
import hashlib

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, Table, Column, Integer, String, Float, MetaData, inspect

from fastapi import HTTPException, UploadFile

from app.core.db import SessionLocal, engine
from app.core.logging import get_logger
from app.models.dataset_registry import DatasetRegistry
from app.utils import (
    handle_duplicate_content,
    handle_duplicate_name,
    pull_db_schema,
    pull_db_column_description,
)
from app.services.ai_metadata import (
    generate_column_descriptions,
    generate_dataset_description,
)
from sqlalchemy import select

logger = get_logger(__name__)


# Helper function to convert pandas dtypes to SQLAlchemy types
def pandas_dtype_to_sqlalchemy_type(dtype):
    if pd.api.types.is_numeric_dtype(dtype):
        if pd.api.types.is_float_dtype(dtype):
            return Float
        return Integer

    return String


def categorize_columns(df: pd.DataFrame) -> dict:
    """
    Categorize each column into: categorical, numerical, or date.
    Returns a dict mapping column names to their category.
    """
    column_types = {}

    for col_name in df.columns:
        # Get non-null values for analysis
        non_null_values = df[col_name].dropna()

        if len(non_null_values) == 0:
            column_types[col_name] = "categorical"
            continue

        # Check if column is already datetime64 - fast pandas dtype check
        if pd.api.types.is_datetime64_any_dtype(df[col_name]):
            column_types[col_name] = "date"
            continue

        # Check if column is numeric - fast pandas dtype check
        if pd.api.types.is_numeric_dtype(df[col_name]):
            column_types[col_name] = "numerical"
            continue

        # For string columns, try to convert entire series at once
        # If ALL values convert successfully (no NaT), it's a date column
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                parsed_dates = pd.to_datetime(non_null_values, errors="coerce")
            if parsed_dates.notna().all():
                column_types[col_name] = "date"
                continue
        except (ValueError, TypeError):
            pass

        # Try to convert entire series to numeric - if ALL succeed, it's numerical
        try:
            numeric_values = pd.to_numeric(non_null_values, errors="coerce")
            if numeric_values.notna().all():
                column_types[col_name] = "numerical"
                continue
        except (ValueError, TypeError):
            pass

        # Default to categorical for string/text columns
        column_types[col_name] = "categorical"

    return column_types


async def upload_dataset(file: UploadFile, db: AsyncSession):
    # 1. Validate file extension
    filename = file.filename.lower()
    if not (
        filename.endswith(".csv")
        or filename.endswith(".xlsx")
        or filename.endswith(".xls")
    ):
        raise HTTPException(
            status_code=400, detail="Only CSV and Excel files are currently supported"
        )

    try:
        # 2. Read the CSV data into Pandas
        contents = await file.read()

        # calculate the hash of the file contents
        file_hash = hashlib.sha256(contents).hexdigest()

        # 2. Parse into Pandas DataFrame based on file type
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            # Requires `openpyxl` to be installed for .xlsx files
            df = pd.read_excel(io.BytesIO(contents))

        # check if the dataset already exists
        existing_dataset = await handle_duplicate_content(
            DatasetRegistry, file_hash, db
        )
        if existing_dataset:
            logger.info("Exact file already exists. Skipping upload.")
            return {
                "message": "Dataset already exists",
                "dataset_id": existing_dataset.table_name,
                "rows_inserted": 0,
            }

        # check for duplicate file name
        await handle_duplicate_name(DatasetRegistry, filename, db)

        # We need a safely generated table name for this specific dataset
        dataset_id = str(uuid.uuid4()).replace("-", "_")
        table_name = f"dataset_{dataset_id}"

        # 3. Infer Schema and dynamically create SQLAlchemy Table
        metadata = MetaData()
        columns = []

        # Build sample data for AI Metadata Generation
        sample_data = {}

        logger.info("Inferring schema and dynamically creating SQLAlchemy Table")
        for col_name, dtype in df.dtypes.items():
            # Sanitize column names for SQL safety
            safe_col_name = (
                str(col_name).strip().lower().replace(" ", "_").replace("-", "_")
            )

            # Store max 10 non-empty samples for the LLM metadata request
            samples = df[col_name].dropna().astype(str).head(10).tolist()
            sample_data[safe_col_name] = samples

            # Map pandas type to SQLAlchemy type
            sa_type = pandas_dtype_to_sqlalchemy_type(dtype)
            columns.append(Column(safe_col_name, sa_type))

            # Update the pandas dataframe to have the safe column name
            df.rename(columns={col_name: safe_col_name}, inplace=True)

        dynamic_table = Table(table_name, metadata, *columns)

        # 4. Create the table in the database synchronously via run_sync
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)

        # 5. Insert data efficiently

        import numpy as np
        import math

        # Convert NaN/NaT strings to pure python None
        df = df.replace({np.nan: None, pd.NA: None})

        # Iterate over columns and forcefully cast datetime objects to strings
        for col in df.select_dtypes(include=["datetime", "datetimetz"]).columns:
            print(col)
            df[col] = df[col].dt.strftime("%Y-%m-%d %H:%M:%S")

        # Convert dataframe to a list of dicts for SQLAlchemy insertion
        raw_data = df.to_dict(orient="records")

        # Deep clean the dictionary: Ensure types explicitly match the SQLAlchemy Column types
        data_to_insert = []
        logger.info("Converting dataframe to list of dicts for SQLAlchemy insertion")
        for row in raw_data:
            clean_row = {}
            for col_obj in columns:
                col_name = col_obj.name

                v = row.get(col_name)

                # Handle pandas/numpy nulls and string "nan"
                if (
                    v is None
                    or pd.isna(v)
                    or (isinstance(v, float) and math.isnan(v))
                    or str(v).lower() == "nan"
                    or str(v).lower() == "none"
                    or str(v).lower() == "na"
                ):
                    clean_row[col_name] = None
                    continue

                # Coerce to the exact type SQLAlchemy expects based on our schema inference
                sa_type = col_obj.type
                try:
                    if isinstance(sa_type, String):
                        clean_row[col_name] = str(v)
                    elif isinstance(sa_type, Integer):
                        try:
                            # Attempt to cast directly, fallback to None if it contains non-numeric text
                            clean_row[col_name] = int(float(v))
                        except ValueError:
                            clean_row[col_name] = None
                    elif isinstance(sa_type, Float):
                        clean_row[col_name] = float(v)
                    else:
                        clean_row[col_name] = v
                except (ValueError, TypeError):
                    clean_row[col_name] = None  # Fallback if cast fails

            data_to_insert.append(clean_row)

        logger.info("Inserting data into table: %s", table_name)
        if data_to_insert:
            async with engine.begin() as conn:
                await conn.execute(dynamic_table.insert(), data_to_insert)

        # Generate the AI descriptions using the extracted samples
        column_descriptions = await generate_column_descriptions(sample_data)
        dataset_description = await generate_dataset_description(sample_data, filename)

        # Categorize columns into categorical, numerical, or date
        column_types = categorize_columns(df)

        # Create a new registry entry
        new_registry = DatasetRegistry(
            original_filename=filename,
            table_name=table_name,
            file_hash=file_hash,
            description=dataset_description,
            row_count=len(data_to_insert),
            column_count=len(columns),
            column_descriptions=column_descriptions,
            column_types=column_types,
        )
        db.add(new_registry)
        await db.commit()

        return {
            "message": "File uploaded and processed successfully",
            "dataset_id": table_name,
            "rows_inserted": len(data_to_insert),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def get_db_schema(dataset_id: str):
    try:
        columns = await pull_db_schema(dataset_id)

        if columns is None:
            logger.error("Dataset not found: %s", dataset_id)
            raise HTTPException(status_code=404, detail="Dataset not found")

        from app.utils import pull_dataset_overview

        # Query the dataset registry to get column_types and descriptions
        async with SessionLocal() as session:
            query = select(DatasetRegistry).where(
                DatasetRegistry.table_name == dataset_id
            )
            result = await session.execute(query)
            registry = result.scalar_one_or_none()

        overview = await pull_dataset_overview(dataset_id, DatasetRegistry)
        descriptions = await pull_db_column_description(dataset_id, DatasetRegistry)

        # Get column_types from registry if available
        column_types = registry.column_types if registry else {}

        # Merge descriptions and column_types
        for col in columns:
            col["description"] = descriptions.get(col["name"], "")
            col["column_type"] = column_types.get(col["name"], "categorical")

        return {
            "dataset_id": dataset_id,
            "description": overview.get("description") if overview else None,
            "row_count": overview.get("row_count") if overview else None,
            "column_count": overview.get("column_count") if overview else None,
            "columns": columns,
            "column_types": column_types,
        }
    except Exception as e:
        logger.error("Error getting schema for dataset: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


ALLOWED_AGGREGATIONS = {"COUNT", "SUM", "AVG", "MIN", "MAX"}


async def compute_kpi(
    dataset_id: str,
    kpi_column: str,
    aggregation: str = "COUNT",
    date_column: str | None = None,
):
    """
    Compute an aggregate KPI value (and optional time-series breakdown) for a dataset column.
    """
    aggregation = aggregation.upper().strip()
    if aggregation not in ALLOWED_AGGREGATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid aggregation '{aggregation}'. Must be one of {ALLOWED_AGGREGATIONS}",
        )

    # Pull schema to validate columns exist
    columns = await pull_db_schema(dataset_id)
    if columns is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    col_names = {c["name"] for c in columns}

    if kpi_column not in col_names:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{kpi_column}' not found in dataset",
        )
    if date_column and date_column not in col_names:
        raise HTTPException(
            status_code=400,
            detail=f"Date column '{date_column}' not found in dataset",
        )

    try:
        async with engine.connect() as conn:
            # ---- Overall aggregate value ----
            agg_expr = (
                f"COUNT(*)"
                if aggregation == "COUNT"
                else f'{aggregation}("{kpi_column}")'
            )
            overall_sql = f'SELECT {agg_expr} AS value FROM "{dataset_id}"'
            result = await conn.execute(text(overall_sql))
            overall_value = result.scalar()

            # ---- Optional time-series breakdown ----
            breakdown = None
            if date_column:
                breakdown_sql = (
                    f'SELECT "{date_column}" AS period, {agg_expr} AS value '
                    f'FROM "{dataset_id}" '
                    f'GROUP BY "{date_column}" '
                    f'ORDER BY "{date_column}" ASC'
                )
                bk_result = await conn.execute(text(breakdown_sql))
                rows = bk_result.mappings().fetchall()
                breakdown = [
                    {"period": str(r["period"]), "value": r["value"]} for r in rows
                ]

        return {
            "dataset_id": dataset_id,
            "kpi_column": kpi_column,
            "aggregation": aggregation,
            "value": overall_value,
            "date_column": date_column,
            "breakdown": breakdown,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error computing KPI: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

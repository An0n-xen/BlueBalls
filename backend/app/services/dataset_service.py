import io
import uuid
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, Table, Column, Integer, String, Float, MetaData, inspect
from fastapi import HTTPException, UploadFile
from app.core.db import engine

# Helper function to convert pandas dtypes to SQLAlchemy types
def pandas_dtype_to_sqlalchemy_type(dtype):
    if pd.api.types.is_numeric_dtype(dtype):
        if pd.api.types.is_float_dtype(dtype):
            return Float
        return Integer
    
    return String

async def upload_dataset(file: UploadFile):
    # 1. Validate file extension
    filename = file.filename.lower()
    if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are currently supported")

    try:
        # 2. Read the CSV data into Pandas
        contents = await file.read()

        # 2. Parse into Pandas DataFrame based on file type
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            # Requires `openpyxl` to be installed for .xlsx files
            df = pd.read_excel(io.BytesIO(contents))

        # We need a safely generated table name for this specific dataset
        dataset_id = str(uuid.uuid4()).replace("-", "_")
        table_name = f"dataset_{dataset_id}"

        # 3. Infer Schema and dynamically create SQLAlchemy Table
        metadata = MetaData()
        columns = []

        for col_name, dtype in df.dtypes.items():
            # Sanitize column names for SQL safety 
            safe_col_name = str(col_name).strip().lower().replace(" ", "_").replace("-", "_")

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
        for col in df.select_dtypes(include=['datetime', 'datetimetz']).columns:
            print(col)
            df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        # Convert dataframe to a list of dicts for SQLAlchemy insertion
        raw_data = df.to_dict(orient="records")
        
        # Deep clean the dictionary: Ensure types explicitly match the SQLAlchemy Column types
        data_to_insert = []
        for row in raw_data:
            clean_row = {}
            for col_obj in columns:
                col_name = col_obj.name
                
                v = row.get(col_name)
                
                # Handle pandas/numpy nulls and string "nan"
                if v is None or pd.isna(v) or (isinstance(v, float) and math.isnan(v)) or str(v).lower() == "nan" or str(v).lower() == "none" or str(v).lower() == "na":
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
                     clean_row[col_name] = None # Fallback if cast fails

            data_to_insert.append(clean_row)
            
        if data_to_insert:
            async with engine.begin() as conn:
                await conn.execute(dynamic_table.insert(), data_to_insert)

        return {
            "message": "File uploaded and processed successfully",
            "dataset_id": table_name,
            "rows_inserted": len(data_to_insert)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def get_db_schema(dataset_id: str):
    try:
        def _get_columns(connection):
            inspector = inspect(connection)
            
            # Verify the table actually exists to prevent errors/SQL injection
            if not inspector.has_table(dataset_id):
                return None
                
            columns = inspector.get_columns(dataset_id)
            return [
                {"name": col["name"], "type": str(col["type"])}
                for col in columns
            ]
        async with engine.connect() as conn:
            columns = await conn.run_sync(_get_columns)

        if columns is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        return {
            "dataset_id": dataset_id,
            "columns": columns
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import inspect
from app.core.db import get_async_db, engine
from app.core.logging import get_logger
from app.services.ai_charts import chart_suggester_app
from app.services.chart_generator import chart_generator_app
from app.models.dataset_registry import DatasetRegistry
from app.utils import pull_db_column_description, pull_db_schema
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/charts", tags=["charts"])

@router.get("/suggest")
async def suggest_charts(dataset_id: str, db: AsyncSession = Depends(get_async_db)):
    try:
        columns = await pull_db_schema(dataset_id)

        if columns is None:
            logger.error("Dataset not found: %s", dataset_id)
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        descriptions = await pull_db_column_description(dataset_id, DatasetRegistry)
        
        # Merge descriptions
        for col in columns:
            col["description"] = descriptions.get(col["name"], "")

        # Now, invoke our LangGraph workflow!
        initial_state = {"schema_info": columns}
        
        # We use ainvoke for async execution
        result = await chart_suggester_app.ainvoke(initial_state)
        
        return {
            "dataset_id": dataset_id,
            "suggestions": result["suggestions"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChartGenerateRequest(BaseModel):
    dataset_id: str
    user_query: str

@router.post("/generate")
async def generate_chart(request: ChartGenerateRequest, db: AsyncSession = Depends(get_async_db)):
    try:
        dataset_id = request.dataset_id
        columns = await pull_db_schema(dataset_id)
        if columns is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        descriptions = await pull_db_column_description(dataset_id, DatasetRegistry)
        for col in columns:
            col["description"] = descriptions.get(col["name"], "")

        initial_state = {
            "dataset_id": dataset_id,
            "user_query": request.user_query,
            "schema_info": columns
        }
        
        result = await chart_generator_app.ainvoke(initial_state)
        
        if result.get("sql_error"):
            raise HTTPException(status_code=400, detail=result["sql_error"])
            
        return {
            "sql_query": result.get("sql_query"),
            "data": result.get("sql_results"),
            "chart_spec": result.get("chart_spec")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating chart: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

        # 1. Ask AI to suggest 3 queries
        initial_state = {"schema_info": columns}
        result = await chart_suggester_app.ainvoke(initial_state)
        queries = result.get("suggested_queries", [])
        
        if not queries:
             raise HTTPException(status_code=500, detail="Failed to generate AI chart suggestions.")

        # 2. For each query, run the Text-to-SQL logic concurrently
        import asyncio
        async def generate_single_chart(query: str):
            generator_state = {
                "dataset_id": dataset_id,
                "user_query": query,
                "schema_info": columns
            }
            res = await chart_generator_app.ainvoke(generator_state)
            
            # If it failed to generate SQL, skip peacefully
            if res.get("sql_error"):
                return None
                
            spec = res.get("chart_spec", {}).get("chart_spec") if isinstance(res.get("chart_spec"), dict) and "chart_spec" in res.get("chart_spec") else res.get("chart_spec")
            
            return {
                "query": query,
                "sql_query": res.get("sql_query"),
                "chart_spec": spec
            }

        chart_tasks = [generate_single_chart(q) for q in queries]
        generated_charts = await asyncio.gather(*chart_tasks)
        
        # Filter out any that failed
        successful_charts = [c for c in generated_charts if c and c.get("chart_spec")]

        return {
            "dataset_id": dataset_id,
            "suggestions": successful_charts
        }
    except Exception as e:
        logger.error(f"Error suggesting charts: {e}")
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

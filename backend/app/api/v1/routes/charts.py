from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import inspect
from app.core.db import get_async_db, engine
from app.services.ai_charts import chart_suggester_app
from app.models.dataset_registry import DatasetRegistry
from app.utils import pull_db_column_description, pull_db_schema

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

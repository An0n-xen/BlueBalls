from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import inspect
from app.core.db import get_async_db, engine
from app.services.ai_charts import chart_suggester_app

router = APIRouter(prefix="/charts", tags=["charts"])

@router.get("/suggest")
async def suggest_charts(dataset_id: str, db: AsyncSession = Depends(get_async_db)):
    try:
        # First, grab the schema just like we did in the datasets route
        def _get_columns(connection):
            inspector = inspect(connection)
            if not inspector.has_table(dataset_id):
                return None
            return [
                {"name": col["name"], "type": str(col["type"])}
                for col in inspector.get_columns(dataset_id)
            ]
            
        async with engine.connect() as conn:
            columns = await conn.run_sync(_get_columns)

        if columns is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

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

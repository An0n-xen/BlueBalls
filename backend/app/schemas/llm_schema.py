from __future__ import annotations
from typing import List, Dict, Any, Optional, TypedDict
from pydantic import BaseModel, Field


class ChartGeneratorState(TypedDict):
    dataset_id: str
    user_query: str
    schema_info: List[dict]
    sql_query: Optional[str]
    sql_error: Optional[str]
    sql_results: Optional[List[dict]]
    chart_spec: Optional[dict]


class ChartGenerateRequest(BaseModel):
    dataset_id: str
    user_query: str

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


class KpiComputeRequest(BaseModel):
    dataset_id: str
    kpi_column: str
    aggregation: str = Field(
        default="COUNT",
        description="Aggregation function: COUNT, SUM, AVG, MIN, MAX",
    )
    date_column: Optional[str] = Field(
        default=None,
        description="Optional date column for time-based grouping",
    )

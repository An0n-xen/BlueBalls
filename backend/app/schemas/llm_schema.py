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


class ColumnBarXValue(BaseModel):
    column: str = Field(description="Column name, or '__record_count__' for row count")
    aggregation: str = Field(
        default="COUNT",
        description="Aggregation: COUNT, SUM, AVG, MIN, MAX",
    )


class ColumnBarRequest(BaseModel):
    dataset_id: str
    y_axis: str = Field(description="Category column for grouping (Y-axis labels)")
    x_values: List[ColumnBarXValue] = Field(
        description="Metrics to measure on the value axis",
        min_length=1,
    )
    slice: Optional[str] = Field(
        default=None, description="Optional column for stacked/grouped series"
    )
    sort_by: Optional[str] = Field(default=None, description="Column to sort by")
    sort_dir: str = Field(default="desc", description="Sort direction: asc or desc")
    chart_type: str = Field(
        default="column", description="'column' (vertical) or 'bar' (horizontal)"
    )

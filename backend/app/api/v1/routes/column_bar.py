"""Column & Bar chart endpoint – builds ECharts specs from user-selected
columns + aggregations, no AI involved."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.core.db import engine
from app.core.logging import get_logger
from app.core.rate_limit import get_rate_limit
from app.schemas.llm_schema import ColumnBarRequest
from app.services.dataset_service import get_db_schema

logger = get_logger(__name__)
router = APIRouter(prefix="/charts")

ALLOWED_AGGS = {"COUNT", "SUM", "AVG", "MIN", "MAX"}


def _safe_identifier(name: str) -> str:
    """Double-quote a SQL identifier to prevent injection."""
    return '"' + name.replace('"', '""') + '"'


@router.post(
    "/column-bar",
    dependencies=[Depends(get_rate_limit(limit=20, window_size_seconds=60))],
)
async def generate_column_bar(req: ColumnBarRequest):
    """Build a column/bar chart from explicit column + aggregation selections."""
    # ---- Validate dataset exists ----
    schema = await get_db_schema(req.dataset_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Dataset not found")

    col_names = {c["name"] for c in schema.get("columns", [])}
    table = _safe_identifier(req.dataset_id)

    # ---- Validate columns ----
    if req.y_axis not in col_names:
        raise HTTPException(status_code=400, detail=f"Column '{req.y_axis}' not found")
    for xv in req.x_values:
        if xv.column != "__record_count__" and xv.column not in col_names:
            raise HTTPException(
                status_code=400, detail=f"Column '{xv.column}' not found"
            )
        if xv.aggregation.upper() not in ALLOWED_AGGS:
            raise HTTPException(
                status_code=400, detail=f"Invalid aggregation '{xv.aggregation}'"
            )
    if req.slice and req.slice not in col_names:
        raise HTTPException(
            status_code=400, detail=f"Slice column '{req.slice}' not found"
        )

    y_col = _safe_identifier(req.y_axis)

    # ---- Build SELECT expressions ----
    select_parts = [f"{y_col} AS category"]
    aliases = []

    if req.slice:
        slice_col = _safe_identifier(req.slice)
        select_parts.append(f"{slice_col} AS slice_val")

    for i, xv in enumerate(req.x_values):
        agg = xv.aggregation.upper()
        alias = f"val_{i}"
        if xv.column == "__record_count__":
            select_parts.append(f"COUNT(*) AS {alias}")
        else:
            col = _safe_identifier(xv.column)
            select_parts.append(f"{agg}({col}) AS {alias}")
        aliases.append(alias)

    # ---- Build GROUP BY / ORDER BY ----
    group_parts = ["category"]
    if req.slice:
        group_parts.append("slice_val")

    order_clause = ""
    if req.sort_by:
        direction = "ASC" if req.sort_dir.lower() == "asc" else "DESC"
        if req.sort_by == "__record_count__":
            order_clause = f"ORDER BY val_0 {direction}"
        elif req.sort_by in col_names:
            order_clause = f"ORDER BY {_safe_identifier(req.sort_by)} {direction}"
    if not order_clause:
        order_clause = "ORDER BY val_0 DESC"

    sql = (
        f"SELECT {', '.join(select_parts)} "
        f"FROM {table} "
        f"WHERE {y_col} IS NOT NULL "
        f"GROUP BY {', '.join(group_parts)} "
        f"{order_clause} "
        f"LIMIT 200"
    )

    logger.info("Column-bar SQL: %s", sql)

    try:
        async with engine.connect() as conn:
            result = await conn.execute(text(sql))
            rows = [dict(r._mapping) for r in result.fetchall()]
    except Exception as e:
        logger.error("Column-bar query failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Query error: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="Query returned no data")

    # ---- Build ECharts spec ----
    is_horizontal = req.chart_type.lower() == "bar"

    if req.slice:
        chart_spec = _build_sliced_spec(rows, aliases, req, is_horizontal)
    else:
        chart_spec = _build_simple_spec(rows, aliases, req, is_horizontal)

    return {"chart_spec": chart_spec, "sql_query": sql, "row_count": len(rows)}


def _build_simple_spec(rows, aliases, req, is_horizontal):
    """Non-sliced – one series per x_value."""
    categories = [str(r["category"]) for r in rows]
    series = []

    for i, xv in enumerate(req.x_values):
        label = (
            "Record Count"
            if xv.column == "__record_count__"
            else f"{xv.aggregation.upper()}({xv.column})"
        )
        data = [r[aliases[i]] for r in rows]
        # Convert Decimal to float
        data = [float(v) if v is not None else 0 for v in data]
        series.append(
            {
                "name": label,
                "type": "bar",
                "data": data,
                "emphasis": {"focus": "series"},
            }
        )

    category_axis = {"type": "category", "data": categories}
    value_axis = {"type": "value"}

    spec = {
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"show": len(series) > 1, "top": "top"},
        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
        "xAxis": category_axis if not is_horizontal else value_axis,
        "yAxis": value_axis if not is_horizontal else category_axis,
        "series": series,
    }
    return spec


def _build_sliced_spec(rows, aliases, req, is_horizontal):
    """Sliced – one series per unique slice value, stacked."""
    categories_ordered = []
    seen = set()
    for r in rows:
        cat = str(r["category"])
        if cat not in seen:
            categories_ordered.append(cat)
            seen.add(cat)

    slice_values_ordered = []
    seen_slices = set()
    for r in rows:
        sv = str(r["slice_val"]) if r["slice_val"] is not None else "(empty)"
        if sv not in seen_slices:
            slice_values_ordered.append(sv)
            seen_slices.add(sv)

    # Build data maps: slice_val -> {category -> value}
    # For simplicity use only the first x_value for sliced charts
    alias = aliases[0]
    data_map = {}
    for r in rows:
        sv = str(r["slice_val"]) if r["slice_val"] is not None else "(empty)"
        cat = str(r["category"])
        if sv not in data_map:
            data_map[sv] = {}
        data_map[sv][cat] = float(r[alias]) if r[alias] is not None else 0

    series = []
    for sv in slice_values_ordered:
        data = [data_map.get(sv, {}).get(cat, 0) for cat in categories_ordered]
        series.append(
            {
                "name": sv,
                "type": "bar",
                "stack": "total",
                "data": data,
                "emphasis": {"focus": "series"},
            }
        )

    category_axis = {"type": "category", "data": categories_ordered}
    value_axis = {"type": "value"}

    spec = {
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"show": True, "top": "top", "type": "scroll"},
        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
        "xAxis": category_axis if not is_horizontal else value_axis,
        "yAxis": value_axis if not is_horizontal else category_axis,
        "series": series,
    }
    return spec

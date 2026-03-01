from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END
from app.core.llm import llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from sqlalchemy import text
from app.core.db import engine
from app.core.logging import get_logger
import json

logger = get_logger(__name__)

class ChartGeneratorState(TypedDict):
    dataset_id: str
    user_query: str
    schema_info: List[dict]
    sql_query: Optional[str]
    sql_error: Optional[str]
    sql_results: Optional[List[dict]]
    chart_spec: Optional[dict]

async def generate_sql_node(state: ChartGeneratorState):
    """Generates PostgreSQL query based on schema and user request."""
    logger.info(f"Generating SQL for query: {state['user_query']}")
    schema = state["schema_info"]
    query = state["user_query"]
    dataset_id = state["dataset_id"]
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert PostgreSQL data analyst. 
Given the following database schema for a table named '{table_name}', write a valid PostgreSQL query to answer the user's request.
Return ONLY a valid JSON object with a single key 'sql_query' containing the raw SQL. Do not include markdown formatting or explanations.
Ensure the SQL is safe (SELECT only) and uses correct column names."""),
        ("user", "Schema: {schema}\n\nUser Request: {query}")
    ])
    
    chain = prompt | llm.bind(response_format={"type": "json_object"}) | JsonOutputParser()
    
    try:
        response = await chain.ainvoke({
            "table_name": dataset_id,
            "schema": json.dumps(schema), 
            "query": query
        })
        return {"sql_query": response.get("sql_query", "")}
    except Exception as e:
        logger.error(f"Failed to generate SQL: {e}")
        return {"sql_error": str(e)}

async def execute_sql_node(state: ChartGeneratorState):
    """Executes the generated SQL query securely against the database."""
    sql_query = state.get("sql_query")
    
    if not sql_query:
        return {"sql_error": "No SQL query generated."}
        
    logger.info(f"Executing SQL: {sql_query}")
    
    try:
        # Security check: ensure it's a SELECT query
        if not sql_query.strip().upper().startswith("SELECT"):
            return {"sql_error": "Only SELECT queries are allowed."}

        async with engine.connect() as conn:
            # Execute in read-only transaction if possible, but for now just execute
            result = await conn.execute(text(sql_query))
            rows = result.mappings().fetchall()
            # Convert to list of dicts, converting non-serializable types if necessary
            data = [dict(row) for row in rows]
            
        logger.info(f"SQL execution successful, retrieved {len(data)} rows.")
        return {"sql_results": data, "sql_error": None}
    except Exception as e:
        logger.error(f"SQL Execution failed: {e}")
        return {"sql_error": str(e), "sql_results": None}

def should_generate_chart(state: ChartGeneratorState):
    """Conditional edge to check if SQL execution was successful."""
    if state.get("sql_error"):
        return END
    return "generate_chart_spec"

async def generate_chart_spec_node(state: ChartGeneratorState):
    """Generates an ECharts JSON configuration based on the SQL results."""
    logger.info("Generating ECharts specification.")
    data = state.get("sql_results", [])
    query = state["user_query"]
    
    # Cap data size if too large for LLM context
    limited_data = data[:50] 
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert data visualization engineer. 
Given a user's original request and the resulting data from a SQL query, generate a complete JSON configuration object for Apache ECharts.
The configuration must be a valid ECharts 'option' object that can be directly passed to echarts.setOption().
Ensure the chart type perfectly matches the user's intent (e.g., bar, line, pie, scatter).
Include appropriate titles, tooltips, x/y axes, and map the provided data precisely to the 'series' or 'dataset' properties.
Return ONLY valid JSON. No markdown ticks, no explanations."""),
        ("user", "User Request: {query}\n\nData (up to 50 rows): {data}")
    ])
    
    chain = prompt | llm.bind(response_format={"type": "json_object"}) | JsonOutputParser()
    
    try:
        response = await chain.ainvoke({
            "query": query,
            "data": json.dumps(limited_data, default=str) # Handle dates/decimals
        })
        return {"chart_spec": response}
    except Exception as e:
        logger.error(f"Failed to generate chart spec: {e}")
        return {"chart_spec": None}

workflow = StateGraph(ChartGeneratorState)

workflow.add_node("generate_sql", generate_sql_node)
workflow.add_node("execute_sql", execute_sql_node)
workflow.add_node("generate_chart_spec", generate_chart_spec_node)

workflow.add_edge(START, "generate_sql")
workflow.add_edge("generate_sql", "execute_sql")
workflow.add_conditional_edges("execute_sql", should_generate_chart)
workflow.add_edge("generate_chart_spec", END)

chart_generator_app = workflow.compile()

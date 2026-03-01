from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

class ChartAgentState(TypedDict):
    schema_info: List[dict] 
    suggested_queries: List[str]        

async def suggest_charts_node(state: ChartAgentState):
    schema = state["schema_info"]
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert data analyst. Given the following database schema, suggest exactly 3 highly insightful analytical questions that could be answered with a chart.
Return ONLY a valid JSON object with a single key 'queries' containing an array of 3 strings. Example: {{"queries": ["Show me the top 5 reasons for admission", "What is the age distribution?", "Count of patients by gender"]}}"""),
        ("user", "Schema: {schema}")
    ])
    
    from app.core.llm import llm
    chain = prompt | llm.bind(response_format={"type": "json_object"}) | JsonOutputParser()
    
    try:
        response = await chain.ainvoke({"schema": schema})
        return {"suggested_queries": response.get("queries", [])}
    except Exception:
        return {"suggested_queries": []}

workflow = StateGraph(ChartAgentState)

workflow.add_node("suggest_charts", suggest_charts_node)

workflow.add_edge(START, "suggest_charts")
workflow.add_edge("suggest_charts", END)
chart_suggester_app = workflow.compile()

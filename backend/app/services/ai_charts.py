from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from app.core.llm import llm
from langchain_core.prompts import ChatPromptTemplate

class ChartAgentState(TypedDict):
    schema_info: List[dict] 
    suggestions: str        

async def suggest_charts_node(state: ChartAgentState):
    schema = state["schema_info"]
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert data analyst. Given the following database schema, suggest 3 highly insightful charts that could be generated from this data.
                       For each chart, explain WHY it would be useful.
                       Format as markdown."""),
        ("user", "Schema: {schema}")
    ])
    
    chain = prompt | llm
    
    response = await chain.ainvoke({"schema": schema})
    
    return {"suggestions": response.content}

workflow = StateGraph(ChartAgentState)

workflow.add_node("suggest_charts", suggest_charts_node)

workflow.add_edge(START, "suggest_charts")
workflow.add_edge("suggest_charts", END)
chart_suggester_app = workflow.compile()

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.llm import description_llm
from app.core.logging import get_logger

logger = get_logger(__name__)

async def generate_column_descriptions(sample_data: dict) -> dict:
    """
    Takes a dict of column names mapping to lists of sample values.
    Returns a dict mapping column names to 1-sentence string descriptions.
    """
    try:
        logger.info("Generating AI column descriptions for dataset...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert data dictionary assistant. "
                       "Given a JSON dictionary containing column names and a list of their sample values from a CSV, "
                       "reply with ONLY a valid JSON object. "
                       "The keys must be the column names, and the values must be a concise, 1-sentence description "
                       "explaining what the column likely represents based on the column name and the sample data. "
                       "Do not include markdown blocks or any other text."),
            ("user", "{samples}")
        ])
        
        # We use a fast, deterministic setting 
        chain = prompt | description_llm.bind(response_format={"type": "json_object"}) | JsonOutputParser()
        
        response = await chain.ainvoke({"samples": sample_data})
        logger.info("Successfully generated AI descriptions.")
        return response
    except Exception as e:
        logger.error(f"Failed to generate descriptions: {e}")
        return {}

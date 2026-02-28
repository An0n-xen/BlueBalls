import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

# We use the ChatOpenAI client, but redirect the base_url to DeepInfra!
llm = ChatOpenAI(
    api_key=os.getenv("DEEPINFRA_API_KEY"),
    base_url="https://api.deepinfra.com/v1/openai",
    model="Qwen/Qwen2.5-72B-Instruct",
    temperature=0.2, # Low temperature since we want structured data/SQL later
    max_retries=2
)

# The fast/cheap brain for simple metadata categorization
description_llm = ChatOpenAI(
    api_key=os.getenv("DEEPINFRA_API_KEY"),
    base_url="https://api.deepinfra.com/v1/openai",
    model="meta-llama/Meta-Llama-3-8B-Instruct",
    temperature=0.0
)
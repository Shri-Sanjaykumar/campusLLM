import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

try:
    llm = ChatOpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        model="deepseek/deepseek-v4-flash:free",
        max_tokens=100
    )
    res = llm.invoke("Say hi")
    print("Success:", res.content)
except Exception as e:
    print("Error:", str(e))

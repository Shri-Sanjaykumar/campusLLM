import os
import bs4
import requests
import json
from dotenv import load_dotenv
from exa_py import Exa


from langchain_core.prompts import PromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import WebBaseLoader, PyMuPDFLoader, TextLoader
from langchain_community.vectorstores import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from google import genai
from google.genai import types

# =========================================================
# LOAD ENV
# =========================================================

load_dotenv()
exa = Exa(api_key=os.environ.get("EXA_API_KEY"))
# =========================================================
# LANGSMITH CONFIG
# =========================================================

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"

# =========================================================
# CONFIG
# =========================================================

RELEVANCE_THRESHOLD = 0.15
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
CHROMA_PERSIST_DIR = "./chroma_db"

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in .env file")

# =========================================================
# INDEXING & STORAGE
# =========================================================

embedding_func = FastEmbedEmbeddings(
    model_name="BAAI/bge-small-en-v1.5"
)

vectorstore = Chroma(
    persist_directory=CHROMA_PERSIST_DIR,
    embedding_function=embedding_func
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)

def ingest_document(file_path: str):
    """
    Load a file (PDF or Text), split it, and add to vectorstore.
    """
    if file_path.endswith(".pdf"):
        loader = PyMuPDFLoader(file_path)
    else:
        # Default to text loader for other formats
        loader = TextLoader(file_path)
    
    docs = loader.load()
    splits = text_splitter.split_documents(docs)
    vectorstore.add_documents(documents=splits)
    # vectorstore.persist() # Chroma 0.4+ persists automatically or uses a different mechanism, but explicit persist calls are sometimes needed depending on version. 
    # For newer versions, it's auto-persisted.

def ingest_url(url: str):
    """
    Load a website URL, split it, and add to vectorstore.
    """
    loader = WebBaseLoader(url)
    docs = loader.load()
    splits = text_splitter.split_documents(docs)
    vectorstore.add_documents(documents=splits)

# =========================================================
# RETRIEVAL
# =========================================================

def retrieve_context(question: str) -> str | None:
    results = vectorstore.similarity_search_with_relevance_scores(
        question,
        k=4,
    )

    relevant_docs = [
        doc for doc, score in results if score >= RELEVANCE_THRESHOLD
    ]

    if not relevant_docs:
        return None

    return "\n\n".join(doc.page_content for doc in relevant_docs)

# =========================================================
# GREETING DETECTOR
# =========================================================

def is_greeting(text: str) -> bool:
    greetings = {
        "hi",
        "hello",
        "hey",
        "hai",
        "hii",
        "good morning",
        "good afternoon",
        "good evening",
        "whats up",
        "what's up",
    }

    text = text.lower().strip()
    return any(text == g or text.startswith(g) for g in greetings)

# =========================================================
# PROMPT
# =========================================================

prompt = PromptTemplate(
    input_variables=["context", "question"],
    template="""
You are a helpful university campus assistant.

You can:
- Answer questions about university policies, academics, hostel, placements, events, etc.
- Guide students using official university information.

Rules:
1. If the question is about your identity, answer directly.
2. If the user asks a general knowledge question, answer it directly to the best of your ability.
3. If the user asks a university-specific question, prioritize using the provided context.
4. Keep answers clear, simple, and student-friendly.
5. Provide steps in bullet points when applicable.

Context:
{context}

Student Question:
{question}

Answer:
"""
)

# =========================================================
# LLM
# =========================================================

llm = ChatOpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    model="deepseek/deepseek-v4-flash:free",
    max_tokens=1000
)

# =========================================================
# SECONDARY RAG / FALLBACK
# =========================================================

# (is_university_relevant removed for broader answering capabilities)

def exa_search_fallback(question: str) -> str:
    import re
    try:
        response = exa.answer(question)
        answer_text = response.answer
        
        # Extract markdown links from Exa's response
        links = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', answer_text)
        
        sources = []
        seen_urls = set()
        for title, url in links:
            if url not in seen_urls:
                sources.append(f"- [{title}]({url})")
                seen_urls.add(url)
                
        # Remove the citation blocks e.g., ([Title](url), [Title](url))
        answer_text = re.sub(r'\s*\((?:\[[^\]]+\]\((?:https?://[^\)]+)\)(?:,\s*)?)+\)', '', answer_text)
        # Also remove any remaining bare inline links like [Title](url) -> Title
        answer_text = re.sub(r'\[([^\]]+)\]\((https?://[^\)]+)\)', r'\1', answer_text)
        
        if sources:
            sources_text = "\n\n**Sources:**\n" + "\n".join(sources)
            answer_text += sources_text
            
        return answer_text
    except Exception as e:
        return f"Sorry, I couldn't find an answer. (Error: {str(e)})"

# =========================================================
# RAG FUNCTION
# =========================================================

def rag_answer(question: str) -> str:
    context = retrieve_context(question)

    if context is None:
        context = "" # Empty context for general questions

    chain = (
        {
            "context": lambda _: context,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    answer = chain.invoke(question)

    # Use Exa search as a powerful web fallback if the LLM still doesn't know
    fallback_triggers = [
        "don't know",
        "don’t know",
        "do not know",
        "I'm not sure",
        "I am not sure"
    ]
    
    answer_lower = answer.lower()
    
    # If the response indicates lack of knowledge, use Exa search
    if any(trigger in answer_lower for trigger in fallback_triggers):
        # We search the exact question since we are no longer limiting to VIT
        return exa_search_fallback(question)

    return answer

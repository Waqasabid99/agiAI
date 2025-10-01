"""
FastAPI Backend for RAG Chatbot
Connects the React frontend with the LangChain RAG system
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv()

# Configuration
FAISS_INDEX_PATH = "faiss_index"

# Initialize FastAPI app
app = FastAPI(title="AgiAI RAG Chatbot API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class Message(BaseModel):
    content: str
    role: str  # 'user' or 'bot'

class ChatRequest(BaseModel):
    content: str
    role: str = "user"
    conversation_history: Optional[List[Message]] = None

class ChatResponse(BaseModel):
    content: str
    role: str = "bot"
    sources: Optional[List[str]] = None

# Global variables for RAG system
rag_system = None
llm = None
conversation_histories = {}  # Store conversation histories per session

class RAGSystem:
    """RAG system with FAISS vector database"""
    
    def __init__(self):
        print("Initializing embeddings model...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        self.vectorstore = None
        print("Embeddings model loaded!")
    
    def load_existing_vectorstore(self):
        """Load existing FAISS vectorstore"""
        if not os.path.exists(FAISS_INDEX_PATH):
            raise FileNotFoundError(f"FAISS index not found at {FAISS_INDEX_PATH}")
        
        print(f"Loading existing FAISS index from {FAISS_INDEX_PATH}...")
        self.vectorstore = FAISS.load_local(
            FAISS_INDEX_PATH,
            self.embeddings,
            allow_dangerous_deserialization=True
        )
        print("FAISS index loaded successfully!")
    
    def retrieve_context(self, query, k=3):
        """Retrieve relevant context for a query"""
        if not self.vectorstore:
            return "", []
        
        docs = self.vectorstore.similarity_search(query, k=k)
        
        # Format context with sources
        context_parts = []
        sources = []
        
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get('source', 'Unknown')
            sources.append(source)
            context_parts.append(f"[Source {i}: {source}]\n{doc.page_content}")
        
        context = "\n\n".join(context_parts)
        return context, sources

@app.on_event("startup")
async def startup_event():
    """Initialize the RAG system and LLM on startup"""
    global rag_system, llm
    
    # Check for API key
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY not found in environment variables!")
    
    # Initialize LLM
    print("Initializing Groq LLM...")
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",  # Updated to a more common model
        temperature=0.7,
        max_tokens=1024
    )
    print("LLM initialized!")
    
    # Initialize RAG system
    rag_system = RAGSystem()
    
    try:
        rag_system.load_existing_vectorstore()
    except FileNotFoundError as e:
        print(f"Warning: {e}")
        print("Please run the scraper script first to create the FAISS index.")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "message": "AgiAI RAG Chatbot API is running",
        "rag_loaded": rag_system is not None and rag_system.vectorstore is not None
    }

@app.post("/getMsg", response_model=ChatResponse)
async def get_message(request: ChatRequest):
    """
    Main endpoint to process user messages and return bot responses
    """
    if not rag_system or not rag_system.vectorstore:
        raise HTTPException(
            status_code=503,
            detail="RAG system not initialized. Please ensure FAISS index exists."
        )
    
    if not llm:
        raise HTTPException(
            status_code=503,
            detail="LLM not initialized. Please check GROQ_API_KEY."
        )
    
    try:
        user_message = request.content.strip()
        
        if not user_message:
            raise HTTPException(status_code=400, detail="Message content cannot be empty")
        
        # Retrieve relevant context from RAG
        context, sources = rag_system.retrieve_context(user_message, k=3)
        
        # Create system prompt with context
        system_prompt = f"""You are AgiAI, a helpful and friendly AI assistant for Agiteks. 
Use the following context from the Agiteks website to answer the user's question accurately.
If the answer is not in the context, say so politely and provide a general helpful response.

Context from Agiteks website:
{context}

Be concise, friendly, professional, and accurate in your responses."""
        
        # Build messages for the LLM
        messages = [SystemMessage(content=system_prompt)]
        
        # Add conversation history if provided (last 6 messages)
        if request.conversation_history:
            recent_history = request.conversation_history[-6:]
            for msg in recent_history:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == "bot":
                    messages.append(AIMessage(content=msg.content))
        
        # Add current user message
        messages.append(HumanMessage(content=user_message))
        
        # Get response from LLM
        response = llm.invoke(messages)
        
        # Return response
        return ChatResponse(
            content=response.content,
            role="bot",
            sources=sources if sources else None
        )
    
    except Exception as e:
        print(f"Error processing message: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing your message: {str(e)}"
        )

@app.post("/reset")
async def reset_conversation():
    """Reset conversation history"""
    global conversation_histories
    conversation_histories = {}
    return {"status": "success", "message": "Conversation history cleared"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "rag_system": {
            "initialized": rag_system is not None,
            "vectorstore_loaded": rag_system.vectorstore is not None if rag_system else False
        },
        "llm": {
            "initialized": llm is not None
        }
    }

if __name__ == "__main__":
    import uvicorn
    
    # Run the server
    uvicorn.run(
        "main:app",  # Assuming this file is named main.py
        host="0.0.0.0",
        port=8000,
        reload=True  # Enable auto-reload during development
    )
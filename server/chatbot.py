"""
RAG Chatbot using LangChain, Groq, and FAISS
Scrapes agiteks.com and answers queries based on that data

Prerequisites:
pip install langchain langchain-groq langchain-community python-dotenv
pip install faiss-cpu beautifulsoup4 requests
pip install langchain-huggingface sentence-transformers
"""

import os
import pickle
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv()

# Configuration
WEBSITE_URL = "https://agiteks.com"
FAISS_INDEX_PATH = "faiss_index"
MAX_PAGES_TO_SCRAPE = 20

class WebsiteScraper:
    """Scrapes website content"""
    
    def __init__(self, base_url, max_pages=20):
        self.base_url = base_url
        self.max_pages = max_pages
        self.visited_urls = set()
        self.domain = urlparse(base_url).netloc
    
    def is_valid_url(self, url):
        """Check if URL belongs to the same domain"""
        parsed = urlparse(url)
        return parsed.netloc == self.domain
    
    def scrape_page(self, url):
        """Scrape content from a single page"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, timeout=10, headers=headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            
            # Get text content
            text = soup.get_text(separator=' ', strip=True)
            
            # Get all links for crawling
            links = []
            for link in soup.find_all('a', href=True):
                absolute_url = urljoin(url, link['href'])
                if self.is_valid_url(absolute_url) and absolute_url not in self.visited_urls:
                    links.append(absolute_url)
            
            return text, links
        
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return None, []
    
    def scrape_website(self):
        """Scrape multiple pages from the website"""
        to_visit = [self.base_url]
        documents = []
        
        print(f"Starting to scrape {self.base_url}...")
        
        while to_visit and len(self.visited_urls) < self.max_pages:
            url = to_visit.pop(0)
            
            if url in self.visited_urls:
                continue
            
            print(f"Scraping: {url} ({len(self.visited_urls) + 1}/{self.max_pages})")
            self.visited_urls.add(url)
            
            text, links = self.scrape_page(url)
            
            if text and len(text.strip()) > 100:
                documents.append({
                    'content': text,
                    'source': url
                })
            
            # Add new links to visit
            to_visit.extend([link for link in links if link not in self.visited_urls])
        
        print(f"\nScraped {len(documents)} pages successfully!")
        return documents

class RAGSystem:
    """RAG system with FAISS vector database"""
    
    def __init__(self):
        print("Initializing embeddings model...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        self.vectorstore = None
        print("Embeddings model loaded!")
    
    def process_and_store_documents(self, documents):
        """Split documents and store in FAISS"""
        print("\nProcessing documents...")
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        
        texts = []
        metadatas = []
        
        for doc in documents:
            chunks = text_splitter.split_text(doc['content'])
            texts.extend(chunks)
            metadatas.extend([{'source': doc['source']} for _ in chunks])
        
        print(f"Created {len(texts)} text chunks")
        
        # Create FAISS vectorstore
        print("Creating embeddings and storing in FAISS...")
        self.vectorstore = FAISS.from_texts(
            texts=texts,
            embedding=self.embeddings,
            metadatas=metadatas
        )
        
        # Save to disk
        print(f"Saving FAISS index to {FAISS_INDEX_PATH}...")
        self.vectorstore.save_local(FAISS_INDEX_PATH)
        
        print("Documents stored successfully!")
    
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
            return ""
        
        docs = self.vectorstore.similarity_search(query, k=k)
        
        # Format context with sources
        context_parts = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get('source', 'Unknown')
            context_parts.append(f"[Source {i}: {source}]\n{doc.page_content}")
        
        context = "\n\n".join(context_parts)
        return context

def chatbot_with_rag():
    """Main chatbot function with RAG"""
    print("=" * 50)
    print("RAG Chatbot (Groq + LangChain + FAISS)")
    print("=" * 50)
    
    # Initialize LLM
    llm = ChatGroq(
        model="openai/gpt-oss-20b", 
        temperature=0.7,
        max_tokens=1024
    )
    
    # Initialize RAG system
    rag = RAGSystem()
    
    # Check if we need to scrape and index
    print("\nChecking for existing FAISS index...")
    
    if os.path.exists(FAISS_INDEX_PATH):
        choice = input("FAISS index found. Do you want to re-scrape the website? (y/n): ").strip().lower()
        
        if choice == 'y':
            # Scrape website
            scraper = WebsiteScraper(WEBSITE_URL, max_pages=MAX_PAGES_TO_SCRAPE)
            documents = scraper.scrape_website()
            
            if documents:
                rag.process_and_store_documents(documents)
            else:
                print("No documents scraped. Exiting...")
                return
        else:
            # Load existing vectorstore
            try:
                rag.load_existing_vectorstore()
            except Exception as e:
                print(f"Error loading vectorstore: {e}")
                print("Please re-scrape the website.")
                return
    else:
        print("No existing FAISS index found. Scraping website...")
        # Scrape website
        scraper = WebsiteScraper(WEBSITE_URL, max_pages=MAX_PAGES_TO_SCRAPE)
        documents = scraper.scrape_website()
        
        if documents:
            rag.process_and_store_documents(documents)
        else:
            print("No documents scraped. Exiting...")
            return
    
    print("\n" + "=" * 50)
    print("Chatbot ready! Ask questions about Agiteks.")
    print("Type 'quit', 'exit', or 'bye' to end\n")
    
    # Initialize conversation history
    conversation_history = []
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() in ['quit', 'exit', 'bye']:
            print("Chatbot: Goodbye! Have a great day!")
            break
        
        if not user_input:
            continue
        
        try:
            # Retrieve relevant context
            context = rag.retrieve_context(user_input, k=3)
            
            # Create prompt with context
            system_prompt = f"""You are a helpful AI assistant for Agiteks. 
Use the following context from the Agiteks website to answer the user's question.
If the answer is not in the context, say so and provide a general helpful response.

Context from Agiteks website:
{context}

Be concise, friendly, and accurate."""
            
            # Build messages
            messages = [SystemMessage(content=system_prompt)]
            messages.extend(conversation_history[-6:])  # Keep last 3 exchanges
            messages.append(HumanMessage(content=user_input))
            
            # Get response
            response = llm.invoke(messages)
            
            # Update conversation history
            conversation_history.append(HumanMessage(content=user_input))
            conversation_history.append(AIMessage(content=response.content))
            
            print(f"Chatbot: {response.content}\n")
            
        except Exception as e:
            print(f"Error: {e}\n")

if __name__ == "__main__":
    # Check environment variables
    if not os.getenv("GROQ_API_KEY"):
        print("Error: GROQ_API_KEY not found!")
        api_key = input("Enter your Groq API key: ").strip()
        if api_key:
            os.environ["GROQ_API_KEY"] = api_key
        else:
            exit(1)
    
    # Run chatbot
    chatbot_with_rag()
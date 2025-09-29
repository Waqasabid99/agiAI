// chatbot.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { EmbeddingStore } = require("./embedStore");
const { scrapeWebsite } = require("./scraper");

// Create Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: "*", // Or specify allowed domains
    methods: ["POST", "GET"],
    credentials: true,
  })
);
app.use(express.json());

// Ollama configuration
const OLLAMA_BASE_URL = "http://localhost:11434";
const LLM_MODEL = "llama3.2:1b";

// Initialize embedding store
const embedStore = new EmbeddingStore("./vector_db");

// Track initialization
let isInitialized = false;

/**
 * Initialize the chatbot system
 */
async function initializeChatbot() {
  try {
    await embedStore.initialize();
    isInitialized = true;
    console.log("Chatbot initialized successfully");
  } catch (error) {
    console.error("Failed to initialize chatbot:", error.message);
    throw error;
  }
}

/**
 * Generate response using Ollama LLM
 */
async function generateLLMResponse(prompt, context) {
  try {
    const systemPrompt = `You are a helpful assistant that answers questions based solely on the provided context from a website.

IMPORTANT RULES:
1. Only answer based on the context provided below
2. If the answer cannot be found in the context, say: "I could not find that information on the website."
3. Be concise and accurate
4. Do not make up information
5. If relevant, you can mention which part of the website the information comes from

Context:
${context}`;

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: LLM_MODEL,
        prompt: `${systemPrompt}\n\nUser Question: ${prompt}\n\nAnswer:`,
        stream: false,
      },
      { timeout: 60000 }
    );

    return response.data.response;
  } catch (error) {
    console.error("Error generating LLM response:", error.message);
    throw error;
  }
}

/**
 * Process user query with RAG pipeline
 */
async function processQuery(userQuery) {
  try {
    // Step 1: Retrieve relevant chunks
    const relevantChunks = await embedStore.searchSimilar(userQuery, 5);

    if (relevantChunks.length === 0) {
      return {
        answer:
          "I could not find that information on the website. The knowledge base might be empty or your question might not be covered.",
        sources: [],
      };
    }

    // Step 2: Prepare context from retrieved chunks
    const context = relevantChunks
      .map((chunk, idx) => `[Source ${idx + 1}]: ${chunk.text}`)
      .join("\n\n");

    console.log(`Retrieved ${relevantChunks.length} relevant chunks`);

    // Step 3: Generate answer using LLM
    const answer = await generateLLMResponse(userQuery, context);

    // Step 4: Prepare sources
    const sources = relevantChunks.map((chunk, idx) => ({
      index: idx + 1,
      text: chunk.text.substring(0, 200) + "...",
      url: chunk.url,
      title: chunk.title,
      relevanceScore: chunk.score,
    }));

    return {
      answer,
      sources,
    };
  } catch (error) {
    console.error("Error processing query:", error.message);
    throw error;
  }
}

/**
 * POST /getMsg - Main chatbot endpoint
 */
app.post("/getMsg", async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({
        error: "Chatbot is not initialized yet. Please wait.",
      });
    }

    const { content, role } = req.body;

    if (!content || role !== "user") {
      return res.status(400).json({
        error: 'Invalid request. Expected { content: string, role: "user" }',
      });
    }

    console.log(`Received query: ${content}`);

    // Process the query through RAG pipeline
    const result = await processQuery(content);

    res.json({
      role: "assistant",
      content: result.answer,
      sources: result.sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /getMsg:", error.message);
    res.status(500).json({
      error: "An error occurred while processing your request",
      details: error.message,
    });
  }
});

/**
 * POST /scrape - Scrape and index a website
 */
app.post("/scrape", async (req, res) => {
  try {
    const url = "https://agiteks.com";
    const { isDynamic = false } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
      });
    }

    console.log(`Starting scrape for: ${url}`);

    // Scrape the website
    const scrapedData = await scrapeWebsite(url, isDynamic);

    // Store chunks in vector database
    const count = await embedStore.storeChunks(scrapedData.chunks, {
      url: scrapedData.url,
      title: scrapedData.title,
    });

    res.json({
      message: "Website scraped and indexed successfully",
      url: scrapedData.url,
      title: scrapedData.title,
      chunksStored: count,
      timestamp: scrapedData.scrapedAt,
    });
  } catch (error) {
    console.error("Error in /scrape:", error.message);
    res.status(500).json({
      error: "Failed to scrape website",
      details: error.message,
    });
  }
});

/**
 * GET /status - Check chatbot status
 */
app.get("/status", async (req, res) => {
  try {
    const count = await embedStore.getCount();

    res.json({
      status: "running",
      initialized: isInitialized,
      chunksInDatabase: count,
      ollamaUrl: OLLAMA_BASE_URL,
      embeddingModel: "mxbai-embed-large",
      llmModel: LLM_MODEL,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error getting status",
      details: error.message,
    });
  }
});

/**
 * DELETE /clear - Clear all data from database
 */
app.delete("/clear", async (req, res) => {
  try {
    await embedStore.clearAll();
    await embedStore.initialize();

    res.json({
      message: "Database cleared successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Error clearing database",
      details: error.message,
    });
  }
});

/**
 * Start the server
 */
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize the chatbot system
    await initializeChatbot();

    // Start Express server
    app.listen(PORT, () => {
      console.log(
        `\n🤖 RAG Chatbot Server running on port http://localhost:${PORT}`
      );
      console.log(`\nAvailable endpoints:`);
      console.log(`  POST /getMsg    - Send a message to the chatbot`);
      console.log(`  POST /scrape    - Scrape and index a website`);
      console.log(`  GET  /status    - Check system status`);
      console.log(`  DELETE /clear   - Clear all data\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;

// chatbot.js
require("dotenv").config();
const express = require("express");
const Groq = require("groq-sdk");
const cors = require("cors");
const { Pinecone } = require("@pinecone-database/pinecone");
const { scrapeWebsite } = require("./scraper");

// Create Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: "*", 
    methods: ["POST", "GET"],
    credentials: true,
  })
);
app.use(express.json());

// Groq configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const LLM_MODEL = "openai/gpt-oss-20b";
const PINECONE_INDEX_NAME = "chatbot";

if (!GROQ_API_KEY) {
  console.error("ERROR: GROQ_API_KEY environment variable is not set!");
  console.error("Please set it using: export GROQ_API_KEY='your-api-key-here'");
  process.exit(1);
}

if (!PINECONE_API_KEY) {
  console.error("ERROR: PINECONE_API_KEY environment variable is not set!");
  console.error("Please set it using: export PINECONE_API_KEY='your-api-key-here'");
  process.exit(1);
}

// Initialize Groq client
const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

// Track initialization
let isInitialized = false;
let pineconeIndex = null;

/**
 * Generate embeddings using Pinecone's inference API
 */
async function generateEmbedding(text) {
  try {
    const embeddings = await pinecone.inference.embed(
      "llama-text-embed-v2",
      [text],
      { inputType: "passage" }
    );
    
    return embeddings[0].values;
  } catch (error) {
    console.error("Error generating embedding:", error.message);
    throw error;
  }
}

/**
 * Initialize the chatbot system
 */
async function initializeChatbot() {
  try {
    // Get the Pinecone index
    pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);
    
    isInitialized = true;
    console.log("Chatbot initialized successfully");
    console.log(`Connected to Pinecone index: ${PINECONE_INDEX_NAME}`);
  } catch (error) {
    console.error("Failed to initialize chatbot:", error.message);
    throw error;
  }
}

/**
 * Store chunks in Pinecone
 */
async function storeChunks(chunks, metadata) {
  try {
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      
      vectors.push({
        id: `chunk_${Date.now()}_${i}`,
        values: embedding,
        metadata: {
          text: chunk,
          url: metadata.url,
          title: metadata.title,
          timestamp: new Date().toISOString(),
        },
      });
      
      // Log progress
      if ((i + 1) % 10 === 0) {
        console.log(`Generated embeddings for ${i + 1}/${chunks.length} chunks`);
      }
    }
    
    // Upsert vectors to Pinecone in batches
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await pineconeIndex.upsert(batch);
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
    }
    
    return vectors.length;
  } catch (error) {
    console.error("Error storing chunks:", error.message);
    throw error;
  }
}

/**
 * Search for similar chunks in Pinecone
 */
async function searchSimilar(query, topK = 5) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search in Pinecone
    const results = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
    });
    
    // Format results
    return results.matches.map(match => ({
      text: match.metadata.text,
      url: match.metadata.url,
      title: match.metadata.title,
      score: match.score,
    }));
  } catch (error) {
    console.error("Error searching similar chunks:", error.message);
    throw error;
  }
}

/**
 * Get count of vectors in Pinecone
 */
async function getCount() {
  try {
    const stats = await pineconeIndex.describeIndexStats();
    return stats.totalRecordCount || 0;
  } catch (error) {
    console.error("Error getting count:", error.message);
    return 0;
  }
}

/**
 * Clear all vectors from Pinecone
 */
async function clearAll() {
  try {
    await pineconeIndex.deleteAll();
    console.log("All vectors cleared from Pinecone");
  } catch (error) {
    console.error("Error clearing vectors:", error.message);
    throw error;
  }
}

/**
 * Generate response using Groq LLM
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

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: LLM_MODEL,
      temperature: 0.3,
      max_tokens: 1024,
      top_p: 0.9,
    });

    return completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating LLM response:", error.message);
    if (error.status === 401) {
      throw new Error("Invalid Groq API key. Please check your GROQ_API_KEY environment variable.");
    }
    if (error.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw error;
  }
}

/**
 * Process user query with RAG pipeline
 */
async function processQuery(userQuery) {
  try {
    // Step 1: Retrieve relevant chunks
    const relevantChunks = await searchSimilar(userQuery, 5);

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

    // Store chunks in Pinecone
    const count = await storeChunks(scrapedData.chunks, {
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
    const count = await getCount();

    res.json({
      status: "running",
      initialized: isInitialized,
      chunksInDatabase: count,
      vectorDB: "Pinecone",
      indexName: PINECONE_INDEX_NAME,
      embeddingModel: "llama-text-embed-v2",
      llmModel: LLM_MODEL,
      apiKeysConfigured: {
        groq: !!GROQ_API_KEY,
        pinecone: !!PINECONE_API_KEY,
      },
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
    await clearAll();

    res.json({
      message: "Pinecone index cleared successfully",
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
        `\n🤖 RAG Chatbot Server (Groq + Pinecone) running on http://localhost:${PORT}`
      );
      console.log(`\nAvailable endpoints:`);
      console.log(`  POST /getMsg    - Send a message to the chatbot`);
      console.log(`  POST /scrape    - Scrape and index a website`);
      console.log(`  GET  /status    - Check system status`);
      console.log(`  DELETE /clear   - Clear all data`);
      console.log(`\nUsing:`);
      console.log(`  LLM: ${LLM_MODEL} (Groq)`);
      console.log(`  Vector DB: Pinecone (${PINECONE_INDEX_NAME})`);
      console.log(`  Embeddings: llama-text-embed-v2 (Pinecone)\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
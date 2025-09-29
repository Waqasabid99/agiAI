// embedStore.js
const axios = require('axios');
const lancedb = require('vectordb');
const path = require('path');

// Ollama configuration
const OLLAMA_BASE_URL = 'http://localhost:11434';
const EMBEDDING_MODEL = 'mxbai-embed-large';

class EmbeddingStore {
  constructor(dbPath = './vector_db') {
    this.dbPath = dbPath;
    this.db = null;
    this.table = null;
    this.tableName = 'website_chunks';
  }

  /**
   * Initialize the vector database
   */
  async initialize() {
    try {
      console.log('Initializing LanceDB...');
      this.db = await lancedb.connect(this.dbPath);
      
      // Check if table exists
      const tableNames = await this.db.tableNames();
      
      if (tableNames.includes(this.tableName)) {
        console.log(`Loading existing table: ${this.tableName}`);
        this.table = await this.db.openTable(this.tableName);
      } else {
        console.log(`Table ${this.tableName} will be created on first insert`);
      }
      
      console.log('LanceDB initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error.message);
      throw error;
    }
  }

  /**
   * Generate embedding using Ollama
   */
  async generateEmbedding(text) {
    try {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/embeddings`,
        {
          model: EMBEDDING_MODEL,
          prompt: text
        },
        { timeout: 30000 }
      );

      return response.data.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Store chunks with their embeddings in the vector database
   */
  async storeChunks(chunks, metadata = {}) {
    try {
      console.log(`Generating embeddings for ${chunks.length} chunks...`);
      
      const records = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
        
        const embedding = await generateEmbedding(chunk);
        
        records.push({
          text: chunk,
          vector: embedding,
          url: metadata.url || '',
          title: metadata.title || '',
          chunk_index: i,
          created_at: new Date().toISOString()
        });
        
        // Small delay to avoid overwhelming Ollama
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create or append to table
      if (!this.table) {
        console.log(`Creating new table: ${this.tableName}`);
        this.table = await this.db.createTable(this.tableName, records);
      } else {
        console.log(`Adding records to existing table: ${this.tableName}`);
        await this.table.add(records);
      }

      console.log(`Successfully stored ${records.length} chunks in database`);
      return records.length;
    } catch (error) {
      console.error('Error storing chunks:', error.message);
      throw error;
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilar(query, topK = 5) {
    try {
      if (!this.table) {
        console.log('No data in database yet');
        return [];
      }

      console.log(`Searching for: "${query}"`);
      
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);
      
      // Perform vector search
      const results = await this.table
        .search(queryEmbedding)
        .limit(topK)
        .execute();

      console.log(`Found ${results.length} relevant chunks`);
      
      return results.map(result => ({
        text: result.text,
        score: result._distance,
        url: result.url,
        title: result.title,
        chunk_index: result.chunk_index
      }));
    } catch (error) {
      console.error('Error searching database:', error.message);
      throw error;
    }
  }

  /**
   * Delete all chunks from a specific URL
   */
  async deleteByUrl(url) {
    try {
      if (!this.table) {
        console.log('No table to delete from');
        return;
      }

      await this.table.delete(`url = '${url}'`);
      console.log(`Deleted all chunks from ${url}`);
    } catch (error) {
      console.error('Error deleting chunks:', error.message);
      throw error;
    }
  }

  /**
   * Get total count of stored chunks
   */
  async getCount() {
    try {
      if (!this.table) return 0;
      
      const count = await this.table.countRows();
      return count;
    } catch (error) {
      console.error('Error getting count:', error.message);
      return 0;
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAll() {
    try {
      if (this.table) {
        await this.db.dropTable(this.tableName);
        this.table = null;
        console.log('Database cleared');
      }
    } catch (error) {
      console.error('Error clearing database:', error.message);
      throw error;
    }
  }
}

/**
 * Standalone function to generate embeddings (can be used outside class)
 */
async function generateEmbedding(text) {
  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/embeddings`,
      {
        model: EMBEDDING_MODEL,
        prompt: text
      },
      { timeout: 30000 }
    );

    return response.data.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

module.exports = {
  EmbeddingStore,
  generateEmbedding
};
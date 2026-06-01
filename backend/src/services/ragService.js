// backend/src/services/ragService.js
const axios = require('axios');
const KnowledgeBase = require('../models/KnowledgeBase');

class RagService {
  constructor() {
    this.huggingFaceApiUrl = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';
  }

  async embedText(text) {
    try {
      const response = await axios.post(
        this.huggingFaceApiUrl,
        { inputs: text },
        { headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` } }
      );
      return response.data;
    } catch (error) {
      console.error("Error embedding text:", error);
      throw error;
    }
  }

  async searchContext(query, category) {
    const queryVector = await this.embedText(query);
    const results = await KnowledgeBase.aggregate([
      {
        $vectorSearch: {
          index: "default", // IMPORTANT: Ensure this matches the index name created in Atlas
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit: 3,
          filter: { category: category }
        }
      },
      {
        $project: {
          text: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]);
    return results;
  }

  async generateAnswer(query, context) {
    try {
      const groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama3-8b-8192',
          messages: [
            { role: 'system', content: 'You are an expert in the Lorek language. Answer based on the provided context.' },
            { role: 'user', content: `Context: ${JSON.stringify(context)}\n\nQuestion: ${query}` }
          ]
        },
        { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
      );
      return groqResponse.data.choices[0].message.content;
    } catch (error) {
      console.error("Error calling Groq API:", error);
      throw error;
    }
  }
}

module.exports = new RagService();

// backend/scripts/generateEmbeddings.js
const KnowledgeBase = require('../src/models/KnowledgeBase');
const ragService = require('../src/services/ragService');
const mongoose = require('mongoose');
require('dotenv').config(); // Loads .env from the current working directory

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");
    
    console.log("Embedding service initialized.");
    console.log("Checking HF_API_KEY:", process.env.HF_API_KEY ? "Loaded" : "Missing");

    const docs = await KnowledgeBase.find({ $or: [ { embedding: { $exists: false } }, { embedding: [] } ] });
    console.log(`Found ${docs.length} documents needing embeddings.`);

    for (const doc of docs) {
      const vector = await ragService.embedText(doc.text);
      await KnowledgeBase.updateOne({ _id: doc._id }, { $set: { embedding: vector } });
      console.log(`Embedded doc: ${doc._id}`);
    }
  } catch (error) {
    console.error("Error generating embeddings:", error);
  } finally {
    process.exit();
  }
}

run();

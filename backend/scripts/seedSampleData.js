// backend/scripts/seedSampleData.js
const mongoose = require('mongoose');
const KnowledgeBase = require('../src/models/KnowledgeBase');
require('dotenv').config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const sample = await KnowledgeBase.create({
      text: "Hello in Lorek is 'Ayo'",
      category: "vocabulary",
      metadata: { source: "manual_test" }
    });

    console.log(`Sample document seeded: ${sample._id}`);
  } catch (error) {
    console.error("Error seeding sample data:", error);
  } finally {
    process.exit();
  }
}

seed();

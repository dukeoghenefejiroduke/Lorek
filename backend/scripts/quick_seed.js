const mongoose = require('mongoose');
const MONGO_URI = "mongodb+srv://Izon:learnizon@izon.xsueirm.mongodb.net/?appName=Izon";

const Lesson = require('../src/models/Lesson');
const Unit = require('../src/models/Unit');
const Language = require('../models/Language');
const Module = require('../models/Module');

async function quickSeed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB!");
  
  const izon = await Language.findOne({ code: 'IZON' });
  if (!izon) {
    console.error("Izon language not found!");
    process.exit(1);
  }
  
  // Seed basic content for one unit
  const mod = await Module.create({ title: { izon: "Unit 1", english: "Unit 1" }, level: 'beginner' });
  const unit = await Unit.create({ title: "Unit 1 — Greetings", sectionId: new mongoose.Types.ObjectId() });
  
  await Lesson.create({
    title: { izon: "Basic Greetings", english: "Basic Greetings" },
    language_id: izon._id,
    level: 'beginner',
    lessonType: 'vocabulary',
    category: 'greetings',
    order: 1,
    status: 'published',
    moduleId: mod._id,
    content: {
      introduction: { english: "Learn common Izon greetings." },
      examples: [{ izon: "Wari", english: "Hello" }]
    },
    createdBy: new mongoose.Types.ObjectId()
  });
  
  console.log("Quick seed complete!");
  process.exit(0);
}
quickSeed();

require('dotenv').config();
const mongoose = require('mongoose');

const Language = require('../src/models/Language');
const Vocabulary = require('../src/models/Vocabulary');
const Lesson = require('../src/models/Lesson');
const Proverb = require('../src/models/Proverb');
const CulturalContent = require('../src/models/CulturalContent');

async function clearDb() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set');
    process.exit(1);
  }

  try {
    console.log('⚠️ WARNING: This will permanently delete ALL content data.');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Language.deleteMany({});
    await Vocabulary.deleteMany({});
    await Lesson.deleteMany({});
    await Proverb.deleteMany({});
    await CulturalContent.deleteMany({});

    console.log('Collections cleared: Languages, Vocabulary, Lessons, Proverbs, CulturalContent');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
}

clearDb();

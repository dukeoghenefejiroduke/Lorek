require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('./src/models/Language');
const Vocabulary = require('./src/models/Vocabulary');
const Lesson = require('./src/models/Lesson');
const Proverb = require('./src/models/Proverb');
const CulturalContent = require('./src/models/CulturalContent');

async function checkCounts() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/izon_db');
    console.log('Connected to MongoDB');

    const languages = await Language.find();
    console.log(`Languages: ${languages.length}`);

    for (const lang of languages) {
      console.log(`--- ${lang.name} ---`);
      const vocabCount = await Vocabulary.countDocuments({ language_id: lang._id });
      const lessonCount = await Lesson.countDocuments({ language_id: lang._id });
      const proverbCount = await Proverb.countDocuments({ language_id: lang._id });
      const culturalCount = await CulturalContent.countDocuments({ language_id: lang._id });
      
      console.log(`Vocabulary: ${vocabCount}`);
      console.log(`Lessons: ${lessonCount}`);
      console.log(`Proverbs: ${proverbCount}`);
      console.log(`CulturalContent: ${culturalCount}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCounts();

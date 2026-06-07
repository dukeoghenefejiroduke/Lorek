require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('./src/models/Language');
const Lesson = require('./src/models/Lesson');
const Proverb = require('./src/models/Proverb');
const CulturalContent = require('./src/models/CulturalContent');

async function inspectSamples() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/izon_db');
    
    const izonLang = await Language.findOne({ code: 'IZON' });
    
    const lesson = await Lesson.findOne({ language_id: izonLang._id });
    const proverb = await Proverb.findOne({ language_id: izonLang._id });
    const culture = await CulturalContent.findOne({ language_id: izonLang._id });
    
    console.log('Sample Lesson:', JSON.stringify(lesson, null, 2));
    console.log('Sample Proverb:', JSON.stringify(proverb, null, 2));
    console.log('Sample Culture:', JSON.stringify(culture, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectSamples();

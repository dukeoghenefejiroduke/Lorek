require('dotenv').config();
const mongoose = require('mongoose');
const Vocabulary = require('./src/models/Vocabulary');
const Language = require('./src/models/Language');

async function inspectIzonData() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/izon_db');
    
    const izonLang = await Language.findOne({ code: 'IZON' });
    if (!izonLang) {
      console.log('Izon language not found');
      process.exit(0);
    }
    
    const sample = await Vocabulary.find({ language_id: izonLang._id }).limit(2);
    console.log('Sample Izon Vocabulary:', JSON.stringify(sample, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectIzonData();

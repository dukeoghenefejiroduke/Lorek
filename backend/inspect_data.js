require('dotenv').config();
const mongoose = require('mongoose');
const Vocabulary = require('./src/models/Vocabulary');

async function inspectData() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/izon_db');
    const sample = await Vocabulary.findOne().limit(1);
    console.log('Sample Vocabulary:', JSON.stringify(sample, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectData();

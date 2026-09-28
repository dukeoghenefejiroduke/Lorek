require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('./src/models/Language');

async function inspectLanguages() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri);
    const languages = await Language.find({});
    console.log('--- All Languages in DB ---');
    console.log(`Total languages found: ${languages.length}`);
    languages.forEach(l => {
      console.log(`- Code: ${l.code}, Name: ${l.name}, isActive: ${l.isActive}, isPublished: ${l.isPublished}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

inspectLanguages();

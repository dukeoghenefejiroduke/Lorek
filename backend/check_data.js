require('dotenv').config();
const mongoose = require('mongoose');
const Proverb = require('./src/models/Proverb');
const CulturalContent = require('./src/models/CulturalContent');
const Vocabulary = require('./src/models/Vocabulary');

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const proverbsWithoutLanguage = await Proverb.find({ $or: [ { language_id: { $exists: false } }, { language_id: null } ] });

    const contentWithoutLanguage = await CulturalContent.find({ $or: [ { language_id: { $exists: false } }, { language_id: null } ] });

    const vocabWithoutLanguage = await Vocabulary.find({ $or: [ { language_id: { $exists: false } }, { language_id: null } ] });

    if (vocabWithoutLanguage.length > 0) {
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();

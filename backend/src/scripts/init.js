const mongoose = require('mongoose');
const Vocabulary = require('../models/Vocabulary');
require('dotenv').config();

const optimizeDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // Create text index for the Translator & Search
    await Vocabulary.collection.createIndex({ izonWord: 'text', englishTranslation: 'text' });
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
optimizeDB();

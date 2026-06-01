require('dotenv').config();
const mongoose = require('mongoose');
const Proverb = require('./src/models/Proverb');

async function checkProverbs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const proverbsWithoutLanguage = await Proverb.find({ language_id: { $exists: false } });

    if (proverbsWithoutLanguage.length > 0) {
    }

    const allProverbs = await Proverb.find({});
    
    // Check for null language_id too
    const proverbsWithNullLanguage = await Proverb.find({ language_id: null });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProverbs();

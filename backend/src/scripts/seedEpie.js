require('dotenv').config();
const mongoose = require('mongoose');
const Vocabulary = require('../models/Vocabulary');
const Language = require('../models/Language');
const User = require('../models/User');

const epieWords = [
  { izonWord: "kọlọ", englishTranslation: "House", category: "other", difficulty: "beginner" },
  { izonWord: "ọmọ", englishTranslation: "Mother", category: "family", difficulty: "beginner" },
  { izonWord: "ọba", englishTranslation: "Father", category: "family", difficulty: "beginner" },
  { izonWord: "nẹi", englishTranslation: "Four", category: "numbers", difficulty: "beginner" },
  { izonWord: "sọnọ", englishTranslation: "Five", category: "numbers", difficulty: "beginner" },
];

async function seedEpie() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const epieLanguage = await Language.findOne({ code: 'EPIE' });
    if (!epieLanguage) {
      console.error('Epie language not found. Please run LanguageSeed.js first.');
      process.exit(1);
    }

    const admin = await User.findOne({ role: 'admin' });
    const adminId = admin ? admin._id : new mongoose.Types.ObjectId();

    for (const word of epieWords) {
      await Vocabulary.findOneAndUpdate(
        { izonWord: word.izonWord, language_id: epieLanguage._id },
        { 
          ...word, 
          language_id: epieLanguage._id,
          createdBy: adminId, 
          isPublished: true, 
          verificationStatus: 'verified' 
        },
        { upsert: true, new: true }
      );
    }
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedEpie();

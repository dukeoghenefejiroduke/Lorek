require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Vocabulary = require('../models/Vocabulary');
const Language = require('../models/Language');
const izonLookup = require('../translation/packs/izo/IzonLookup.json');
const englishReverseLookup = require('../translation/packs/izo/EnglishReverseLookup.json');

async function seedVocabulary() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Ensure Izon language exists
    let lang = await Language.findOne({ code: 'IZON' });
    if (!lang) {
      lang = await Language.create({
        code: 'IZON',
        name: 'Izon',
        nativeName: 'Ịzọn',
        description: 'Izon language pack',
        isDefault: true,
        isActive: true
      });
      console.log('Created Izon language record.');
    }

    const adminId = new mongoose.Types.ObjectId();

    // Clear existing vocabulary to sync directly with translation dictionary
    await Vocabulary.deleteMany({});
    console.log('Cleared existing vocabulary collection for clean dictionary sync.');

    console.log(`Processing ${izonLookup.length} dictionary entries from IzonLookup.json...`);

    // Build reverse map from Izon word to English translation(s)
    const izonToEnglish = {};
    for (const [engWord, izonList] of Object.entries(englishReverseLookup)) {
      if (Array.isArray(izonList)) {
        for (const izonWord of izonList) {
          const cleanIzon = izonWord.toLowerCase().trim();
          if (!izonToEnglish[cleanIzon]) {
            izonToEnglish[cleanIzon] = [];
          }
          if (!izonToEnglish[cleanIzon].includes(engWord)) {
            izonToEnglish[cleanIzon].push(engWord);
          }
        }
      }
    }

    const vocabularyDocs = [];
    const seenWords = new Set();

    for (const item of izonLookup) {
      const izonWord = item.izon_context ? item.izon_context.trim() : '';
      if (!izonWord || seenWords.has(izonWord.toLowerCase())) continue;
      seenWords.add(izonWord.toLowerCase());

      const rawText = item.text || '';
      const cleanIzon = izonWord.toLowerCase();
      let englishTrans = '';
      if (izonToEnglish[cleanIzon] && izonToEnglish[cleanIzon].length > 0) {
        englishTrans = izonToEnglish[cleanIzon].join(', ');
      } else {
        englishTrans = rawText.split('.')[0] || 'Translation unavailable';
      }

      let category = 'other';
      const lowerText = rawText.toLowerCase();
      if (lowerText.includes('call') || lowerText.includes('speak') || lowerText.includes('word')) category = 'greetings';
      else if (lowerText.includes('food') || lowerText.includes('eat') || lowerText.includes('cook')) category = 'food';
      else if (lowerText.includes('family') || lowerText.includes('mother') || lowerText.includes('father') || lowerText.includes('child')) category = 'family';
      else if (lowerText.includes('number') || lowerText.includes('one') || lowerText.includes('two')) category = 'numbers';

      vocabularyDocs.push({
        language_id: lang._id,
        izonWord: izonWord,
        englishTranslation: englishTrans,
        category: category,
        difficulty: izonWord.length > 8 ? 'intermediate' : 'beginner',
        examples: rawText ? [{ izon: izonWord, english: rawText }] : [],
        audioAvailable: false,
        verified: true,
        isPublished: true,
        isActive: true,
        createdBy: adminId
      });
    }

    console.log(`Prepared ${vocabularyDocs.length} vocabulary documents to seed.`);

    const result = await Vocabulary.insertMany(vocabularyDocs);
    console.log(`Vocabulary successfully seeded from translation dictionary! Total: ${result.length} words.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding vocabulary from dictionary:', error);
    process.exit(1);
  }
}

seedVocabulary();

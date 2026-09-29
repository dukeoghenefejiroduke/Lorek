require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const Vocabulary = require('../../models/Vocabulary');
const Language = require('../../models/Language');
const ogbiaLookup = require('../../translation/packs/ogb/ogbiaLookup.json');

async function seedOgbiaVocabulary() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    let lang = await Language.findOne({ code: 'OGBIA' });
    if (!lang) {
      lang = await Language.create({
        code: 'OGBIA',
        name: 'Ogbia',
        nativeName: 'Ọgbiạ',
        description: 'Ogbia language pack',
        isDefault: false,
        isActive: true
      });
    }
    const adminId = new mongoose.Types.ObjectId();
    await Vocabulary.deleteMany({ language_id: lang._id });
    const entries = ogbiaLookup.entries || ogbiaLookup;
    const vocabularyDocs = [];
    const seenWords = new Set();
    const validCategories = ['greetings', 'family', 'verbs', 'food', 'animals', 'nature', 'numbers', 'time', 'colors', 'body_parts', 'clothing', 'household', 'emotions', 'actions', 'professions', 'education', 'religion', 'traditions', 'music', 'dance', 'festivals', 'proverbs', 'idioms', 'other'];

    if (Array.isArray(entries)) {
      for (const item of entries) {
        const ogbiaWord = item.ogbia ? item.ogbia.trim() : '';
        if (!ogbiaWord || seenWords.has(ogbiaWord.toLowerCase())) continue;
        seenWords.add(ogbiaWord.toLowerCase());
        const englishTrans = item.english || 'Translation unavailable';
        const rawCategory = item.category ? item.category.toLowerCase() : 'other';
        const category = validCategories.includes(rawCategory) ? rawCategory : 'other';
        vocabularyDocs.push({
          language_id: lang._id,
          izonWord: ogbiaWord,
          englishTranslation: englishTrans,
          category: category,
          difficulty: ogbiaWord.length > 8 ? 'intermediate' : 'beginner',
          examples: [{ izon: ogbiaWord, english: englishTrans }],
          audioAvailable: false,
          verified: true,
          isPublished: true,
          isActive: true,
          createdBy: adminId
        });
      }
    }
    if (vocabularyDocs.length > 0) {
      await Vocabulary.insertMany(vocabularyDocs);
      console.log(`Ogbia vocabulary successfully seeded! Total: ${vocabularyDocs.length} words.`);
    }
  } catch (error) {
    console.error('⚠️ Vocabulary seed error:', error);
  }
  process.exit(0);
}

seedOgbiaVocabulary();

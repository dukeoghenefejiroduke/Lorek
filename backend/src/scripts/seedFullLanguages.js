require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('../models/Language');
const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const Proverb = require('../models/Proverb');
const User = require('../models/User');

const seedData = [
  {
    language: { code: 'IZON', name: 'Izon', nativeName: 'Ịzọn', description: 'Major language of the Ijaw people.', icon: '🌊', color: '#4CAF50' },
    vocabulary: [
      { izonWord: 'Bara', englishTranslation: 'Hand', category: 'body', difficulty: 'beginner' },
      { izonWord: 'Kiri', englishTranslation: 'Land', category: 'nature', difficulty: 'beginner' }
    ],
    lessons: [
      { title: { english: 'Greetings', izon: 'Gban-gban' }, description: { english: 'Learn basic greetings' }, level: 1, category: 'basics' }
    ],
    proverbs: [
      { izon: 'Bara bo keme fa', english: 'A person with no hands is not a person', meaning: 'Everyone needs help', category: 'wisdom', difficulty: 'intermediate' }
    ]
  },
  {
    language: { code: 'EPIE', name: 'Epie', nativeName: 'Epie', description: 'Edoid language.', icon: '🌳', color: '#9C27B0' },
    vocabulary: [
      { izonWord: 'Oma', englishTranslation: 'Sun', category: 'nature', difficulty: 'beginner' }
    ],
    lessons: [
      { title: { english: 'Nature Basics', izon: 'Oma-ma' }, description: { english: 'Learn about nature' }, level: 1, category: 'nature' }
    ],
    proverbs: [
      { izon: 'Oma fa', english: 'The sun is out', meaning: 'It is a new day', category: 'nature', difficulty: 'beginner' }
    ]
  },
  {
    language: { code: 'OGBIA', name: 'Ogbia', nativeName: 'Ọgbiạ', description: 'Dialect of Izon.', icon: '🐟', color: '#2196F3' },
    vocabulary: [
      { izonWord: 'Ami', englishTranslation: 'Water', category: 'nature', difficulty: 'beginner' }
    ],
    lessons: [
      { title: { english: 'Water World', izon: 'Ami-mi' }, description: { english: 'Water vocabulary' }, level: 1, category: 'nature' }
    ],
    proverbs: [
      { izon: 'Ami fa', english: 'Water is life', meaning: 'Water is essential', category: 'nature', difficulty: 'beginner' }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/izon_db');

    const admin = await User.findOne({ role: 'admin' });
    const adminId = admin ? admin._id : new mongoose.Types.ObjectId();

    for (const data of seedData) {
      // 1. Create/Update Language
      let lang = await Language.findOneAndUpdate(
        { code: data.language.code },
        data.language,
        { upsert: true, new: true }
      );

      // 2. Seed Vocabulary
      for (const vocab of data.vocabulary) {
        await Vocabulary.findOneAndUpdate(
          { izonWord: vocab.izonWord, language_id: lang._id },
          { ...vocab, language_id: lang._id, createdBy: adminId, isPublished: true },
          { upsert: true }
        );
      }

      // 3. Seed Lessons
      for (const lesson of data.lessons) {
        await Lesson.findOneAndUpdate(
          { 'title.english': lesson.title.english, language_id: lang._id },
          { ...lesson, language_id: lang._id, createdBy: adminId, status: 'published' },
          { upsert: true }
        );
      }

      // 4. Seed Proverbs
      for (const proverb of data.proverbs) {
        await Proverb.findOneAndUpdate(
          { izon: proverb.izon, language_id: lang._id },
          { ...proverb, language_id: lang._id, createdBy: adminId, isPublished: true },
          { upsert: true }
        );
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();

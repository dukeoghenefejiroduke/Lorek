require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('../src/models/Language');
const Vocabulary = require('../src/models/Vocabulary');
const Lesson = require('../src/models/Lesson');
const Proverb = require('../src/models/Proverb');
const CulturalContent = require('../src/models/CulturalContent');
const User = require('../src/models/User');

const languages = [
  { code: 'IZON', name: 'Izon', nativeName: 'Ịzọn', description: 'Major language of the Ijaw people.', icon: '🌊', color: '#4CAF50' },
  { code: 'EPIE', name: 'Epie', nativeName: 'Epie', description: 'Edoid language.', icon: '🌳', color: '#9C27B0' },
  { code: 'OGBIA', name: 'Ogbia', nativeName: 'Ọgbiạ', description: 'Central Delta language.', icon: '🐟', color: '#2196F3' },
  { code: 'NEMBE', name: 'Nembe', nativeName: 'Nembe', description: 'Dialect of Izon.', icon: '⛵', color: '#FF9800' }
];

const generateData = (langCode, langIndex) => {
  const vocab = Array.from({ length: 25 }, (_, i) => ({
    izonWord: `${langCode}-Word-${i + 1}`,
    englishTranslation: `Translation ${i + 1} (${langCode})`,
    category: 'basics',
    difficulty: 'beginner'
  }));
  
  const lessons = Array.from({ length: 7 }, (_, i) => {
    const globalOrder = (langIndex * 7) + i + 1;
    return {
      title: { english: `Lesson ${globalOrder} in ${langCode}`, izon: `${langCode}-Lesson-${i + 1}` },
      description: { english: `Basic ${langCode} lesson ${i + 1}` },
      level: 'beginner',
      lessonType: 'vocabulary',
      category: 'basics',
      order: globalOrder,
      content: {
        introduction: {
          izon: `Introduction to ${langCode} lesson ${i + 1}`,
          english: `Welcome to ${langCode} lesson ${i + 1}. In this lesson, we will explore basic concepts.`
        }
      },
      exercises: [{
        type: 'translation',
        question: {
          izon: `Translate this ${langCode} phrase ${i + 1}`,
          english: `Translate this phrase`
        },
        correctAnswer: {
          izon: `Phrase ${i+1}`,
          english: `Phrase ${i+1}`
        },
        points: 10
      }],
      review: {
        summary: { izon: `Summary`, english: `Review of lesson ${i+1}` },
        keyPoints: [{ izon: `Point ${i + 1}`, english: `Key point ${i + 1}` }]
      }
    };
  });

  const proverbs = Array.from({ length: 3 }, (_, i) => ({
    izon: `Proverb ${i + 1} in ${langCode}`,
    english: `Translation of proverb ${i + 1}`,
    meaning: `Meaning of proverb ${i + 1} in ${langCode} culture`,
    category: 'wisdom',
    difficulty: 'beginner'
  }));
  const culture = Array.from({ length: 3 }, (_, i) => ({
    title: `Cultural Insight ${i + 1} (${langCode})`,
    description: `A deep dive into ${langCode} tradition ${i + 1}.`,
    category: 'traditions'
  }));
  return { vocab, lessons, proverbs, culture };
};

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ role: 'admin' });
    const adminId = admin ? admin._id : null;

    for (const [index, langData] of languages.entries()) {
      console.log(`Seeding ${langData.name}...`);
      
      const lang = await Language.findOneAndUpdate(
        { code: langData.code },
        langData,
        { upsert: true, new: true }
      );

      const data = generateData(langData.code, index);

      for (const item of data.culture) {
        await CulturalContent.findOneAndUpdate(
          { title: item.title, language_id: lang._id },
          { ...item, language_id: lang._id, createdBy: adminId, isPublished: true },
          { upsert: true }
        );
      }

      for (const item of data.lessons) {
        await Lesson.findOneAndUpdate(
          { 'title.english': item.title.english, language_id: lang._id },
          { ...item, language_id: lang._id, createdBy: adminId, status: 'published' },
          { upsert: true }
        );
      }

      for (const item of data.proverbs) {
        await Proverb.findOneAndUpdate(
          { izon: item.izon, language_id: lang._id },
          { ...item, language_id: lang._id, createdBy: adminId, isPublished: true },
          { upsert: true }
        );
      }

      for (const item of data.vocab) {
        await Vocabulary.findOneAndUpdate(
          { izonWord: item.izonWord, language_id: lang._id },
          { ...item, language_id: lang._id, createdBy: adminId, isPublished: true },
          { upsert: true }
        );
      }
    }

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();

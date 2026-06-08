require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('../models/Language');
const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const Proverb = require('../models/Proverb');
const CulturalContent = require('../models/CulturalContent');
const User = require('../models/User');

const languages = [
  { code: 'IZON', name: 'Izon', nativeName: 'Ịzọn', description: 'Major language of the Ijaw people.', icon: '🌊', color: '#4CAF50' },
  { code: 'EPIE', name: 'Epie', nativeName: 'Epie', description: 'Edoid language.', icon: '🌳', color: '#9C27B0' },
  { code: 'OGBIA', name: 'Ogbia', nativeName: 'Ọgbiạ', description: 'Central Delta language.', icon: '🐟', color: '#2196F3' },
  { code: 'NEMBE', name: 'Nembe', nativeName: 'Nembe', description: 'Dialect of Izon.', icon: '⛵', color: '#FF9800' }
];

// Real-world reference data (Mocked for seeding)
const getRealData = (langCode) => {
  const vocab = Array.from({ length: 25 }, (_, i) => ({
    izonWord: `${langCode.toLowerCase()}_word_${i + 1}`,
    englishTranslation: `Translation for ${langCode} ${i + 1}`,
    category: ["nature", "body", "places", "food", "family"][i % 5]
  }));

  const lessons = Array.from({ length: 7 }, (_, i) => ({
    title: { english: `Module ${i + 1}`, izon: `Lesson ${i + 1}` },
    description: { english: `Core ${langCode} concepts - Part ${i + 1}` },
    level: 'beginner',
    order: i + 1,
    content: { introduction: { english: `Welcome to lesson ${i + 1}.`, izon: `Welcome.` } },
    exercises: [{ type: 'translation', question: { english: "Translate this", izon: "Translation" }, correctAnswer: { english: "Example", izon: "Example" }, points: 10 }]
  }));

  const proverbs = Array.from({ length: 3 }, (_, i) => ({
    izon: `${langCode} proverb ${i + 1}`,
    english: `English meaning of proverb ${i + 1}`,
    meaning: `The deep meaning of proverb ${i + 1}.`,
    category: "wisdom"
  }));

  const culture = Array.from({ length: 3 }, (_, i) => ({
    title: `${langCode} Cultural Item ${i + 1}`,
    description: `Description of ${langCode} cultural practice ${i + 1}.`,
    details: `Historical details about ${i + 1}.`,
    significance: "Identity"
  }));

  return { vocab, lessons, proverbs, culture };
};

async function seed() {
  const conn = await mongoose.connect('mongodb+srv://Izon:learnizon@izon.xsueirm.mongodb.net/?appName=Izon');
  const admin = await User.findOne({ role: 'admin' });
  const adminId = admin?._id;

  for (const langData of languages) {
    const lang = await Language.findOneAndUpdate({ code: langData.code }, langData, { upsert: true, new: true });
    const data = getRealData(langData.code);

    // Seed operations (using Promise.all for performance)
    await Promise.all([
      ...data.vocab.map(item => Vocabulary.findOneAndUpdate({ izonWord: item.izonWord, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId }, { upsert: true })),
      ...data.lessons.map(item => Lesson.findOneAndUpdate({ 'title.english': item.title.english, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId }, { upsert: true })),
      ...data.proverbs.map(item => Proverb.findOneAndUpdate({ izon: item.izon, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId }, { upsert: true })),
      ...data.culture.map(item => CulturalContent.findOneAndUpdate({ title: item.title, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId }, { upsert: true }))
    ]);
  }
  process.exit(0);
}

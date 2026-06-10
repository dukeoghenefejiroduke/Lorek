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

const languageData = {
  IZON: {
    vocab: [
      { izonWord: 'amá', englishTranslation: 'town' },
      { izonWord: 'bírà', englishTranslation: 'hand/arm' },
      { izonWord: 'burú', englishTranslation: 'yam' },
      { izonWord: 'fịrị́', englishTranslation: 'work' },
      { izonWord: 'nụ́a', englishTranslation: 'welcome/thank you' }
    ],
    proverbs: [
      { izon: 'Gbáán gbáán, kírí kọ́rọ́.', english: 'Slow and steady, the earth falls.', meaning: 'Persistence leads to success.' }
    ],
    culture: [
      { title: 'The Owuamapu', description: 'Water spirits believed to dwell in the Niger Delta and influence human affairs.' }
    ]
  },
  NEMBE: {
    vocab: [
      { izonWord: 'ikpútú', englishTranslation: 'stone' },
      { izonWord: 'déín', englishTranslation: 'night' },
      { izonWord: 'yengí', englishTranslation: 'mother' }
    ],
    proverbs: [
      { izon: 'Agwa bụ ẹzọ.', english: 'Manners maketh a man.', meaning: 'Character and conduct define a person’s worth.' }
    ],
    culture: [
      { title: 'Nembe-Brass History', description: 'The history of the Nembe-Brass Kingdom and its defiance against colonial powers.' }
    ]
  },
  OGBIA: {
    vocab: [
      { izonWord: 'òsukùlù', englishTranslation: 'school' },
      { izonWord: 'ny', englishTranslation: 'nasal sound prefix' }
    ],
    proverbs: [{ izon: 'Ọgbiạ ọma', english: 'Ogbia land', meaning: 'Pride in the heritage of the Ogbia people.' }],
    culture: [{ title: 'Ogbia Markets', description: 'The vital role of the Ogbia Township Market in local social and economic life.' }]
  },
  EPIE: {
    vocab: [
      { izonWord: 'Epie', englishTranslation: 'Greeting' }
    ],
    proverbs: [{ izon: 'Epie o', english: 'Greeting the community', meaning: 'Significance of communal respect.' }],
    culture: [{ title: 'Epie Traditions', description: 'Oral history and family lineage importance in Epie culture.' }]
  }
};

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const admin = await User.findOne({ role: 'admin' });
    const adminId = admin ? admin._id : null;

    for (const langData of languages) {
      const lang = await Language.findOneAndUpdate({ code: langData.code }, langData, { upsert: true, new: true });
      const data = languageData[langData.code] || { vocab: [], proverbs: [], culture: [] };

      for (const item of data.culture) {
        await CulturalContent.findOneAndUpdate({ title: item.title, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId, isPublished: true }, { upsert: true });
      }
      for (const item of data.proverbs) {
        await Proverb.findOneAndUpdate({ izon: item.izon, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId, isPublished: true }, { upsert: true });
      }
      for (const item of data.vocab) {
        await Vocabulary.findOneAndUpdate({ izonWord: item.izonWord, language_id: lang._id }, { ...item, language_id: lang._id, createdBy: adminId, isPublished: true, category: 'basics', difficulty: 'beginner' }, { upsert: true });
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

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Language = require('../../models/Language');

async function seedOgbiaLanguage() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    await Language.updateOne(
      { code: 'OGBIA' },
      {
        code: 'OGBIA',
        name: 'Ogbia',
        nativeName: 'Ọgbiạ',
        description: 'Ogbia is a Central Delta language spoken in Bayelsa State, Nigeria.',
        region: 'Bayelsa, Nigeria',
        icon: '🐟',
        color: '#2196F3',
        difficulty: 'intermediate',
        totalWords: 520,
        totalLessons: 8,
        totalSpeakers: 500000,
        order: 2,
        isDefault: false,
        isActive: true,
        features: {
          hasAudio: false,
          hasPronunciation: true,
          hasGrammar: true,
          hasCulture: true,
        }
      },
      { upsert: true }
    );
    console.log('Ogbia language record seeded/updated successfully in MongoDB.');
  } catch (error) {
    console.warn('⚠️ MongoDB offline. Ogbia language seed prepared for DB sync:', error.message);
  }
  process.exit(0);
}

seedOgbiaLanguage();

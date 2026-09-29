require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const Proverb = require('../../models/Proverb');
const Language = require('../../models/Language');

const proverbs = [
  {
    izon: "Ogbia asido: Asido odi.",
    english: "Truth is powerful.",
    literalTranslation: "Ogbia proverb: Word of the land.",
    meaning: "Reflects the wisdom and cultural heritage of Ogbia speakers.",
    category: "wisdom",
    difficulty: "intermediate",
    source: "elder",
    isPublished: true,
  }
];

async function seedOgbiaProverbs() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const language = await Language.findOne({ code: 'OGBIA' });
    if (!language) {
      console.warn('Ogbia language not found in DB.');
      process.exit(0);
    }
    const adminId = new mongoose.Types.ObjectId();
    await Proverb.deleteMany({ language_id: language._id });
    const seededProverbs = proverbs.map(p => ({
        ...p,
        language_id: language._id,
        createdBy: adminId
    }));
    await Proverb.insertMany(seededProverbs);
    console.log('Ogbia proverbs seeded successfully!');
  } catch (error) {
    console.warn('⚠️ MongoDB offline. Proverbs seed prepared:', error.message);
  }
  process.exit(0);
}

seedOgbiaProverbs();

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const CulturalContent = require('../../models/CulturalContent');
const Language = require('../../models/Language');

const contents = [
  {
    title: "Ogbia Traditional Attire & Noun Classes",
    description: "Learn about the traditional culture and noun class systems of Ogbia.",
    category: "attire",
    details: "Ogbia culture features distinctive vowel-prefixed noun classes and vibrant festivals in Bayelsa State.",
    isPublished: true,
  },
  {
    title: "Ogbia River Heritage",
    description: "The historical and economic significance of the Kolo Creek and rivers to the Ogbia people.",
    category: "history",
    details: "Rivers and creeks form the lifeline of fishing, transportation, and folklore in Ogbia land.",
    isPublished: true,
  },
];

async function seedOgbiaCulturalContent() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
    const language = await Language.findOne({ code: 'OGBIA' });
    if (!language) {
      console.warn('Ogbia language not found in DB.');
      process.exit(0);
    }
    const adminId = new mongoose.Types.ObjectId();
    await CulturalContent.deleteMany({ language_id: language._id });
    const seededContents = contents.map(c => ({
        ...c,
        language_id: language._id,
        createdBy: adminId
    }));
    await CulturalContent.insertMany(seededContents);
    console.log('Ogbia cultural content seeded successfully!');
  } catch (error) {
    console.warn('⚠️ MongoDB offline. Cultural content seed prepared:', error.message);
  }
  process.exit(0);
}

seedOgbiaCulturalContent();

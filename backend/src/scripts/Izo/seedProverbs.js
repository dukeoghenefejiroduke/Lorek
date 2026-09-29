require('dotenv').config();
const mongoose = require('mongoose');
const Proverb = require('../models/Proverb');
const Language = require('../models/Language');

const proverbs = [
  {
    izon: "Opu koro, opu koro.",
    english: "Big pot, big pot.",
    literalTranslation: "Large pot, large pot.",
    meaning: "It suggests that great things come from great preparations.",
    category: "wisdom",
    difficulty: "intermediate",
    source: "elder",
    isPublished: true,
  },
  {
    izon: "Fụrụ koro, fụrụ koro.",
    english: "Wind blows, wind blows.",
    literalTranslation: "Wind blows, wind blows.",
    meaning: "Refers to the inevitability of change.",
    category: "life",
    difficulty: "beginner",
    source: "native_speaker",
    isPublished: true,
  },
];

async function seedProverbs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const language = await Language.findOne({ code: 'IZON' });
    if (!language) {
      console.error('Izon language not found!');
      process.exit(1);
    }

    const adminId = new mongoose.Types.ObjectId(); // Mock creator

    await Proverb.deleteMany({ language_id: language._id });
    
    const seededProverbs = proverbs.map(p => ({
        ...p,
        language_id: language._id,
        createdBy: adminId
    }));

    await Proverb.insertMany(seededProverbs);
    console.log('Proverbs seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedProverbs();

const mongoose = require('mongoose');
const Proverb = require('../models/Proverb');
const Language = require('../models/Language');
require('dotenv').config();

const seedData = [
  {
    izon: "Beni dowei tiri kpo bari-ebere.",
    english: "The ground where the water is sought is also where the water is found.",
    meaning: "Success often comes from the same place where you faced challenges.",
    category: "wisdom",
    difficulty: "intermediate",
    culturalContext: {
        region: "Kolokuma",
        culturalSignificance: "Encouragement for persistence in local labor."
    },
    isPublished: true,
    isActive: true,
    createdBy: new mongoose.Types.ObjectId('69d291181b8d4a6d532a5096'),
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find Izon Language
    const izonLanguage = await Language.findOne({ code: 'IZON' });
    if (!izonLanguage) {
      console.error('IZON language not found. Please run LanguageSeed.js first.');
      process.exit(1);
    }

    const proverbsWithLanguage = seedData.map(p => ({
      ...p,
      language_id: izonLanguage._id
    }));

    // Clear and re-seed
    await Proverb.deleteMany({});
    await Proverb.insertMany(proverbsWithLanguage);
    
    process.exit();
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
};

seedDB();

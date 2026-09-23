require('dotenv').config();
const mongoose = require('mongoose');
const CulturalContent = require('../models/CulturalContent');
const Language = require('../models/Language');

const contents = [
  {
    title: "Izon Traditional Attire",
    description: "Learn about the traditional attire worn by the Izon people.",
    category: "attire",
    details: "Traditionally, Izon people wear specific fabrics and styles that represent their status and connection to the water.",
    isPublished: true,
  },
  {
    title: "New Yam Festival",
    description: "An important festival celebrating the harvest.",
    category: "festivals",
    details: "The New Yam Festival marks the beginning of the harvest season and is a time for community gathering.",
    isPublished: true,
  },
];

async function seedCulturalContent() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const language = await Language.findOne({ code: 'IZON' });
    if (!language) {
      console.error('Izon language not found!');
      process.exit(1);
    }

    const adminId = new mongoose.Types.ObjectId(); // Mock creator

    await CulturalContent.deleteMany({});
    
    const seededContents = contents.map(c => ({
        ...c,
        language_id: language._id,
        createdBy: adminId
    }));

    await CulturalContent.insertMany(seededContents);
    console.log('Cultural content seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedCulturalContent();

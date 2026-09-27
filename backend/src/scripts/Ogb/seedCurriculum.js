require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Language = require('../../models/Language');
const Lesson = require('../../models/Lesson');

async function seedOgbiaCurriculum() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    let language = await Language.findOne({ code: 'OGBIA' });
    if (!language) {
      console.warn('Ogbia language not found in DB.');
      process.exit(0);
    }
    const adminId = new mongoose.Types.ObjectId();
    await Lesson.deleteMany({ language_id: language._id });
    const lessons = [
      {
        language_id: language._id,
        title: 'Ogbia Basics & Greetings',
        type: 'vocabulary',
        category: 'greetings',
        content: {
          introduction: {
            english: 'Learn basic Ogbia greetings and SVO sentence structure.',
            izon: 'Ogbia greetings.'
          },
          vocabulary: [
            { izon: 'Ade', english: 'Farm' },
            { izon: 'Amum', english: 'Water' },
            { izon: 'Otu', english: 'House' }
          ]
        },
        createdBy: adminId
      }
    ];
    await Lesson.insertMany(lessons);
    console.log('Ogbia curriculum seeded successfully!');
  } catch (error) {
    console.warn('⚠️ MongoDB offline. Curriculum seed prepared:', error.message);
  }
  process.exit(0);
}

seedOgbiaCurriculum();

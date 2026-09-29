require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const Language = require('../../models/Language');
const Lesson = require('../../models/Lesson');
const Vocabulary = require('../../models/Vocabulary');

async function seedOgbiaCurriculum() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    let language = await Language.findOne({ code: 'OGBIA' });
    if (!language) {
      console.warn('Ogbia language not found in DB.');
      process.exit(0);
    }
    const adminId = new mongoose.Types.ObjectId();
    await Lesson.deleteMany({ language_id: language._id });
    
    const vocabWords = await Vocabulary.find({ language_id: language._id }).limit(3);
    const vocabularyContent = vocabWords.length > 0 
      ? vocabWords.map(v => ({ wordId: v._id, izon: v.izonWord, english: v.englishTranslation }))
      : [];

    const lessons = [
      {
        language_id: language._id,
        title: {
          izon: 'Ogbia Basics & Greetings',
          english: 'Ogbia Basics & Greetings'
        },
        description: {
          english: 'Learn basic Ogbia greetings and vocabulary.',
          izon: 'Ogbia greetings.'
        },
        lessonType: 'vocabulary',
        level: 'beginner',
        order: 1,
        category: 'greetings',
        content: {
          introduction: {
            english: 'Learn basic Ogbia greetings and SVO sentence structure.',
            izon: 'Ogbia greetings.'
          },
          vocabulary: vocabularyContent
        },
        createdBy: adminId
      }
    ];
    await Lesson.insertMany(lessons);
    console.log('Ogbia curriculum seeded successfully!');
  } catch (error) {
    console.error('⚠️ Curriculum seed error:', error);
  }
  process.exit(0);
}

seedOgbiaCurriculum();

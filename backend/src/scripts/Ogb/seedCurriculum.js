require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const Language = require('../../models/Language');
const Lesson = require('../../models/Lesson');
const Vocabulary = require('../../models/Vocabulary');
const Course = require('../../models/Course');
const Section = require('../../models/Section');
const Unit = require('../../models/Unit');

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
    
    // Cleanup only Ogbia lessons
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

    const createdLessons = await Lesson.insertMany(lessons);

    // Find or create Ogbia Course
    let course = await Course.findOne({ languageId: language._id });
    if (!course) {
      course = await Course.create({
        title: 'Ogbia Beginner Course',
        languageId: language._id,
        description: 'Learn the Ogbia language from basics to conversations.'
      });
    }

    // Find or create Section
    let section = await Section.findOne({ courseId: course._id });
    if (!section) {
      section = await Section.create({
        title: 'Ogbia Beginner Track',
        courseId: course._id
      });
      await Course.findByIdAndUpdate(course._id, { $addToSet: { sections: section._id } });
    }

    // Find or create Unit
    let unit = await Unit.findOne({ sectionId: section._id });
    if (!unit) {
      unit = await Unit.create({
        title: 'Unit 1: Basics & Greetings',
        sectionId: section._id,
        lessons: createdLessons.map(l => l._id)
      });
      await Section.findByIdAndUpdate(section._id, { $addToSet: { units: unit._id } });
    } else {
      unit.lessons = createdLessons.map(l => l._id);
      await unit.save();
    }

    console.log('Ogbia curriculum, course, section, and unit seeded successfully!');
  } catch (error) {
    console.error('⚠️ Curriculum seed error:', error);
  }
  process.exit(0);
}

seedOgbiaCurriculum();

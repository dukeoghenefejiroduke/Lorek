require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Language = require('../src/models/Language');
const Lesson = require('../src/models/Lesson');
const Unit = require('../src/models/Unit');
const Section = require('../src/models/Section');
const Course = require('../src/models/Course');
const Vocabulary = require('../src/models/Vocabulary');
const CulturalContent = require('../src/models/CulturalContent');
const Proverb = require('../src/models/Proverb');

async function clearCurriculum() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');

    const langCode = process.argv[2];
    if (!langCode) {
      console.error('Error: Please specify a language code to clear (e.g., node clear_curriculum.js IZON or OGBIA).');
      console.error('Global collection drops are disabled to protect multi-language data.');
      process.exit(1);
    }

    const language = await Language.findOne({ code: langCode.toUpperCase() });
    if (!language) {
      console.error(`Language with code ${langCode} not found in database.`);
      process.exit(1);
    }

    console.log(`Clearing curriculum and content for language: ${language.name} (${language.code})...`);

    await Lesson.deleteMany({ language_id: language._id });
    await Vocabulary.deleteMany({ language_id: language._id });
    await CulturalContent.deleteMany({ language_id: language._id });
    await Proverb.deleteMany({ language_id: language._id });

    const courses = await Course.find({ languageId: language._id });
    for (const course of courses) {
      const sections = await Section.find({ courseId: course._id });
      for (const section of sections) {
        await Unit.deleteMany({ sectionId: section._id });
        await Section.findByIdAndDelete(section._id);
      }
      await Course.findByIdAndDelete(course._id);
    }

    console.log(`Curriculum and content cleared successfully for ${language.code}. Other languages remain untouched.`);
    process.exit(0);
  } catch (error) {
    console.error('Error clearing curriculum:', error);
    process.exit(1);
  }
}

clearCurriculum();

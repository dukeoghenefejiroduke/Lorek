require('dotenv').config();
const mongoose = require('mongoose');
const Lesson = require('./src/models/Lesson');

async function checkLessons() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const lessonsWithoutLanguage = await Lesson.find({ $or: [ { language_id: { $exists: false } }, { language_id: null } ] });

    if (lessonsWithoutLanguage.length > 0) {
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLessons();

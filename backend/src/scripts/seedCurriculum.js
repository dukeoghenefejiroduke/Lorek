require('dotenv').config();
console.log('Starting seedCurriculum.js');
const mongoose = require('mongoose');
const Unit = require('../models/Unit');
const Lesson = require('../models/Lesson');
const Section = require('../models/Section');
const Course = require('../models/Course');
const Language = require('../models/Language');
const Module = require('../models/Module');
const Vocabulary = require('../models/Vocabulary');

const curriculum = [
  {
    unit: "Unit 1 — Greetings & Introductions",
    lessons: [
      { 
        title: "Basic Greetings", 
        type: "vocabulary",
        content: {
          introduction: { english: "Learn common Izon greetings.", izon: "Izon greetings." },
          examples: [
            { izon: "Wari", english: "Hello" },
            { izon: "Sere", english: "Goodbye" }
          ]
        }
      },
      { 
        title: "Saying Your Name", 
        type: "grammar",
        content: {
          grammar: [{ 
            title: { english: "Self-Introduction" }, 
            explanation: { english: "Use 'Nime' to say your name." }
          }]
        }
      },
      { title: "Asking Someone's Name", type: "conversation" },
      { title: "Basic Politeness", type: "culture" },
      { title: "Unit Review", type: "review" }
    ]
  },
  {
    unit: "Unit 2 — People & Family",
    lessons: [
      { title: "Family Vocabulary", type: "vocabulary" },
      { title: "People & Relationships", type: "vocabulary" },
      { title: "Possession", type: "grammar" },
      { title: "Describing People", type: "grammar" },
      { title: "Unit Review", type: "review" }
    ]
  },
  {
    unit: "Unit 3 — Everyday Words",
    lessons: [
      { title: "Common Objects", type: "vocabulary" },
      { title: "Food & Drink", type: "vocabulary" },
      { title: "Places", type: "vocabulary" },
      { title: "Basic Actions", type: "grammar" },
      { title: "Unit Review", type: "review" }
    ]
  },
  {
    unit: "Unit 4 — Basic Sentences",
    lessons: [
      { title: "Simple Statements", type: "grammar" },
      { title: "Questions", type: "grammar" },
      { title: "Negation", type: "grammar" },
      { title: "Everyday Conversations", type: "conversation" },
      { title: "Unit Review", type: "review" }
    ]
  },
  {
    unit: "Unit 5 — Practical Conversation",
    lessons: [
      { title: "Meeting Someone", type: "conversation" },
      { title: "At Home", type: "conversation" },
      { title: "Asking for Something", type: "conversation" },
      { title: "Everyday Conversation", type: "conversation" },
      { title: "Final Review", type: "review" }
    ]
  }
];

async function seedCurriculum() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
// ...

    const izon = await Language.findOne({ code: 'IZON' });
    console.log('Language found:', izon ? izon._id : 'None');
    if (!izon) throw new Error('Izon language not found.');

    const adminId = new mongoose.Types.ObjectId();
    console.log('Admin ID:', adminId);

    let course = await Course.findOne({ title: 'Izon Beginner Course' });
    console.log('Course found:', course ? course._id : 'None');
    if (!course) {
      course = await Course.create({ title: 'Izon Beginner Course', languageId: izon._id });
      console.log('Course created:', course._id);
    }
// ...

    let section = await Section.findOne({ title: 'Beginner Track', courseId: course._id });
    if (!section) {
      section = await Section.create({ title: 'Beginner Track', courseId: course._id });
      await Course.findByIdAndUpdate(course._id, { $push: { sections: section._id } });
    }

    for (const unitData of curriculum) {
      const unit = await Unit.create({ title: unitData.unit, sectionId: section._id });
      await Section.findByIdAndUpdate(section._id, { $push: { units: unit._id } });

      const mod = await Module.create({ 
        title: { izon: unitData.unit, english: unitData.unit },
        level: 'beginner',
        order: 1 
      });

      for (let i = 0; i < unitData.lessons.length; i++) {
        const lessonData = unitData.lessons[i];
        
        // Define default content
        const defaultContent = {
            introduction: { english: `Welcome to ${lessonData.title}.`, izon: "Welcome." },
            grammar: [],
            culturalNotes: [],
            vocabulary: [],
            examples: []
        };

        const lesson = await Lesson.create({
          title: { izon: lessonData.title, english: lessonData.title },
          description: { english: `Learn about ${lessonData.title}.` },
          language_id: izon._id,
          level: 'beginner',
          lessonType: lessonData.type,
          category: 'greetings',
          order: i + 1,
          status: 'published',
          moduleId: mod._id, 
          // Merge provided content with defaults
          content: { ...defaultContent, ...lessonData.content },
          exercises: [{
            type: "multiple-choice",
            question: { english: "Example question", izon: "Example question" },
            options: [{ id: "a", english: "Correct", isCorrect: true }, { id: "b", english: "Incorrect", isCorrect: false }],
            points: 10
          }],
          createdBy: adminId
        });

        await Unit.findByIdAndUpdate(unit._id, { $push: { lessons: lesson._id } });
        await Module.findByIdAndUpdate(mod._id, { $push: { lessons: lesson._id } });
      }
      console.log(`Seeded ${unitData.unit} and Module`);
    }

    console.log('Curriculum seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedCurriculum();

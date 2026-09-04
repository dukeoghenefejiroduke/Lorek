const mongoose = require('mongoose');
const Language = require('../backend/src/models/Language');
const Course = require('../backend/src/models/Course');
const Section = require('../backend/src/models/Section');
const Unit = require('../backend/src/models/Unit');
const Lesson = require('../backend/src/models/Lesson');

require('dotenv').config();

const sections = [
    'Greetings', 'Introductions', 'Family', 'Numbers', 'Food', 
    'Everyday Objects', 'Places', 'Time', 'Basic Conversations', 'Review'
];

async function seedIzonDemo() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // 1. Get or Create Izon Language
    const language = await Language.findOneAndUpdate(
        { code: 'IZON' },
        { 
            name: 'Izon', 
            nativeName: 'Izon', 
            isDemo: true,
            isPublished: false 
        },
        { upsert: true, new: true }
    );

    // 2. Create Beginner Course
    const course = await Course.findOneAndUpdate(
        { title: 'Izon Beginner (DEMO)' },
        { title: 'Izon Beginner (DEMO)', languageId: language._id, description: 'DEMO/UNVERIFIED content' },
        { upsert: true, new: true }
    );

    // 3. Create Sections, Units, Lessons
    for (let i = 0; i < sections.length; i++) {
        const section = await Section.create({
            title: `${sections[i]} (DEMO)`,
            courseId: course._id
        });
        
        // Add section to course
        await Course.findByIdAndUpdate(course._id, { $push: { sections: section._id } });

        const unit = await Unit.create({
            title: `Unit ${i + 1} (DEMO)`,
            sectionId: section._id
        });
        
        await Section.findByIdAndUpdate(section._id, { $push: { units: unit._id } });

        // Seed 1 sample lesson
        const lesson = await Lesson.create({
            title: { izon: `Lesson ${i+1} (DEMO)`, english: `Lesson ${i+1}` },
            language_id: language._id,
            level: 'beginner',
            lessonType: 'vocabulary',
            category: 'greetings',
            order: i + 1,
            exercises: [{ type: 'multiple-choice', question: { izon: 'Sample (DEMO)', english: 'Sample' }, options: [] }]
        });

        await Unit.findByIdAndUpdate(unit._id, { $push: { lessons: lesson._id } });
    }

    console.log('Izon Beginner (DEMO) course hierarchy seeded successfully.');
    process.exit();
}

seedIzonDemo();

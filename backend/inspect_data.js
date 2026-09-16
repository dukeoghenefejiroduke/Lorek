require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('./src/models/Course');
const Unit = require('./src/models/Unit');
const Lesson = require('./src/models/Lesson');

async function inspectData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const courses = await Course.countDocuments();
        const units = await Unit.countDocuments();
        const lessons = await Lesson.countDocuments();
        
        console.log('--- Database Inspection ---');
        console.log('Courses:', courses);
        console.log('Units:', units);
        console.log('Lessons:', lessons);

        if (lessons > 0) {
            const lesson = await Lesson.findOne({});
            console.log('Sample Lesson Title:', lesson.title);
            console.log('Exercise Count:', lesson.exercises ? lesson.exercises.length : 0);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Inspection failed:', err);
        process.exit(1);
    }
}
inspectData();

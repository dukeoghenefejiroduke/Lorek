require('dotenv').config();
const mongoose = require('mongoose');
const Unit = require('./src/models/Unit');
const Section = require('./src/models/Section');
const Lesson = require('./src/models/Lesson');

async function auditData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('--- Unit Audit ---');
        const units = await Unit.find({}).populate('sectionId', 'title');
        
        const unitTitles = new Set();
        units.forEach(u => {
            const title = u.title || 'Untitled';
            if (unitTitles.has(title)) {
                console.warn(`DUPLICATE FOUND: ${title} (ID: ${u._id})`);
            } else {
                unitTitles.add(title);
                console.log(`Unit: ${title} (ID: ${u._id})`);
            }
        });
        
        console.log('\n--- Lesson-Unit Mapping Audit ---');
        const lessons = await Lesson.find({}).select('title.english unitId');
        lessons.forEach(l => {
            console.log(`Lesson: ${l.title.english}, UnitID: ${l.unitId}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Audit failed:', err);
        process.exit(1);
    }
}
auditData();

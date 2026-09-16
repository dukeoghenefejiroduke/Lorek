require('dotenv').config();
const mongoose = require('mongoose');

async function clearCurriculum() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // List collections to drop. 
    // Using direct drop check might be safer if collections don't exist yet.
    const collections = ['lessons', 'units', 'sections', 'courses', 'modules', 'vocabulary'];
    
    for (const collName of collections) {
      try {
        await mongoose.connection.db.dropCollection(collName);
        console.log(`Dropped collection: ${collName}`);
      } catch (err) {
        if (err.code === 26) {
          console.log(`Collection ${collName} not found, skipping.`);
        } else {
          console.error(`Error dropping ${collName}:`, err.message);
        }
      }
    }
    console.log('Curriculum collections cleared.');
    process.exit(0);
  } catch (error) {
    console.error('Error connecting/clearing:', error);
    process.exit(1);
  }
}
clearCurriculum();

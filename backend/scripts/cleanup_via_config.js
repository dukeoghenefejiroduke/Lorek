const connectDB = require('../src/config/database');
const mongoose = require('mongoose');

async function cleanup() {
  try {
    await connectDB();
    if (mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
        console.log("Database dropped.");
    } else {
        console.log("Database connection not active.");
    }
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
cleanup();

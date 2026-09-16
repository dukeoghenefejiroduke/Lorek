require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function cleanup() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI is not set!");
      // Fallback if dotenv failed
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.db.dropDatabase();
    console.log("Database dropped.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
cleanup();

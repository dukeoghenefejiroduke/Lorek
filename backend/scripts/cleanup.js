require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.db.dropDatabase();
    console.log("Database dropped.");
    process.exit(0);
  } catch (error) {
    console.error("Error dropping database:", error);
    process.exit(1);
  }
}
cleanup();

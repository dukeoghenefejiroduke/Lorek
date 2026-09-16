const mongoose = require('mongoose');
const User = require('./src/models/User');

async function checkIndices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/lorek");
    const indexes = await User.collection.getIndexes();
    console.log("User model indexes:", Object.keys(indexes));
    process.exit();
  } catch (error) {
    console.error("Failed to check indices:", error);
    process.exit(1);
  }
}
checkIndices();

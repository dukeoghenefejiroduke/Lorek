const mongoose = require('mongoose');
require('dotenv').config(); // If you use a .env file for your DB URI

const DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/izonlearner';

async function elevateUser() {
  try {
    await mongoose.connect(DB_URI);

    const result = await mongoose.connection.db.collection('users').updateOne(
      { username: "duke" },
      { $set: { role: "admin" } }
    );

    if (result.matchedCount === 0) {
    } else {
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

elevateUser();

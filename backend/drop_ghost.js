const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.db.collection('users').dropIndex('progress.referralCode_1');
  } catch (e) {
  } finally {
    process.exit();
  }
}
run();

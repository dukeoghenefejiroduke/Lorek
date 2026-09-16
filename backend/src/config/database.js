const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      family: 4
    };
    await mongoose.connect(process.env.MONGODB_URI, options);
    console.info('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ Connection Error (continuing in offline-mode):', err.message);
  }
};

module.exports = connectDB;

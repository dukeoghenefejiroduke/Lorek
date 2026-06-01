const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      maxPoolSize: 10, // Optimized for Termux RAM
      serverSelectionTimeoutMS: 5000,
      family: 4 // Faster for mobile DNS
    };
    await mongoose.connect(process.env.MONGODB_URI, options);
  } catch (err) {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

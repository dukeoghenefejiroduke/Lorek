require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function cleanupExpiredUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const now = new Date();
    
    // Find users pending verification with expired tokens
    const result = await User.deleteMany({
      status: 'pending_verification',
      'security.emailVerificationExpires': { $lt: now }
    });
    
    console.log(`Cleanup complete. Deleted ${result.deletedCount} expired, unverified users.`);
    process.exit(0);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}

cleanupExpiredUsers();

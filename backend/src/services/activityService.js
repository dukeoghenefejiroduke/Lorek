const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');

const logActivity = async (userId, type, message, metadata = {}) => {
  await ActivityFeed.create({
    userId,
    type,
    message,
    metadata,
  });
};

module.exports = { logActivity };

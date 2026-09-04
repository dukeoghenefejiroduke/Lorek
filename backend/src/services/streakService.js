const User = require('../models/User');

/**
 * Streak Service
 * Manages daily learning streaks with protection.
 */

const getDayString = (date) => date.toISOString().split('T')[0];

const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return 0;

  const now = new Date();
  const today = getDayString(now);
  
  const lastActive = user.progress.streak.lastActive ? getDayString(user.progress.streak.lastActive) : null;
  
  // Already active today
  if (lastActive === today) {
    return user.progress.streak.current;
  }

  // Calculate yesterday to detect breaks
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getDayString(yesterdayDate);

  // Active yesterday - increment streak
  if (lastActive === yesterday) {
    user.progress.streak.current += 1;
  } 
  // Missed a day
  else {
    // Check for streak protection
    if ((user.progress.streak.freezes || 0) > (user.progress.streak.freezeUsed || 0)) {
        // Use a freeze
        user.progress.streak.freezeUsed = (user.progress.streak.freezeUsed || 0) + 1;
        // Streak survives, no change to current
    } else {
        // Streak broken
        user.progress.streak.current = 1;
    }
  }

  // Update longest streak
  if (user.progress.streak.current > user.progress.streak.longest) {
    user.progress.streak.longest = user.progress.streak.current;
  }

  user.progress.streak.lastActive = now;
  await user.save();

  return user.progress.streak.current;
};

module.exports = { updateStreak };

const LearningProgress = require('../models/LearningProgress');
const User = require('../models/User');
const ProcessedEvent = require('../models/ProcessedEvent');

const addXP = async (userId, amount, source = 'exercise', eventId = null) => {
  // Idempotency check
  if (eventId) {
      const alreadyProcessed = await ProcessedEvent.findOne({ eventId });
      if (alreadyProcessed) return; // Already processed
  }

  // 1. Update User.totalPoints (legacy)
  await User.findByIdAndUpdate(userId, { $inc: { totalPoints: amount } });

  // 2. Update LearningProgress.xpHistory
  let progress = await LearningProgress.findOne({ userId });
  if (!progress) {
    progress = new LearningProgress({ userId });
  }
  
  const now = new Date();
  const lastUpdated = new Date(progress.xpHistory.lastUpdated);
  if (now.getDate() !== lastUpdated.getDate() || now.getMonth() !== lastUpdated.getMonth() || now.getFullYear() !== lastUpdated.getFullYear()) {
      progress.xpHistory.daily = 0;
  }
  const getWeek = (date) => {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      d.setDate(d.getDate()+4-(d.getDay()||7));
      return Math.ceil((((d-new Date(d.getFullYear(),0,1))/8.64e7)+1)/7);
  };
  if (getWeek(now) !== getWeek(lastUpdated)) {
      progress.xpHistory.weekly = 0;
  }
  if (now.getMonth() !== lastUpdated.getMonth() || now.getFullYear() !== lastUpdated.getFullYear()) {
      progress.xpHistory.monthly = 0;
  }

  // Update totals
  progress.xpHistory.total += amount;
  progress.xpHistory.daily += amount;
  progress.xpHistory.weekly += amount;
  progress.xpHistory.monthly += amount;
  progress.xpHistory.lastUpdated = now;

  // Update daily stats
  const today = now.toISOString().split('T')[0];
  const dailyStat = progress.dailyStats.find(d => d.date === today);
  if (dailyStat) {
      dailyStat.xpEarned = (dailyStat.xpEarned || 0) + amount;
  } else {
      progress.dailyStats.push({ date: today, xpEarned: amount });
  }

  await progress.save();

  // Mark event as processed
  if (eventId) {
      await ProcessedEvent.create({ eventId });
  }
};

const addExperience = async (userId, amount) => {
    // Legacy support for experience
    const user = await User.findById(userId);
    if(user) {
        user.addExperience(amount);
        user.updateLevel(); // Centralize level update
        await user.save();
    }
};

const calculatePointsEarned = (score, isFirstCompletion, isNewBestScore) => {
    return 10;
};

const calculateExpEarned = (score, timeSpent) => {
  const baseExp = score * 2;
  const timeBonus = Math.min(50, Math.floor(timeSpent / 2));
  return baseExp + timeBonus;
};

module.exports = { addXP, addExperience, calculatePointsEarned, calculateExpEarned };

const User = require('../models/User');
const LearningProgress = require('../models/LearningProgress');

/**
 * League Service
 * Manages weekly league tiers, rankings, and promotions/demotions.
 */

const TIERS = ['bronze', 'silver', 'gold', 'sapphire', 'ruby', 'emerald'];

const calculateWeeklyRankings = async (tier) => {
    return await User.find({ 'league.tier': tier })
        .populate('progressId', 'xpHistory') // Ensure progress data is linked
        .sort({ 'xpHistory.weekly': -1 });
};

const processWeeklyReset = async () => {
    for (let i = 0; i < TIERS.length; i++) {
        const tier = TIERS[i];
        const users = await calculateWeeklyRankings(tier);
        
        const promoteCount = Math.floor(users.length * 0.2); // Top 20%
        const demoteCount = Math.floor(users.length * 0.2); // Bottom 20%

        // Promote top users
        for (let j = 0; j < promoteCount; j++) {
            if (i < TIERS.length - 1) {
                users[j].league.previousTier = tier;
                users[j].league.tier = TIERS[i + 1];
            }
        }
        
        // Demote bottom users
        for (let j = users.length - demoteCount; j < users.length; j++) {
            if (i > 0) {
                users[j].league.previousTier = tier;
                users[j].league.tier = TIERS[i - 1];
            }
        }
        
        // Save updates
        await Promise.all(users.map(u => u.save()));
    }

    // Reset weekly XP for all users
    await LearningProgress.updateMany({}, { 'xpHistory.weekly': 0 });
};

module.exports = { calculateWeeklyRankings, processWeeklyReset, TIERS };

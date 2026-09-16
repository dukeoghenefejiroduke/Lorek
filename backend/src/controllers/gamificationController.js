const User = require('../models/User');
const LeaderboardHistory = require('../models/LeaderboardHistory');
const { logger } = require('../config/logger');
const redis = require('../config/redis');
const { AppError, ValidationError } = require('../middleware/errorHandler');

const achievementService = require('../services/achievementService');
const leaderboardService = require('../services/leaderboardService');

// ============================================================================
// LEADERBOARD FUNCTIONS
// ============================================================================

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { period = 'weekly', category = 'points', limit = 20, page = 1, includeUser = true } = req.query;
    const userId = req.userId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];
    if (!validPeriods.includes(period)) throw new ValidationError('Invalid period specified');

    const dateRange = leaderboardService.getDateRange(period);

    let leaderboard;
    let userRank = null;

    switch (category) {
      case 'points':
        leaderboard = await leaderboardService.getPointsLeaderboard(dateRange, limit, skip);
        if (includeUser && userId) userRank = await leaderboardService.getUserPointsRank(userId, dateRange);
        break;
      case 'streak':
        leaderboard = await leaderboardService.getStreakLeaderboard(limit, skip);
        if (includeUser && userId) userRank = await leaderboardService.getUserStreakRank(userId);
        break;
      case 'words':
        leaderboard = await leaderboardService.getWordsLeaderboard(limit, skip);
        if (includeUser && userId) userRank = await leaderboardService.getUserWordsRank(userId);
        break;
      case 'lessons':
        leaderboard = await leaderboardService.getLessonsLeaderboard(limit, skip);
        if (includeUser && userId) userRank = await leaderboardService.getUserLessonsRank(userId);
        break;
      default:
        throw new ValidationError('Invalid category specified');
    }

    const total = await leaderboardService.getLeaderboardTotalCount(category, dateRange);
    const cacheKey = `leaderboard:${period}:${category}:${page}`;
    await redis.set(cacheKey, leaderboard, 300);

    res.json({
      success: true,
      leaderboard,
      userRank,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: parseInt(limit) },
      period,
      category,
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserRank = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { period = 'weekly' } = req.query;
    const user = await User.findById(userId).select('username progress totalPoints vocabularyMastery lessonsCompleted');
    if (!user) throw new AppError('User not found', 404);

    const dateRange = leaderboardService.getDateRange(period);
    const [pointsRank, streakRank, wordsRank, lessonsRank] = await Promise.all([
      leaderboardService.getUserPointsRank(userId, dateRange),
      leaderboardService.getUserStreakRank(userId),
      leaderboardService.getUserWordsRank(userId),
      leaderboardService.getUserLessonsRank(userId),
    ]);

    const nearbyCompetitors = await leaderboardService.getNearbyCompetitors(userId, pointsRank.rank, period);

    res.json({
      success: true,
      user: { id: user._id, username: user.username, points: user.totalPoints, streak: user.streak, wordsMastered: user.vocabularyMastery?.length || 0, lessonsCompleted: user.lessonsCompleted || 0 },
      ranks: { points: pointsRank, streak: streakRank, words: wordsRank, lessons: lessonsRank },
      nearbyCompetitors,
      period,
    });
  } catch (err) {
    next(err);
  }
};

exports.getLeaderboardHistory = async (req, res, next) => {
  try {
    const { period = 'weekly', limit = 10 } = req.query;
    const history = await LeaderboardHistory.find({ period }).sort({ weekStart: -1 }).limit(parseInt(limit)).populate('topUsers.userId', 'username');
    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// ACHIEVEMENT FUNCTIONS
// ============================================================================

exports.checkAchievements = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const stats = await achievementService.getUserStats(user);
    const newlyEarned = [];
    const allBadges = [];

    for (const rule of achievementService.BADGE_RULES) {
      const hasBadge = user.badges?.some(b => b.name === rule.name);
      if (hasBadge) {
        allBadges.push(user.badges.find(b => b.name === rule.name));
        continue;
      }
      if (await achievementService.meetsCriteria(user, stats, rule)) {
        const newBadge = { ...rule, earnedAt: new Date() };
        newlyEarned.push(newBadge);
        if (!user.progress) user.progress = { totalPoints: 0, badges: [] };
        user.progress.badges = user.progress.badges || [];
        user.progress.badges.push(newBadge);
        user.progress.totalPoints = (user.progress.totalPoints || 0) + rule.points;
        user.markModified('progress');
        await achievementService.sendAchievementNotification(userId, newBadge);
      }
    }

    if (newlyEarned.length > 0) {
      user.badges = [...(user.badges || []), ...newlyEarned];
      await user.save();
      logger.info(`User ${userId} earned ${newlyEarned.length} new badges`);
    }

    res.json({ success: true, earnedNow: newlyEarned, allBadges, totalBadges: allBadges.length, totalPoints: user.totalPoints });
  } catch (err) {
    next(err);
  }
};

exports.getAchievements = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { category, tier } = req.query;
    const user = await User.findById(userId).select('badges');
    if (!user) throw new AppError('User not found', 404);

    const allBadges = achievementService.BADGE_RULES.map(rule => {
      const earned = user.badges?.find(b => b.name === rule.name);
      return { ...rule, earned: !!earned, earnedAt: earned?.earnedAt || null };
    });

    let filteredBadges = allBadges;
    if (category) filteredBadges = filteredBadges.filter(b => b.category === category);
    if (tier) filteredBadges = filteredBadges.filter(b => b.tier === tier);

    const groupedByCategory = filteredBadges.reduce((acc, badge) => {
      if (!acc[badge.category]) acc[badge.category] = [];
      acc[badge.category].push(badge);
      return acc;
    }, {});

    const totalBadges = achievementService.BADGE_RULES.length;
    const earnedCount = user.badges?.length || 0;
    const progress = {
      total: totalBadges,
      earned: earnedCount,
      percentage: Math.round((earnedCount / totalBadges) * 100),
      nextBadge: await achievementService.getNextAchievableBadge(user),
    };

    res.json({ success: true, badges: filteredBadges, groupedByCategory, progress, categories: Object.keys(groupedByCategory) });
  } catch (err) {
    next(err);
  }
};

exports.getAchievementStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select('badges');
    if (!user) throw new AppError('User not found', 404);

    const stats = {
      totalEarned: user.badges?.length || 0,
      byTier: {},
      byCategory: {},
      recentEarnings: user.badges?.slice(-5).map(b => ({ name: b.name, icon: b.icon, earnedAt: b.earnedAt })) || [],
    };

    user.badges?.forEach(badge => {
      const rule = achievementService.BADGE_RULES.find(r => r.name === badge.name);
      if (rule) {
        stats.byTier[rule.tier] = (stats.byTier[rule.tier] || 0) + 1;
        stats.byCategory[rule.category] = (stats.byCategory[rule.category] || 0) + 1;
      }
    });

    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
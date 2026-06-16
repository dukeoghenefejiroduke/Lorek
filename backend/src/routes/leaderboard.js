const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { contentLimiter } = require('../middleware/rateLimit');
const { query, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { cacheMiddleware } = require('../middleware/cache');
const redis = require('../config/redis');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(contentLimiter);

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validateLeaderboardQuery = [
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'allTime']),
  query('category').optional().isIn(['points', 'streak', 'words', 'lessons', 'accuracy']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get date range based on period
 */
function getDateRange(period) {
  const now = new Date();
  let start, end;

  switch (period) {
    case 'daily':
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
      break;case 'weekly':
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to start on Monday
        start = new Date(d.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
     break;

    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    default:
      return null;
  }

  return { start, end };
}

/**
 * Get points leaderboard
 */
async function getPointsLeaderboard(period, limit, skip, userId = null) {
  let sortField = { 'progress.totalPoints': -1 };
  
  if (period !== 'allTime') {
    // For time-based leaderboard, we need to aggregate from activity
    // This simplified version uses total points
    sortField = { 'progress.totalPoints': -1 };
  }

  const users = await User.find({ status: 'active' })
    .select('username profile.avatar progress.totalPoints progress.streak.current progress.badges')
    .sort(sortField)
    .skip(skip)
    .limit(limit);

  const leaderboard = users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.thumbnail || user.profile?.avatar?.url,
    points: user.progress?.totalPoints || 0,
    streak: user.progress?.streak?.current || 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));

  // Get user's rank if userId provided
  let userRank = null;
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      const higherRanked = await User.countDocuments({
        status: 'active',
        'progress.totalPoints': { $gt: user.progress?.totalPoints || 0 },
      });
      const totalUsers = await User.countDocuments({ status: 'active' });
      userRank = {
        rank: higherRanked + 1,
        outOf: totalUsers,
        percentile: totalUsers > 0 ? Math.round(((totalUsers - higherRanked) / totalUsers) * 100) : 0,
      };
    }
  }

  return { leaderboard, userRank };
}

/**
 * Get streak leaderboard
 */
async function getStreakLeaderboard(limit, skip, userId = null) {
  const users = await User.find({ status: 'active' })
    .select('username profile.avatar progress.streak.current progress.badges')
    .sort({ 'progress.streak.current': -1 })
    .skip(skip)
    .limit(limit);

  const leaderboard = users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.thumbnail || user.profile?.avatar?.url,
    streak: user.progress?.streak?.current || 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));

  let userRank = null;
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      const higherRanked = await User.countDocuments({
        status: 'active',
        'progress.streak.current': { $gt: user.progress?.streak?.current || 0 },
      });
      const totalUsers = await User.countDocuments({ status: 'active' });
      userRank = {
        rank: higherRanked + 1,
        outOf: totalUsers,
      };
    }
  }

  return { leaderboard, userRank };
}

/**
 * Get words leaderboard
 */

async function getWordsLeaderboard(limit, skip, userId = null) {
  // Fetch active users with necessary fields
  const users = await User.find({ status: 'active' })
    .select('username profile.avatar progress.badges vocabularyMastery');

  // Calculate word count in JS
  const leaderboardData = users.map(user => ({
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.thumbnail || user.profile?.avatar?.url,
    words: user.vocabularyMastery ? user.vocabularyMastery.length : 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));

  // Sort and Paginate
  const sorted = leaderboardData.sort((a, b) => b.words - a.words);
  const leaderboard = sorted.slice(skip, skip + limit).map((item, index) => ({
    ...item,
    rank: skip + index + 1,
  }));

  let userRank = null;
  if (userId) {
    const targetId = userId.toString();
    const userData = leaderboardData.find(u => u.userId.toString() === targetId);
    if (userData) {
      userRank = {
        rank: leaderboardData.filter(u => u.words > userData.words).length + 1,
        outOf: leaderboardData.length,
      };
    }
  }

  return { leaderboard, userRank };
}


/**
 * Get lessons leaderboard
 */
async function getLessonsLeaderboard(limit, skip, userId = null) {
  const users = await User.find({ status: 'active' })
    .select('username profile.avatar progress.lessonStats.totalCompleted progress.badges')
    .sort({ 'progress.lessonStats.totalCompleted': -1 })
    .skip(skip)
    .limit(limit);

  const leaderboard = users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.thumbnail || user.profile?.avatar?.url,
    lessons: user.progress?.lessonStats?.totalCompleted || 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));

  let userRank = null;
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      const lessonsCompleted = user.progress?.lessonStats?.totalCompleted || 0;
      const higherRanked = await User.countDocuments({
        status: 'active',
        'progress.lessonStats.totalCompleted': { $gt: lessonsCompleted },
      });
      const totalUsers = await User.countDocuments({ status: 'active' });
      userRank = {
        rank: higherRanked + 1,
        outOf: totalUsers,
      };
    }
  }

  return { leaderboard, userRank };
}

/**
 * Get accuracy leaderboard
 */
async function getAccuracyLeaderboard(limit, skip, userId = null) {
  const users = await User.find({ status: 'active' })
    .select('username profile.avatar progress.totalWords progress.badges vocabularyMastery')
    .sort({ 'progress.totalWords': -1 }) // Database handles sorting
    .skip(skip)
    .limit(limit);

  const leaderboardData = users.map(user => {
    let accuracy = 0;
    if (user.vocabularyMastery && user.vocabularyMastery.length > 0) {
      const totalReviews = user.vocabularyMastery.reduce((sum, v) => sum + (v.reviewCount || 0), 0);
      const correctReviews = user.vocabularyMastery.reduce((sum, v) => sum + (v.correctCount || 0), 0);
      accuracy = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;
    }
    return {
      userId: user._id,
      username: user.username,
      avatar: user.profile?.avatar?.thumbnail || user.profile?.avatar?.url,
      accuracy: Math.round(accuracy),
      badgeCount: user.progress?.badges?.length || 0,
    };
  });

  const sorted = leaderboardData.sort((a, b) => b.accuracy - a.accuracy);
  const leaderboard = sorted.slice(skip, skip + limit).map((item, index) => ({
    ...item,
    rank: skip + index + 1,
  }));

  let userRank = null;
  if (userId) {
    // 1. Ensure userId exists and cast to string for comparison
    const targetId = userId.toString();
    
    // 2. Find the user in the data list
    const userData = leaderboardData.find(u => u.userId && u.userId.toString() === targetId);

    if (userData) {
      const rank = leaderboardData.filter(u => u.accuracy > userData.accuracy).length + 1;
      userRank = {
        rank,
        outOf: leaderboardData.length,
      };
    } else {
      // 3. Fallback: If user has no data yet, they are at the bottom
      userRank = { 
        rank: leaderboardData.length + 1, 
        outOf: leaderboardData.length + 1 
      };
    }
  }

  return { leaderboard, userRank };
}

// ============================================================================
// MAIN LEADERBOARD ENDPOINT
// ============================================================================

/**
 * Get leaderboard with multiple categories and timeframes
 * GET /api/leaderboard
 */
// Add 'auth' here so req.user is populated

router.get('/', auth, validateLeaderboardQuery, cacheMiddleware(300), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      period = 'weekly',
      category = 'points',
      limit = 20,
      page = 1,
    } = req.query;

    const userId = req.user._id;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    let result;
    let total = 0;

    // Each function now just returns { leaderboard, userRank }
    switch (category) {
      case 'points':
        result = await getPointsLeaderboard(period, parsedLimit, skip, userId);
        total = await User.countDocuments({ status: 'active' });
        break;
      case 'streak':
        result = await getStreakLeaderboard(parsedLimit, skip, userId);
        total = await User.countDocuments({ status: 'active' });
        break;
      case 'words':
        result = await getWordsLeaderboard(parsedLimit, skip, userId);
        total = await User.countDocuments({ status: 'active' }); 
        break;
      case 'lessons':
        result = await getLessonsLeaderboard(parsedLimit, skip, userId);
        total = await User.countDocuments({ status: 'active' });
        break;
      case 'accuracy':
        result = await getAccuracyLeaderboard(parsedLimit, skip, userId);
        total = await User.countDocuments({ status: 'active' });
        break;
      default:
        throw new AppError('Invalid category', 400);
    }

    // Response is sent; cacheMiddleware intercepts this and 
    // stores it in Redis automatically using the URL as the key.
    res.json({
      success: true,
      data: {
        leaderboard: result.leaderboard,
        userRank: result.userRank,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parsedLimit),
          totalItems: total,
          itemsPerPage: parsedLimit,
        },
      },
      meta: {
        period,
        category,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET USER RANK
// ============================================================================

/**
 * Get current user's rank across different categories
 * GET /api/leaderboard/rank
 */router.get('/rank', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) throw new AppError('User not found', 404);

    // 1. Calculate Ranks (Points as primary example)
    const pointsHigher = await User.countDocuments({
      status: 'active',
      'progress.totalPoints': { $gt: user.progress?.totalPoints || 0 },
    });
    const pointsRank = pointsHigher + 1;

    // Streak rank
    const streakHigher = await User.countDocuments({
      status: 'active',
      'progress.streak.current': { $gt: user.progress?.streak?.current || 0 },
    });
    const streakRank = streakHigher + 1;

    // Words rank
    const wordCount = user.vocabularyMastery?.length || 0;

    // Instead of $expr/ $size, fetch users and filter, 
    // or if the user count is huge, use a simpler indexed field if possible.
    // For now, to maintain FerretDB compatibility:
    const allUsersWithVocab = await User.find({ status: 'active' }).select('vocabularyMastery');
    const wordsHigher = allUsersWithVocab.filter(u => (u.vocabularyMastery?.length || 0) > wordCount).length;
    const wordsRank = wordsHigher + 1;


    // Lessons rank
    const lessonsCompleted = user.progress?.lessonStats?.totalCompleted || 0;
    const lessonsHigher = await User.countDocuments({
      status: 'active',
      'progress.lessonStats.totalCompleted': { $gt: lessonsCompleted },
    });
    const lessonsRank = lessonsHigher + 1;

    const totalUsers = await User.countDocuments({ status: 'active' });
    // 2. SENSIBLE NOTIFICATION TRIGGER
    // Check Redis for the user's "last known rank"
    const rankCacheKey = `user:rank:last:${userId}`;
    const lastRank = await redis.get(rankCacheKey);

    if (lastRank) {
      const prevRank = parseInt(lastRank);
      // If current rank is smaller (better) than previous rank
      if (pointsRank < prevRank) {
        notificationService.sendLeaderboardUpdate(
          userId, 
          pointsRank, 
          'Overall Points'
        ).catch(err => logger.error('Leaderboard notification failed', err));
      }
    }

    // 3. Update the "last known rank" in Redis
    await redis.set(rankCacheKey, pointsRank.toString(), { EX: 604800 }); // Keep for 7 days

    res.json({
      success: true,
      data: {
        points: {
          rank: pointsRank,
          outOf: await User.countDocuments({ status: 'active' }),
          percentile: Math.round(((totalUsers - pointsRank) / totalUsers) * 100),
        },

        streak: {
          rank: streakRank,
          outOf: totalUsers,
        },
        words: {
          rank: wordsRank,
          outOf: totalUsers,
        },
        lessons: {
          rank: lessonsRank,
          outOf: totalUsers,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET FRIENDS LEADERBOARD
// ============================================================================

/**
 * Get leaderboard filtered by friends
 * GET /api/leaderboard/friends
 */
router.get('/friends', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { category = 'points', limit = 20 } = req.query;

    const user = await User.findById(userId).populate('friends.user', 'username profile.avatar progress.totalPoints progress.streak.current progress.badges');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const friendIds = user.friends
      ?.filter(f => f.status === 'accepted')
      .map(f => f.user._id) || [];

    // Add current user to comparison
    friendIds.push(userId);

    let friends = [];
    if (category === 'points') {
      friends = await User.find({ _id: { $in: friendIds } })
        .select('username profile.avatar progress.totalPoints progress.streak.current progress.badges')
        .sort({ 'progress.totalPoints': -1 })
        .limit(parseInt(limit));
    } else if (category === 'streak') {
      friends = await User.find({ _id: { $in: friendIds } })
        .select('username profile.avatar progress.streak.current progress.badges')
        .sort({ 'progress.streak.current': -1 })
        .limit(parseInt(limit));
    }
    
    
const leaderboard = friends
  .filter(f => f) // Remove any null entries from deleted users
  .map((friend, index) => ({
    rank: index + 1,
    userId: friend._id,
    username: friend.username,
    avatar: friend.profile?.avatar?.thumbnail || friend.profile?.avatar?.url,
    points: friend.progress?.totalPoints || 0,
    streak: friend.progress?.streak?.current || 0,
    badgeCount: friend.progress?.badges?.length || 0,
    isCurrentUser: friend._id.toString() === userId.toString(),
  }));

    res.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
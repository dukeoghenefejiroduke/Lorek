const User = require('../models/User');
const Achievement = require('../models/Achievement');
const Badge = require('../models/Badge');
const LeaderboardHistory = require('../models/LeaderboardHistory');
const notificationService = require('../services/notificationService');
const { logger } = require('../config/logger');
const redis = require('../config/redis');
const { AppError, ValidationError } = require('../middleware/errorHandler');

// ============================================================================
// BADGE & ACHIEVEMENT CONFIGURATION
// ============================================================================

const BADGE_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  DIAMOND: 'diamond',
};

const BADGE_CATEGORIES = {
  STREAK: 'streak',
  VOCABULARY: 'vocabulary',
  LESSONS: 'lessons',
  SOCIAL: 'social',
  SPECIAL: 'special',
  MASTERY: 'mastery',
};

const BADGE_RULES = [
  // Streak Badges
  { 
    name: 'First Flame', 
    description: 'Started your learning journey with a 3-day streak',
    criteria: { streak: 3 }, 
    icon: '🔥', 
    tier: BADGE_TIERS.BRONZE,
    category: BADGE_CATEGORIES.STREAK,
    points: 50,
  },
  { 
    name: 'Week Warrior', 
    description: 'Maintained a 7-day learning streak',
    criteria: { streak: 7 }, 
    icon: '⚡', 
    tier: BADGE_TIERS.SILVER,
    category: BADGE_CATEGORIES.STREAK,
    points: 100,
  },
  { 
    name: 'Monthly Master', 
    description: '30 days of consecutive learning',
    criteria: { streak: 30 }, 
    icon: '🌙', 
    tier: BADGE_TIERS.GOLD,
    category: BADGE_CATEGORIES.STREAK,
    points: 300,
  },
  { 
    name: 'Year-Long Legend', 
    description: '365 days of dedication to Izon',
    criteria: { streak: 365 }, 
    icon: '👑', 
    tier: BADGE_TIERS.DIAMOND,
    category: BADGE_CATEGORIES.STREAK,
    points: 1000,
  },

  // Vocabulary Badges
  { 
    name: 'Izon Novice', 
    description: 'Learned your first 10 Izon words',
    criteria: { wordsMastered: 10 }, 
    icon: '🌱', 
    tier: BADGE_TIERS.BRONZE,
    category: BADGE_CATEGORIES.VOCABULARY,
    points: 50,
  },
  { 
    name: 'Word Collector', 
    description: 'Mastered 50 Izon words',
    criteria: { wordsMastered: 50 }, 
    icon: '📚', 
    tier: BADGE_TIERS.SILVER,
    category: BADGE_CATEGORIES.VOCABULARY,
    points: 150,
  },
  { 
    name: 'Vocabulary King', 
    description: 'Command of 200 Izon words',
    criteria: { wordsMastered: 200 }, 
    icon: '👑', 
    tier: BADGE_TIERS.GOLD,
    category: BADGE_CATEGORIES.VOCABULARY,
    points: 400,
  },
  { 
    name: 'Izon Lexicographer', 
    description: 'Mastered 500 Izon words',
    criteria: { wordsMastered: 500 }, 
    icon: '📖', 
    tier: BADGE_TIERS.PLATINUM,
    category: BADGE_CATEGORIES.VOCABULARY,
    points: 800,
  },
  { 
    name: 'Living Dictionary', 
    description: 'Achieved mastery of 1000 Izon words',
    criteria: { wordsMastered: 1000 }, 
    icon: '🗣️', 
    tier: BADGE_TIERS.DIAMOND,
    category: BADGE_CATEGORIES.VOCABULARY,
    points: 1500,
  },

  // Points Badges
  { 
    name: 'Point Seeker', 
    description: 'Earned 100 points',
    criteria: { points: 100 }, 
    icon: '⭐', 
    tier: BADGE_TIERS.BRONZE,
    category: BADGE_CATEGORIES.LESSONS,
    points: 25,
  },
  { 
    name: 'Centurion', 
    description: 'Earned 1000 points',
    criteria: { points: 1000 }, 
    icon: '💫', 
    tier: BADGE_TIERS.SILVER,
    category: BADGE_CATEGORIES.LESSONS,
    points: 100,
  },
  { 
    name: 'Point Millionaire', 
    description: 'Earned 5000 points',
    criteria: { points: 5000 }, 
    icon: '💰', 
    tier: BADGE_TIERS.GOLD,
    category: BADGE_CATEGORIES.LESSONS,
    points: 500,
  },
  { 
    name: 'Izon Elder', 
    description: 'Achieved 10000 points and deep cultural understanding',
    criteria: { points: 10000 }, 
    icon: '🦅', 
    tier: BADGE_TIERS.DIAMOND,
    category: BADGE_CATEGORIES.SPECIAL,
    points: 1000,
  },

  // Lesson Completion Badges
  { 
    name: 'Lesson Starter', 
    description: 'Completed your first lesson',
    criteria: { lessonsCompleted: 1 }, 
    icon: '🎓', 
    tier: BADGE_TIERS.BRONZE,
    category: BADGE_CATEGORIES.LESSONS,
    points: 25,
  },
  { 
    name: 'Dedicated Learner', 
    description: 'Completed 25 lessons',
    criteria: { lessonsCompleted: 25 }, 
    icon: '📝', 
    tier: BADGE_TIERS.SILVER,
    category: BADGE_CATEGORIES.LESSONS,
    points: 150,
  },
  { 
    name: 'Course Conqueror', 
    description: 'Completed 100 lessons',
    criteria: { lessonsCompleted: 100 }, 
    icon: '🏆', 
    tier: BADGE_TIERS.GOLD,
    category: BADGE_CATEGORIES.LESSONS,
    points: 500,
  },

  // Social Badges
  { 
    name: 'Social Butterfly', 
    description: 'Invited 3 friends to learn Izon',
    criteria: { referrals: 3 }, 
    icon: '🦋', 
    tier: BADGE_TIERS.SILVER,
    category: BADGE_CATEGORIES.SOCIAL,
    points: 100,
  },
  { 
    name: 'Community Leader', 
    description: 'Invited 10 friends to learn Izon',
    criteria: { referrals: 10 }, 
    icon: '👥', 
    tier: BADGE_TIERS.GOLD,
    category: BADGE_CATEGORIES.SOCIAL,
    points: 300,
  },
  { 
    name: 'Ambassador', 
    description: 'Invited 25 friends to learn Izon',
    criteria: { referrals: 25 }, 
    icon: '🤝', 
    tier: BADGE_TIERS.PLATINUM,
    category: BADGE_CATEGORIES.SOCIAL,
    points: 600,
  },

  // Special Badges
  { 
    name: 'Early Bird', 
    description: 'Joined during the first month of Izon App',
    criteria: { earlyAdopter: true }, 
    icon: '🐦', 
    tier: BADGE_TIERS.SPECIAL,
    category: BADGE_CATEGORIES.SPECIAL,
    points: 200,
    secret: true,
  },
  { 
    name: 'Perfect Week', 
    description: 'Completed at least one lesson every day for a week',
    criteria: { perfectWeek: 1 }, 
    icon: '✨', 
    tier: BADGE_TIERS.SILVER,
    category: BADGE_CATEGORIES.STREAK,
    points: 150,
  },
  { 
    name: 'Night Owl', 
    description: 'Learned after midnight 5 times',
    criteria: { nightStudy: 5 }, 
    icon: '🦉', 
    tier: BADGE_TIERS.BRONZE,
    category: BADGE_CATEGORIES.SPECIAL,
    points: 75,
  },
];

// ============================================================================
// LEADERBOARD FUNCTIONS
// ============================================================================

/**
 * Get leaderboard with multiple timeframes and filters
 * GET /api/progress/leaderboard
 */
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { 
      period = 'weekly', 
      category = 'points',
      limit = 20,
      page = 1,
      includeUser = true,
    } = req.query;

    const userId = req.userId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];
    if (!validPeriods.includes(period)) {
      throw new ValidationError('Invalid period specified');
    }

    // Determine date range based on period
    const dateRange = getDateRange(period);

    // Get leaderboard based on category
    let leaderboard;
    let userRank = null;

    switch (category) {
      case 'points':
        leaderboard = await getPointsLeaderboard(dateRange, limit, skip);
        if (includeUser && userId) {
          userRank = await getUserPointsRank(userId, dateRange);
        }
        break;
      
      case 'streak':
        leaderboard = await getStreakLeaderboard(limit, skip);
        if (includeUser && userId) {
          userRank = await getUserStreakRank(userId);
        }
        break;
      
      case 'words':
        leaderboard = await getWordsLeaderboard(limit, skip);
        if (includeUser && userId) {
          userRank = await getUserWordsRank(userId);
        }
        break;
      
      case 'lessons':
        leaderboard = await getLessonsLeaderboard(limit, skip);
        if (includeUser && userId) {
          userRank = await getUserLessonsRank(userId);
        }
        break;
      
      default:
        throw new ValidationError('Invalid category specified');
    }

    // Get total count for pagination
    const total = await getLeaderboardTotalCount(category, dateRange);

    // Cache leaderboard in Redis for 5 minutes
    const cacheKey = `leaderboard:${period}:${category}:${page}`;
    await redis.set(cacheKey, leaderboard, 300);

    res.json({
      success: true,
      leaderboard,
      userRank,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      period,
      category,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get user's rank and progress
 * GET /api/progress/rank
 */
exports.getUserRank = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { period = 'weekly' } = req.query;

    const user = await User.findById(userId)
      .select('username progress totalPoints vocabularyMastery lessonsCompleted');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get ranks in different categories
    const [pointsRank, streakRank, wordsRank, lessonsRank] = await Promise.all([
      getUserPointsRank(userId, getDateRange(period)),
      getUserStreakRank(userId),
      getUserWordsRank(userId),
      getUserLessonsRank(userId),
    ]);

    // Get nearby competitors
    const nearbyCompetitors = await getNearbyCompetitors(userId, pointsRank.rank, period);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        points: user.totalPoints,
        streak: user.streak,
        wordsMastered: user.vocabularyMastery?.length || 0,
        lessonsCompleted: user.lessonsCompleted || 0,
      },
      ranks: {
        points: pointsRank,
        streak: streakRank,
        words: wordsRank,
        lessons: lessonsRank,
      },
      nearbyCompetitors,
      period,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get leaderboard history
 * GET /api/progress/leaderboard/history
 */
exports.getLeaderboardHistory = async (req, res, next) => {
  try {
    const { period = 'weekly', limit = 10 } = req.query;

    const history = await LeaderboardHistory.find({ period })
      .sort({ weekStart: -1 })
      .limit(parseInt(limit))
      .populate('topUsers.userId', 'username');

    res.json({
      success: true,
      history,
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// ACHIEVEMENT FUNCTIONS
// ============================================================================

/**
 * Check and award achievements
 * POST /api/progress/achievements/check
 */
exports.checkAchievements = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get user's current stats
    const stats = await getUserStats(user);

    // Check each badge rule
    const newlyEarned = [];
    const allBadges = [];

    for (const rule of BADGE_RULES) {
      // Skip secret badges if not eligible
      if (rule.secret && !await isEligibleForSecretBadge(user, rule)) {
        continue;
      }

      // Check if user already has this badge
      const hasBadge = user.badges?.some(b => b.name === rule.name);
      
      if (hasBadge) {
        allBadges.push(user.badges.find(b => b.name === rule.name));
        continue;
      }

      // Check if criteria met
if (await meetsCriteria(user, stats, rule)) {
  const newBadge = {
    name: rule.name,
    description: rule.description,
    icon: rule.icon,
    tier: rule.tier,
    category: rule.category,
    points: rule.points,
    earnedAt: new Date(),
  };

  newlyEarned.push(newBadge);
  
  // Ensure the progress object exists
  if (!user.progress) user.progress = { totalPoints: 0, badges: [] };
  
  // Push to the array
  user.progress.badges = user.progress.badges || [];
  user.progress.badges.push(newBadge);
  
  // Update points
  user.progress.totalPoints = (user.progress.totalPoints || 0) + rule.points;

  // MANDATORY FOR FERRETDB: Tell Mongoose the nested object changed
  user.markModified('progress');
  
  await sendAchievementNotification(userId, newBadge);
}
}
    // Update user's badges
    if (newlyEarned.length > 0) {
      user.badges = [...(user.badges || []), ...newlyEarned];
      await user.save();

      // Log achievement
      logger.info(`User ${userId} earned ${newlyEarned.length} new badges`);
    }

    res.json({
      success: true,
      earnedNow: newlyEarned,
      allBadges,
      totalBadges: allBadges.length,
      totalPoints: user.totalPoints,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get user's achievements
 * GET /api/progress/achievements
 */
exports.getAchievements = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { category, tier } = req.query;

    const user = await User.findById(userId).select('badges');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get all available badges with earned status
    const allBadges = BADGE_RULES.map(rule => {
      const earned = user.badges?.find(b => b.name === rule.name);
      return {
        ...rule,
        earned: !!earned,
        earnedAt: earned?.earnedAt || null,
      };
    });

    // Filter by category if specified
    let filteredBadges = allBadges;
    if (category) {
      filteredBadges = filteredBadges.filter(b => b.category === category);
    }
    if (tier) {
      filteredBadges = filteredBadges.filter(b => b.tier === tier);
    }

    // Group by category
    const groupedByCategory = filteredBadges.reduce((acc, badge) => {
      if (!acc[badge.category]) {
        acc[badge.category] = [];
      }
      acc[badge.category].push(badge);
      return acc;
    }, {});

    // Calculate progress
    const totalBadges = BADGE_RULES.length;
    const earnedCount = user.badges?.length || 0;
    const progress = {
      total: totalBadges,
      earned: earnedCount,
      percentage: Math.round((earnedCount / totalBadges) * 100),
      nextBadge: await getNextAchievableBadge(user),
    };

    res.json({
      success: true,
      badges: filteredBadges,
      groupedByCategory,
      progress,
      categories: Object.keys(groupedByCategory),
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get achievement statistics
 * GET /api/progress/achievements/stats
 */
exports.getAchievementStats = async (req, res, next) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('badges');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Calculate stats
    const stats = {
      totalEarned: user.badges?.length || 0,
      byTier: {},
      byCategory: {},
      recentEarnings: user.badges?.slice(-5).map(b => ({
        name: b.name,
        icon: b.icon,
        earnedAt: b.earnedAt,
      })) || [],
    };

    // Count by tier
    user.badges?.forEach(badge => {
      const rule = BADGE_RULES.find(r => r.name === badge.name);
      if (rule) {
        stats.byTier[rule.tier] = (stats.byTier[rule.tier] || 0) + 1;
        stats.byCategory[rule.category] = (stats.byCategory[rule.category] || 0) + 1;
      }
    });

    res.json({
      success: true,
      stats,
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get date range based on period
 */
const getDateRange = (period) => {
  const now = new Date();
  let start, end;

  switch (period) {
    case 'daily':
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
      break;
    
    case 'weekly':
      const firstDay = now.getDate() - now.getDay();
      start = new Date(now.setDate(firstDay));
      start.setHours(0, 0, 0, 0);
      end = new Date(now.setDate(firstDay + 6));
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
};

/**
 * Get points leaderboard
 */
const getPointsLeaderboard = async (dateRange, limit, skip) => {
  let query = {};

  if (dateRange) {
    // For time-based leaderboard, we need to aggregate from activity logs
    // This is a simplified version - in production, you'd have an Activity collection
    query = { 'progress.lastActive': { $gte: dateRange.start, $lte: dateRange.end } };
  }

  const users = await User.find(query)
    .select('username progress.totalPoints progress.streak badges')
    .sort({ 'progress.totalPoints': -1 })
    .skip(skip)
    .limit(limit);

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    points: user.progress?.totalPoints || 0,
    streak: user.progress?.streak || 0,
    badgeCount: user.badges?.length || 0,
    trend: calculateTrend(user),
  }));
};

/**
 * Get streak leaderboard
 */
const getStreakLeaderboard = async (limit, skip) => {
  const users = await User.find({})
    .select('username progress.streak badges')
    .sort({ 'progress.streak': -1 })
    .skip(skip)
    .limit(limit);

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    streak: user.progress?.streak || 0,
    badgeCount: user.badges?.length || 0,
  }));
};

/**
 * Get words mastered leaderboard
 */
const getWordsLeaderboard = async (limit, skip) => {
  const users = await User.find({})
    .select('username vocabularyMastery badges')
    .sort({ vocabularyMastery: -1 })
    .skip(skip)
    .limit(limit);

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    wordsMastered: user.vocabularyMastery?.length || 0,
    badgeCount: user.badges?.length || 0,
  }));
};

/**
 * Get lessons completed leaderboard
 */
const getLessonsLeaderboard = async (limit, skip) => {
  const users = await User.find({})
    .select('username lessonsCompleted badges')
    .sort({ lessonsCompleted: -1 })
    .skip(skip)
    .limit(limit);

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    lessonsCompleted: user.lessonsCompleted || 0,
    badgeCount: user.badges?.length || 0,
  }));
};

/**
 * Get user's points rank
 */
const getUserPointsRank = async (userId, dateRange) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const higherRanked = await User.countDocuments({
    'progress.totalPoints': { $gt: user.progress?.totalPoints || 0 },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
    percentile: ((higherRanked) / totalUsers * 100).toFixed(1),
  };
};

/**
 * Get user's streak rank
 */
const getUserStreakRank = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const higherRanked = await User.countDocuments({
    'progress.streak': { $gt: user.progress?.streak || 0 },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
  };
};

/**
 * Get user's words rank - Optimized for FerretDB
 */
const getUserWordsRank = async (userId) => {
  const user = await User.findById(userId).select('vocabularyMastery');
  if (!user) return null;

  const wordsCount = user.vocabularyMastery?.length || 0;

  // FerretDB Compatibility: Use a more standard query structure
  // Note: If you store the count in a field, this is 100x faster
  const higherRanked = await User.countDocuments({
    "vocabularyMastery.wordsCount": { $gt: wordsCount } 
  });

  // If you don't have a count field, use this fallback for FerretDB:
  // const allUsers = await User.find({}, 'vocabularyMastery');
  // const higherRanked = allUsers.filter(u => (u.vocabularyMastery?.length || 0) > wordsCount).length;

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
  };
};

/**
 * Get user's lessons rank
 */
const getUserLessonsRank = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const higherRanked = await User.countDocuments({
    lessonsCompleted: { $gt: user.lessonsCompleted || 0 },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
  };
};

/**
 * Get nearby competitors
 */
const getNearbyCompetitors = async (userId, userRank, period) => {
  const range = 3; // Show 3 above and below
  const startRank = Math.max(1, userRank - range);
  const endRank = userRank + range;

  const users = await User.find({})
    .select('username progress.totalPoints')
    .sort({ 'progress.totalPoints': -1 })
    .skip(startRank - 1)
    .limit(endRank - startRank + 1);

  return users.map((user, index) => ({
    rank: startRank + index,
    userId: user._id,
    username: user.username,
    points: user.progress?.totalPoints || 0,
    isCurrentUser: user._id.toString() === userId,
  }));
};

/**
 * Get leaderboard total count
 */
const getLeaderboardTotalCount = async (category, dateRange) => {
  switch (category) {
    case 'points':
      return await User.countDocuments(dateRange ? {
        'progress.lastActive': { $gte: dateRange.start, $lte: dateRange.end },
      } : {});
    default:
      return await User.countDocuments();
  }
};

/**
 * Get user stats for achievement checking
 */
const getUserStats = async (user) => {
  return {   
    points: user.progress?.totalPoints || 0,
    // Fix: Ensure we are accessing the correct path for current streak
    streak: typeof user.progress?.streak === 'number' 
      ? user.progress.streak 
      : user.progress?.streak?.current || 0,
    wordsMastered: user.vocabularyMastery?.length || 0,
    lessonsCompleted: user.lessonsCompleted || user.progress?.completedLessons?.length || 0,
    referrals: user.referrals?.length || 0,
    createdAt: user.createdAt,
    studyTimes: user.studyTimes || [],
  };
};

/**
 * Check if user meets badge criteria
 */
const meetsCriteria = async (user, stats, rule) => {
  const criteria = rule.criteria;
  
  // Use the stats object which we'll ensure pulls from the correct schema paths
  if (criteria.streak && stats.streak < criteria.streak) return false;
  if (criteria.points && stats.points < criteria.points) return false;
  if (criteria.wordsMastered && stats.wordsMastered < criteria.wordsMastered) return false;
  if (criteria.lessonsCompleted && stats.lessonsCompleted < criteria.lessonsCompleted) return false;
  if (criteria.referrals && stats.referrals < criteria.referrals) return false;
  
  if (criteria.earlyAdopter) {
    const launchDate = new Date('2024-01-01'); // Example launch date
    if (user.createdAt > launchDate) return false;
  }

  if (criteria.perfectWeek) {
    // Check if user completed lessons every day for a week
    const perfectWeeks = await checkPerfectWeeks(user);
    if (perfectWeeks < criteria.perfectWeek) return false;
  }

  if (criteria.nightStudy) {
    const nightStudyCount = stats.studyTimes.filter(t => {
      const hour = new Date(t).getHours();
      return hour >= 0 && hour <= 4;
    }).length;
    if (nightStudyCount < criteria.nightStudy) return false;
  }

  return true;
};

/**
 * Check if user is eligible for secret badge
 */
const isEligibleForSecretBadge = async (user, rule) => {
  // Secret badges have hidden requirements
  // This is where you'd implement special logic
  return true; // For now, always eligible to check
};

/**
 * Calculate trend (up/down/stable)
 */
const calculateTrend = (user) => {
  // In production, compare with previous period
  // For now, return random for demo
  const trends = ['up', 'down', 'stable'];
  return trends[Math.floor(Math.random() * trends.length)];
};

/**
 * Send achievement notification
 */
const sendAchievementNotification = async (userId, badge) => {
  try {
    await notificationService.sendBadgeEarned(userId,
    {
      type: 'achievement',
      title: '🏆 New Badge Earned!',
      body: `Congratulations! You've earned the "${badge.name}" badge.`,
      data: { badge },
    });
  } catch (error) {
    logger.error('Failed to send achievement notification:', error);
  }
};

/**
 * Get next achievable badge
 */
const getNextAchievableBadge = async (user) => {
  const stats = await getUserStats(user);
  const earnedNames = new Set(user.badges?.map(b => b.name) || []);

  for (const rule of BADGE_RULES) {
    if (!earnedNames.has(rule.name)) {
      const progress = calculateProgress(stats, rule.criteria);
      return {
        ...rule,
        progress,
        remaining: calculateRemaining(stats, rule.criteria),
      };
    }
  }

  return null;
};

/**
 * Calculate progress towards a badge
 */
const calculateProgress = (stats, criteria) => {
  if (criteria.streak) {
    return Math.min(100, (stats.streak / criteria.streak) * 100);
  }
  if (criteria.points) {
    return Math.min(100, (stats.points / criteria.points) * 100);
  }
  if (criteria.wordsMastered) {
    return Math.min(100, (stats.wordsMastered / criteria.wordsMastered) * 100);
  }
  if (criteria.lessonsCompleted) {
    return Math.min(100, (stats.lessonsCompleted / criteria.lessonsCompleted) * 100);
  }
  if (criteria.referrals) {
    return Math.min(100, (stats.referrals / criteria.referrals) * 100);
  }
  return 0;
};

/**
 * Calculate remaining to earn badge
 */
const calculateRemaining = (stats, criteria) => {
  if (criteria.streak) {
    return Math.max(0, criteria.streak - stats.streak);
  }
  if (criteria.points) {
    return Math.max(0, criteria.points - stats.points);
  }
  if (criteria.wordsMastered) {
    return Math.max(0, criteria.wordsMastered - stats.wordsMastered);
  }
  if (criteria.lessonsCompleted) {
    return Math.max(0, criteria.lessonsCompleted - stats.lessonsCompleted);
  }
  if (criteria.referrals) {
    return Math.max(0, criteria.referrals - stats.referrals);
  }
  return 0;
};

/**
 * Check perfect weeks (simplified)
 */
const checkPerfectWeeks = async (user) => {
  // In production, query activity logs
  // For now, return 0
  return 0;
};

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

/**
 * Update leaderboard history (run weekly)
 */
exports.updateLeaderboardHistory = async () => {
  try {
    const weekStart = getDateRange('weekly').start;
    const topUsers = await getPointsLeaderboard(null, 10, 0);

    await LeaderboardHistory.create({
      weekStart,
      period: 'weekly',
      topUsers: topUsers.map(u => ({
        userId: u.userId,
        rank: u.rank,
        points: u.points,
      })),
    });

    logger.info('Leaderboard history updated');
  } catch (error) {
    logger.error('Failed to update leaderboard history:', error);
  }
};

/**
 * Check achievements for all active users (run daily)
 */
exports.checkAllUsersAchievements = async () => {
  try {
    const activeUsers = await User.find({
      lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }).select('_id');

    logger.info(`Checking achievements for ${activeUsers.length} active users`);

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);
      await Promise.all(batch.map(user => 
        processUserAchievements(user._id)
      ));
    }

    logger.info('Achievement check completed');
  } catch (error) {
    logger.error('Failed to check all users achievements:', error);
  }
};

/**
 * Process achievements for a single user
 */
const processUserAchievements = async (userId) => {
  try {
    const req = { userId };
    const res = { json: () => {} };
    await exports.checkAchievements(req, res, () => {});
  } catch (error) {
    logger.error(`Failed to process achievements for user ${userId}:`, error);
  }
};

module.exports = exports;
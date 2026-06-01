const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const cache = require('memory-cache');

const Progress = require('../models/Progress');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const LearningAnalytics = require('../models/LearningAnalytics');
const LeaderboardHistory = require('../models/LeaderboardHistory');
const { auth } = require('../middleware/auth');
const { logger } = require('../config/logger');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const redis = require('../config/redis');
const gamificationController = require('../controllers/gamificationController');

// ============================================================================
// RATE LIMITING
// ============================================================================

const progressLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(progressLimiter);


// GET /api/progress/stats   ← Add this (heavily used in frontend)
router.get('/stats', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new AppError('User not found', 404);
    
    // Aggregate data from vocabularyMastery array
    const mastery = user.vocabularyMastery || [];
    const totalReviews = mastery.reduce((sum, v) => sum + (v.reviewCount || 0), 0);
    const correctAnswers = mastery.reduce((sum, v) => sum + (v.correctCount || 0), 0);
    
    // Derived Accuracy
    const accuracy = totalReviews > 0 ? Math.round((correctAnswers / totalReviews) * 100) : 0;
    
    // Words "Learned" (Threshold of mastery)
    const wordsLearned = mastery.filter(v => v.masteryLevel === 'mastered' || v.masteryLevel === 'learning').length;

    res.json({
      success: true,
      data: {
        totalPractice: totalReviews,
        correctAnswers: correctAnswers,
        streak: user.progress?.streak?.current || 0,
        accuracy: accuracy,
        wordsLearned: wordsLearned,
        points: user.progress?.totalPoints || 0,
        dailyProgress: user.progress?.dailyProgress || 0, // XP for the current day
        dailyGoal: user.progress?.dailyGoal || 20
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/progress/rank
 */
router.get('/rank', auth, (req, res, next) => {
    req.userId = req.user._id;
    gamificationController.getUserRank(req, res, next);
});

/**
 * GET /api/progress/monthly
 * Matches: progressAPI.getMonthly(month, year)
 */
router.get('/monthly', auth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const logs = await Progress.find({
      user: req.user._id,
      lastAttempt: { $gte: start, $lte: end }
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/progress/yearly
 * Matches: progressAPI.getYearly(year)
 */
router.get('/yearly', auth, async (req, res, next) => {
  try {
    const { year } = req.query;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);

    const logs = await Progress.find({
      user: req.user._id,
      lastAttempt: { $gte: start, $lte: end }
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/progress/reset
 * Matches: progressAPI.reset()
 */
router.post('/reset', auth, async (req, res, next) => {
  try {
    // Optional: Add a check for a 'confirm' flag in body
    await Progress.deleteMany({ user: req.user._id });
    
    const user = await User.findById(req.user._id);
    user.progress = { totalPoints: 0, completedLessons: [], badges: [], achievements: [] };
    user.vocabularyMastery = [];
    
    user.markModified('progress');
    await user.save();

    res.json({ success: true, message: 'Progress reset successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/progress/badges
 * Move this ABOVE any routes with :id parameters
 */
router.get('/badges', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('progress.badges');
    const languageId = req.languageId;
    
    // Filter badges based on language context
    const badges = (user.progress.badges || []).filter(badge => {
      if (!badge.language_id) return true; // Show global badges
      return badge.language_id.toString() === languageId?.toString();
    });
    
    res.json({ success: true, data: badges });
  } catch (err) {
    next(err);
  }
});

/**
 * Export user progress data
 * GET /api/progress/export
 */
router.get('/export', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const format = req.query.format || 'json';

    const user = await User.findById(userId)
      .select('username progress vocabularyMastery gamification')
      .lean();

    if (!user) throw new AppError('User not found', 404);

    const exportData = {
      username: user.username,
      exportedAt: new Date(),
      stats: user.progress,
      vocabulary: user.vocabularyMastery,
      achievements: user.progress?.badges || []
    };

    if (format === 'csv') {
      // Simple JSON to CSV conversion for vocabulary
      const items = user.vocabularyMastery || [];
      const replacer = (key, value) => value === null ? '' : value;
      const header = ['wordId', 'masteryLevel', 'correctCount', 'lastReviewed'];
      
      const csv = [
        header.join(','),
        ...items.map(row => header.map(fieldName => 
          JSON.stringify(row[fieldName], replacer)).join(','))
      ].join('\r\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=izon_progress.csv');
      return res.status(200).send(csv);
    }

    // Default JSON response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=izon_progress.json');
    res.status(200).send(JSON.stringify(exportData, null, 2));

  } catch (err) {
    next(err);
  }
});

/**
 * Manually trigger achievement check
 * POST /api/progress/achievements/check
 */
router.post('/achievements/check', auth, (req, res, next) => {
    req.userId = req.user._id;
    gamificationController.checkAchievements(req, res, next);
});

// Achievement Stats
router.get('/achievements/stats', auth, (req, res, next) => {
    req.userId = req.user._id;
    gamificationController.getAchievementStats(req, res, next);
});


// ============================================================================
// VALIDATION RULES
// ============================================================================

// Change this validation rule
const validateLessonId = [
  param('lessonId').custom(value => {
    // Allow slugs for Practice Mode (e.g., 'izon-to-english')
    if (typeof value === 'string' && value.includes('-')) return true;
    
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid lesson ID format');
    }
    return true;
  }),
];

// ============================================================================
// GET USER PROGRESS
// ============================================================================

/**
 * Get user's overall progress with comprehensive stats
 * GET /api/progress
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get user with populated data
    const user = await User.findById(userId)
      .populate({
        path: 'progress.completedLessons.lessonId',
        select: 'title.english level category difficulty',
      })
      .select('username progress gamification vocabularyMastery analytics learningStats');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get all progress records
    const allProgress = await Progress.find({ user: userId })
      .populate('lesson', 'title.english level category difficulty estimatedTime')
      .sort('-lastAttempt');

    // Calculate comprehensive statistics
    const stats = await calculateUserStats(user, allProgress);

    // Get current rank
    const rank = await getUserRank(userId);

    // Get streak information
    const streakInfo = await getStreakInfo(user);

    // Get recent activity
    const recentActivity = await getRecentActivity(userId, allProgress);

    // Get next milestones
    const nextMilestones = await getNextMilestones(user);

    // Get learning recommendations
    const recommendations = await getLearningRecommendations(user, allProgress);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          level: user.gamification?.level || 1,
          experience: user.gamification?.experience || 0,
          nextLevelExp: user.gamification?.nextLevelExp || 100,
        },
        progress: {
          totalPoints: user.progress?.totalPoints || 0,
          currentStreak: user.progress?.streak?.current || 0,
          longestStreak: user.progress?.streak?.longest || 0,
          completedLessons: user.progress?.completedLessons?.length || 0,
          totalLessons: await getTotalLessonsCount(),
          completionRate: stats.completionRate,
          dailyGoal: user.progress?.dailyGoal || 20,
        },
        vocabulary: {
          totalLearned: user.vocabularyMastery?.length || 0,
          mastered: user.vocabularyMastery?.filter(v => v.masteryLevel === 'mastered' || v.masteryLevel === 'native').length || 0,
          learning: user.vocabularyMastery?.filter(v => v.masteryLevel === 'learning' || v.masteryLevel === 'reviewing').length || 0,
          accuracy: stats.vocabularyAccuracy,
        },
        achievements: {
          total: user.progress?.badges?.length || 0,
          recent: user.progress?.badges?.slice(-5) || [],
        },
        statistics: stats,
        rank,
        streakInfo,
        recentActivity,
        nextMilestones,
        recommendations,
        lessonProgress: allProgress.map(p => ({
          lessonId: p.lesson?._id,
          lessonTitle: p.lesson?.title?.english,
          level: p.lesson?.level,
          category: p.lesson?.category,
          completed: p.completed,
          score: p.score,
          attempts: p.attempts,
          timeSpent: p.timeSpent,
          lastAttempt: p.lastAttempt,
        })),
      },
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Handle user progress update or fetch stats
 * POST /api/progress
 */  
 router.post('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { dailyGoal } = req.body;

    if (dailyGoal !== undefined) {
      // 1. Find the user first
      const userToUpdate = await User.findById(userId);
      
      if (userToUpdate) {
        // 2. Modify the progress object safely
        if (!userToUpdate.progress) userToUpdate.progress = {};
        userToUpdate.progress.dailyGoal = parseInt(dailyGoal);
        
        // 3. Mark as modified and save (FerretDB loves this)
        userToUpdate.markModified('progress');
        await userToUpdate.save();
        
        logger.info(`User ${userId} updated daily goal to ${dailyGoal}`);
      }
    }

    // Now fetch the clean data for the response (Use .lean() for speed)
    const user = await User.findById(userId).lean();
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const allProgress = await Progress.find({ user: userId })
      .populate('lesson', 'title.english level category difficulty estimatedTime')
      .sort('-lastAttempt');

    // Reuse your helper functions
    const stats = await calculateUserStats(user, allProgress);
    const rank = await getUserRank(userId);
    const streakInfo = await getStreakInfo(user);
    const recentActivity = await getRecentActivity(userId, allProgress);
    const nextMilestones = await getNextMilestones(user);
    const recommendations = await getLearningRecommendations(user, allProgress);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          level: user.gamification?.level || 1,
          experience: user.gamification?.experience || 0,
        },
        progress: {
          totalPoints: user.progress?.totalPoints || 0,
          currentStreak: user.progress?.streak?.current || 0,
          dailyGoal: user.progress?.dailyGoal || 0, // Include this in response
          completionRate: stats.completionRate,
        },
        statistics: stats,
        rank,
        streakInfo,
        recentActivity,
        nextMilestones,
        recommendations
      },
    });

  } catch (err) {
    next(err);
  }
});


/**
 * POST /api/progress/rewards/:rewardId/claim
 * Matches: gamificationAPI.claimReward(rewardId)
 */
router.post('/rewards/:rewardId/claim', auth, async (req, res, next) => {
  try {
    const { rewardId } = req.params;
    // Implementation logic for rewards (deducting points, adding items)
    res.json({ success: true, message: `Reward ${rewardId} claimed` });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LESSON PROGRESS
// ============================================================================

/**
 * Get progress for specific lesson
 * GET /api/progress/lesson/:lessonId
 */
router.post('/lesson/:lessonId', auth, async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { score, completed, timeSpent } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    // Update user points
    user.progress.totalPoints = (user.progress.totalPoints || 0) + (score / 10);
    user.markModified('progress');
    await user.save();
    
    // Determine if this is a standard lesson or Practice Mode
    const isMongoId = mongoose.Types.ObjectId.isValid(lessonId);
    const query = isMongoId 
      ? { user: userId, lesson: lessonId } 
      : { user: userId, practiceType: lessonId };

    const update = {
      $set: {
        score,
        completed,
        timeSpent: timeSpent || 0,
        lastAttempt: new Date(),
        // Explicitly set the identifying field for upserts
        ...(isMongoId ? { lesson: lessonId } : { practiceType: lessonId })
      },
      $inc: { attempts: 1 }
    };

    // Use updateOne instead of findOneAndUpdate to avoid the 'fields' error
    await Progress.updateOne(query, update, { upsert: true });

    res.json({ success: true, message: 'Progress updated' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET PROGRESS BY CATEGORY
// ============================================================================

/**
 * Get progress grouped by category
 * GET /api/progress/categories
 */
router.get('/categories', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const progress = await Progress.find({ user: userId })
      .populate('lesson', 'category level difficulty');

    // Group by category
    const byCategory = {};
    const byLevel = {};
    const byDifficulty = {};

    progress.forEach(p => {
      if (!p.lesson) return;

      // By category
      const category = p.lesson.category || 'uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = {
          total: 0,
          completed: 0,
          averageScore: 0,
          totalTime: 0,
        };
      }
      byCategory[category].total += 1;
      if (p.completed) {
        byCategory[category].completed += 1;
      }
      byCategory[category].averageScore = 
        (byCategory[category].averageScore * byCategory[category].total + p.score) / (byCategory[category].total);
      byCategory[category].totalTime += p.timeSpent || 0;

      // By level
      const level = p.lesson.level || 'beginner';
      if (!byLevel[level]) {
        byLevel[level] = {
          total: 0,
          completed: 0,
          averageScore: 0,
        };
      }
      byLevel[level].total += 1;
      if (p.completed) {
        byLevel[level].completed += 1;
      }

      // By difficulty
      const difficulty = p.lesson.difficulty || 'medium';
      if (!byDifficulty[difficulty]) {
        byDifficulty[difficulty] = {
          total: 0,
          completed: 0,
          averageScore: 0,
        };
      }
      byDifficulty[difficulty].total += 1;
      if (p.completed) {
        byDifficulty[difficulty].completed += 1;
      }
    });

    // Calculate completion percentages
    Object.keys(byCategory).forEach(cat => {
      byCategory[cat].completionPercentage = byCategory[cat].total > 0 
        ? Math.round((byCategory[cat].completed / byCategory[cat].total) * 100) 
        : 0;
    });

    res.json({
      success: true,
      data: {
        byCategory,
        byLevel,
        byDifficulty,
        summary: {
          totalCategories: Object.keys(byCategory).length,
          bestCategory: getBestCategory(byCategory),
          needsAttention: getNeedsAttentionCategories(byCategory),
        },
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// UPDATE STREAK
// ============================================================================

/**
 * Update user's streak
 * POST /api/progress/streak
 */
router.post('/streak', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const now = new Date();
    const today = new Date(now).setHours(0, 0, 0, 0);
    
    // Initialize streak object if it doesn't exist to prevent "0" or undefined issues
    if (!user.progress.streak) {
      user.progress.streak = { current: 0, longest: 0, lastActive: null };
    }

    const lastActiveDate = user.progress.streak.lastActive 
      ? new Date(user.progress.streak.lastActive).setHours(0, 0, 0, 0) 
      : null;

    let newStreak = user.progress.streak.current;
    let streakUpdated = false;
    let message = '';

    if (!lastActiveDate) {
      // First time ever
      newStreak = 1;
      streakUpdated = true;
      message = '🎉 First day of your journey!';
    } else {
      const diffDays = Math.round((today - lastActiveDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Already practiced today
        message = 'Streak already safe for today!';
      } else if (diffDays === 1) {
        // Consecutive day
        newStreak += 1;
        streakUpdated = true;
        message = `🔥 ${newStreak} Day Streak!`;
      } else {
        // Broke the streak (2 or more days)
        newStreak = 1;
        streakUpdated = true;
        message = 'Streak reset, but you are back! 1-day streak.';
      }
    }

    if (streakUpdated) {
      user.progress.streak.current = newStreak;
      user.progress.streak.lastActive = now;
      if (newStreak > (user.progress.streak.longest || 0)) {
        user.progress.streak.longest = newStreak;
      }
      
      // Essential for FerretDB: explicitly mark as modified if nested
      user.markModified('progress.streak');
      await user.save();
    }

    res.json({
      success: true,
      data: {
        currentStreak: newStreak,
        longestStreak: user.progress.streak.longest,
        message
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get user's total points
 * GET /api/progress/points
 */
router.get('/points', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('progress.totalPoints');
    res.json({ success: true, data: { points: user.progress?.totalPoints || 0 } });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CHECK MILESTONES
// ============================================================================

/**
 * Check and award milestone badges
 * POST /api/progress/milestone
 */
router.post('/milestone', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const languageId = req.languageId;
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const points = user.progress?.totalPoints || 0;
    
    // Filter by language for language-specific milestones
    const lessonsCompleted = user.progress?.completedLessons?.filter(l => {
      if (!l.language_id) return true; // Fallback for old data
      return l.language_id.toString() === languageId?.toString();
    }).length || 0;
    
    // Count words for specific language
    const wordsLearned = user.vocabularyMastery?.filter(v => {
      if (!v.language_id) return true; // Fallback for old data
      return v.language_id.toString() === languageId?.toString();
    }).length || 0;

    const streak = user.progress?.streak?.current || 0;

    const earnedBadges = [];
    const milestoneChecks = [
      // Points milestones (Global)
      { condition: points >= 100, badge: { name: 'Point Seeker', icon: '⭐', tier: 'bronze', description: 'Earned 100 points', isGlobal: true } },
      { condition: points >= 500, badge: { name: 'Point Collector', icon: '💫', tier: 'silver', description: 'Earned 500 points', isGlobal: true } },
      { condition: points >= 1000, badge: { name: 'Izon Warrior', icon: '⚔️', tier: 'gold', description: 'Earned 1000 points', isGlobal: true } },
      { condition: points >= 5000, badge: { name: 'Linguistic Chief', icon: '👑', tier: 'platinum', description: 'Earned 5000 points', isGlobal: true } },
      { condition: points >= 10000, badge: { name: 'Izon Elder', icon: '🦅', tier: 'diamond', description: 'Earned 10000 points', isGlobal: true } },
      
      // Lesson milestones (Language specific)
      { condition: lessonsCompleted >= 1, badge: { name: 'First Steps', icon: '👣', tier: 'bronze', description: 'Completed first lesson' } },
      { condition: lessonsCompleted >= 10, badge: { name: 'Dedicated Learner', icon: '📚', tier: 'silver', description: 'Completed 10 lessons' } },
      { condition: lessonsCompleted >= 50, badge: { name: 'Course Conqueror', icon: '🏆', tier: 'gold', description: 'Completed 50 lessons' } },
      { condition: lessonsCompleted >= 100, badge: { name: 'Master Scholar', icon: '🎓', tier: 'platinum', description: 'Completed 100 lessons' } },
      
      // Vocabulary milestones (Language specific)
      { condition: wordsLearned >= 10, badge: { name: 'Word Novice', icon: '🌱', tier: 'bronze', description: 'Learned 10 words' } },
      { condition: wordsLearned >= 50, badge: { name: 'Word Collector', icon: '📖', tier: 'silver', description: 'Learned 50 words' } },
      { condition: wordsLearned >= 200, badge: { name: 'Vocabulary King', icon: '👑', tier: 'gold', description: 'Learned 200 words' } },
      { condition: wordsLearned >= 500, badge: { name: 'Lexicon Master', icon: '🗣️', tier: 'platinum', description: 'Learned 500 words' } },
      
      // Streak milestones (Global)
      { condition: streak >= 7, badge: { name: 'Week Warrior', icon: '🔥', tier: 'silver', description: '7-day streak', isGlobal: true } },
      { condition: streak >= 30, badge: { name: 'Monthly Master', icon: '🌙', tier: 'gold', description: '30-day streak', isGlobal: true } },
      { condition: streak >= 100, badge: { name: 'Century Club', icon: '💯', tier: 'platinum', description: '100-day streak', isGlobal: true } },
    ];

    milestoneChecks.forEach(check => {
      if (check.condition) {
        // Check if user already has this badge FOR THIS LANGUAGE (or globally if isGlobal)
        const hasBadge = user.progress.badges.some(b => 
          b.name === check.badge.name && 
          (check.badge.isGlobal ? !b.language_id : b.language_id?.toString() === languageId?.toString())
        );
        
        if (!hasBadge) {
          const badgeData = {
            ...check.badge,
            dateEarned: new Date(),
          };
          if (!check.badge.isGlobal) {
            badgeData.language_id = languageId;
          }
          
          earnedBadges.push(badgeData);
          user.progress.badges.push(badgeData);

          // Award points for badge
          const badgePoints = getBadgePoints(check.badge.tier);
          user.progress.totalPoints += badgePoints;
          user.gamification.points.total += badgePoints;
        }
      }
    });

    if (earnedBadges.length > 0) {
      await user.save();

      // Send notifications for each badge
      for (const badge of earnedBadges) {
        await notificationService.sendBadgeEarned(userId, badge);
      }

      logger.info(`User ${userId} earned ${earnedBadges.length} new badges`);
    }

    res.json({
      success: true,
      data: {
        earned: earnedBadges,
        total: user.progress.badges.length,
        allBadges: user.progress.badges,
        pointsAwarded: earnedBadges.reduce((sum, b) => sum + getBadgePoints(b.tier), 0),
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LEADERBOARD
// ============================================================================

/**
 * Get leaderboard with multiple categories
 * GET /api/progress/leaderboard
 */
router.get('/leaderboard', auth, (req, res, next) => {
    // Inject userId into req for the controller to use
    req.userId = req.user._id; 
    gamificationController.getLeaderboard(req, res, next);
});

// ============================================================================
// CHECK ACHIEVEMENTS
// ============================================================================

/**
 * Check and award achievements
 * POST /api/progress/achievements
 */
router.get('/achievements', auth, (req, res, next) => {
    req.userId = req.user._id;
    gamificationController.getAchievements(req, res, next);
});

// ============================================================================
// GET PROGRESS GRAPH
// ============================================================================

/**
 * Get progress graph data
 * GET /api/progress/graph
 */
router.get('/graph', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { period = 'month', metric = 'points' } = req.query;

    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // Get progress records in date range
    const progress = await Progress.find({
      user: userId,
      lastAttempt: { $gte: startDate, $lte: endDate },
    }).populate('lesson', 'category level');

    // Group by date
    const byDate = {};
    const byCategory = {};

    progress.forEach(p => {
      if (!p.lastAttempt) return;

      const dateStr = p.lastAttempt.toISOString().split('T')[0];
      
      if (!byDate[dateStr]) {
        byDate[dateStr] = {
          date: dateStr,
          points: 0,
          lessons: 0,
          time: 0,
          accuracy: 0,
          count: 0,
        };
      }

      byDate[dateStr].points += p.score || 0;
      byDate[dateStr].lessons += 1;
      byDate[dateStr].time += p.timeSpent || 0;
      byDate[dateStr].accuracy += p.score || 0;
      byDate[dateStr].count += 1;

      // By category
      if (p.lesson?.category) {
        if (!byCategory[p.lesson.category]) {
          byCategory[p.lesson.category] = {
            count: 0,
            totalScore: 0,
          };
        }
        byCategory[p.lesson.category].count += 1;
        byCategory[p.lesson.category].totalScore += p.score || 0;
      }
    });

    // Calculate averages
    Object.keys(byDate).forEach(date => {
      byDate[date].accuracy = byDate[date].accuracy / byDate[date].count;
    });

    // Calculate category averages
    Object.keys(byCategory).forEach(cat => {
      byCategory[cat].averageScore = byCategory[cat].totalScore / byCategory[cat].count;
    });

    // Get cumulative points
    const cumulative = [];
    let runningTotal = 0;

    Object.keys(byDate)
      .sort()
      .forEach(date => {
        runningTotal += byDate[date].points;
        cumulative.push({
          date,
          total: runningTotal,
        });
      });

    res.json({
      success: true,
      data: {
        daily: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
        cumulative,
        byCategory,
        summary: {
          totalPoints: Object.values(byDate).reduce((sum, d) => sum + d.points, 0),
          totalLessons: Object.values(byDate).reduce((sum, d) => sum + d.lessons, 0),
          totalTime: Object.values(byDate).reduce((sum, d) => sum + d.time, 0),
          averageAccuracy: Object.values(byDate).reduce((sum, d) => sum + d.accuracy, 0) / Object.keys(byDate).length,
        },
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LEARNING STATISTICS
// ============================================================================

/**
 * Get detailed learning statistics
 * GET /api/progress/stats
 */
router.get('/stats/detailed', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const analytics = await LearningAnalytics.findOne({
      user: userId,
      period: 'weekly',
    }).sort({ date: -1 });

    const user = await User.findById(userId)
      .select('progress gamification vocabularyMastery');

    const stats = {
      overview: {
        totalPoints: user.progress?.totalPoints || 0,
        level: user.gamification?.level || 1,
        experience: user.gamification?.experience || 0,
        nextLevelExp: user.gamification?.nextLevelExp || 100,
        streak: user.progress?.streak?.current || 0,
        longestStreak: user.progress?.streak?.longest || 0,
      },
      learning: {
        wordsLearned: user.vocabularyMastery?.length || 0,
        lessonsCompleted: user.progress?.completedLessons?.length || 0,
        totalTimeSpent: user.analytics?.totalTimeSpent || 0,
        averageSessionTime: user.analytics?.averageSessionLength || 0,
      },
      performance: analytics?.performance || {
        accuracy: 0,
        speed: 0,
        retention: 0,
      },
      patterns: analytics?.patterns || {
        preferredTime: 'unknown',
        preferredDay: 'unknown',
        strengths: [],
        weaknesses: [],
      },
      predictions: analytics?.predictions || {
        nextLevelDate: null,
        masteryDate: null,
        churnProbability: 0,
      },
    };

    res.json({
      success: true,
      data: stats,
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate user statistics
 */
async function calculateUserStats(user, progress) {
  const completedLessons = progress.filter(p => p.completed);
  const totalLessons = await getTotalLessonsCount();

  // Calculate average score
  const scores = progress.filter(p => p.score).map(p => p.score);
  const avgScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
    : 0;

  // Calculate total time
  const totalTime = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

  // Calculate vocabulary accuracy
  let vocabAccuracy = 0;
  if (user.vocabularyMastery && user.vocabularyMastery.length > 0) {
      const correct = user.vocabularyMastery.reduce((sum, v) => sum + (v.correctCount || 0), 0);
      const total = user.vocabularyMastery.reduce((sum, v) => sum + (v.reviewCount || 0), 0);
    
      // Fallback: If reviews are 0 but they have points, give a baseline accuracy 
      // or keep it at 0 to encourage their first lesson.
      vocabAccuracy = total > 0 ? (correct / total) * 100 : 0;
  }

  // Calculate daily average
  const firstActivity = progress.length > 0 
    ? Math.min(...progress.map(p => p.lastAttempt || new Date()))
    : new Date();
  const daysActive = Math.ceil((new Date() - firstActivity) / (1000 * 60 * 60 * 24));
  const dailyAverage = daysActive > 0 ? completedLessons.length / daysActive : 0;

  return {
    averageScore: Math.round(avgScore),
    totalTimeSpent: totalTime,
    vocabularyAccuracy: Math.round(vocabAccuracy),
    dailyAverageLessons: Math.round(dailyAverage * 10) / 10,
    completionRate: totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0,
    perfectScores: progress.filter(p => p.score === 100).length,
    firstLessonDate: progress.length > 0 ? Math.min(...progress.map(p => p.lastAttempt)) : null,
    lastLessonDate: progress.length > 0 ? Math.max(...progress.map(p => p.lastAttempt)) : null,
  };
}

/**
 * Get total lessons count
 */
async function getTotalLessonsCount() {
  const Lesson = mongoose.model('Lesson');
  return await Lesson.countDocuments({ status: 'published' });
}

/**
 * Get user rank
 */
async function getUserRank(userId) {
  const user = await User.findById(userId);
  
  const higherRanked = await User.countDocuments({
    'progress.totalPoints': { $gt: user.progress?.totalPoints || 0 },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
    percentile: totalUsers > 0 ? Math.round(((totalUsers - higherRanked) / totalUsers) * 100) : 0,
  };
}

/**
 * Get streak information
 */
async function getStreakInfo(user) {
  const currentStreak = user.progress?.streak?.current || 0;
  const longestStreak = user.progress?.streak?.longest || 0;
  const lastActive = user.progress?.streak?.lastActive;

  let nextMilestone = null;
  if (currentStreak < 7) {
    nextMilestone = { days: 7, remaining: 7 - currentStreak };
  } else if (currentStreak < 30) {
    nextMilestone = { days: 30, remaining: 30 - currentStreak };
  } else if (currentStreak < 100) {
    nextMilestone = { days: 100, remaining: 100 - currentStreak };
  } else if (currentStreak < 365) {
    nextMilestone = { days: 365, remaining: 365 - currentStreak };
  }

  return {
    current: currentStreak,
    longest: longestStreak,
    lastActive,
    nextMilestone,
    atRisk: lastActive ? (new Date() - lastActive) / (1000 * 60 * 60 * 24) > 1 : false,
  };
}

/**
 * Get recent activity
 */
async function getRecentActivity(userId, progress) {
  const recent = progress
    .filter(p => p.lastAttempt)
    .sort((a, b) => b.lastAttempt - a.lastAttempt)
    .slice(0, 10)
    .map(p => ({
      type: 'lesson',
      lessonId: p.lesson?._id,
      lessonTitle: p.lesson?.title?.english,
      action: p.completed ? 'completed' : 'practiced',
      score: p.score,
      timeSpent: p.timeSpent,
      timestamp: p.lastAttempt,
    }));

  return recent;
}

/**
 * Get next milestones
 */
async function getNextMilestones(user) {
  const points = user.progress?.totalPoints || 0;
  const lessons = user.progress?.completedLessons?.length || 0;
  const words = user.vocabularyMastery?.length || 0;
  const streak = user.progress?.streak?.current || 0;

  const milestones = [];

  // Points milestones
  const pointMilestones = [100, 500, 1000, 5000, 10000];
  for (const target of pointMilestones) {
    if (points < target) {
      milestones.push({
        type: 'points',
        target,
        current: points,
        remaining: target - points,
        percentage: Math.round((points / target) * 100),
        badge: getBadgeForPoints(target),
      });
      break;
    }
  }

  // Lesson milestones
  const lessonMilestones = [1, 10, 50, 100];
  for (const target of lessonMilestones) {
    if (lessons < target) {
      milestones.push({
        type: 'lessons',
        target,
        current: lessons,
        remaining: target - lessons,
        percentage: Math.round((lessons / target) * 100),
        badge: getBadgeForLessons(target),
      });
      break;
    }
  }

  // Word milestones
  const wordMilestones = [10, 50, 200, 500];
  for (const target of wordMilestones) {
    if (words < target) {
      milestones.push({
        type: 'words',
        target,
        current: words,
        remaining: target - words,
        percentage: Math.round((words / target) * 100),
        badge: getBadgeForWords(target),
      });
      break;
    }
  }

  // Streak milestones
  const streakMilestones = [7, 30, 100, 365];
  for (const target of streakMilestones) {
    if (streak < target) {
      milestones.push({
        type: 'streak',
        target,
        current: streak,
        remaining: target - streak,
        percentage: Math.round((streak / target) * 100),
        badge: getBadgeForStreak(target),
      });
      break;
    }
  }

  return milestones;
}

/**
 * Get learning recommendations
 */
async function getLearningRecommendations(user, progress) {
  const recommendations = [];

  // Get weak categories
  const categoryProgress = {};
  progress.forEach(p => {
    if (!p.lesson?.category) return;
    const cat = p.lesson.category;
    if (!categoryProgress[cat]) {
      categoryProgress[cat] = { total: 0, completed: 0, scores: [] };
    }
    categoryProgress[cat].total += 1;
    if (p.completed) categoryProgress[cat].completed += 1;
    if (p.score) categoryProgress[cat].scores.push(p.score);
  });

  // Find categories with low scores
  Object.entries(categoryProgress).forEach(([cat, data]) => {
    if (data.scores.length > 0) {
      const avgScore = data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
      if (avgScore < 70) {
        recommendations.push({
          type: 'review',
          category: cat,
          reason: `Your average score in ${cat} is ${Math.round(avgScore)}%. Review these lessons.`,
          priority: 'high',
        });
      }
    }
  });

  // Recommend next lessons in weak categories
  const weakCategories = Object.entries(categoryProgress)
    .filter(([_, data]) => {
      const avgScore = data.scores.reduce((sum, s) => sum + s, 0) / (data.scores.length || 1);
      return avgScore < 70;
    })
    .map(([cat]) => cat);

  if (weakCategories.length > 0) {
    const Lesson = mongoose.model('Lesson');
    const nextLessons = await Lesson.find({
      category: { $in: weakCategories },
      _id: { $nin: progress.map(p => p.lesson?._id) },
      status: 'published',
    })
      .limit(3)
      .select('title.english level category difficulty');

    nextLessons.forEach(lesson => {
      recommendations.push({
        type: 'lesson',
        lesson: {
          id: lesson._id,
          title: lesson.title?.english,
          category: lesson.category,
          difficulty: lesson.difficulty,
        },
        reason: `Continue improving your ${lesson.category} skills.`,
        priority: 'medium',
      });
    });
  }

  return recommendations;
}

/**
 * Get points leaderboard
 */
async function getPointsLeaderboard(period, limit, skip) {
  let dateFilter = {};
  
  if (period !== 'allTime') {
    const startDate = new Date();
    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }
    dateFilter = { lastActive: { $gte: startDate } };
  }

  const users = await User.find(dateFilter)
    .select('username profile.avatar progress.totalPoints progress.streak progress.badges')
    .sort({ 'progress.totalPoints': -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.url,
    points: user.progress?.totalPoints || 0,
    streak: user.progress?.streak?.current || 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));
}

/**
 * Get streak leaderboard
 */
async function getStreakLeaderboard(limit, skip) {
  const users = await User.find({})
    .select('username profile.avatar progress.streak progress.badges')
    .sort({ 'progress.streak.current': -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.url,
    streak: user.progress?.streak?.current || 0,
    longestStreak: user.progress?.streak?.longest || 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));
}

/**
 * Get words leaderboard REWRITTEN for FerretDB Compatibility
 */
async function getWordsLeaderboard(limit, skip) {
  // FerretDB fallback: process in memory for reliability with array lengths
  const users = await User.find({})
    .select('username profile.avatar vocabularyMastery progress.badges')
    .lean();

  return users
    .map(user => ({
      userId: user._id,
      username: user.username,
      avatar: user.profile?.avatar?.url,
      words: Array.isArray(user.vocabularyMastery) ? user.vocabularyMastery.length : 0,
      badgeCount: user.progress?.badges?.length || 0,
    }))
    .sort((a, b) => b.words - a.words)
    .slice(skip, skip + parseInt(limit))
    .map((item, index) => ({ ...item, rank: skip + index + 1 }));
}

/**
 * Get lessons leaderboard
 */
async function getLessonsLeaderboard(limit, skip) {
  const users = await User.find({})
    .select('username profile.avatar progress.lessonStats.totalCompleted progress.badges')
    .sort({ 'progress.lessonStats.totalCompleted': -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return users.map((user, index) => ({
    rank: skip + index + 1,
    userId: user._id,
    username: user.username,
    avatar: user.profile?.avatar?.url,
    lessons: user.progress?.lessonStats?.totalCompleted || 0,
    badgeCount: user.progress?.badges?.length || 0,
  }));
}

/**
 * Get user points rank
 */
async function getUserPointsRank(userId, period) {
  const user = await User.findById(userId);
  
  const higherRanked = await User.countDocuments({
    'progress.totalPoints': { $gt: user.progress?.totalPoints || 0 },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
    percentile: totalUsers > 0 ? Math.round(((totalUsers - higherRanked) / totalUsers) * 100) : 0,
  };
}

/**
 * Get user streak rank
 */
async function getUserStreakRank(userId) {
  const user = await User.findById(userId);
  
  const higherRanked = await User.countDocuments({
    'progress.streak.current': { $gt: user.progress?.streak?.current || 0 },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
  };
}

/**
 * Get user words rank
 */
async function getUserWordsRank(userId) {
  const user = await User.findById(userId).select('vocabularyMastery');
  const wordCount = user.vocabularyMastery?.length || 0;

  // Instead of complex aggregation, count users who have a larger array
  // This is much safer for the SQLite-backed FerretDB
  const allUsers = await User.find({}).select('vocabularyMastery');
  const higherRankedCount = allUsers.filter(u => 
    (u.vocabularyMastery?.length || 0) > wordCount
  ).length;

  return {
    rank: higherRankedCount + 1,
    outOf: allUsers.length,
  };
}

/**
 * Get user lessons rank
 */
async function getUserLessonsRank(userId) {
  const user = await User.findById(userId);
  const lessonsCompleted = user.progress?.lessonStats?.totalCompleted || 0;

  const higherRanked = await User.countDocuments({
    'progress.lessonStats.totalCompleted': { $gt: lessonsCompleted },
  });

  const totalUsers = await User.countDocuments();

  return {
    rank: higherRanked + 1,
    outOf: totalUsers,
  };
}

/**
 * Get leaderboard total count
 */
async function getLeaderboardTotalCount(category) {
  return await User.countDocuments();
}

/**
 * Get friends leaderboard
 */
async function getFriendsLeaderboard(userId, category, limit) {
  const user = await User.findById(userId).populate('friends.user', 'username profile.avatar progress');

  if (!user.friends || user.friends.length === 0) {
    return [];
  }

  const friendIds = user.friends
    .filter(f => f.status === 'accepted')
    .map(f => f.user._id);

  const friends = await User.find({ _id: { $in: friendIds } })
    .select('username profile.avatar progress.totalPoints progress.streak.current progress.lessonStats.totalCompleted')
    .sort({ 'progress.totalPoints': -1 })
    .limit(parseInt(limit));

  return friends.map((friend, index) => ({
    rank: index + 1,
    userId: friend._id,
    username: friend.username,
    avatar: friend.profile?.avatar?.url,
    points: friend.progress?.totalPoints || 0,
    streak: friend.progress?.streak?.current || 0,
    lessons: friend.progress?.lessonStats?.totalCompleted || 0,
  }));
}

/**
 * Get next streak milestone
 */
function getNextStreakMilestone(currentStreak) {
  if (currentStreak < 7) return { days: 7, remaining: 7 - currentStreak };
  if (currentStreak < 30) return { days: 30, remaining: 30 - currentStreak };
  if (currentStreak < 100) return { days: 100, remaining: 100 - currentStreak };
  if (currentStreak < 365) return { days: 365, remaining: 365 - currentStreak };
  return null;
}

/**
 * Get badge points by tier
 */
function getBadgePoints(tier) {
  const points = {
    bronze: 50,
    silver: 100,
    gold: 200,
    platinum: 500,
    diamond: 1000,
  };
  return points[tier] || 50;
}

/**
 * Get badge for points milestone
 */
function getBadgeForPoints(points) {
  const badges = {
    100: { name: 'Point Seeker', icon: '⭐', tier: 'bronze' },
    500: { name: 'Point Collector', icon: '💫', tier: 'silver' },
    1000: { name: 'Izon Warrior', icon: '⚔️', tier: 'gold' },
    5000: { name: 'Linguistic Chief', icon: '👑', tier: 'platinum' },
    10000: { name: 'Izon Elder', icon: '🦅', tier: 'diamond' },
  };
  return badges[points];
}

/**
 * Get badge for lessons milestone
 */
function getBadgeForLessons(lessons) {
  const badges = {
    1: { name: 'First Steps', icon: '👣', tier: 'bronze' },
    10: { name: 'Dedicated Learner', icon: '📚', tier: 'silver' },
    50: { name: 'Course Conqueror', icon: '🏆', tier: 'gold' },
    100: { name: 'Master Scholar', icon: '🎓', tier: 'platinum' },
  };
  return badges[lessons];
}

/**
 * Get badge for words milestone
 */
function getBadgeForWords(words) {
  const badges = {
    10: { name: 'Word Novice', icon: '🌱', tier: 'bronze' },
    50: { name: 'Word Collector', icon: '📖', tier: 'silver' },
    200: { name: 'Vocabulary King', icon: '👑', tier: 'gold' },
    500: { name: 'Lexicon Master', icon: '🗣️', tier: 'platinum' },
  };
  return badges[words];
}

/**
 * Get badge for streak milestone
 */
function getBadgeForStreak(streak) {
  const badges = {
    7: { name: 'Week Warrior', icon: '🔥', tier: 'silver' },
    30: { name: 'Monthly Master', icon: '🌙', tier: 'gold' },
    100: { name: 'Century Club', icon: '💯', tier: 'platinum' },
    365: { name: 'Year-Long Legend', icon: '👑', tier: 'diamond' },
  };
  return badges[streak];
}

/**
 * Get best category
 */
function getBestCategory(byCategory) {
  let best = null;
  let bestScore = 0;

  Object.entries(byCategory).forEach(([cat, data]) => {
    if (data.averageScore > bestScore) {
      bestScore = data.averageScore;
      best = { category: cat, score: data.averageScore };
    }
  });

  return best;
}

/**
 * Get categories needing attention
 */
function getNeedsAttentionCategories(byCategory) {
  const needsAttention = [];

  Object.entries(byCategory).forEach(([cat, data]) => {
    if (data.averageScore < 70) {
      needsAttention.push({
        category: cat,
        score: data.averageScore,
        completionRate: data.completionPercentage,
      });
    }
  });

  return needsAttention.sort((a, b) => a.score - b.score).slice(0, 3);
}

/**
 * Check all achievements
 */
async function checkAllAchievements(user) {
  const earned = [];
  if (!user.progress) user.progress = {};
  if (!user.progress.achievements) user.progress.achievements = [];

  // 1. Deduplicate existing array first
  const seen = new Set();
  user.progress.achievements = user.progress.achievements.filter(a => {
    const duplicate = seen.has(a.name);
    seen.add(a.name);
    return !duplicate;
  });

  const milestones = [
    {
      condition: (user.progress?.totalPoints || 0) >= 100,
      achievement: { name: 'Point Collector', description: 'Earned 100 points', icon: '💰' },
    },
    {
      condition: (user.vocabularyMastery?.length || 0) >= 10,
      achievement: { name: 'Word Learner', description: 'Learned 10 words', icon: '📝' },
    }
  ];

  milestones.forEach(({ condition, achievement }) => {
    if (condition && !seen.has(achievement.name)) {
      const entry = { ...achievement, dateEarned: new Date() };
      user.progress.achievements.push(entry);
      earned.push(entry);
      seen.add(achievement.name);
    }
  });

  return earned;
}

module.exports = router;
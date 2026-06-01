const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const cache = require('memory-cache');

const Lesson = require('../models/Lesson');
const Language = require('../models/Language');
const Progress = require('../models/Progress');
const User = require('../models/User');
const LearningAnalytics = require('../models/LearningAnalytics');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { logger } = require('../config/logger');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const redis = require('../config/redis');

// ============================================================================
// RATE LIMITING
// ============================================================================

const lessonLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(lessonLimiter);

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validateLessonId = [
  param('id').custom(value => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid lesson ID format');
    }
    return true;
  }),
];

const validateCompletion = [
  body('score')
    .isInt({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('timeSpent')
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive number'),
  body('responses')
    .optional()
    .isArray()
    .withMessage('Responses must be an array'),
];

const validateLessonCreation = [
  body('title.izon').notEmpty().withMessage('Izon title is required'),
  body('title.english').notEmpty().withMessage('English title is required'),
  body('level').isIn(['beginner', 'intermediate', 'advanced', 'master', 'cultural'])
    .withMessage('Invalid lesson level'),
  body('category').notEmpty().withMessage('Category is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
];

// ============================================================================
// GET ALL LESSONS
// ============================================================================

/**
 * Get all lessons with filtering, pagination, and user progress
 * GET /api/lessons
 */
router.get('/', auth, cacheMiddleware(300), async (req, res, next) => {
  try {
    const {
      level,
      category,
      difficulty,
      status,
      search,
      lang,
      page = 1,
      limit = 10,
      sortBy = 'order',
      sortOrder = 'asc',
      includeProgress = 'false',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 2. Allow 'status' to be passed in, default to 'published' for security
    const query = {};
    if (status) {
      query.status = status;
    } else {
      query.status = 'published';
    }

    // Filter by Language if lang provided
    if (lang) {
      const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
      if (languageDoc) {
        query.language_id = languageDoc._id;
      }
    }
    
    // Apply filters
    if (level) query.level = level;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    // Search functionality
    if (search) {
      query.$or = [
        { 'title.izon': { $regex: search, $options: 'i' } },
        { 'title.english': { $regex: search, $options: 'i' } },
        { 'description.english': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [lessons, total] = await Promise.all([
      Lesson.find(query)
        .select('title.english title.izon description.english level category order estimatedTime rewards.badges difficulty')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Lesson.countDocuments(query),
    ]);

    // Enhance with user progress if authenticated and requested
    let enhancedLessons = lessons;
    if (includeProgress === 'true' && req.userId) {
      enhancedLessons = await Promise.all(
        lessons.map(async (lesson) => {
          const progress = await Progress.findOne({
            user: req.userId,
            lesson: lesson._id,
          }).select('completed score attempts lastAttempt');

          return {
            ...lesson.toObject(),
            userProgress: progress || {
              completed: false,
              score: 0,
              attempts: 0,
            },
          };
        })
      );
    } else {
      enhancedLessons = lessons.map(lesson => ({
        ...lesson.toObject(),
        userProgress: null,
      }));
    }

    // Get category information
    const categories = await getLessonCategories();

    res.json({
      success: true,
      data: enhancedLessons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: skip + lessons.length < total,
        hasPrev: page > 1,
      },
      filters: {
        level,
        category,
        difficulty,
        search,
      },
      availableFilters: {
        levels: ['beginner', 'intermediate', 'advanced', 'master', 'cultural'],
        categories,
        difficulties: ['easy', 'medium', 'hard', 'challenging'],
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LESSON BY ID
// ============================================================================

/**
 * Get lesson by ID with full details
 * GET /api/lessons/:id
 */
router.get('/:id', validateLessonId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeProgress = 'true' } = req.query;

    const lesson = await Lesson.findById(id)
      .populate('content.vocabulary.wordId', 'izonWord englishTranslation pronunciation difficulty')
      .populate('content.vocabulary.context')
      .populate('prerequisites.lessonId', 'title.english level')
      .populate('relatedLessons', 'title.english level order')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    // Check if lesson is published or user is admin
    if (lesson.status !== 'published' && req.userRole !== 'admin') {
      throw new AppError('Lesson not available', 404);
    }

    // Get user progress if authenticated
    let userProgress = null;
    let prerequisitesMet = true;
    let missingPrerequisites = [];

   if (req.userId) {
      userProgress = await Progress.findOne({
        user: req.userId,
        lesson: id,
      }).select('completed score attempts lastAttempt timeSpent');

      // Check prerequisites
      if (lesson.prerequisites && lesson.prerequisites.length > 0) {
        const prerequisiteIds = lesson.prerequisites
          .filter(p => p.type === 'lesson')
          .map(p => p.lessonId);

        const completedLessons = await Progress.find({
          user: req.userId,
          lesson: { $in: prerequisiteIds },
          completed: true,
        }).select('lesson');

        const completedIds = completedLessons.map(p => p.lesson.toString());
        
        missingPrerequisites = lesson.prerequisites
          .filter(p => p.type === 'lesson' && !completedIds.includes(p.lessonId.toString()))
          .map(p => ({
            lessonId: p.lessonId,
            title: p.lessonId?.title?.english,
            minimumScore: p.minimumScore,
          }));

        prerequisitesMet = missingPrerequisites.length === 0;
      }
    }

    // Get related lessons
    const relatedLessons = await getRelatedLessons(lesson);

    // Get lesson statistics
    const stats = await getLessonStats(id);

    // FIX: Atomic increment to bypass the crashing pre('save') hook in Lesson.js
    await Lesson.updateOne({ _id: id }, { $inc: { 'analytics.views': 1 } });

    res.json({
      success: true,
      data: {
        ...lesson.toObject(),
        userProgress,
        prerequisites: {
          met: prerequisitesMet,
          missing: missingPrerequisites,
        },
        relatedLessons,
        statistics: stats,
        recommendations: await getLessonRecommendations(lesson, req.userId),
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// COMPLETE LESSON
// ============================================================================

/**
 * Complete a lesson with detailed tracking
 * POST /api/lessons/:id/complete
 */
router.post('/:id/complete', auth, validateLessonId, validateCompletion, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR',
      });
    }
    
    const { id } = req.params;
    const { score, timeSpent, responses = [], feedback = {}, answers, startedAt } = req.body;
    const userId = req.user._id; 

    // Get lesson
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    // Check prerequisites
    const prerequisitesMet = await checkPrerequisites(userId, lesson);
    if (!prerequisitesMet.met) {
      return res.status(403).json({
        success: false,
        error: 'Prerequisites not met',
        missing: prerequisitesMet.missing,
        code: 'PREREQUISITES_NOT_MET',
      });
    }

    // Find or create progress
    let progress = await Progress.findOne({ user: userId, lesson: id });

    const isFirstCompletion = !progress || !progress.completed;
    const isNewBestScore = !progress || score > (progress.highestScore || 0);

     const attemptStartedAt = startedAt ? new Date(startedAt) : new Date();

    if (progress) {
      // Update existing progress
      progress.score = score;
      progress.highestScore = Math.max(progress.highestScore || 0, score);
      progress.attempts += 1;
      progress.lastAttempt = new Date();
      progress.completed = score >= (lesson.assessment?.passingScore || 70);
      progress.timeSpent += (progress.timeSpent || 0) + timeSpent;;

      // Add to attempt history
      progress.attemptHistory.push({
        attemptNumber: progress.attempts,
        score,
        timeSpent,
        responses: responses || answers, 
        startedAt: attemptStartedAt,
        completedAt: new Date(),
      });

    } else {
      // Create new progress
      progress = new Progress({
        user: userId,
        lesson: id,
        score,
        highestScore: score,
        attempts: 1,
        completed: score >= (lesson.assessment?.passingScore || 70),
        timeSpent,
        lastAttempt: new Date(),
        attemptHistory: [{
          attemptNumber: 1,
          score,
          timeSpent,
          responses: responses || answers,
          startedAt: attemptStartedAt,
          completedAt: new Date(),
        }],
      });
    }

    await progress.save();

    // Update user progress
    const user = await User.findById(userId);

    // Add points
    const pointsEarned = calculatePointsEarned(score, isFirstCompletion, isNewBestScore);
    user.progress.totalPoints += pointsEarned;
    user.gamification.points.total += pointsEarned;
    user.gamification.points.history.push({
      amount: pointsEarned,
      reason: 'lesson_completion',
      lessonId: id,
      timestamp: new Date(),
    });

    // Add experience
    const expEarned = calculateExpEarned(score, timeSpent);
    user.gamification.experience += expEarned;
    user.updateLevel();

    // Track completed lesson
    if (progress.completed && !user.progress.completedLessons.some(l => l.lessonId?.toString() === id)) {
      user.progress.completedLessons.push({
        lessonId: id,
        language_id: lesson.language_id,
        completedAt: new Date(),
        score,
        timeSpent,
      });

      user.progress.lessonStats.totalCompleted += 1;
      user.progress.lessonStats.totalTimeSpent += timeSpent;

      // Update average score
      const totalScore = user.progress.lessonStats.averageScore * (user.progress.lessonStats.totalCompleted - 1);
      user.progress.lessonStats.averageScore = (totalScore + score) / user.progress.lessonStats.totalCompleted;
    }

    user.lastActive = new Date();
    await user.save();

    // Update learning analytics
   
    try {
  // We don't await this if we want immediate response, 
  // but in your environment, awaiting it is safer to prevent process overload.
  await updateLearningAnalytics(userId, lesson, progress, {
    score,
    timeSpent,
    responses,
  });
} catch (analyticsErr) {
  logger.error(`Analytics failed for user ${userId}: ${analyticsErr.message}`);
  // Do NOT next(err) here - we don't want to crash the whole request
}

    // Check for achievements
let achievements = [];
try {
  achievements = await checkLessonAchievements(user, lesson, progress, {
    isFirstCompletion,
    isNewBestScore,
    perfectScore: score === 100,
  });

  // Notifications
  if (achievements.length > 0) {
    for (const achievement of achievements) {
      await notificationService.sendAchievementUnlocked(userId, achievement)
        .catch(err => logger.error(`Notification failed: ${err.message}`));
    }
  }
} catch (achieveErr) {
  logger.error(`Achievement check failed: ${achieveErr.message}`);
}

    // Send notifications for achievements
    for (const achievement of achievements) {
      await notificationService.sendAchievementUnlocked(userId, achievement);
    }

    // Get next recommended lesson
    const nextLesson = await getNextRecommendedLesson(userId, lesson);

    // Clear cache
    await clearLessonCache(userId, id);

    // Log completion
    logger.info(`User ${userId} completed lesson ${id} with score ${score}`);

    res.json({
      success: true,
      data: {
        progress: {
          completed: progress.completed,
          score,
          highestScore: progress.highestScore,
          attempts: progress.attempts,
          timeSpent: progress.timeSpent,
          passed: score >= (lesson.assessment?.passingScore || 70),
        },
        rewards: {
          pointsEarned,
          experienceEarned: expEarned,
          newBadges: achievements.filter(a => a.type === 'badge'),
          newAchievements: achievements.filter(a => a.type === 'achievement'),
        },
        nextLesson: nextLesson ? {
          id: nextLesson._id,
          title: nextLesson.title?.english,
          order: nextLesson.order,
        } : null,
        statistics: {
          userLevel: user.gamification.level,
          totalPoints: user.progress.totalPoints,
          streak: user.progress.streak?.current || 0,
        },
        feedback: generateLessonFeedback(score, timeSpent, lesson.estimatedTime?.minutes),
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LESSON PROGRESS
// ============================================================================

/**
 * Get user's progress for a specific lesson
 * GET /api/lessons/:id/progress
 */
router.get('/:id/progress', auth, validateLessonId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id; 

    const progress = await Progress.findOne({ user: userId, lesson: id })
      .select('-__v');

    if (!progress) {
      return res.json({
        success: true,
        data: {
          started: false,
          completed: false,
          attempts: 0,
        },
      });
    }

    // Get lesson details for context
    const lesson = await Lesson.findById(id).select('title estimatedTime assessment');

    res.json({
      success: true,
      data: {
        ...progress.toObject(),
        lessonInfo: {
          title: lesson?.title,
          estimatedTime: lesson?.estimatedTime,
          passingScore: lesson?.assessment?.passingScore || 70,
        },
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LESSON RECOMMENDATIONS
// ============================================================================

/**
 * Get personalized lesson recommendations
 * GET /api/lessons/recommendations
 */
router.get('/recommendations/list', auth, async (req, res, next) => {
  try {
    const userId = req.user._id; 
    const { limit = 5 } = req.query;

    const recommendations = await getPersonalizedRecommendations(userId, parseInt(limit));

    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET LESSON STATISTICS
// ============================================================================

/**
 * Get lesson statistics (admin only)
 * GET /api/lessons/stats/overview
 */
router.get('/stats/overview', auth, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await getLessonStatistics();

    res.json({
      success: true,
      data: stats,
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * Create new lesson (admin only)
 * POST /api/lessons
 */
router.post('/', auth, authorize('admin'), validateLessonCreation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR',
      });
    }

    const lessonData = {
      ...req.body,
      order: Number(req.body.order) || 1,
      createdBy: req.userId,
      status: req.body.status || 'draft',
      version: 1,
      analytics: {
        views: 0,
        completions: 0,
        averageScore: 0,
      },
    };

    const lesson = new Lesson(lessonData);
    await lesson.save();

    logger.info(`New lesson created: ${lesson.title.english} by admin ${req.userId}`);

    // Clear cache
    await clearLessonCache();

    res.status(201).json({
      success: true,
      data: lesson,
      message: 'Lesson created successfully. It is currently in draft status.',
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Update lesson (admin only)
 * PUT /api/lessons/:id
 */
router.put('/:id', auth, authorize('admin'), validateLessonId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const lesson = await Lesson.findById(id)
      .populate('content.vocabulary.wordId', 'izonWord englishTranslation pronunciation difficulty')
      .populate('content.vocabulary.context')
      .populate('prerequisites.lessonId', 'title.english level')
      .populate('relatedLessons', 'title.english level order')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');
      
    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    if (lesson.status !== 'published' && req.userRole !== 'admin') {
       throw new AppError('Lesson not available', 404);
    }
    
    // Track changes
    const changes = [];
    Object.keys(updates).forEach(key => {
      if (JSON.stringify(lesson[key]) !== JSON.stringify(updates[key])) {
        changes.push({
          field: key,
          oldValue: lesson[key],
          newValue: updates[key],
        });
      }
    });

    // Apply updates
    Object.assign(lesson, updates);
    lesson.updatedBy = req.userId;
    lesson.version += 1;

    // Add to change log
    lesson.changeLog.push({
      version: lesson.version,
      changedBy: req.userId,
      changedAt: new Date(),
      changes,
    });

    await lesson.save();

    logger.info(`Lesson updated: ${lesson.title.english} by admin ${req.userId}`);

    // Clear cache
    await clearLessonCache(id);

    res.json({
      success: true,
      data: lesson,
      changes: changes.length,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Delete lesson (admin only)
 * DELETE /api/lessons/:id
 */
router.delete('/:id', auth, authorize('admin'), validateLessonId, async (req, res, next) => {
  try {
    const { id } = req.params;

    const lesson = await Lesson.findById(id);

    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    // Soft delete - archive instead of remove
    lesson.status = 'archived';
    lesson.archivedAt = new Date();
    lesson.archivedBy = req.userId;
    await lesson.save();

    logger.info(`Lesson archived: ${lesson.title.english} by admin ${req.userId}`);

    // Clear cache
    await clearLessonCache(id);

    res.json({
      success: true,
      message: 'Lesson archived successfully',
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Publish lesson (admin only)
 * POST /api/lessons/:id/publish
 */
router.post('/:id/publish', auth, authorize('admin'), validateLessonId, async (req, res, next) => {
  try {
    const { id } = req.params;

    const lesson = await Lesson.findById(id);

    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    lesson.status = 'published';
    lesson.publishedAt = new Date();
    lesson.publishedBy = req.userId;
    await lesson.save();

    logger.info(`Lesson published: ${lesson.title.english} by admin ${req.userId}`);

    // Notify users about new lesson
    await notifyUsersAboutNewLesson(lesson);

    // Clear cache
    await clearLessonCache(id);

    res.json({
      success: true,
      message: 'Lesson published successfully',
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get lesson categories
 */
async function getLessonCategories() {
  const categories = await Lesson.distinct('category', { status: 'published' });
  return categories.map(cat => ({
    name: cat,
    count: 0, // Would need to count
  }));
}

/**
 * Get related lessons
 */
async function getRelatedLessons(lesson) {
  if (lesson.relatedLessons && lesson.relatedLessons.length > 0) {
    return lesson.relatedLessons;
  }

  // Find lessons in same category and level
  const related = await Lesson.find({
    category: lesson.category,
    level: lesson.level,
    _id: { $ne: lesson._id },
    status: 'published',
  })
    .limit(3)
    .select('title.english level order');

  return related;
}

/**
 * Get lesson statistics - Refactored for maximum FerretDB compatibility
 * Moves logic from MongoDB Aggregation to JavaScript
 */
async function getLessonStats(lessonId) {
  try {
    const [completions, allProgress] = await Promise.all([
      Progress.countDocuments({ lesson: lessonId, completed: true }),
      Progress.find({ lesson: lessonId }).select('score timeSpent')
    ]);

    const count = allProgress.length;
    const totals = allProgress.reduce((acc, curr) => {
      acc.score += (Number(curr.score) || 0);
      acc.time += (Number(curr.timeSpent) || 0);
      return acc;
    }, { score: 0, time: 0 });

    return {
      completions,
      averageScore: count > 0 ? Math.round(totals.score / count) : 0,
      totalTimeSpent: totals.time,
      uniqueLearners: count // Simplified for performance
    };
  } catch (error) {
    logger.error(`Stats error: ${error.message}`);
    return { completions: 0, averageScore: 0, totalTimeSpent: 0, uniqueLearners: 0 };
  }
}

/**
 * Get lesson recommendations
 */
async function getLessonRecommendations(lesson, userId) {
  // 1. Basic check
  if (!userId) return [];
  
  // 2. STRICT VALIDATION: Ensure it's a valid 24-char Mongo ID
  if (!mongoose.Types.ObjectId.isValid(userId) || String(userId).length !== 24) {
    logger.warn(`Skipping recommendations: Invalid ObjectId format [${userId}]`);
    return []; 
  }


  try {
    const user = await User.findById(userId);
    if (!user) return [];
   // Get lessons in same category that user hasn't completed
   const completedIds = user.progress?.completedLessons?.map(l => l.lessonId) || [];

   const recommendations = await Lesson.find({
     category: lesson.category,
     _id: { $nin: completedIds },
     status: 'published',
   })
    .limit(3)
    .select('title.english level order difficulty');

    return recommendations;
  } catch (err) {
    logger.error("Recommendation lookup failed", err);
    return [];
  }
}

/**
 * Check prerequisites
 */
async function checkPrerequisites(userId, lesson) {
  if (!lesson.prerequisites || lesson.prerequisites.length === 0) {
    return { met: true, missing: [] };
  }

  const missing = [];

  for (const prereq of lesson.prerequisites) {
    if (prereq.type === 'lesson') {
      const progress = await Progress.findOne({
        user: userId,
        lesson: prereq.lessonId,
        completed: true,
      });

      if (!progress || (prereq.minimumScore && progress.score < prereq.minimumScore)) {
        missing.push({
          type: 'lesson',
          id: prereq.lessonId,
          requiredScore: prereq.minimumScore,
        });
      }
    }
  }

  return {
    met: missing.length === 0,
    missing,
  };
}

/**
 * Calculate points earned
 */
function calculatePointsEarned(score, isFirstCompletion, isNewBestScore) {
  let points = Math.floor(score / 2); // Base points: 0-50

  if (isFirstCompletion) {
    points += 50; // First time bonus
  }

  if (isNewBestScore && score === 100) {
    points += 25; // Perfect score bonus
  }

  return points;
}

/**
 * Calculate experience earned
 */
function calculateExpEarned(score, timeSpent) {
  const baseExp = score * 2; // 0-200
  const timeBonus = Math.min(50, Math.floor(timeSpent / 2)); // Up to 50 bonus
  return baseExp + timeBonus;
}

/**
 * Generate lesson feedback
 */
function generateLessonFeedback(score, timeSpent, estimatedTime) {
  const feedback = [];

  if (score >= 90) {
    feedback.push('Excellent work! You\'ve mastered this lesson.');
  } else if (score >= 70) {
    feedback.push('Good job! You\'ve passed the lesson.');
  } else {
    feedback.push('Keep practicing! Review the material and try again.');
  }

  if (estimatedTime && timeSpent < estimatedTime * 0.7) {
    feedback.push('You completed this lesson faster than expected!');
  } else if (estimatedTime && timeSpent > estimatedTime * 1.5) {
    feedback.push('Take your time - accuracy is more important than speed.');
  }

  return feedback;
}

/**
 * Update learning analytics
 */
async function updateLearningAnalytics(userId, lesson, progress, sessionData) {
  const today = new Date().toISOString().split('T')[0];

  // ONLY use the atomic update. It handles creation (upsert) and incrementing 
  // without loading the heavy document into memory.
  await LearningAnalytics.updateOne(
    { user: userId, period: 'daily', date: today },
    { 
      $inc: { 
        'activity.totalSessions': 1,
        'activity.totalTime': sessionData.timeSpent || 0,
        'progress.lessonsCompleted': 1,
        'progress.pointsEarned': sessionData.score || 0
      },
      $set: {
        'metadata.generatedAt': new Date()
      }
    },
    { upsert: true }
  );
}

/**
 * Check lesson achievements
 */
async function checkLessonAchievements(user, lesson, progress, flags) {
  const achievements = [];

  // First lesson completion
  if (flags.isFirstCompletion && user.progress.completedLessons.length === 1) {
    achievements.push({
      type: 'achievement',
      name: 'First Steps',
      description: 'Completed your first lesson!',
      icon: '🎓',
    });
  }

  // Perfect score
  if (flags.perfectScore) {
    achievements.push({
      type: 'badge',
      name: 'Perfect Score',
      description: 'Achieved 100% on a lesson',
      icon: '💯',
      tier: 'gold',
    });
  }

  // Lesson streak (complete lessons on consecutive days)
  if (flags.isFirstCompletion && user.progress.streak.current >= 7) {
    achievements.push({
      type: 'badge',
      name: 'Week Warrior',
      description: 'Completed lessons for 7 days in a row',
      icon: '🔥',
      tier: 'silver',
    });
  }

  return achievements;
}

/**
 * Get next recommended lesson
 */
async function getNextRecommendedLesson(userId, currentLesson) {
  const user = await User.findById(userId);
  const completedIds = user.progress.completedLessons.map(l => l.lessonId);

  // Try to get next lesson in same module
  if (currentLesson.moduleId) {
    const nextInModule = await Lesson.findOne({
      moduleId: currentLesson.moduleId,
      order: currentLesson.order + 1,
      status: 'published',
    }).select('title.english order');

    if (nextInModule) return nextInModule;
  }

  // Otherwise, get next lesson in same level
  const nextLesson = await Lesson.findOne({
    level: currentLesson.level,
    order: { $gt: currentLesson.order },
    _id: { $nin: completedIds },
    status: 'published',
  })
    .sort({ order: 1 })
    .select('title.english order');

  return nextLesson;
}

/**
 * Get personalized recommendations
 */
async function getPersonalizedRecommendations(userId, limit) {
  const user = await User.findById(userId);
  const completedIds = user.progress.completedLessons.map(l => l.lessonId);

  // Get user's preferred categories from history
  const categoryCounts = {};
  user.progress.completedLessons.forEach(completion => {
    if (completion.category) {
      categoryCounts[completion.category] = (categoryCounts[completion.category] || 0) + 1;
    }
  });

  const preferredCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // Recommend lessons from preferred categories
  const recommendations = await Lesson.find({
    category: { $in: preferredCategories },
    _id: { $nin: completedIds },
    status: 'published',
    level: user.progress?.level || 'beginner',
  })
    .sort({ popularity: -1, order: 1 })
    .limit(limit)
    .select('title.english level category order difficulty');

  return recommendations;
}

/**
 * Get overall lesson statistics (Admin)
 * Refactored to avoid $avg and $addToSet which can be finicky in proot/FerretDB
 */
async function getLessonStatistics() {
  const [totalLessons, byLevel, byCategory, allProgress, publishedCount, draftCount] = await Promise.all([
    Lesson.countDocuments({}),
    Lesson.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }]),
    Lesson.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Progress.find({}).select('score user'), // Fetch raw for JS calculation
    Lesson.countDocuments({ status: 'published' }),
    Lesson.countDocuments({ status: 'draft' }),
  ]);

  // Calculate averages and uniqueness in JS
  const totalCompletions = allProgress.length;
  const avgScore = totalCompletions > 0 
    ? allProgress.reduce((acc, p) => acc + (p.score || 0), 0) / totalCompletions 
    : 0;
  
  const uniqueUsers = new Set(allProgress.map(p => p.user.toString())).size;

  return {
    totalLessons,
    byLevel,
    byCategory,
    completionStats: {
      totalCompletions,
      averageScore: avgScore,
      uniqueUsersCount: uniqueUsers,
    },
    publishedCount,
    draftCount,
  };
}

/**
 * Notify users about new lesson
 */
async function notifyUsersAboutNewLesson(lesson) {
  try {
    // Get active users interested in this category/level
    const users = await User.find({
      status: 'active',
      $or: [
        { 'preferences.preferredCategories': lesson.category },
        { 'preferences.preferredCategories': { $exists: false } },
      ],
    }).limit(100).select('_id');

    await notificationService.sendToMany(users.map(u => u._id), {
      type: 'new_lesson',
      title: '📚 New Lesson Available!',
      body: `"${lesson.title.english}" is now available. Start learning today!`,
      data: {
        lessonId: lesson._id,
        level: lesson.level,
        category: lesson.category,
      },
      priority: 2,
      actionUrl: `/lessons/${lesson._id}`,
    }, { channels: ['in_app', 'push'] });

  } catch (error) {
    logger.error('Failed to notify users about new lesson:', error);
  }
}

/**
 * Clear lesson cache
 */
async function clearLessonCache(lessonId = null) {
  try {
    const patterns = ['lessons:list*'];
    if (lessonId) {
      patterns.push(`lesson:${lessonId}*`);
    }

    for (const pattern of patterns) {
      // This now calls the method we just added to your class
      const keys = await redis.keys(pattern);
      
      if (keys && keys.length > 0) {
        // Your class already has a del() method, but ioredis.del 
        // can take an array. If your wrapper only takes one key, 
        // you might need to loop or update the del method.
        await Promise.all(keys.map(key => redis.del(key)));
      }
    }
  } catch (error) {
    logger.error('Failed to clear lesson cache:', error);
  }
}


module.exports = router;
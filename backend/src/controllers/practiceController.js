const Vocabulary = require('../models/Vocabulary');
const User = require('../models/User');
const PracticeSession = require('../models/PracticeSession');
const LearningProgress = require('../models/LearningProgress');
const Language = require('../models/Language');
const notificationService = require('../services/notificationService');
const { logger } = require('../config/logger');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const redis = require('../config/redis');

// ============================================================================
// SRS ALGORITHM CONFIGURATION
// ============================================================================

const SRS_STAGES = {
  0: { name: 'New', interval: 0, ease: 2.5, description: 'First time seeing word' },
  1: { name: 'Learning', interval: 4 / 24, ease: 2.5, description: 'Hours until review' }, // 4 hours
  2: { name: 'Reviewing', interval: 1, ease: 2.5, description: 'Days until review' },
  3: { name: 'Mastered', interval: 3, ease: 2.5, description: 'Every 3 days' },
  4: { name: 'Fluent', interval: 7, ease: 2.5, description: 'Weekly review' },
  5: { name: 'Native', interval: 30, ease: 2.5, description: 'Monthly check-in' },
};

const QUALITY_SCORES = {
  AGAIN: 0, // Complete blackout, didn't remember
  HARD: 1,  // Remembered with significant effort
  GOOD: 2,  // Remembered with some effort
  EASY: 3,  // Perfect recall
  PERFECT: 4, // Instant recall, no effort
};

const MAX_INTERVAL = 365 * 3; // 3 years max interval
const REVIEWS_PER_SESSION = 20;
const NEW_WORDS_PER_SESSION = 5;
const LEITNER_BOXES = 5; // Leitner system boxes

// ============================================================================
// MAIN PRACTICE ENDPOINT
// ============================================================================

/**
 * Get daily practice words with advanced SRS
 * GET /api/practice/daily
 */
exports.getDailyPractice = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { 
      limit = 20,
      includeNew = true,
      category,
      difficulty,
      lang,
      sessionId,
    } = req.query;

    // Resolve language_id if lang is provided
    let targetLanguageId = null;
    if (lang) {
      const language = await Language.findOne({ code: lang.toUpperCase() });
      if (language) {
        targetLanguageId = language._id;
      }
    }

    // Get or create practice session
    let session;
    if (sessionId) {
      session = await PracticeSession.findById(sessionId);
      if (!session || session.userId.toString() !== userId) {
        throw new AppError('Invalid practice session', 404);
      }
    } else {
      session = await createPracticeSession(userId, {
        limit: parseInt(limit),
        includeNew: includeNew === 'true',
        category,
        difficulty,
        language_id: targetLanguageId,
      });
    }

    // Get due words using advanced SRS algorithm
    const dueWords = await getDueWords(userId, session);
    
    // Get new words if needed
    let practiceSet = [];
    if (dueWords.length >= session.settings.wordsPerSession) {
      practiceSet = dueWords.slice(0, session.settings.wordsPerSession);
    } else {
      practiceSet = dueWords;
      
      // Add new words if allowed
      if (session.settings.includeNew) {
        const newWordsNeeded = session.settings.wordsPerSession - dueWords.length;
        const newWords = await getNewWords(userId, newWordsNeeded, session);
        practiceSet = [...practiceSet, ...newWords];
      }
    }

    // Shuffle practice set for better learning
    practiceSet = shuffleArray(practiceSet);

    // Update session with practice words
    session.words = practiceSet.map(w => ({
      wordId: w._id,
      presentedAt: new Date(),
     // Initialize fields to avoid "undefined" errors in FerretDB sorting/queries later
     quality: null,
     reviewedAt: null
    }));
    session.startedAt = new Date();
    // Ensure Mongoose flags the words array as changed
    session.markModified('words'); 
    await session.save();

    // Prepare response with enhanced word data
    const enhancedWords = await enhanceWordData(practiceSet, userId);

    // Cache practice session in Redis
    await cachePracticeSession(session._id, {
      sessionId: session._id,
      words: enhancedWords,
      settings: session.settings,
    });

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        words: enhancedWords,
        stats: {
          dueToday: dueWords.length,
          newAvailable: await getNewWordsCount(userId),
          totalMastered: await getMasteredCount(userId),
          nextReview: await getNextReviewTime(userId),
        },
        settings: session.settings,
        progress: {
          completed: session.completed,
          total: session.settings.wordsPerSession,
        },
      },
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Submit practice results
 * POST /api/practice/submit
 */
exports.submitPracticeResult = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { 
      sessionId, 
      wordId, 
      quality, 
      responseTime, 
      confidence,
      mistakes,
    } = req.body;

    // Validate input
    if (!sessionId || !wordId || quality === undefined) {
      throw new ValidationError('Missing required fields');
    }

    if (!Object.values(QUALITY_SCORES).includes(quality)) {
      throw new ValidationError('Invalid quality score');
    }

    // Get practice session
    const session = await PracticeSession.findById(sessionId);
    if (!session || session.userId.toString() !== userId) {
      throw new AppError('Invalid practice session', 404);
    }

    // Find word in session
    const sessionWord = session.words.find(w => 
      w.wordId.toString() === wordId
    );
    
    if (!sessionWord) {
      throw new AppError('Word not found in session', 404);
    }

    // Calculate metrics
    const metrics = calculateMetrics(sessionWord, quality, responseTime, confidence);

    // Update SRS for the word
    const updatedSRS = await updateSRS(userId, wordId, quality, metrics);

    // Update session word data
    Object.assign(sessionWord, {
      quality,
      responseTime,
      confidence,
      mistakes: mistakes || [],
      reviewedAt: new Date(),
      srsStage: updatedSRS.stage,
      nextReview: updatedSRS.nextReview,
    });

    // Update session progress
    session.completed = session.words.filter(w => w.reviewedAt).length;
    
    // Check if session is complete
    if (session.completed >= session.settings.wordsPerSession) {
      session.completedAt = new Date();
      await finalizePracticeSession(session, userId);
    }

    await session.save();

    // Clear cache
    await clearPracticeCache(userId, sessionId);

    // Send real-time update via WebSocket if available
    await sendPracticeUpdate(userId, {
      type: 'word_completed',
      sessionId,
      completed: session.completed,
      total: session.settings.wordsPerSession,
    });

    res.json({
      success: true,
      data: {
        wordId,
        quality,
        nextReview: updatedSRS.nextReview,
        stage: updatedSRS.stage,
        stageName: SRS_STAGES[updatedSRS.stage].name,
        metrics,
        sessionProgress: {
          completed: session.completed,
          total: session.settings.wordsPerSession,
        },
        streak: await updateStreak(userId),
      },
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get practice statistics
 * GET /api/practice/stats
 */
exports.getPracticeStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { period = 'week' } = req.query;

    const stats = await getPracticeStatistics(userId, period);

    res.json({
      success: true,
      data: stats,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get review forecast
 * GET /api/practice/forecast
 */
exports.getReviewForecast = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { days = 30 } = req.query;

    const forecast = await getReviewForecast(userId, parseInt(days));

    res.json({
      success: true,
      data: forecast,
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// ADVANCED SRS ALGORITHMS
// ============================================================================

/**
 * Update SRS using modified SM-2 algorithm
 */
const updateSRS = async (userId, wordId, quality, metrics) => {
  try {
    const user = await User.findById(userId);
    const masteryItem = user.vocabularyMastery.find(
      v => v.wordId.toString() === wordId.toString()
    );

    let stage, ease, interval, nextReview;

    if (!masteryItem) {
      // First time seeing this word
      stage = 1;
      ease = SRS_STAGES[1].ease;
      interval = SRS_STAGES[1].interval;
      
      // Get word to find its language_id
      const Vocabulary = mongoose.model('Vocabulary');
      const word = await Vocabulary.findById(wordId);

      // Add to vocabulary mastery
      user.vocabularyMastery.push({
        wordId,
        language_id: word?.language_id,
        stage,
        ease,
        interval,
        reviewCount: 1,
        lapses: quality <= QUALITY_SCORES.HARD ? 1 : 0,
        lastReview: new Date(),
        nextReview: calculateNextReview(interval, stage),
        history: [{
          quality,
          responseTime: metrics.responseTime,
          timestamp: new Date(),
        }],
      });
    } else {
      // Existing word - apply SM-2 algorithm
      const oldStage = masteryItem.stage;
      const oldEase = masteryItem.ease || 2.5;
      
      // SM-2 algorithm for ease factor
      ease = oldEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      ease = Math.max(1.3, Math.min(2.5, ease)); // Clamp between 1.3 and 2.5

      // Determine new stage based on quality
      if (quality <= QUALITY_SCORES.AGAIN) {
        // Complete failure - reset to stage 1
        stage = 1;
        interval = SRS_STAGES[1].interval;
        masteryItem.lapses = (masteryItem.lapses || 0) + 1;
      } else if (quality <= QUALITY_SCORES.HARD) {
        // Hard recall - decrease stage or interval
        stage = Math.max(1, oldStage - 1);
        interval = calculateInterval(stage, ease, masteryItem.reviewCount);
      } else if (quality <= QUALITY_SCORES.GOOD) {
        // Good recall - progress normally
        stage = Math.min(Object.keys(SRS_STAGES).length - 1, oldStage + 1);
        interval = calculateInterval(stage, ease, masteryItem.reviewCount);
      } else {
        // Easy/Perfect recall - progress faster
        stage = Math.min(Object.keys(SRS_STAGES).length - 1, oldStage + 2);
        interval = calculateInterval(stage, ease, masteryItem.reviewCount) * 1.5;
      }

      // Cap interval at maximum
      interval = Math.min(interval, MAX_INTERVAL);
      
      // Calculate next review date
      nextReview = calculateNextReview(interval, stage);

      // Update mastery item
      masteryItem.stage = stage;
      masteryItem.ease = ease;
      masteryItem.interval = interval;
      masteryItem.nextReview = nextReview;
      masteryItem.reviewCount = (masteryItem.reviewCount || 0) + 1;
      masteryItem.lastReview = new Date();
      
      // Add to history
      if (!masteryItem.history) masteryItem.history = [];
      masteryItem.history.push({
        quality,
        responseTime: metrics.responseTime,
        stage,
        timestamp: new Date(),
      });
    }

      // FerretDB FIX: Mongoose might not detect the deep change in an array of objects
     // Tell Mongoose exactly which path in the document was modified
      user.markModified('vocabularyMastery');
      await user.save();

    return {
      stage,
      ease,
      interval,
      nextReview,
      reviewCount: masteryItem?.reviewCount || 1,
    };

  } catch (error) {
    logger.error('SRS update error:', error);
    throw error;
  }
};

/**
 * Calculate interval based on SM-2 algorithm
 */
const calculateInterval = (stage, ease, reviewCount) => {
  if (stage <= 1) return SRS_STAGES[stage].interval;
  
  if (stage === 2) {
    return SRS_STAGES[2].interval;
  }
  
  // For stage 3+, apply exponential spacing
  const baseInterval = SRS_STAGES[stage].interval;
  const multiplier = Math.pow(ease, stage - 2);
  
  return baseInterval * multiplier;
};

/**
 * Calculate next review date
 */
const calculateNextReview = (interval, stage) => {
  const now = new Date();
  
  if (stage <= 1) {
    // Hours for learning stage
    return new Date(now.getTime() + interval * 60 * 60 * 1000);
  } else {
    // Days for review stage
    return new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  }
};

/**
 * Calculate learning metrics
 */
const calculateMetrics = (sessionWord, quality, responseTime, confidence) => {
  const metrics = {
    quality,
    responseTime,
    confidence: confidence || quality / 4,
    accuracy: quality >= QUALITY_SCORES.GOOD ? 1 : quality / 4,
    speed: calculateSpeedMetric(responseTime),
  };

  if (sessionWord.presentedAt) {
    const timeToRespond = (new Date() - new Date(sessionWord.presentedAt)) / 1000;
    metrics.timeToRespond = timeToRespond;
    metrics.expectedTime = calculateExpectedTime(sessionWord.wordId);
    metrics.performance = metrics.expectedTime / timeToRespond;
  }

  return metrics;
};

/**
 * Calculate speed metric based on response time
 */
const calculateSpeedMetric = (responseTime) => {
  if (responseTime < 2) return 4; // Lightning fast
  if (responseTime < 4) return 3; // Fast
  if (responseTime < 8) return 2; // Normal
  if (responseTime < 15) return 1; // Slow
  return 0; // Very slow
};

// ============================================================================
// WORD SELECTION ALGORITHMS
// ============================================================================

/**
 * Get due words using advanced criteria
 */
const getDueWords = async (userId, session) => {
  const user = await User.findById(userId).populate('vocabularyMastery.wordId');
  
  const now = new Date();
  const dueItems = [];

  for (const item of user.vocabularyMastery) {
    if (new Date(item.nextReview) <= now) {
      // Apply additional filtering based on session settings
      if (session.settings.category && 
          item.wordId.category !== session.settings.category) {
        continue;
      }
      
      if (session.settings.difficulty && 
          item.wordId.difficulty !== session.settings.difficulty) {
        continue;
      }

      if (session.settings.language_id && 
          item.wordId.language_id.toString() !== session.settings.language_id.toString()) {
        continue;
      }

      dueItems.push({
        ...item.toObject(),
        priority: calculatePriority(item, now),
      });
    }
  }

  // Sort by priority (highest first)
  dueItems.sort((a, b) => b.priority - a.priority);

  return dueItems.map(item => item.wordId);
};

/**
 * Calculate priority for due words
 */
const calculatePriority = (item, now) => {
  const overdue = (now - new Date(item.nextReview)) / (24 * 60 * 60 * 1000);
  const lapses = item.lapses || 0;
  const reviewCount = item.reviewCount || 1;
  
  // Priority formula: overdue days * (1 + lapses) / reviewCount
  return (overdue * (1 + lapses)) / Math.sqrt(reviewCount);
};

/**
 * Get new words for learning
 */
const getNewWords = async (userId, limit, session) => {
  const user = await User.findById(userId);
  
  // Get mastered word IDs
  const masteredIds = user.vocabularyMastery.map(v => v.wordId);

  // Build query for new words
  const query = {
    _id: { $nin: masteredIds },
  };

  // Apply filters
  if (session.settings.category) {
    query.category = session.settings.category;
  }
  if (session.settings.difficulty) {
    query.difficulty = session.settings.difficulty;
  }
  if (session.settings.language_id) {
    query.language_id = session.settings.language_id;
  }

  // Get words with priority for introduction
  const words = await Vocabulary.find(query)
    .sort({ frequency: -1, usefulness: -1 }) // Most frequent/useful first
    .limit(limit);

  return words;
};

/**
 * Get count of new words available
 */
const getNewWordsCount = async (userId) => {
  const user = await User.findById(userId);
  const masteredIds = user.vocabularyMastery.map(v => v.wordId);
  
  return await Vocabulary.countDocuments({
    _id: { $nin: masteredIds },
  });
};

/**
 * Get count of mastered words
 */
const getMasteredCount = async (userId) => {
  const user = await User.findById(userId);
  return user.vocabularyMastery.filter(v => v.stage >= 4).length;
};

/**
 * Get next review time
 */
const getNextReviewTime = async (userId) => {
  const user = await User.findById(userId);
  
  const nextReview = user.vocabularyMastery
    .map(v => new Date(v.nextReview))
    .filter(d => d > new Date())
    .sort((a, b) => a - b)[0];

  return nextReview || null;
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new practice session
 */
const createPracticeSession = async (userId, options) => {
  const session = new PracticeSession({
    userId,
    startedAt: new Date(),
    settings: {
      wordsPerSession: options.limit || REVIEWS_PER_SESSION,
      includeNew: options.includeNew !== false,
      category: options.category,
      difficulty: options.difficulty,
      language_id: options.language_id,
      newWordsLimit: NEW_WORDS_PER_SESSION,
    },
    words: [],
    completed: 0,
  });

  await session.save();
  return session;
};

/**
 * Finalize practice session
 */
const finalizePracticeSession = async (session, userId) => {
  // Calculate session statistics
  const stats = calculateSessionStats(session);
  
  session.stats = stats;
  session.completedAt = new Date();
  await session.save();

  // Update user's learning progress
  await updateLearningProgress(userId, session, stats);

  // Send session summary notification
  await sendSessionSummary(userId, stats);

  // Clear cache
  await clearPracticeCache(userId, session._id);
};

/**
 * Calculate session statistics
 */
const calculateSessionStats = (session) => {
  const words = session.words.filter(w => w.reviewedAt);
  
  const stats = {
    totalWords: words.length,
    averageQuality: words.reduce((sum, w) => sum + w.quality, 0) / words.length,
    averageResponseTime: words.reduce((sum, w) => sum + w.responseTime, 0) / words.length,
    byQuality: {},
    newWords: words.filter(w => w.srsStage === 1).length,
    reviewedWords: words.filter(w => w.srsStage > 1).length,
    masteredWords: words.filter(w => w.srsStage >= 4).length,
  };

  // Group by quality
  words.forEach(w => {
    stats.byQuality[w.quality] = (stats.byQuality[w.quality] || 0) + 1;
  });

  return stats;
};

/**
 * Update user's learning progress
 */
const updateLearningProgress = async (userId, session, stats) => {
  let progress = await LearningProgress.findOne({ userId });
  
  if (!progress) {
    progress = new LearningProgress({ userId });
  }

  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  const dailyStat = progress.dailyStats.find(d => d.date === today);
  
  if (dailyStat) {
    dailyStat.wordsReviewed += stats.totalWords;
    dailyStat.sessionTime += (new Date() - session.startedAt) / 1000 / 60; // minutes
  } else {
    progress.dailyStats.push({
      date: today,
      wordsReviewed: stats.totalWords,
      sessionTime: (new Date() - session.startedAt) / 1000 / 60,
    });
  }

  // Update streak
  const lastActive = progress.lastActive || new Date(0);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastActive.toDateString() === yesterday.toDateString()) {
    progress.currentStreak += 1;
  } else if (lastActive.toDateString() !== new Date().toDateString()) {
    progress.currentStreak = 1;
  }

  progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak);
  progress.lastActive = new Date();
  progress.totalSessions += 1;
  progress.totalWordsReviewed += stats.totalWords;

  await progress.save();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Enhance word data with user-specific information
 */
const enhanceWordData = async (words, userId) => {
  const user = await User.findById(userId);
  
  return words.map(word => {
    const mastery = user.vocabularyMastery.find(
      v => v.wordId.toString() === word._id.toString()
    );

    return {
      ...word.toObject(),
      srsInfo: mastery ? {
        stage: mastery.stage,
        stageName: SRS_STAGES[mastery.stage]?.name,
        reviewCount: mastery.reviewCount,
        lastReview: mastery.lastReview,
        nextReview: mastery.nextReview,
        ease: mastery.ease,
      } : null,
      isNew: !mastery,
    };
  });
};

/**
 * Shuffle array (Fisher-Yates)
 */
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Calculate expected response time
 */
const calculateExpectedTime = (wordId) => {
  // In production, use ML model based on word complexity
  return 5; // Default 5 seconds
};

/**
 * Optimized Atomic Streak Update for FerretDB/SQLite
 */
const updateStreak = async (userId) => {
  const now = new Date();
  
  // Create a timestamp for the very beginning of today
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Create a timestamp for the very beginning of yesterday
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // 1. Increment streak if lastActive was yesterday
  const continueStreak = await User.updateOne(
    { 
      _id: userId, 
      lastActive: { $gte: startOfYesterday, $lt: startOfToday } 
    },
    { 
      $inc: { "progress.streak": 1 },
      $set: { lastActive: now }
    }
  );

  // 2. If no documents were modified, they either:
  //    a) Already updated today (do nothing)
  //    b) Missed a day (reset streak to 1)
  if (continueStreak.matchedCount === 0) {
    await User.updateOne(
      { 
        _id: userId, 
        lastActive: { $lt: startOfYesterday } // Only reset if they actually missed yesterday
      },
      { 
        $set: { 
          "progress.streak": 1,
          lastActive: now 
        }
      }
    );
  }

  // Fetch the final number to return to the UI
  const user = await User.findById(userId).select('progress.streak');
  return user.progress.streak;
};

/**
 * Cache practice session
 */
const cachePracticeSession = async (sessionId, data) => {
  try {
    await redis.set(`practice:${sessionId}`, data, 3600); // 1 hour TTL
  } catch (error) {
    logger.error('Failed to cache practice session:', error);
  }
};

/**
 * Clear practice cache
 */
const clearPracticeCache = async (userId, sessionId) => {
  try {
    await redis.del(`practice:${sessionId}`);
    await redis.del(`practice:user:${userId}`);
  } catch (error) {
    logger.error('Failed to clear practice cache:', error);
  }
};

/**
 * Get practice statistics
 */
const getPracticeStatistics = async (userId, period) => {
  const endDate = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate = new Date(0);
  }

  const sessions = await PracticeSession.find({
    userId,
    completedAt: { $gte: startDate, $lte: endDate },
  });

  const user = await User.findById(userId);
  const progress = await LearningProgress.findOne({ userId });

  return {
    summary: {
      totalSessions: sessions.length,
      totalWordsReviewed: sessions.reduce((sum, s) => sum + (s.stats?.totalWords || 0), 0),
      averageQuality: calculateAverageQuality(sessions),
      averageSessionTime: calculateAverageSessionTime(sessions),
    },
    byDay: aggregateByDay(sessions, period),
    streak: {
      current: progress?.currentStreak || 0,
      longest: progress?.longestStreak || 0,
    },
    mastery: {
      total: user.vocabularyMastery.length,
      byStage: countByStage(user.vocabularyMastery),
      newWords: await getNewWordsCount(userId),
    },
    performance: {
      accuracyTrend: calculateAccuracyTrend(sessions),
      speedTrend: calculateSpeedTrend(sessions),
    },
  };
};

/**
 * Get review forecast
 */
const getReviewForecast = async (userId, days) => {
  const user = await User.findById(userId).select('vocabularyMastery');
  const forecast = [];
  
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + days);

  // Get all items once instead of filtering in a loop
  const masteryItems = user.vocabularyMastery || [];

  for (let i = 0; i < days; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    const dateString = targetDate.toISOString().split('T')[0];

    const dueCount = masteryItems.filter(item => {
      if (!item.nextReview) return false;
      const reviewDate = new Date(item.nextReview).toISOString().split('T')[0];
      return reviewDate === dateString;
    }).length;

    forecast.push({
      date: dateString,
      dueCount,
      estimatedTime: dueCount * 2,
    });
  }

  return forecast;
};

/**
 * Calculate average quality from sessions
 */
const calculateAverageQuality = (sessions) => {
  const allQualities = sessions.flatMap(s => 
    s.words.filter(w => w.quality !== undefined).map(w => w.quality)
  );
  
  if (allQualities.length === 0) return 0;
  return allQualities.reduce((sum, q) => sum + q, 0) / allQualities.length;
};

/**
 * Calculate average session time
 */
const calculateAverageSessionTime = (sessions) => {
  const completed = sessions.filter(s => s.completedAt);
  if (completed.length === 0) return 0;
  
  const totalTime = completed.reduce((sum, s) => 
    sum + (new Date(s.completedAt) - new Date(s.startedAt)), 0
  );
  
  return totalTime / completed.length / 1000 / 60; // minutes
};

/**
 * Aggregate sessions by day
 */
const aggregateByDay = (sessions, period) => {
  const byDay = {};
  
  sessions.forEach(session => {
    const date = session.startedAt.toISOString().split('T')[0];
    
    if (!byDay[date]) {
      byDay[date] = {
        date,
        sessions: 0,
        wordsReviewed: 0,
        timeSpent: 0,
      };
    }
    
    byDay[date].sessions += 1;
    byDay[date].wordsReviewed += session.stats?.totalWords || 0;
    byDay[date].timeSpent += (new Date(session.completedAt) - new Date(session.startedAt)) / 1000 / 60;
  });
  
  return Object.values(byDay);
};

/**
 * Count vocabulary by SRS stage
 */
const countByStage = (vocabulary) => {
  const counts = {};
  
  Object.keys(SRS_STAGES).forEach(stage => {
    counts[stage] = 0;
  });
  
  vocabulary.forEach(item => {
    counts[item.stage] = (counts[item.stage] || 0) + 1;
  });
  
  return counts;
};

/**
 * Calculate accuracy trend
 */
const calculateAccuracyTrend = (sessions) => {
  // Sort by date
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  
  return sessions.map(s => ({
    date: s.startedAt.toISOString().split('T')[0],
    accuracy: s.stats?.averageQuality / 4 * 100 || 0,
  }));
};

/**
 * Calculate speed trend
 */
const calculateSpeedTrend = (sessions) => {
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  
  return sessions.map(s => ({
    date: s.startedAt.toISOString().split('T')[0],
    speed: 100 - (s.stats?.averageResponseTime * 10) || 0,
  }));
};

/**
 * Send practice update via WebSocket
 */
const sendPracticeUpdate = async (userId, data) => {
  // Implementation would depend on your WebSocket setup
  logger.debug(`Practice update for user ${userId}:`, data);
};

/**
 * Send session summary notification
 */
const sendSessionSummary = async (userId, stats) => {
  try {
    await notificationService.sendNotification(userId,
    {
      type: 'practice_summary',
      title: '✨ Practice Session Complete!',
      body: `You reviewed ${stats.totalWords} words with ${Math.round(stats.averageQuality * 100)}% accuracy.`,
      data: { stats },
    });
  } catch (error) {
    logger.error('Failed to send session summary:', error);
  }
};

module.exports = exports;
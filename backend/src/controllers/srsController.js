const User = require('../models/User');
const Vocabulary = require('../models/Vocabulary');
const LearningAnalytics = require('../models/LearningAnalytics');
const PracticeSession = require('../models/PracticeSession');
const { logger } = require('../config/logger');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const redis = require('../config/redis');
const notificationService = require('../services/notificationService');

// ============================================================================
// ADVANCED SRS ALGORITHM CONFIGURATION
// ============================================================================

const SRS_ALGORITHM = {
  // SM-2+ algorithm with optimizations for language learning
  VERSION: 'SM-2+',
  
  // Quality score mapping (0-5 scale)
  QUALITY: {
    AGAIN: 0,      // Complete blackout, didn't remember
    HARD: 1,       // Remembered with significant effort
    GOOD: 2,       // Remembered with some effort
    EASY: 3,       // Perfect recall, minimal effort
    PERFECT: 4,    // Instant recall, no effort
  },
  
  // SRS stages with descriptions
  STAGES: {
    0: { name: 'NEW', interval: 0, multiplier: 0, description: 'First encounter' },
    1: { name: 'LEARNING', interval: 4/24, multiplier: 1, description: 'Learning phase (hours)' }, // 4 hours
    2: { name: 'REVIEWING', interval: 1, multiplier: 1.5, description: 'Daily review' },
    3: { name: 'CONSOLIDATING', interval: 3, multiplier: 2, description: 'Every 3 days' },
    4: { name: 'MASTERING', interval: 7, multiplier: 2.5, description: 'Weekly review' },
    5: { name: 'FLUENT', interval: 30, multiplier: 3, description: 'Monthly review' },
    6: { name: 'NATIVE', interval: 90, multiplier: 3.5, description: 'Quarterly check' },
    7: { name: 'AUTOMATIC', interval: 365, multiplier: 4, description: 'Yearly review' },
  },
  
  // Leitner system boxes
  LEITNER: {
    1: { name: 'Box 1', reviews: 1, interval: 1 },
    2: { name: 'Box 2', reviews: 2, interval: 2 },
    3: { name: 'Box 3', reviews: 3, interval: 4 },
    4: { name: 'Box 4', reviews: 4, interval: 8 },
    5: { name: 'Box 5', reviews: 5, interval: 16 },
  },
  
  // Learning parameters
  PARAMETERS: {
    MIN_EASE: 1.3,
    MAX_EASE: 3.5,
    INITIAL_EASE: 2.5,
    MAX_INTERVAL: 365 * 3, // 3 years
    REVIEW_LIMIT: 50, // Max reviews per day
    NEW_WORDS_LIMIT: 10, // Max new words per day
  },
};

// ============================================================================
// MAIN SRS UPDATE ENDPOINT
// ============================================================================

/**
 * Update vocabulary mastery with advanced SRS
 * POST /api/vocabulary/mastery/update
 */
exports.updateMastery = async (req, res, next) => {
  try {
    const { 
      wordId, 
      quality, 
      responseTime, 
      sessionId,
      context,
      mistakes = [],
    } = req.body;

    // Validate input
    if (!wordId || quality === undefined) {
      throw new ValidationError('Word ID and quality score are required');
    }

    if (!Object.values(SRS_ALGORITHM.QUALITY).includes(quality)) {
      throw new ValidationError('Invalid quality score. Must be 0-4');
    }

    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get word details
    const word = await Vocabulary.findById(wordId);
    if (!word) {
      throw new AppError('Word not found', 404);
    }

    // Find or create mastery record
    const masteryIndex = user.vocabularyMastery.findIndex(
      v => v.wordId.toString() === wordId
    );

    // Calculate SRS using enhanced algorithm
    const result = await calculateEnhancedSRS({
      user,
      word,
      masteryIndex,
      quality,
      responseTime,
      context,
      mistakes,
    });

    // Atomic update for mastery record
    if (masteryIndex > -1) {
      // Update existing record
      await User.updateOne(
        { _id: userId, 'vocabularyMastery.wordId': wordId },
        {
          $set: {
            'vocabularyMastery.$.interval': result.mastery.interval,
            'vocabularyMastery.$.easeFactor': result.mastery.easeFactor,
            'vocabularyMastery.$.stage': result.mastery.stage,
            'vocabularyMastery.$.nextReview': result.mastery.nextReview,
            'vocabularyMastery.$.reviewCount': result.mastery.reviewCount,
            'vocabularyMastery.$.lastReviewed': new Date(),
          },
          $push: { 'vocabularyMastery.$.reviewHistory': result.review }
        }
      );
    } else {
      // Create new record
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            vocabularyMastery: {
              wordId,
              language_id: word.language_id,
              ...result.mastery,
              firstSeen: new Date(),
              lastReviewed: new Date(),
              reviewHistory: [result.review],
            }
          }
        }
      );
    }

    // Update user's learning stats asynchronously (non-blocking)
    updateUserLearningStats(user, result, word).catch(err => logger.error('Error updating stats:', err));


    // Update practice session if provided
    if (sessionId) {
      await updatePracticeSession(sessionId, userId, wordId, result);
    // Re-fetch session to get the latest completion count
    const session = await PracticeSession.findById(sessionId).lean();
    if (session) {
      response.data.sessionProgress = {
        completed: session.words.filter(w => w.reviewedAt).length,
        total: session.settings.wordsPerSession,
        remaining: session.words.filter(w => !w.reviewedAt).length,
      };
    }
  }

    // Check for achievements and send notifications asynchronously (non-blocking)
    checkMasteryAchievements(user, word, result)
      .then(achievements => {
        // Log if needed or handle
      })
      .catch(err => logger.error('Error checking achievements:', err));

    if (result.milestones.length > 0) {
      sendMasteryNotifications(userId, result.milestones)
        .catch(err => logger.error('Error sending notifications:', err));
    }

    // Cache the result asynchronously
    cacheMasteryResult(userId, wordId, result).catch(err => logger.error('Cache error:', err));

    // Prepare response
    const response = {
      success: true,
      data: {
        wordId,
        word: word.word,
        quality,
        srs: {
          stage: result.mastery.stage,
          stageName: SRS_ALGORITHM.STAGES[result.mastery.stage].name,
          interval: result.mastery.interval,
          easeFactor: result.mastery.easeFactor,
          nextReview: result.mastery.nextReview,
          reviewCount: result.mastery.reviewCount || 1,
          lapses: result.mastery.lapses || 0,
        },
        metrics: result.metrics,
        milestones: result.milestones,
        achievements: [], // Assuming empty as async check
        nextReviewIn: calculateTimeUntil(result.mastery.nextReview),
        recommendations: result.recommendations,
      },
    };

    // If this was part of a session, include session progress
    if (sessionId) {
      const session = await PracticeSession.findById(sessionId);
      if (session) {
        response.data.sessionProgress = {
          completed: session.words.filter(w => w.reviewedAt).length,
          total: session.settings.wordsPerSession,
          remaining: session.words.filter(w => !w.reviewedAt).length,
        };
      }
    }

    res.json(response);

  } catch (err) {
    next(err);
  }
};

/**
 * Batch update multiple words
 * POST /api/vocabulary/mastery/batch-update
 */
exports.batchUpdateMastery = async (req, res, next) => {
  try {
    const { updates } = req.body;
    const userId = req.userId;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ValidationError('Updates array is required');
    }

    const user = await User.findById(userId);
    const results = [];
    const errors = [];

    // Process updates in sequence to maintain data integrity
    for (const update of updates) {
      try {
        const { wordId, quality, responseTime } = update;
        
        // Find mastery index
        const masteryIndex = user.vocabularyMastery.findIndex(
          v => v.wordId.toString() === wordId
        );

        // Calculate SRS
        const result = await calculateEnhancedSRS({
          user,
          masteryIndex,
          quality,
          responseTime,
        });

        // Update mastery record
        if (masteryIndex > -1) {
          user.vocabularyMastery[masteryIndex] = {
            ...user.vocabularyMastery[masteryIndex],
            ...result.mastery,
            lastReviewed: new Date(),
            reviewHistory: [
              ...(user.vocabularyMastery[masteryIndex].reviewHistory || []),
              result.review,
            ],
          };
        } else {
          user.vocabularyMastery.push({
            wordId,
            ...result.mastery,
            firstSeen: new Date(),
            lastReviewed: new Date(),
            reviewHistory: [result.review],
          });
        }

        results.push({
          wordId,
          success: true,
          nextReview: result.mastery.nextReview,
        });

      } catch (error) {
        errors.push({
          wordId: update.wordId,
          error: error.message,
        });
      }
    }

    await user.save();

    res.json({
      success: true,
      data: {
        processed: results.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get word mastery statistics
 * GET /api/vocabulary/mastery/stats
 */
exports.getMasteryStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).populate('vocabularyMastery.wordId');

    // Calculate comprehensive statistics
    const stats = calculateMasteryStats(user);

    // Get review forecast
    const forecast = await getReviewForecast(user);

    // Get weak areas
    const weakAreas = await identifyWeakAreas(user);

    res.json({
      success: true,
      data: {
        summary: stats.summary,
        distribution: stats.distribution,
        performance: stats.performance,
        retention: stats.retention,
        forecast,
        weakAreas,
        recommendations: generateLearningRecommendations(stats, weakAreas),
      },
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// ADVANCED SRS CALCULATION
// ============================================================================

/**
 * Calculate enhanced SRS using SM-2+ algorithm
 */
const calculateEnhancedSRS = async ({
  user,
  word,
  masteryIndex,
  quality,
  responseTime,
  context,
  mistakes,
}) => {
  
  // Get current mastery data
  const current = masteryIndex > -1 
    ? user.vocabularyMastery[masteryIndex] 
    : {
        stage: 0,
        interval: 0,
        easeFactor: SRS_ALGORITHM.PARAMETERS.INITIAL_EASE,
        reviewCount: 0,
        lapses: 0,
        streak: 0,
        lastEase: SRS_ALGORITHM.PARAMETERS.INITIAL_EASE,
      };

  // Apply SM-2 algorithm for ease factor
  let easeFactor = current.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Clamp ease factor
  easeFactor = Math.max(
    SRS_ALGORITHM.PARAMETERS.MIN_EASE,
    Math.min(SRS_ALGORITHM.PARAMETERS.MAX_EASE, easeFactor)
  );

  // Calculate new stage based on quality
  let newStage = current.stage;
  let interval = current.interval;
  let lapses = current.lapses || 0;
  let streak = current.streak || 0;

  if (quality <= SRS_ALGORITHM.QUALITY.AGAIN) {
    newStage = 1;
    // Use the specific LEARNING interval (4 hours)
    interval = SRS_ALGORITHM.STAGES[1].interval; 
    lapses += 1;
    streak = 0;
  }

  else if (quality <= SRS_ALGORITHM.QUALITY.HARD) {
    // Hard recall - decrease stage
    newStage = Math.max(1, current.stage - 1);
    interval = calculateInterval(newStage, easeFactor, current.reviewCount);
    streak = Math.max(0, streak - 1);
  } 
  else if (quality <= SRS_ALGORITHM.QUALITY.GOOD) {
    // Good recall - normal progression
    newStage = Math.min(7, current.stage + 1);
    interval = calculateInterval(newStage, easeFactor, current.reviewCount);
    streak += 1;
  } 
  else {
    // Easy/Perfect recall - accelerated progression
    newStage = Math.min(7, current.stage + 2);
    interval = calculateInterval(newStage, easeFactor, current.reviewCount) * 1.5;
    streak += 2;
  }

  // Apply Leitner system for additional optimization
  const leitnerBox = calculateLeitnerBox(newStage, quality, streak);

  // Calculate next review date
  const nextReview = calculateNextReview(interval, newStage);

  // Calculate learning metrics
  const metrics = calculateLearningMetrics({
    quality,
    responseTime,
    current,
    word,
    context,
    mistakes,
  });

  // Check for milestones
  const milestones = checkMilestones({
    current,
    newStage,
    reviewCount: current.reviewCount + 1,
    lapses,
    streak,
    quality,
  });

  // Generate recommendations
  const recommendations = generateWordRecommendations({
    word,
    metrics,
    stage: newStage,
    quality,
  });

  // Prepare mastery update
  const mastery = {
    stage: newStage,
    interval,
    easeFactor,
    nextReview,
    reviewCount: current.reviewCount + 1,
    lapses,
    streak,
    leitnerBox,
    lastQuality: quality,
    lastEase: easeFactor,
    averageResponseTime: calculateAverageResponseTime(current, responseTime),
  };

  // Prepare review record
  const review = {
    quality,
    responseTime,
    stage: newStage,
    interval,
    easeFactor,
    metrics,
    mistakes,
    context,
    timestamp: new Date(),
  };

  return {
    mastery,
    review,
    metrics,
    milestones,
    recommendations,
  };
};

/**
 * Calculate interval based on SM-2 algorithm
 */
const calculateInterval = (stage, easeFactor, reviewCount) => {
  if (stage <= 1) {
    return SRS_ALGORITHM.STAGES[stage].interval;
  }
  
  if (stage === 2) {
    return SRS_ALGORITHM.STAGES[2].interval;
  }
  
  // Apply exponential spacing for higher stages
  const baseInterval = SRS_ALGORITHM.STAGES[stage].interval;
  const multiplier = Math.pow(easeFactor, stage - 2);
  const interval = baseInterval * multiplier * (1 + Math.log10(reviewCount) / 10);
  
  // Cap at maximum interval
  return Math.min(interval, SRS_ALGORITHM.PARAMETERS.MAX_INTERVAL);
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
 * Calculate Leitner box based on performance
 */
const calculateLeitnerBox = (stage, quality, streak) => {
  // Map to Leitner system (1-5 boxes)
  let box = Math.min(5, Math.max(1, Math.ceil(stage / 2)));
  
  // Adjust based on quality
  if (quality >= SRS_ALGORITHM.QUALITY.EASY) {
    box = Math.min(5, box + 1);
  } else if (quality <= SRS_ALGORITHM.QUALITY.HARD) {
    box = Math.max(1, box - 1);
  }
  
  return box;
};

// ============================================================================
// METRICS CALCULATION
// ============================================================================

/**
 * Calculate learning metrics
 */
const calculateLearningMetrics = ({
  quality,
  responseTime,
  current,
  word,
  context,
  mistakes,
}) => {
  
  // Base metrics
  const metrics = {
    quality,
    responseTime,
    accuracy: quality / 4, // 0-1 scale
    speed: calculateSpeedMetric(responseTime),
    confidence: calculateConfidence(quality, responseTime),
    retention: calculateRetention(current, quality),
  };

  // Word-specific metrics
  metrics.wordDifficulty = word.difficulty || 'medium';
  metrics.wordLength = word.word.length;
  metrics.wordComplexity = calculateWordComplexity(word);

  // Contextual metrics
  if (context) {
    metrics.contextRelevance = calculateContextRelevance(context, word);
  }

  // Mistake analysis
  if (mistakes && mistakes.length > 0) {
    metrics.mistakeTypes = mistakes;
    metrics.mistakePatterns = analyzeMistakePatterns(mistakes);
  }

  // Historical metrics
  if (current.reviewCount > 0) {
    metrics.improvement = calculateImprovement(current, quality);
    metrics.consistency = calculateConsistency(current, quality);
  }

  return metrics;
};

/**
 * Calculate speed metric
 */
const calculateSpeedMetric = (responseTime) => {
  if (responseTime < 2) return 5; // Lightning fast
  if (responseTime < 4) return 4; // Very fast
  if (responseTime < 8) return 3; // Fast
  if (responseTime < 15) return 2; // Normal
  if (responseTime < 30) return 1; // Slow
  return 0; // Very slow
};

/**
 * Calculate confidence based on quality and response time
 */
const calculateConfidence = (quality, responseTime) => {
  const baseConfidence = quality / 4; // 0-1
  const speedFactor = Math.max(0, 1 - (responseTime / 60)); // Slower responses reduce confidence
  return (baseConfidence * 0.7 + speedFactor * 0.3);
};

/**
 * Calculate retention based on historical performance
 */
const calculateRetention = (current, quality) => {
  if (!current.reviewHistory || current.reviewHistory.length === 0) {
    return quality / 4;
  }
  
  const recentQualities = current.reviewHistory
    .slice(-5)
    .map(r => r.quality / 4);
  
  recentQualities.push(quality / 4);
  
  return recentQualities.reduce((a, b) => a + b, 0) / recentQualities.length;
};

/**
 * Calculate word complexity
 */
const calculateWordComplexity = (word) => {
  let complexity = 0;
  
  // Length factor
  complexity += Math.min(5, word.word.length / 2);
  
  // Syllables (simplified)
  const syllables = (word.word.match(/[aeiou]/gi) || []).length;
  complexity += syllables;
  
  // Rare characters
  const rareChars = (word.word.match(/[^a-zA-Z\s]/g) || []).length;
  complexity += rareChars * 2;
  
  return Math.min(10, complexity);
};

// ============================================================================
// MILESTONE DETECTION
// ============================================================================

/**
 * Check for learning milestones
 */
const checkMilestones = ({
  current,
  newStage,
  reviewCount,
  lapses,
  streak,
  quality,
}) => {
  const milestones = [];

  // First review
  if (current.reviewCount === 0) {
    milestones.push({
      type: 'first_review',
      title: 'First Review',
      description: 'You\'ve started learning this word!',
      icon: '🌟',
    });
  }

  // Stage milestones
  if (newStage === 4 && current.stage < 4) {
    milestones.push({
      type: 'mastered',
      title: 'Word Mastered!',
      description: 'You\'ve reached the mastering stage for this word.',
      icon: '🎓',
    });
  }

  if (newStage === 7 && current.stage < 7) {
    milestones.push({
      type: 'automatic',
      title: 'Automatic Recall!',
      description: 'This word has become automatic for you.',
      icon: '⚡',
    });
  }

  // Streak milestones
  if (streak === 5) {
    milestones.push({
      type: 'streak_5',
      title: '5 in a Row!',
      description: 'You\'ve remembered this word correctly 5 times in a row.',
      icon: '🔥',
    });
  }

  if (streak === 10) {
    milestones.push({
      type: 'streak_10',
      title: 'Perfect Streak!',
      description: '10 consecutive correct reviews for this word.',
      icon: '🏆',
    });
  }

  // Review count milestones
  if (reviewCount === 10) {
    milestones.push({
      type: 'review_10',
      title: 'Double Digits',
      description: 'You\'ve reviewed this word 10 times.',
      icon: '🔟',
    });
  }

  if (reviewCount === 50) {
    milestones.push({
      type: 'review_50',
      title: 'Veteran Learner',
      description: '50 reviews for this word - true dedication!',
      icon: '🎯',
    });
  }

  // Quality milestones
  if (quality === SRS_ALGORITHM.QUALITY.PERFECT && current.lastQuality < SRS_ALGORITHM.QUALITY.PERFECT) {
    milestones.push({
      type: 'perfect_recall',
      title: 'Perfect Recall!',
      description: 'Instant, effortless recall!',
      icon: '💫',
    });
  }

  return milestones;
};

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

/**
 * Generate word-specific learning recommendations
 */
const generateWordRecommendations = ({
  word,
  metrics,
  stage,
  quality,
}) => {
  const recommendations = [];

  // Difficulty-based recommendations
  if (metrics.wordDifficulty === 'hard' && quality < SRS_ALGORITHM.QUALITY.GOOD) {
    recommendations.push({
      type: 'practice',
      priority: 'high',
      title: 'Extra Practice Needed',
      description: 'This word seems challenging. Try using it in a sentence.',
      action: 'practice',
    });
  }

  // Stage-based recommendations
  if (stage === 1) {
    recommendations.push({
      type: 'context',
      priority: 'medium',
      title: 'See in Context',
      description: 'View example sentences with this word.',
      action: 'examples',
    });
  }

  if (stage === 3) {
    recommendations.push({
      type: 'audio',
      priority: 'medium',
      title: 'Listen to Pronunciation',
      description: 'Hear how native speakers pronounce this word.',
      action: 'audio',
    });
  }

  // Mistake-based recommendations
  if (metrics.mistakePatterns?.length > 0) {
    metrics.mistakePatterns.forEach(pattern => {
      recommendations.push({
        type: 'mistake_pattern',
        priority: 'high',
        title: `Watch out for: ${pattern}`,
        description: `You tend to make ${pattern} errors with this word.`,
        action: 'focus',
      });
    });
  }

  // Time-based recommendations
  if (metrics.responseTime > 30) {
    recommendations.push({
      type: 'speed',
      priority: 'low',
      title: 'Work on Speed',
      description: 'Try to recall this word faster.',
      action: 'quick_recall',
    });
  }

  return recommendations;
};

/**
 * Analyze mistake patterns
 */
const analyzeMistakePatterns = (mistakes) => {
  const patterns = [];
  const mistakeCounts = {};

  mistakes.forEach(mistake => {
    mistakeCounts[mistake] = (mistakeCounts[mistake] || 0) + 1;
  });

  // Identify patterns
  if (mistakeCounts['spelling'] > 2) {
    patterns.push('spelling');
  }
  if (mistakeCounts['pronunciation'] > 2) {
    patterns.push('pronunciation');
  }
  if (mistakeCounts['meaning'] > 2) {
    patterns.push('meaning confusion');
  }
  if (mistakeCounts['tone'] > 2) {
    patterns.push('tone');
  }

  return patterns;
};

// ============================================================================
// USER STATISTICS UPDATES
// ============================================================================

/**
 * Update user learning statistics
 */
const updateUserLearningStats = async (user, result, word) => {
  // Initialize stats if not present
  if (!user.learningStats) {
    user.learningStats = {
      totalReviews: 0,
      totalMastered: 0,
      byDifficulty: {},
      byCategory: {},
      averageQuality: 0,
      streak: 0,
    };
  }

  const stats = user.learningStats;

  // Update total reviews
  stats.totalReviews = (stats.totalReviews || 0) + 1;

  // Update average quality
  const totalQuality = (stats.averageQuality || 0) * (stats.totalReviews - 1) + result.metrics.quality;
  stats.averageQuality = totalQuality / stats.totalReviews;

  // Update mastered count
  if (result.mastery.stage >= 4) {
    stats.totalMastered = (stats.totalMastered || 0) + 1;
  }

  // Update by difficulty
  const difficulty = word.difficulty || 'medium';
  stats.byDifficulty[difficulty] = (stats.byDifficulty[difficulty] || 0) + 1;

  // Update by category
  const category = word.category || 'general';
  stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

  // Update streak
  if (result.metrics.quality >= SRS_ALGORITHM.QUALITY.GOOD) {
    stats.streak = (stats.streak || 0) + 1;
  } else {
    stats.streak = 0;
  }
};

// ============================================================================
// ACHIEVEMENT CHECKING
// ============================================================================

/**
 * Check for mastery-based achievements
 */
const checkMasteryAchievements = async (user, word, result) => {
  const earned = [];

  // Word count achievements
  const masteredCount = user.vocabularyMastery.filter(v => v.stage >= 4).length;
  
  if (masteredCount === 10) {
    earned.push({
      name: 'First Steps',
      description: 'Mastered 10 words',
      icon: '👣',
    });
  }

  if (masteredCount === 50) {
    earned.push({
      name: 'Word Collector',
      description: 'Mastered 50 words',
      icon: '📚',
    });
  }

  if (masteredCount === 100) {
    earned.push({
      name: 'Vocabulary Builder',
      description: 'Mastered 100 words',
      icon: '🏗️',
    });
  }

  if (masteredCount === 500) {
    earned.push({
      name: 'Lexicon Master',
      description: 'Mastered 500 words',
      icon: '📖',
    });
  }

  // Streak achievements
  if (result.mastery.streak === 10) {
    earned.push({
      name: 'Perfect Recall',
      description: '10 perfect reviews in a row',
      icon: '💯',
    });
  }

  // Quality achievements
  if (result.metrics.quality === SRS_ALGORITHM.QUALITY.PERFECT) {
    const perfectCount = user.vocabularyMastery.filter(v => 
      v.reviewHistory?.some(r => r.quality === SRS_ALGORITHM.QUALITY.PERFECT)
    ).length;

    if (perfectCount === 1) {
      earned.push({
        name: 'First Perfect',
        description: 'Achieved your first perfect recall',
        icon: '✨',
      });
    }
  }

  // Category achievements
  const categoryCount = user.vocabularyMastery.filter(v => 
    v.wordId?.category === word.category && v.stage >= 4
  ).length;

  if (categoryCount === 20) {
    earned.push({
      name: `${word.category} Expert`,
      description: `Mastered 20 words in ${word.category}`,
      icon: '🎯',
    });
  }

  return { earned };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate time until next review (human readable)
 */
const calculateTimeUntil = (nextReview) => {
  const now = new Date();
  const diff = nextReview - now;

  if (diff < 0) return 'overdue';
  if (diff < 60 * 1000) return 'less than a minute';
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return `${days} day${days > 1 ? 's' : ''}`;
};

/**
 * Calculate average response time
 */
const calculateAverageResponseTime = (current, newTime) => {
  if (!current.reviewHistory || current.reviewHistory.length === 0) {
    return newTime;
  }
  
  const times = current.reviewHistory.map(r => r.responseTime);
  times.push(newTime);
  
  return times.reduce((a, b) => a + b, 0) / times.length;
};

/**
 * Update practice session
 */
const updatePracticeSession = async (sessionId, userId, wordId, result) => {
  const session = await PracticeSession.findById(sessionId);
  
  if (!session || session.userId.toString() !== userId) {
    return;
  }

  const wordIndex = session.words.findIndex(w => w.wordId.toString() === wordId);
  
  if (wordIndex > -1) {
    
    await PracticeSession.updateOne(
  { _id: sessionId, "words.wordId": wordId },
  { 
    $set: { 
      "words.$.reviewedAt": new Date(),
      "words.$.quality": result.review.quality,
      "words.$.srsStage": result.mastery.stage,
      "words.$.nextReview": result.mastery.nextReview,
      "words.$.metrics": result.metrics
    }
  });
    
    session.completed = session.words.filter(w => w.reviewedAt).length;
    
    await session.save();
  }
};

/**
 * Cache mastery result
 */
const cacheMasteryResult = async (userId, wordId, result) => {
  try {
    const key = `mastery:${userId}:${wordId}`;
    await redis.setex(key, 3600, JSON.stringify({
      nextReview: result.mastery.nextReview,
      stage: result.mastery.stage,
    }));
  } catch (error) {
    logger.error('Failed to cache mastery result:', error);
  }
};

/**
 * Send mastery notifications
 */
const sendMasteryNotifications = async (userId, milestones) => {
  for (const milestone of milestones) {
    await notificationService.sendNotification(userId, {
      type: 'mastery',
      title: milestone.title,
      description: milestone.description,
      icon: milestone.icon,
    });
  }
};

/**
 * Calculate mastery statistics
 */
const calculateMasteryStats = (user) => {
  const mastery = user.vocabularyMastery || [];
  
  const stats = {
    summary: {
      total: mastery.length,
      mastered: mastery.filter(v => v.stage >= 4).length,
      learning: mastery.filter(v => v.stage >= 1 && v.stage < 4).length,
      new: mastery.filter(v => v.stage === 0).length,
      neverReviewed: user.vocabularyMastery.filter(v => !v.lastReviewed).length,
    },
    distribution: {},
    performance: {
      averageQuality: 0,
      averageResponseTime: 0,
      retentionRate: 0,
    },
    retention: {},
  };

  // Distribution by stage
  for (let i = 0; i <= 7; i++) {
    stats.distribution[`stage_${i}`] = mastery.filter(v => v.stage === i).length;
  }

  // Calculate performance metrics
  const reviews = mastery.flatMap(v => v.reviewHistory || []);
  if (reviews.length > 0) {
    stats.performance.averageQuality = reviews.reduce((sum, r) => sum + r.quality, 0) / reviews.length;
    stats.performance.averageResponseTime = reviews.reduce((sum, r) => sum + r.responseTime, 0) / reviews.length;
    
    // Retention rate (percentage of reviews with quality >= GOOD)
    const goodReviews = reviews.filter(r => r.quality >= SRS_ALGORITHM.QUALITY.GOOD).length;
    stats.performance.retentionRate = (goodReviews / reviews.length) * 100;
  }

  // Retention by stage
  for (let i = 1; i <= 7; i++) {
    const stageReviews = mastery
      .filter(v => v.stage === i)
      .flatMap(v => v.reviewHistory || []);
    
    if (stageReviews.length > 0) {
      const goodStageReviews = stageReviews.filter(r => r.quality >= SRS_ALGORITHM.QUALITY.GOOD).length;
      stats.retention[`stage_${i}`] = (goodStageReviews / stageReviews.length) * 100;
    }
  }

  return stats;
};

/**
 * Get review forecast
 */
const getReviewForecast = async (user) => {
  const forecast = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dueCount = user.vocabularyMastery.filter(item => {
      const reviewDate = new Date(item.nextReview);
      return reviewDate >= date && reviewDate < nextDate;
    }).length;

    forecast.push({
      date: date.toISOString().split('T')[0],
      dueCount,
      estimatedTime: dueCount * 2, // 2 minutes per word
    });
  }

  return forecast;
};

/**
 * Identify weak areas
 */
const identifyWeakAreas = async (user) => {
  const weakAreas = [];
  
  // Analyze by category
  const byCategory = {};
  user.vocabularyMastery.forEach(item => {
    if (item.wordId?.category) {
      if (!byCategory[item.wordId.category]) {
        byCategory[item.wordId.category] = { total: 0, lowQuality: 0 };
      }
      byCategory[item.wordId.category].total++;
      
      const lastReview = item.reviewHistory?.slice(-1)[0];
      if (lastReview && lastReview.quality < SRS_ALGORITHM.QUALITY.GOOD) {
        byCategory[item.wordId.category].lowQuality++;
      }
    }
  });

  // Find categories with low performance
  Object.entries(byCategory).forEach(([category, data]) => {
    if (data.total >= 5) {
      const performance = (data.total - data.lowQuality) / data.total;
      if (performance < 0.6) {
        weakAreas.push({
          type: 'category',
          name: category,
          performance: Math.round(performance * 100),
          recommendation: `Review ${category} vocabulary`,
        });
      }
    }
  });

  // Analyze by difficulty
  const byDifficulty = {};
  user.vocabularyMastery.forEach(item => {
    if (item.wordId?.difficulty) {
      if (!byDifficulty[item.wordId.difficulty]) {
        byDifficulty[item.wordId.difficulty] = { total: 0, lowQuality: 0 };
      }
      byDifficulty[item.wordId.difficulty].total++;
      
      const lastReview = item.reviewHistory?.slice(-1)[0];
      if (lastReview && lastReview.quality < SRS_ALGORITHM.QUALITY.GOOD) {
        byDifficulty[item.wordId.difficulty].lowQuality++;
      }
    }
  });

  // Find problematic difficulties
  Object.entries(byDifficulty).forEach(([difficulty, data]) => {
    if (data.total >= 3) {
      const performance = (data.total - data.lowQuality) / data.total;
      if (performance < 0.5) {
        weakAreas.push({
          type: 'difficulty',
          name: difficulty,
          performance: Math.round(performance * 100),
          recommendation: `Focus on ${difficulty} words`,
        });
      }
    }
  });

  return weakAreas;
};

/**
 * Generate learning recommendations
 */
const generateLearningRecommendations = (stats, weakAreas) => {
  const recommendations = [];

  // Based on retention rate
  if (stats.performance.retentionRate < 70) {
    recommendations.push({
      priority: 'high',
      title: 'Focus on Retention',
      description: 'Your retention rate is below 70%. Review difficult words more frequently.',
      action: 'review_difficult',
    });
  }

  // Based on distribution
  if (stats.summary.new > stats.summary.mastered * 2) {
    recommendations.push({
      priority: 'medium',
      title: 'Consolidate Learning',
      description: 'You have many new words. Focus on mastering existing ones.',
      action: 'consolidate',
    });
  }

  // Add weak area recommendations
  weakAreas.forEach(area => {
    recommendations.push({
      priority: 'medium',
      title: `Improve ${area.name}`,
      description: area.recommendation,
      action: 'focus_area',
    });
  });

  return recommendations;
};

module.exports = exports;
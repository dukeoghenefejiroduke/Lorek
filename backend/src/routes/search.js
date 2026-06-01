const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const SearchHistory = require('../models/SearchHistory');
const { logger } = require('../config/logger');
const { cacheMiddleware } = require('../middleware/cache');
const redis = require('../config/redis');

// ============================================================================
// RATE LIMITING
// ============================================================================

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Too many search requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(searchLimiter);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Calculate relevance score for search results
function calculateRelevanceScore(item, query, searchType) {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  
  if (searchType === 'vocabulary' || !searchType) {
    // Exact match
    if (item.izonWord?.toLowerCase() === lowerQuery) score += 100;
    if (item.englishTranslation?.toLowerCase() === lowerQuery) score += 80;
    
    // Starts with
    if (item.izonWord?.toLowerCase().startsWith(lowerQuery)) score += 50;
    if (item.englishTranslation?.toLowerCase().startsWith(lowerQuery)) score += 40;
    
    // Contains
    if (item.izonWord?.toLowerCase().includes(lowerQuery)) score += 20;
    if (item.englishTranslation?.toLowerCase().includes(lowerQuery)) score += 15;
    
    // Category match
    if (item.category?.toLowerCase().includes(lowerQuery)) score += 10;
  }
  
  if (searchType === 'lessons' || !searchType) {
    if (item.title?.english?.toLowerCase() === lowerQuery) score += 100;
    if (item.title?.izon?.toLowerCase() === lowerQuery) score += 80;
    if (item.title?.english?.toLowerCase().startsWith(lowerQuery)) score += 50;
    if (item.title?.english?.toLowerCase().includes(lowerQuery)) score += 20;
    if (item.description?.english?.toLowerCase().includes(lowerQuery)) score += 10;
  }
  
  return score;
}

// Track search in history
async function trackSearch(userId, query, resultCount, searchType, languageId) {
  if (!userId) return;
  
  try {
    // Update or create search history
    await SearchHistory.findOneAndUpdate(
      { user: userId, query: query.toLowerCase(), language_id: languageId },
      {
        $inc: { count: 1 },
        $set: { lastSearched: new Date() },
        $addToSet: { types: searchType }
      },
      { upsert: true, new: true }
    );
    
    // Keep only last 50 searches per user per language
    const count = await SearchHistory.countDocuments({ user: userId, language_id: languageId });
    if (count > 50) {
      const oldest = await SearchHistory.findOne({ user: userId, language_id: languageId })
        .sort({ lastSearched: 1 });
      if (oldest) await oldest.deleteOne();
    }
  } catch (error) {
    logger.error('Failed to track search:', error);
  }
}

// Get trending searches (most searched in last 7 days)
async function getTrendingSearches(limit = 10, languageId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const matchQuery = { lastSearched: { $gte: sevenDaysAgo } };
  if (languageId) {
    matchQuery.language_id = languageId;
  }
  
  const trending = await SearchHistory.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$query', count: { $sum: '$count' } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  
  return trending.map(t => ({ query: t._id, count: t.count }));
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

/**
 * Global search across all content types
 * GET /api/search?q=query&type=all&limit=20
 */
router.get('/', [
  query('q').notEmpty().withMessage('Search query is required').isLength({ min: 2 }).withMessage('Query must be at least 2 characters'),
  query('type').optional().isIn(['all', 'vocabulary', 'lessons', 'users']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { q, type = 'all', limit = 20 } = req.query;
    const userId = req.user ? req.user._id : null;
    const searchLimit = parseInt(limit);
    const languageId = req.languageId;

    let results = {
      vocabulary: [],
      lessons: [],
      users: [],
      total: 0,
    };

    // Search vocabulary
    if (type === 'all' || type === 'vocabulary') {
      const vocabQuery = {
        isPublished: true,
        isActive: true,
        language_id: languageId,
        $or: [
          { izonWord: { $regex: q, $options: 'i' } },
          { englishTranslation: { $regex: q, $options: 'i' } },
          { category: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } },
        ],
      };
      
      const vocabulary = await Vocabulary.find(vocabQuery)
        .select('izonWord englishTranslation category difficulty pronunciation examples')
        .limit(searchLimit);
      
      // Calculate relevance scores and sort
      results.vocabulary = vocabulary
        .map(item => ({
          ...item.toObject(),
          type: 'vocabulary',
          relevanceScore: calculateRelevanceScore(item, q, 'vocabulary'),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, searchLimit);
    }

    // Search lessons
    if (type === 'all' || type === 'lessons') {
      const lessonQuery = {
        status: 'published',
        language_id: languageId,
        $or: [
          { 'title.english': { $regex: q, $options: 'i' } },
          { 'title.izon': { $regex: q, $options: 'i' } },
          { 'description.english': { $regex: q, $options: 'i' } },
          { 'description.izon': { $regex: q, $options: 'i' } },
          { category: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } },
        ],
      };
      
      const lessons = await Lesson.find(lessonQuery)
        .select('title.english title.izon description.english level category order estimatedTime')
        .limit(searchLimit);
      
      results.lessons = lessons
        .map(item => ({
          ...item.toObject(),
          type: 'lesson',
          relevanceScore: calculateRelevanceScore(item, q, 'lessons'),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, searchLimit);
    }

    // Search users (only if authenticated)
    if (userId && (type === 'all' || type === 'users')) {
      const userQuery = {
        status: 'active',
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { 'profile.displayName': { $regex: q, $options: 'i' } },
          { 'profile.firstName': { $regex: q, $options: 'i' } },
          { 'profile.lastName': { $regex: q, $options: 'i' } },
        ],
      };
      
      const users = await User.find(userQuery)
        .select('username profile.displayName profile.avatar progress.level progress.totalPoints')
        .limit(searchLimit);
      
      results.users = users.map(item => ({
        ...item.toObject(),
        type: 'user',
      }));
    }

    // Calculate total
    results.total = results.vocabulary.length + results.lessons.length + results.users.length;

    // Track search for analytics
    await trackSearch(userId, q, results.total, type, languageId);

    // Cache results
    const cacheKey = `search:${q}:${type}:${limit}:${languageId}`;
await redis.set(cacheKey, JSON.stringify(results), {
  EX: 300
});

    res.json({
      success: true,
      data: results,
      query: q,
      type,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// SEARCH BY TYPE
// ============================================================================

/**
 * Search by specific type (same as global but with type param)
 * GET /api/search?q=query&type=vocabulary
 * This is handled by the same endpoint above
 */

// ============================================================================
// SEARCH SUGGESTIONS
// ============================================================================

/**
 * Get search suggestions as user types
 * GET /api/search/suggestions?q=query
 */
router.get('/suggestions', [
  query('q').notEmpty().withMessage('Search query is required'),
], cacheMiddleware(60), async (req, res, next) => {
  try {
    const { q } = req.query;
    const userId = req.user ? req.user._id : null; 
    const languageId = req.languageId;
    const suggestions = new Set();

    // Get from search history
    if (userId) {
      const history = await SearchHistory.find({
        user: userId,
        language_id: languageId,
        query: { $regex: `^${q}`, $options: 'i' },
      })
        .sort({ count: -1 })
        .limit(5);

      history.forEach(h => suggestions.add(h.query));
    }

    // Get from vocabulary (word matches)
    const vocabMatches = await Vocabulary.find({
      isPublished: true,
      language_id: languageId,
      $or: [
        { izonWord: { $regex: `^${q}`, $options: 'i' } },
        { englishTranslation: { $regex: `^${q}`, $options: 'i' } },
      ],
    })
      .limit(10)
      .select('izonWord englishTranslation');
    
    vocabMatches.forEach(v => {
      suggestions.add(v.izonWord);
      suggestions.add(v.englishTranslation);
    });

    // Get from lesson titles
    const lessonMatches = await Lesson.find({
      status: 'published',
      $or: [
        { 'title.english': { $regex: `^${q}`, $options: 'i' } },
        { 'title.izon': { $regex: `^${q}`, $options: 'i' } },
      ],
    })
      .limit(3)
      .select('title.english title.izon');
    
    lessonMatches.forEach(l => {
      suggestions.add(l.title.english);
      if (l.title.izon) suggestions.add(l.title.izon);
    });

    // Get trending searches that match
    const trending = await getTrendingSearches(10);
    trending
      .filter(t => t.query.toLowerCase().startsWith(q.toLowerCase()))
      .forEach(t => suggestions.add(t.query));

    const suggestionsArray = Array.from(suggestions).slice(0, 10);

    res.json({
      success: true,
      data: suggestionsArray,
      query: q,
      count: suggestionsArray.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// RECENT SEARCHES
// ============================================================================

/**
 * Get user's recent searches
 * GET /api/search/recent
 */
router.get('/recent', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const languageId = req.languageId;
    const { limit = 10 } = req.query;

    const recent = await SearchHistory.find({ user: userId, language_id: languageId })
      .sort({ lastSearched: -1 })
      .limit(parseInt(limit))
      .select('query count lastSearched');

    res.json({
      success: true,
      data: recent,
      count: recent.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TRENDING SEARCHES
// ============================================================================

/**
 * Get trending searches globally
 * GET /api/search/trending
 */
router.get('/trending', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const languageId = req.languageId;

    const trending = await getTrendingSearches(parseInt(limit), languageId);

    // Add category counts for trending searches
    const trendingWithCategories = await Promise.all(
      trending.map(async (item) => {
        const vocabCount = await Vocabulary.countDocuments({
          izonWord: { $regex: `^${item.query}$`, $options: 'i' },
          language_id: languageId
        });

        return {
          ...item,
          hasExactMatch: vocabCount > 0,
        };
      })
    );

    res.json({
      success: true,
      data: trendingWithCategories,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CLEAR SEARCH HISTORY
// ============================================================================

/**
 * Clear user's search history
 * DELETE /api/search/history
 */
router.delete('/history', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const result = await SearchHistory.deleteMany({ user: userId });
    
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} search history items`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE SINGLE SEARCH HISTORY ITEM
// ============================================================================

/**
 * Delete a specific search history item
 * DELETE /api/search/history/:query
 */
router.delete('/history/:query', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { query } = req.params;
    
    const result = await SearchHistory.deleteOne({
      user: userId,
      query: decodeURIComponent(query),
    });
    
    res.json({
      success: true,
      message: result.deletedCount > 0 ? 'Search history item removed' : 'Item not found',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
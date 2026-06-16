const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { contentLimiter } = require('../middleware/rateLimit');
const { body, param, query, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const CulturalContent = require('../models/CulturalContent');
const Category = require('../models/Category');
const Proverb = require('../models/Proverb');
const Language = require('../models/Language');
const User = require('../models/User');
const { cacheMiddleware } = require('../middleware/cache');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const redis = require('../config/redis');
const notificationService = require('../services/notificationService');

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(contentLimiter);

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validateProverb = [
  body('izon').trim().notEmpty().withMessage('Izon proverb is required'),
  body('english').trim().notEmpty().withMessage('English translation is required'),
  body('meaning').trim().notEmpty().withMessage('Meaning is required'),
  body('category').optional().isIn([
    'wisdom', 'life', 'family', 'community', 'nature', 'hard_work',
    'patience', 'respect', 'tradition', 'love', 'friendship', 'success', 'caution', 'humor'
  ]),
];

const validateFeedback = [
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ max: 500 }),
];


// Add this near the top of your cultureRoutes.js
router.get('/', async (req, res) => {
  res.json({
    success: true,
    message: "Izon Cultural Hub 🏺",
    endpoints: ["/categories", "/proverbs", "/proverbs/daily"]
  });
});


// ============================================================================
// CULTURAL CATEGORIES
// ============================================================================

/**
 * Get all cultural categories
 * GET /api/culture/categories
 */
router.get('/categories', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { lang } = req.query;
    const query = { type: 'cultural', isActive: true };

    if (lang) {
      const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
      if (languageDoc) {
        query.language_id = languageDoc._id;
      }
    }

    const categories = await Category.find(query)
      .select('name displayName description icon color order')
      .sort({ order: 1 });

    // Get content counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const [contentCount, proverbCount] = await Promise.all([
          CulturalContent.countDocuments({ category: cat.name, isPublished: true }),
          Proverb.countDocuments({ category: cat.name, isPublished: true, isActive: true }),
        ]);
        return {
          ...cat.toObject(),
          contentCount,
          proverbCount,
        };
      })
    );

    // If no categories in DB, return default ones
    if (categoriesWithCounts.length === 0) {
      const defaultCategories = [
        { id: 'traditions', name: 'Traditions', icon: '🪔', color: '#FF6B6B', order: 1, contentCount: 0 },
        { id: 'festivals', name: 'Festivals', icon: '🎉', color: '#4ECDC4', order: 2, contentCount: 0 },
        { id: 'food', name: 'Cuisine', icon: '🍲', color: '#FFE66D', order: 3, contentCount: 0 },
        { id: 'music', name: 'Music & Dance', icon: '🎵', color: '#A8E6CF', order: 4, contentCount: 0 },
        { id: 'proverbs', name: 'Proverbs', icon: '📜', color: '#FF8B94', order: 5, contentCount: 0 },
        { id: 'history', name: 'History', icon: '🏛️', color: '#B5EAD7', order: 6, contentCount: 0 },
        { id: 'attire', name: 'Traditional Attire', icon: '👘', color: '#C7CEEA', order: 7, contentCount: 0 },
        { id: 'language_tips', name: 'Language Tips', icon: '💬', color: '#FFDAC1', order: 8, contentCount: 0 },
      ];
      return res.json({ success: true, data: defaultCategories });
    }

    res.json({ success: true, data: categoriesWithCounts });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PROVERBS - PUBLIC ENDPOINTS
// ============================================================================

/**
 * Get all proverbs with filtering and pagination
 * GET /api/culture/proverbs
 */
router.get('/proverbs', cacheMiddleware(300), async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      difficulty,
      search,
      lang,
      featured = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { isPublished: true, isActive: true };

    if (lang) {
      const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
      if (languageDoc) {
        query.language_id = languageDoc._id;
      }
    }

    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (featured === 'true') query.featured = true;

    // --- REPLACED $text SEARCH WITH $regex FOR FERRETDB ---
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { izon: searchRegex },
        { english: searchRegex },
        { meaning: searchRegex }
      ];
    }

    // --- UPDATED SORT LOGIC (Removed textScore) ---
    const sort = {};
    if (sortBy === 'popularity') {
      sort['popularity.views'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sort.averageRating = sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default to date or provided sortBy field
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const [proverbs, total] = await Promise.all([
      Proverb.find(query)
        .select('izon english meaning category difficulty popularity.views averageRating featured createdAt')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Use lean for better performance on mobile hardware
      Proverb.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: proverbs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      filters: { category, difficulty, featured },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get proverb of the day
 * GET /api/culture/proverbs/daily
 */
router.get('/proverbs/daily', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `proverb:daily:${today}`;

    // 1. Try Cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    // 2. Get Proverb from DB
    let proverb = await Proverb.getProverbOfDay();

    // 3. Fallback: Get any published proverb
    if (!proverb) {
      proverb = await Proverb.findOne({ isPublished: true, isActive: true });
    }

    // 4. Critical Fallback: Avoid 404/Crash
    if (!proverb) {
      return res.json({ 
        success: true, 
        data: null, 
        message: "Proverb is being prepared. Check back soon!" 
      });
    }

    // Increment view count
    await proverb.incrementViews();

    const response = {
      _id: proverb._id,
      izon: proverb.izon,
      english: proverb.english,
      meaning: proverb.meaning,
      category: proverb.category,
      culturalContext: proverb.culturalContext,
      pronunciation: proverb.pronunciation,
      date: today,
      shareText: `Today's Izon proverb: ${proverb.izon} - ${proverb.english}`,
    };

    // 5. Save to Redis
    await redis.set(cacheKey, response, { 
      EX: 86400 // 24 hours
    });
    res.json({ success: true, data: response });
  } catch (err) {
    next(err);
  }
});

/**
 * Get single proverb by ID or slug
 * GET /api/culture/proverbs/:id
 */
router.get('/proverbs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let proverb;

    if (mongoose.Types.ObjectId.isValid(id)) {
      proverb = await Proverb.findById(id)
        .populate('createdBy', 'username profile.avatar')
        .populate('verifiedBy', 'username')
        .populate('relatedProverbs.proverbId', 'izon english meaning');
    } else {
      proverb = await Proverb.findOne({ slug: id });
    }

    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    // Increment view count
    await proverb.incrementViews();

    // Get related proverbs using your model's method
    const related = await proverb.getRelatedProverbs();

    res.json({
      success: true,
      data: {
        ...proverb.toObject(),
        related,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get featured proverbs
 * GET /api/culture/proverbs/featured
 */
router.get('/proverbs/featured', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const proverbs = await Proverb.getFeatured(parseInt(limit));

    res.json({
      success: true,
      data: proverbs,
      count: proverbs.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get proverbs by category
 * GET /api/culture/proverbs/category/:category
 */
router.get('/proverbs/category/:category', cacheMiddleware(600), async (req, res, next) => {
  try {
    const { category } = req.params;
    const { limit = 20 } = req.query;

    const proverbs = await Proverb.getByCategory(category, parseInt(limit));

    const total = await Proverb.countDocuments({ 
      category, 
      isPublished: true, 
      isActive: true 
    });

    res.json({
      success: true,
      data: proverbs,
      category,
      total,
      count: proverbs.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Search proverbs
 * GET /api/culture/proverbs/search
 */
router.get('/proverbs/search', async (req, res, next) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const proverbs = await Proverb.search(q, parseInt(limit));

    res.json({
      success: true,
      data: proverbs,
      query: q,
      count: proverbs.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PROVERB INTERACTIONS
// ============================================================================

/**
 * Add feedback/rating to a proverb
 * POST /api/culture/proverbs/:id/feedback
 */
router.post('/proverbs/:id/feedback', auth, validateFeedback, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    await proverb.addFeedback(req.user._id, { rating, comment });

    res.json({
      success: true,
      data: {
        averageRating: proverb.averageRating,
        feedbackCount: proverb.feedback.length,
      },
      message: 'Feedback added successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Add comment to a proverb
 * POST /api/culture/proverbs/:id/comments
 */
router.post('/proverbs/:id/comments', auth, [
  body('text').trim().notEmpty().withMessage('Comment text is required').isLength({ max: 500 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { text } = req.body;

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    await proverb.addComment(req.user._id, text);

    res.status(201).json({
      success: true,
      data: proverb.comments[proverb.comments.length - 1],
      message: 'Comment added successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Like a proverb
 * POST /api/culture/proverbs/:id/like
 */
router.post('/proverbs/:id/like', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    proverb.popularity.likes = (proverb.popularity.likes || 0) + 1;
    await proverb.save();

    res.json({
      success: true,
      data: { likes: proverb.popularity.likes },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Share a proverb (increment share count)
 * POST /api/culture/proverbs/:id/share
 */
router.post('/proverbs/:id/share', async (req, res, next) => {
  try {
    const { id } = req.params;

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    proverb.popularity.shares = (proverb.popularity.shares || 0) + 1;
    await proverb.save();

    res.json({
      success: true,
      data: { shares: proverb.popularity.shares },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CULTURAL CONTENT ENDPOINTS
// ============================================================================

/**
 * Get cultural content by category
 * GET /api/culture/category/:categoryId
 */
router.get('/category/:categoryId', cacheMiddleware(600), async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { limit = 50 } = req.query;

    // Find category by name or ID
    let category;
    if (mongoose.Types.ObjectId.isValid(categoryId)) {
      category = await Category.findById(categoryId);
    } else {
      category = await Category.findOne({ name: categoryId });
    }

    const categoryName = category?.name || categoryId;

    // Get cultural content
    const content = await CulturalContent.find({
      category: categoryName,
      isPublished: true,
    })
      .select('title description image details duration significance ingredients preparation instruments')
      .sort({ order: 1, createdAt: -1 })
      .limit(parseInt(limit));

    // Get proverbs if category is proverbs
    let proverbs = [];
    if (categoryName === 'proverbs') {
      proverbs = await Proverb.find({ isPublished: true, isActive: true })
        .select('izon english meaning category difficulty popularity.views')
        .sort({ 'popularity.views': -1, createdAt: -1 })
        .limit(parseInt(limit));
    }

    res.json({
      success: true,
      data: {
        category: categoryName,
        content,
        proverbs,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get single cultural content item
 * GET /api/culture/content/:contentId
 */
router.get('/content/:contentId', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { contentId } = req.params;

    let content;
    if (mongoose.Types.ObjectId.isValid(contentId)) {
      content = await CulturalContent.findById(contentId);
    } else {
      content = await CulturalContent.findOne({ slug: contentId });
    }

    if (!content) {
      throw new AppError('Content not found', 404);
    }

    // Increment view count
    await CulturalContent.updateOne({ _id: content._id }, { $inc: { views: 1 } });

    res.json({ success: true, data: content });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PROVERB STATISTICS
// ============================================================================

/**
 * Get proverb statistics
 * GET /api/culture/proverbs/stats
 */
router.get('/proverbs/stats', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const stats = await Proverb.getStats();

    // Get additional stats
    const mostViewed = await Proverb.findOne({ isPublished: true, isActive: true })
      .sort({ 'popularity.views': -1 })
      .select('izon english popularity.views');

    const highestRated = await Proverb.findOne({ isPublished: true, isActive: true })
      .sort({ averageRating: -1 })
      .select('izon english averageRating');

    res.json({
      success: true,
      data: {
        ...stats,
        mostViewed,
        highestRated,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * Create a new proverb (admin only)
 * POST /api/culture/admin/proverbs
 */
router.post('/admin/proverbs', auth, validateProverb, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.user._id);
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const proverb = new Proverb({
      ...req.body,
      createdBy: req.user._id,
      isPublished: req.body.isPublished || false,
      isActive: true,
    });

    await proverb.save();

    logger.info(`Proverb created by admin ${req.user._id}: ${proverb.izon}`);

    res.status(201).json({
      success: true,
      data: proverb,
      message: 'Proverb created successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Update a proverb (admin only)
 * PUT /api/culture/admin/proverbs/:id
 */
router.put('/admin/proverbs/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    // Track changes
    const changes = [];
    Object.keys(req.body).forEach(key => {
      if (JSON.stringify(proverb[key]) !== JSON.stringify(req.body[key])) {
        changes.push({
          field: key,
          oldValue: proverb[key],
          newValue: req.body[key],
        });
      }
    });

    // Apply updates
    Object.assign(proverb, req.body);
    proverb.updatedBy = req.user._id;
    proverb.version += 1;

    // Add to change log
    proverb.changeLog.push({
      version: proverb.version,
      changedBy: req.user._id,
      changedAt: new Date(),
      changes,
      reason: req.body.reason || 'Admin update',
    });

    await proverb.save();

    // Clear cache
    await clearProverbCache();

    logger.info(`Proverb updated by admin ${req.user._id}: ${proverb.izon}`);

    res.json({
      success: true,
      data: proverb,
      changes: changes.length,
      message: 'Proverb updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a proverb (admin only)
 * DELETE /api/culture/admin/proverbs/:id
 */
router.delete('/admin/proverbs/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    // Soft delete
    proverb.isActive = false;
    await proverb.save();

    // Clear cache
    await clearProverbCache();

    logger.info(`Proverb deactivated by admin ${req.user._id}: ${proverb.izon}`);

    res.json({
      success: true,
      message: 'Proverb deactivated successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Verify a proverb (admin only)
 * POST /api/culture/admin/proverbs/:id/verify
 */
router.post('/admin/proverbs/:id/verify', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const user = await User.findById(req.user._id);
    
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const proverb = await Proverb.findById(id);
    if (!proverb) {
      throw new AppError('Proverb not found', 404);
    }

    proverb.verified = true;
    proverb.verificationStatus = 'verified';
    proverb.verifiedBy = req.user._id;
    proverb.verifiedAt = new Date();

    // Add to verification history
    proverb.verificationHistory.push({
      status: 'verified',
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
      notes: notes || 'Admin verification',
    });

    await proverb.save();

    // Clear cache
    await clearProverbCache();

    res.json({
      success: true,
      data: proverb,
      message: 'Proverb verified successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Create cultural content (admin only)
 * POST /api/culture/admin/content
 */
router.post('/admin/content', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const content = new CulturalContent({
      ...req.body,
      createdBy: req.user._id,
      isPublished: false,
    });

    await content.save();

    logger.info(`Cultural content created: ${content.title} by admin ${req.user._id}`);

    res.status(201).json({
      success: true,
      data: content,
      message: 'Cultural content created successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Update cultural content (admin only)
 * PUT /api/culture/admin/content/:id
 */
router.put('/admin/content/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const content = await CulturalContent.findByIdAndUpdate(
      id,
      { ...req.body, updatedBy: req.user._id, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!content) {
      throw new AppError('Content not found', 404);
    }

    // Clear cache
    await clearCultureCache();

    res.json({
      success: true,
      data: content,
      message: 'Content updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function clearCultureCache() {
  try {
    const keys = await redis.keys('culture:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    logger.error('Failed to clear culture cache:', error);
  }
}

async function clearProverbCache() {
  try {
    const keys = await redis.keys('proverb:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    logger.error('Failed to clear proverb cache:', error);
  }
}

/**
 * Triggers the daily proverb notification for all users.
 * Can be called by a CRON job or a system trigger.
 */
async function triggerDailyProverbNotification() {
  try {
    logger.info('Starting automated daily proverb broadcast...');

    // 1. Get the proverb (Logic matches your GET route)
    let proverb = await Proverb.getProverbOfDay();
    if (!proverb) {
      proverb = await Proverb.findOne({ isPublished: true, isActive: true });
    }

    if (!proverb) {
      logger.warn('No proverbs found to broadcast.');
      return;
    }

    // 2. Find all users who want daily tips
    const users = await User.find({
      isActive: true,
      'notifications.pushTokens': { $exists: true, $not: { $size: 0 } }
    }).select('_id notifications');

    if (users.length === 0) return;

    // 3. Use the notificationService to broadcast
    await notificationService.sendToMany(
      users.map(u => u._id),
      {
        type: 'tip_of_day',
        title: "📜 Daily Izon Wisdom",
        body: proverb.izon,
        data: { 
          proverbId: proverb._id.toString(),
          izon: proverb.izon,
          english: proverb.english 
        },
        priority: 2, // Medium
        actionUrl: `/culture/proverbs/${proverb._id}`,
        category: 'culture'
      },
      { channels: ['in_app', 'push'] }
    );

    logger.info(`Broadcasted daily proverb to ${users.length} users.`);
  } catch (error) {
    logger.error('Failed to trigger automated proverb notification:', error);
  }
}

module.exports = router;
module.exports.triggerDailyProverbNotification = triggerDailyProverbNotification;

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { contentLimiter } = require('../middleware/rateLimit');
const { body, param, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const Language = require('../models/Language');
const User = require('../models/User');
const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const { cacheMiddleware } = require('../middleware/cache');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const redis = require('../config/redis');

const hasLanguage = (languages = [], languageId) =>
  languages.some(id => id.toString() === languageId.toString());

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(contentLimiter);

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * Get all available languages
 * GET /api/languages
 */
router.get('/', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const languages = await Language.find({ isActive: true, isPublished: true })
      .sort({ order: 1, name: 1 })
      .select('code name nativeName description region icon color difficulty totalWords totalLessons features');

    res.json({
      success: true,
      data: languages,
      count: languages.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get current user's active language
 * GET /api/languages/user/active
 */
router.get('/user/active', auth, async (req, res, next) => {
  try {
    // Add 'username' to the select or remove .select() entirely 
    // so the pre-save middleware has the data it needs.
    const user = await User.findById(req.userId).select('activeLanguage learningLanguages username referral');

    if (!user.activeLanguage) {
      const defaultLanguage = await Language.findOne({ code: 'IZON', isActive: true });
      if (defaultLanguage) {
        user.activeLanguage = defaultLanguage._id;
        user.learningLanguages = user.learningLanguages || [];
        if (!hasLanguage(user.learningLanguages, defaultLanguage._id)) {
           user.learningLanguages.push(defaultLanguage._id);
        }
        await user.save(); // This was triggering the referral code crash
      }
    }

    let activeLanguage = null;
    if (user.activeLanguage) {
      activeLanguage = await Language.findById(user.activeLanguage);
    }

    const learningLanguages = await Language.find({
      _id: { $in: user.learningLanguages || [] },
    });

    res.json({
      success: true,
      data: {
        activeLanguage,
        learningLanguages,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// USER LANGUAGE PREFERENCES
// ============================================================================

/**
 * Get language by code
 * GET /api/languages/:code
 */
router.get('/:code', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const language = await Language.findOne({ 
      code: code.toUpperCase(), 
      isActive: true, 
      isPublished: true 
    });

    if (!language) {
      throw new AppError('Language not found', 404);
    }

    res.json({
      success: true,
      data: language,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Set active language for learning
 * POST /api/languages/user/active
 */
router.post('/user/active', auth, [
  body('languageCode').notEmpty().withMessage('Language code is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { languageCode } = req.body;
    
    const language = await Language.findOne({ 
      code: languageCode.toUpperCase(), 
      isActive: true 
    });

    if (!language) {
      throw new AppError('Language not found', 404);
    }

    const user = await User.findById(req.userId);
    user.activeLanguage = language._id;
    
    if (!user.learningLanguages) {
      user.learningLanguages = [];
    }
    if (!hasLanguage(user.learningLanguages, language._id)) {
      user.learningLanguages.push(language._id);
    }
    
    await user.save();

    // Clear relevant caches
    await clearUserLanguageCache(req.userId);

    res.json({
      success: true,
      data: {
        activeLanguage: language,
        learningLanguages: user.learningLanguages,
      },
      message: `Switched to ${language.name}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Add language to learning list
 * POST /api/languages/user/add
 */
router.post('/user/add', auth, [
  body('languageCode').notEmpty().withMessage('Language code is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { languageCode } = req.body;
    
    const language = await Language.findOne({ 
      code: languageCode.toUpperCase(), 
      isActive: true 
    });

    if (!language) {
      throw new AppError('Language not found', 404);
    }

    const user = await User.findById(req.userId);
    
    if (!user.learningLanguages) {
      user.learningLanguages = [];
    }
    
    if (hasLanguage(user.learningLanguages, language._id)) {
      return res.json({
        success: true,
        message: 'Language already in your learning list',
      });
    }
    
    user.learningLanguages.push(language._id);
    await user.save();

    res.json({
      success: true,
      data: {
        addedLanguage: language,
        learningLanguages: user.learningLanguages,
      },
      message: `${language.name} added to your learning list`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Remove language from learning list
 * DELETE /api/languages/user/remove/:languageCode
 */
router.delete('/user/remove/:languageCode', auth, async (req, res, next) => {
  try {
    const { languageCode } = req.params;
    
    const language = await Language.findOne({ code: languageCode.toUpperCase() });
    if (!language) {
      throw new AppError('Language not found', 404);
    }

    const user = await User.findById(req.userId);
    
    if (!user.learningLanguages) {
      user.learningLanguages = [];
    }
    
    user.learningLanguages = user.learningLanguages.filter(
      id => id.toString() !== language._id.toString()
    );
    
    // If removing active language, switch to first available
    if (user.activeLanguage?.toString() === language._id.toString()) {
      if (user.learningLanguages.length > 0) {
        user.activeLanguage = user.learningLanguages[0];
      } else {
        const defaultLanguage = await Language.findOne({ code: 'IZON' });
        user.activeLanguage = defaultLanguage?._id;
      }
    }
    
    await user.save();
    await clearUserLanguageCache(req.userId);

    res.json({
      success: true,
      message: `${language.name} removed from your learning list`,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function clearUserLanguageCache(userId) {
  try {
    await redis.del(`user:languages:${userId}`);
  } catch (error) {
    logger.error('Failed to clear user language cache:', error);
  }
}

module.exports = router;

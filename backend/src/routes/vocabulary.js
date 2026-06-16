const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, param, query } = require('express-validator');
const cache = require('memory-cache');

const Vocabulary = require('../models/Vocabulary');
const Language = require('../models/Language');
const User = require('../models/User');
const WordRelation = require('../models/WordRelation');
const Category = require('../models/Category');
const vocabularyController = require('../controllers/vocabularyController');
const srsController = require('../controllers/srsController');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { logger } = require('../config/logger');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const redis = require('../config/redis');
const { contentLimiter } = require('../middleware/rateLimit');

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(contentLimiter);

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

const validateWordId = [
  param('id').custom(value => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid word ID format');
    }
    return true;
  }),
];

// Inside Route/Vocabulary
const validateWordCreation = [
  body('izonWord').notEmpty().withMessage('Izon word is required').trim(),
  body('englishTranslation').notEmpty().withMessage('English translation is required').trim(),
  body('language_id').optional().isMongoId().withMessage('Invalid Language ID format'),
  body('languageCode').optional().isString().withMessage('Language code must be a string'),
  body('lessonId').optional().isMongoId().withMessage('Invalid Lesson ID format'),
  body('category').optional().isString(),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  body('pronunciation.ipa').optional().isString(),
  body('partOfSpeech').optional().isString(),
];

// ============================================================================
// GET ALL VOCABULARY
// ============================================================================

/**
 * Get all vocabulary with advanced filtering and pagination
 * GET /api/vocabulary
 */
router.get('/', validatePagination, cacheMiddleware(300), async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      difficulty,
      lang,
      partOfSpeech,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeExamples = 'false',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { isPublished: true, isActive: true };
    
    // Filter by Language if lang provided
    if (lang) {
      const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
      if (languageDoc) {
        query.language_id = languageDoc._id;
      }
    }
    
    // Apply filters
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (partOfSpeech) query.partOfSpeech = partOfSpeech;

    if (partOfSpeech) query['grammar.partOfSpeech'] = partOfSpeech;
    
    // Search functionality
    if (search && search.trim()) {
      query.$or = [
        { izonWord: { $regex: search, $options: 'i' } },
        { englishTranslation: { $regex: search, $options: 'i' } },
        { 'alternativeTranslations.translation': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const selectFields = includeExamples === 'true' 
      ? '-__v -contributions -flags -verificationHistory' 
      : 'izonWord englishTranslation language_id pronunciation category difficulty examples tags';

    const [vocabulary, total] = await Promise.all([
      Vocabulary.find(query)
        .select(selectFields)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('language_id', 'name code icon color')
        .lean(),
      Vocabulary.countDocuments(query),
    ]);



    // Get available filters for UI
    const availableFilters = await getAvailableFilters();

    // Get popular tags
    const popularTags = await getPopularTags();

    res.json({
      success: true,
      data: vocabulary,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: skip + vocabulary.length < total,
        hasPrev: page > 1,
      },
      filters: {
        applied: { category, difficulty, language_id: query.language_id, partOfSpeech, search },
        available: availableFilters,
      },
      metadata: {
        popularTags,
        totalWords: total,
      },
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// SEARCH VOCABULARY
// ============================================================================

/**
 * Advanced search with multiple strategies
 * GET /api/vocabulary/search
 */
router.get('/search', async (req, res, next) => {
  try {
    const { 
      q, 
      limit = 20,
      page = 1,
      includeExamples = 'false',
    } = req.query;

    if (!q?.trim()) {
      return res.json({
        success: true,
        data: { exact: [], startsWith: [], contains: [], other: [] },
        message: 'Empty search query',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = q.trim().toLowerCase();
    const searchRegex = new RegExp(escapeRegExp(searchTerm), 'i');

    // Build base query
    const baseQuery = {
      isPublished: true,
      isActive: true,
    };

    // Main search query using regex (FerretDB friendly + reliable)
    const searchQuery = {
    ...baseQuery,
    $or: [
      { izonWord: new RegExp(`^${searchTerm}`, 'i') }, // Priority: Starts with
      { izonWord: searchRegex },                        // Contains
      { englishTranslation: searchRegex }
    ],
  };

    // Fetch results with lean for performance
    const [results, total] = await Promise.all([
      Vocabulary.find(searchQuery)
        .select(includeExamples === 'true' 
          ? '' 
          : 'izonWord englishTranslation pronunciation category difficulty dialect tags')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Vocabulary.countDocuments(searchQuery),
    ]);

    // Group results by relevance (better UX than raw list)
    const grouped = {
      exact: [],
      startsWith: [],
      contains: [],
      other: [],
    };

    results.forEach(word => {
      const izonLower = (word.izonWord || '').toLowerCase();
      const englishLower = (word.englishTranslation || '').toLowerCase();

      if (izonLower === searchTerm || englishLower === searchTerm) {
        grouped.exact.push(word);
      } 
      else if (izonLower.startsWith(searchTerm) || englishLower.startsWith(searchTerm)) {
        grouped.startsWith.push(word);
      } 
      else if (izonLower.includes(searchTerm) || englishLower.includes(searchTerm)) {
        grouped.contains.push(word);
      } 
      else {
        grouped.other.push(word);
      }
    });

    // Optional: Sort groups by priority
    const orderedResults = [
      ...grouped.exact,
      ...grouped.startsWith,
      ...grouped.contains,
      ...grouped.other,
    ];

    // Get search suggestions (simple prefix-based)
    const suggestions = await getSearchSuggestions(searchTerm);

    res.json({
      success: true,
      data: {
        exact: grouped.exact,
        startsWith: grouped.startsWith,
        contains: grouped.contains,
        other: grouped.other,
        all: orderedResults,           // fallback flat list
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      metadata: {
        query: searchTerm,
        method: 'regex',               // clear for debugging
        totalResults: total,
        suggestions,
        corrected: await getSpellingCorrection(searchTerm),
      },
    });

  } catch (err) {
    logger.error('Vocabulary search error:', err);
    next(err);
  }
});

// ============================================================================
// GET DAILY MIX (PERSONALIZED)
// ============================================================================

/**
 * Get highly personalized daily vocabulary mix
 * GET /api/vocabulary/daily-mix/personalized
 */
router.get('/daily-mix/personalized', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).populate('vocabularyMastery.wordId');

    const now = new Date();
    const mastery = user.vocabularyMastery || [];

    // 1. CATEGORIZE EXISTING WORDS
    // Due now or overdue
    const dueWords = mastery
      .filter(m => m.wordId && new Date(m.nextReview) <= now)
      .sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview)); // Oldest first

    // Words in 'Learning' stage (Stage 1) but not yet due
    const learningWords = mastery
      .filter(m => m.wordId && m.stage === 1 && new Date(m.nextReview) > now);

    // 2. SELECTION STRATEGY (Total 20 words per session)
    const SESSION_LIMIT = 20;
    const selectedReviews = dueWords.slice(0, 15); // Priority 1: Due reviews
    
    let finalSelection = [...selectedReviews];

    // Priority 2: If we have space, add words currently in the "Learning" phase
    if (finalSelection.length < SESSION_LIMIT) {
      const remainingSpace = SESSION_LIMIT - finalSelection.length;
      finalSelection = [...finalSelection, ...learningWords.slice(0, remainingSpace)];
    }

    // Priority 3: Fill remaining space with New words the user hasn't seen
    if (finalSelection.length < SESSION_LIMIT) {
      const remainingSpace = SESSION_LIMIT - finalSelection.length;
      const seenIds = mastery.map(m => m.wordId._id);
      
      const newWords = await Vocabulary.find({
        _id: { $nin: seenIds },
        isPublished: true,
        isActive: true
      })
      .limit(remainingSpace)
      .lean();

      finalSelection = [...finalSelection, ...newWords.map(w => ({ wordId: w, isNew: true }))];
    }

    // 3. FORMAT RESPONSE
    const data = finalSelection.map(item => {
      // Handle both mastery objects and raw vocabulary objects
      const isNew = item.isNew || false;
      const wordData = isNew ? item.wordId : item.wordId.toObject();
      const srs = isNew ? null : item;

      return {
        ...wordData,
        isNew,
        dueStatus: isNew ? 'new' : (new Date(srs.nextReview) <= now ? 'due' : 'learning'),
        srsInfo: isNew ? null : {
          stage: srs.stage,
          streak: srs.streak,
          nextReview: srs.nextReview
        }
      };
    });

    res.json({
      success: true,
      data: data.sort(() => 0.5 - Math.random()), // Shuffle for the UI
      meta: {
        totalDue: dueWords.length,
        sessionSize: data.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET RANDOM WORDS
// ============================================================================

/**
 * Get random vocabulary words
 * GET /api/vocabulary/random
 */
router.get('/random/selection', async (req, res, next) => {
  try {
    const { count = 10, category, difficulty } = req.query;
    const limit = Math.min(parseInt(count), 50);

    const matchStage = { isPublished: true };
    if (category) matchStage.category = category;
    if (difficulty) matchStage.difficulty = difficulty;

    // FerretDB doesn't support $sample, so we fetch all IDs and pick manually
    const allMatchingWords = await Vocabulary.find(matchStage)
      .select('_id izonWord englishTranslation category difficulty pronunciation')
      .lean();

    if (allMatchingWords.length === 0) {
      return res.json({ success: true, data: [], count: 0 });
    }

    // Shuffle the array in memory
    const shuffled = allMatchingWords.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);

    res.json({
      success: true,
      data: selected,
      count: selected.length,
    });

  } catch (err) {
    next(err);
  }
});


// ============================================================================
// GET WORD SUGGESTIONS
// ============================================================================

/**
 * Get word suggestions for learning
 * GET /api/vocabulary/suggestions
 */
router.get('/suggestions/learning', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const masteredIds = user.vocabularyMastery.map(v => v.wordId.toString());
    const preferredCategories = user.preferences?.preferredCategories || [];

    // 1. Fetch potential candidates
    const query = {
      _id: { $nin: masteredIds },
      isPublished: true
    };
    if (preferredCategories.length > 0) {
      query.category = { $in: preferredCategories };
    }

    const candidates = await Vocabulary.find(query)
      .select('izonWord englishTranslation category difficulty usage difficultyScore pronunciation')
      .limit(100)
      .lean();

    // 2. Calculate priority score in JavaScript
    const suggestions = candidates.map(word => {
      const frequencyScore = word.usage?.frequencyScore || 50;
      const diffScore = word.difficultyScore || 5;
      const categoryBonus = preferredCategories.includes(word.category) ? 20 : 0;

      const priority = (frequencyScore * 0.4) + (diffScore * 0.3) + categoryBonus;
      
      return { ...word, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20);

    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// STATISTICS ENDPOINTS
// ============================================================================

/**
 * Get vocabulary statistics
 * GET /api/vocabulary/stats
 */
router.get('/stats/overview', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const stats = await getVocabularyStats();

    res.json({
      success: true,
      data: stats,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Get word of the day
 * GET /api/vocabulary/word-of-day
 */
router.get('/word-of-day/featured', cacheMiddleware(86400), async (req, res, next) => {
  try {
    const today = new Date().toDateString();
    
    // Use consistent seed for the day
    const seed = parseInt(today.split('/').join('').replace(/\D/g, ''));
    const count = await Vocabulary.countDocuments({ isPublished: true });
    const index = (seed * 9301 + 49297) % count;
    
    const word = await Vocabulary.findOne({ isPublished: true })
      .skip(index)
      .select('izonWord englishTranslation pronunciation examples category culturalContext');

    if (!word) {
      throw new AppError('No vocabulary available', 404);
    }

    // Get related content
    const [relatedWords, proverbs] = await Promise.all([
      getRelatedWords(word._id, 3),
      getRelatedProverbs(word.category, 2),
    ]);

    res.json({
      success: true,
      data: {
        word: word.izonWord,
        translation: word.englishTranslation,
        pronunciation: {
          ipa: word.pronunciation?.ipa,
          audio: word.pronunciation?.audio?.url,
        },
        category: word.category,
        examples: word.examples?.slice(0, 2) || [],
        culturalContext: word.culturalContext?.significance,
        relatedWords,
        proverbs,
        date: today,
        shareText: `Today's Izon word: ${word.izonWord} - ${word.englishTranslation}`,
      },
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Get user's favorite words
 * GET /api/vocabulary/favorites/list
 */
router.get('/favorites/list', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('favorites');

    res.json({
      success: true,
      data: user.favorites || [],
      count: user.favorites?.length || 0,
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET WORDS BY CATEGORY
// ============================================================================

/**
 * Get vocabulary by category
 * GET /api/vocabulary/category/:category
 */
router.get('/category/:category', async (req, res, next) => {
  try {
    const { category } = req.params;
    const { limit = 50, difficulty, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { category, isPublished: true };
    
    if (difficulty) query.difficulty = difficulty;

    const [words, total, categoryInfo] = await Promise.all([
      Vocabulary.find(query)
        .select('izonWord englishTranslation difficulty examples pronunciation')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ izonWord: 1 }),
      Vocabulary.countDocuments(query),
      Category.findOne({ name: category }),
    ]);

    // Get difficulty breakdown
    // Replace the aggregation block with this:
const wordsForStats = await Vocabulary.find({ category, isPublished: true })
  .select('difficulty')
  .lean();

const difficultyCounts = wordsForStats.reduce((acc, curr) => {
  if (curr.difficulty) {
    acc[curr.difficulty] = (acc[curr.difficulty] || 0) + 1;
  }
  return acc;
}, {});

    res.json({
      success: true,
      data: words,
      category: categoryInfo || { 
        name: category,
        description: `Words related to ${category}`,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      statistics: {
        totalWords: total,
        byDifficulty: difficultyCounts
      },
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Alias for stats overview to prevent 404/CastError
 * GET /api/vocabulary/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getVocabularyStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// SRS & MASTERY ROUTES (Personalized Learning)
// ============================================================================

/**
 * @route   POST /api/vocabulary/mastery/update
 * @desc    Update word mastery after a practice session
 * @access  Private
 */
router.post('/mastery/update', auth, srsController.updateMastery);

/**
 * @route   POST /api/vocabulary/mastery/batch-update
 * @desc    Update multiple words mastery at once
 * @access  Private
 */
router.post('/mastery/batch-update', auth, srsController.batchUpdateMastery);

/**
 * @route   GET /api/vocabulary/mastery/stats
 * @desc    Get detailed SRS statistics and review forecast
 * @access  Private
 */
router.get('/mastery/stats', auth, srsController.getMasteryStats);

// ============================================================================
// GET WORD BY ID
// ============================================================================

/**
 * Get vocabulary by ID with enhanced data
 * GET /api/vocabulary/:id
 */
router.get('/:id', validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeRelations = 'true', includeExamples = 'true' } = req.query;

    const word = await Vocabulary.findById(id)
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .populate('synonyms.relatedWord', 'izonWord englishTranslation category')
      .populate('antonyms.relatedWord', 'izonWord englishTranslation')
      .populate('relatedWords.relatedWord', 'izonWord englishTranslation category')
      .populate('examples.addedBy', 'username');

    if (!word || !word.isPublished) {
      throw new AppError('Word not found', 404);
    }

    // Increment view count
    word.usage.popularity.views = (word.usage.popularity.views || 0) + 1;
    word.usage.lastUpdated = new Date();
    await word.save();

    // Get user-specific data if authenticated
    let userData = {};
    if (req.userId) {
      userData = await getUserVocabularyData(req.userId, id);
    }

    // Get related words with context
    let relatedWords = [];
    if (includeRelations === 'true') {
      relatedWords = await getRelatedWordsWithContext(word);
    }

    // Get example sentences with audio
    let examples = [];
    if (includeExamples === 'true' && word.examples) {
      examples = word.examples.map(ex => ({
        ...ex.toObject(),
        audio: ex.audio?.url,
      }));
    }

    // Get similar words for learning
    const similarWords = await getSimilarWords(word);

    res.json({
      success: true,
      data: {
        ...word.toObject(),
        userData,
        relatedWords,
        similarWords,
        examples,
        statistics: {
          views: word.usage?.popularity?.views || 0,
          saves: word.usage?.popularity?.saves || 0,
          searches: word.usage?.popularity?.searches || 0,
        },
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
 * Add new word (admin only)
 * POST /api/vocabulary
 */
router.post('/add', auth, authorize('admin'), validateWordCreation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR',
      });
    }

    const { language_id, languageCode, izonWord } = req.body;
    
    // Resolve language_id if languageCode is provided
    let targetLanguageId = language_id;
    if (languageCode && !targetLanguageId) {
      const language = await Language.findOne({ code: languageCode.toUpperCase() });
      if (language) {
        targetLanguageId = language._id;
      }
    }

    if (!targetLanguageId) {
      throw new ValidationError('language_id or languageCode is required');
    }

    // Check for duplicates in the same language
    const existingWord = await Vocabulary.findOne({
      izonWord: new RegExp(`^${escapeRegExp(izonWord)}$`, 'i'),
      language_id: targetLanguageId
    });

    if (existingWord) {
      throw new ValidationError(`Word "${izonWord}" already exists for this language`);
    }

    const wordData = {
      ...req.body,
      language_id: targetLanguageId,
      createdBy: req.userId,
      createdAt: new Date(),
      lastUpdated: new Date(),
      verified: true,
      verificationHistory: [{
        verifiedBy: req.userId,
        verifiedAt: new Date(),
        status: 'verified',
      }],
      metadata: {
        source: 'admin',
        contributor: req.userId,
        confidence: 1.0,
      },
    };

    const word = new Vocabulary(wordData);
    await word.save();

    // Update category statistics
    if (word.category) {
      await updateCategoryStats(word.category);
    }

    // Clear cache
    await clearVocabularyCache();

    logger.info(`New vocabulary added: ${word.izonWord} by admin ${req.userId}`);

    res.status(201).json({
      success: true,
      data: word,
      message: 'Word added successfully',
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Bulk add words (admin only)
 * POST /api/vocabulary/bulk
 */
router.post('/bulk', auth, authorize('admin'), async (req, res, next) => {
  try {
    const { words, language_id, languageCode } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      throw new ValidationError('Words array is required');
    }

    if (words.length > 500) {
      throw new ValidationError('Maximum 500 words per bulk upload');
    }

    // Resolve global language_id if provided
    let globalLanguageId = language_id;
    if (languageCode && !globalLanguageId) {
      const language = await Language.findOne({ code: languageCode.toUpperCase() });
      if (language) globalLanguageId = language._id;
    }

    const results = {
      added: [],
      skipped: [],
      errors: [],
    };

    for (const wordData of words) {
      try {
        let targetLanguageId = globalLanguageId || wordData.language_id;
        
        if (!targetLanguageId && wordData.languageCode) {
           const lang = await Language.findOne({ code: wordData.languageCode.toUpperCase() });
           if (lang) targetLanguageId = lang._id;
        }

        if (!targetLanguageId) {
           results.errors.push({
             word: wordData.izonWord,
             reason: 'Missing language_id or languageCode',
           });
           continue;
        }

        // Check for duplicates in the same language
        const existing = await Vocabulary.findOne({
          izonWord: new RegExp(`^${escapeRegExp(wordData.izonWord)}$`, 'i'),
          language_id: targetLanguageId
        });

        if (existing) {
          results.skipped.push({
            word: wordData.izonWord,
            reason: 'Already exists in this language',
          });
          continue;
        }

        const word = new Vocabulary({
          ...wordData,
          language_id: targetLanguageId,
          createdBy: req.userId,
          createdAt: new Date(),
          verified: true,
          metadata: {
            source: 'bulk_admin',
            contributor: req.userId,
            confidence: 1.0,
          },
        });

        await word.save();
        results.added.push(wordData.izonWord);

      } catch (error) {
        results.errors.push({
          word: wordData.izonWord,
          error: error.message,
        });
      }
    }

    // Clear cache
    await clearVocabularyCache();

    logger.info(`Bulk vocabulary added: ${results.added.length} words by admin ${req.userId}`);

    res.json({
      success: true,
      data: results,
      summary: {
        total: words.length,
        added: results.added.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Update word (admin only)
 * PUT /api/vocabulary/:id
 */
router.put('/:id', auth, authorize('admin'), validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const word = await Vocabulary.findById(id);

    if (!word) {
      throw new AppError('Word not found', 404);
    }

    // Track changes
    const changes = [];
    Object.keys(updates).forEach(key => {
      if (JSON.stringify(word[key]) !== JSON.stringify(updates[key])) {
        changes.push({
          field: key,
          oldValue: word[key],
          newValue: updates[key],
        });
      }
    });

    // Apply updates
    Object.assign(word, updates);
    word.lastUpdated = new Date();
    word.updatedBy = req.userId;
    word.version = (word.version || 1) + 1;

    // Add to change log
    word.changeLog.push({
      version: word.version,
      changedBy: req.userId,
      changedAt: new Date(),
      changes,
    });

    await word.save();

    // Clear cache
    await clearVocabularyCache(id);

    logger.info(`Vocabulary updated: ${word.izonWord} by admin ${req.userId}`);

    res.json({
      success: true,
      data: word,
      changes: changes.length,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Delete word (admin only)
 * DELETE /api/vocabulary/:id
 */
router.delete('/:id', auth, authorize('admin'), validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;

    const word = await Vocabulary.findById(id);

    if (!word) {
      throw new AppError('Word not found', 404);
    }

    // Soft delete - archive instead of remove
    word.isActive = false;
    word.isPublished = false;
    word.archivedAt = new Date();
    word.archivedBy = req.userId;
    await word.save();

    // Remove from user mastery lists
    await User.updateMany(
      { 'vocabularyMastery.wordId': id },
      { $pull: { vocabularyMastery: { wordId: id } } }
    );

    // Clear cache
    await clearVocabularyCache(id);

    logger.info(`Vocabulary deleted: ${word.izonWord} by admin ${req.userId}`);

    res.json({
      success: true,
      message: 'Word deleted successfully',
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Verify word (admin only)
 * POST /api/vocabulary/:id/verify
 */
router.post('/:id/verify', auth, authorize('admin'), validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = 'verified', notes } = req.body;

    const word = await Vocabulary.findById(id);

    if (!word) {
      throw new AppError('Word not found', 404);
    }

    word.verificationStatus = status;
    word.verificationHistory.push({
      status,
      verifiedBy: req.userId,
      verifiedAt: new Date(),
      notes,
    });

    if (status === 'verified') {
      word.verified = true;
      word.verifiedAt = new Date();
      word.verifiedBy = req.userId;
    }

    await word.save();

    logger.info(`Vocabulary verified: ${word.izonWord} by admin ${req.userId}`);

    res.json({
      success: true,
      data: word,
      message: `Word ${status} successfully`,
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// USER INTERACTION ROUTES
// ============================================================================

/**
 * Save word to favorites
 * POST /api/vocabulary/:id/favorite
 */
router.post('/:id/favorite', auth, validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user.favorites) {
      user.favorites = [];
    }

    if (user.favorites.includes(id)) {
      return res.json({
        success: true,
        message: 'Word already in favorites',
        isFavorite: true,
      });
    }

    user.favorites.push(id);
    await user.save();

    // Update word popularity
    await Vocabulary.findByIdAndUpdate(id, {
      $inc: { 'usage.popularity.saves': 1 },
    });

    res.json({
      success: true,
      message: 'Word added to favorites',
      isFavorite: true,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Remove word from favorites
 * DELETE /api/vocabulary/:id/favorite
 */
router.delete('/:id/favorite', auth, validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);

    user.favorites = user.favorites.filter(f => f.toString() !== id);
    await user.save();

    res.json({
      success: true,
      message: 'Word removed from favorites',
      isFavorite: false,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Report an issue with a word
 * POST /api/vocabulary/:id/report
 */
router.post('/:id/report', auth, validateWordId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, description } = req.body;

    if (!type || !description) {
      throw new ValidationError('Type and description are required');
    }

    const word = await Vocabulary.findById(id);

    if (!word) {
      throw new AppError('Word not found', 404);
    }

    word.flags = word.flags || [];
    word.flags.push({
      type,
      description,
      reportedBy: req.userId,
      reportedAt: new Date(),
      resolved: false,
    });

    await word.save();

    // Notify admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    await notificationService.sendToMany(admins.map(a => a._id), {
      type: 'word_report',
      title: 'New Word Report',
      body: `Issue reported for "${word.izonWord}": ${description}`,
      data: { wordId: id, type, description },
      priority: 3,
    }, { channels: ['in_app', 'email'] });

    res.json({
      success: true,
      message: 'Report submitted successfully. Thank you for helping improve the dictionary!',
    });

  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape regex special characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get available filters
 */
async function getAvailableFilters() {
  const [categories, difficulties, languageIds, partsOfSpeech] = await Promise.all([
    Vocabulary.distinct('category', { isPublished: true }),
    Vocabulary.distinct('difficulty', { isPublished: true }),
    Vocabulary.distinct('language_id', { isPublished: true }),
    Vocabulary.distinct('grammar.partOfSpeech', { isPublished: true }),
  ]);

  const languages = await Language.find({ _id: { $in: languageIds } }).select('name code icon color');

  return {
    categories: categories.filter(Boolean),
    difficulties: difficulties.filter(Boolean),
    languages,
    partsOfSpeech: partsOfSpeech.filter(Boolean),
  };
}

/**
 * Get popular tags
 */
async function getPopularTags() {
  const tags = await Vocabulary.aggregate([
    { $match: { isPublished: true } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  return tags;
}

/**
 * Get word suggestions (FerretDB / SQLite compatible)
 */
async function getSearchSuggestions(term) {
  try {
    const escapedTerm = escapeRegExp(term);
    const regex = new RegExp(`^${escapedTerm}`, 'i');

    // Fetch only the necessary fields
    const matches = await Vocabulary.find({
      $or: [
        { izonWord: regex },
        { englishTranslation: regex },
      ],
      isPublished: true,
    })
    .select('izonWord englishTranslation')
    .limit(20) // Fetch a bit more to ensure we have enough after filtering
    .lean();

    // Use a Set to handle uniqueness in JavaScript
    const suggestionSet = new Set();
    
    matches.forEach(word => {
      if (word.izonWord && word.izonWord.toLowerCase().startsWith(term.toLowerCase())) {
        suggestionSet.add(word.izonWord);
      }
      if (word.englishTranslation && word.englishTranslation.toLowerCase().startsWith(term.toLowerCase())) {
        suggestionSet.add(word.englishTranslation);
      }
    });

    // Convert back to array and limit to top 10
    return Array.from(suggestionSet).slice(0, 10);
  } catch (error) {
    logger.error('Suggestion helper error:', error);
    return [];
  }
}


/**
 * Get spelling correction
 */
async function getSpellingCorrection(term) {
  // Simple Levenshtein-based suggestion
  // In production, use a proper spelling correction service
  return null;
}

/**
 * Get user vocabulary data
 */
async function getUserVocabularyData(userId, wordId) {
  const user = await User.findById(userId);
  
  const mastery = user.vocabularyMastery?.find(
    v => v.wordId?.toString() === wordId.toString()
  );

  return {
    mastered: !!mastery,
    stage: mastery?.stage || 0,
    stageName: getStageName(mastery?.stage),
    lastReviewed: mastery?.lastReviewed,
    nextReview: mastery?.nextReview,
    reviewCount: mastery?.reviewCount || 0,
    inFavorites: user.favorites?.includes(wordId),
  };
}

/**
 * Get stage name
 */
function getStageName(stage) {
  const stages = {
    0: 'New',
    1: 'Learning',
    2: 'Reviewing',
    3: 'Consolidating',
    4: 'Mastering',
    5: 'Fluent',
    6: 'Native',
    7: 'Automatic',
  };
  return stages[stage] || 'Unknown';
}

/**
 * Get related words with context
 */
async function getRelatedWordsWithContext(word) {
  if (!word.relatedWords || word.relatedWords.length === 0) {
    return [];
  }

  const relatedIds = word.relatedWords.map(r => r.relatedWord);
  const relatedWords = await Vocabulary.find({
    _id: { $in: relatedIds },
  }).select('izonWord englishTranslation category');

  return word.relatedWords.map(rel => {
    const wordInfo = relatedWords.find(w => 
      w._id.toString() === rel.relatedWord.toString()
    );
    return {
      ...rel.toObject(),
      word: wordInfo,
    };
  });
}

/**
 * Get similar words
 */
async function getSimilarWords(word) {
  const similar = await Vocabulary.find({
    category: word.category,
    difficulty: word.difficulty,
    _id: { $ne: word._id },
    isPublished: true,
  })
    .limit(5)
    .select('izonWord englishTranslation difficulty');

  return similar;
}

/**
 * Get related words
 */
async function getRelatedWords(wordId, limit) {
  const relations = await WordRelation.find({
    $or: [
      { sourceWord: wordId },
      { targetWord: wordId },
    ],
    verificationStatus: 'verified',
  })
    .populate('sourceWord', 'izonWord englishTranslation')
    .populate('targetWord', 'izonWord englishTranslation')
    .limit(limit);

  return relations.map(r => ({
    word: r.sourceWord._id.equals(wordId) ? r.targetWord : r.sourceWord,
    relationType: r.relationType,
    strength: r.strength,
  }));
}

/**
 * Get related proverbs
 */
async function getRelatedProverbs(category, limit) {
  const Proverb = mongoose.model('Proverb');
  return await Proverb.find({ category, isPublished: true })
    .limit(limit)
    .select('izon english meaning');
}

/**
 * Update category statistics
 */
async function updateCategoryStats(category) {
  try {
    const count = await Vocabulary.countDocuments({ category, isPublished: true });
    
    await Category.findOneAndUpdate(
      { name: category },
      {
        $set: {
          'statistics.wordCount': count,
          lastUpdated: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    logger.error('Failed to update category stats:', error);
  }
}

/**
 * Clear vocabulary cache
 */
async function clearVocabularyCache(wordId = null) {
  try {
    const patterns = ['vocabulary:list*'];
    if (wordId) {
      patterns.push(`vocabulary:${wordId}*`);
    }

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    }
  } catch (error) {
    logger.error('Failed to clear vocabulary cache:', error);
  }
}

/**
 * Get vocabulary statistics (Optimized for FerretDB/SQLite)
 */
 
async function getVocabularyStats() {
  // Fetch minimal fields needed for stats in one go
  const [words, total, verified, pending] = await Promise.all([
    Vocabulary.find({ isPublished: true })
      .select('category difficulty language_id createdAt')
      .lean(),
    Vocabulary.countDocuments({ isPublished: true }),
    Vocabulary.countDocuments({ verified: true }),
    Vocabulary.countDocuments({ verificationStatus: 'pending' }),
  ]);

  const stats = {
    byCategory: {},
    byDifficulty: {},
    byLanguage: {},
  };

  // Single pass through data to build all counts
  words.forEach(word => {
    if (word.category) stats.byCategory[word.category] = (stats.byCategory[word.category] || 0) + 1;
    if (word.difficulty) stats.byDifficulty[word.difficulty] = (stats.byDifficulty[word.difficulty] || 0) + 1;
    if (word.language_id) {
      const langId = word.language_id.toString();
      stats.byLanguage[langId] = (stats.byLanguage[langId] || 0) + 1;
    }
  });

  // Resolve language names
  const languageIds = Object.keys(stats.byLanguage);
  const languages = await Language.find({ _id: { $in: languageIds } }).select('name code');
  
  const byLanguageFormatted = {};
  languages.forEach(lang => {
    byLanguageFormatted[lang.name] = stats.byLanguage[lang._id.toString()];
  });

  // Format byCategory as an array sorted by count
  const sortedCategories = Object.entries(stats.byCategory)
    .map(([_id, count]) => ({ _id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get recent additions from the already fetched list to save a query
  const recentAdditions = [...words]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(w => ({
      izonWord: w.izonWord,
      englishTranslation: w.englishTranslation,
      createdAt: w.createdAt
    }));

  return {
    total,
    verified,
    pending,
    byCategory: sortedCategories,
    byDifficulty: stats.byDifficulty,
    byLanguage: byLanguageFormatted,
    recentAdditions,
    completionRate: total > 0 ? Math.round((verified / total) * 100) : 0,
  };
}

module.exports = router;
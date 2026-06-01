const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const Language = require('../models/Language');

const User = require('../models/User');
const Category = require('../models/Category');
const WordRelation = require('../models/WordRelation');
const { logger } = require('../config/logger');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const redis = require('../config/redis');
const notificationService = require('../services/notificationService');
const axios = require('axios');
const natural = require('natural');
const { OpenAI } = require('openai');

// Initialize AI for advanced processing
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// VOCABULARY MANAGEMENT
// ============================================================================

/**
 * Add vocabulary (single or bulk)
 * POST /api/vocabulary/add
 */
exports.addVocabulary = async (req, res, next) => {
  try {
    const data = req.body;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    // Validate input
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new ValidationError('No vocabulary data provided');
    }

    // Process based on input type
    if (Array.isArray(data)) {
      return await handleBulkAdd(req, res, next);
    } else {
      return await handleSingleAdd(req, res, next);
    }

  } catch (err) {
    next(err);
  }
};

/**
 * Handle single word addition
 */
const handleSingleAdd = async (req, res, next) => {
  try {
    const data = req.body;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    // Validate required fields
    if (!data.izonWord || !data.englishTranslation) {
      throw new ValidationError('izonWord and englishTranslation are required');
    }

    // Resolve language_id if languageCode is provided
    if (data.languageCode && !data.language_id) {
      const language = await Language.findOne({ code: data.languageCode.toUpperCase() });
      if (language) {
        data.language_id = language._id;
      }
    }

    if (!data.language_id) {
      throw new ValidationError('language_id or languageCode is required');
    }

    // Check for duplicates within the same language
    const existingWord = await Vocabulary.findOne({
      izonWord: { $regex: new RegExp(`^${data.izonWord}$`, 'i') },
      language_id: data.language_id
    });

    if (existingWord) {
      throw new ValidationError(`Word "${data.izonWord}" already exists for this language`);
    }

    // Enrich word data
    const enrichedData = await enrichWordData(data);

    // Create new vocabulary entry
    const word = new Vocabulary({
      ...enrichedData,
      language_id: data.language_id,
      createdBy: userId,
      createdAt: new Date(),
      lastUpdated: new Date(),
      verified: isAdmin, // Auto-verify if admin
      verificationHistory: [{
        verifiedBy: userId,
        verifiedAt: new Date(),
        status: isAdmin ? 'verified' : 'pending',
      }],
      metadata: {
        source: 'manual_entry',
        contributor: userId,
        confidence: isAdmin ? 1.0 : 0.5,
      }
    });

    // Validate word with AI if not admin
    if (!isAdmin) {
      const validationResult = await validateWordWithAI(word);
      if (validationResult.suggestions) {
        word.aiSuggestions = validationResult.suggestions;
        word.metadata.confidence = validationResult.confidence;
      }
    }

    await word.save();
    
    // ============================================================================
    // NEW: AUTO-LINK TO LESSON
    // ============================================================================
    if (data.lessonId) {
      await Lesson.findByIdAndUpdate(data.lessonId, {
        $push: { vocabulary: word._id },
        $inc: { totalVocabulary: 1 }
      });
      logger.info(`Word ${word.izonWord} linked to lesson ${data.lessonId}`);
    }

    // Update category statistics
    await updateCategoryStats(word.category);

    // Clear relevant caches
    await clearVocabularyCaches();

    // Notify admins for review if needed
    if (!isAdmin) {
      await notifyAdminsForReview(word);
    }

    // Log the addition
    logger.info(`Vocabulary added: ${word.izonWord} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Word added successfully',
      data: formatWordResponse(word),
      pendingReview: !isAdmin,
      suggestions: word.aiSuggestions || undefined,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Handle bulk word addition
 */
const handleBulkAdd = async (req, res, next) => {
  try {
    const words = req.body.words || req.body;
    const { language_id, languageCode } = req.body;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    if (!Array.isArray(words) || words.length === 0) {
      throw new ValidationError('Invalid bulk data format');
    }

    if (words.length > 1000) {
      throw new ValidationError('Bulk upload limited to 1000 words at a time');
    }

    // Resolve language_id if languageCode is provided
    let targetLanguageId = language_id;
    if (languageCode && !targetLanguageId) {
      const language = await Language.findOne({ code: languageCode.toUpperCase() });
      if (language) {
        targetLanguageId = language._id;
      }
    }

    if (!targetLanguageId) {
      // Check if language_id is present in each word object if not provided globally
      const missingLanguage = words.some(w => !w.language_id && !w.languageCode);
      if (missingLanguage) {
        throw new ValidationError('language_id or languageCode is required for all words');
      }
    }

    // Validate each word
    const validationResults = await validateBulkWords(words);
    const validWords = validationResults.valid;
    const invalidWords = validationResults.invalid;

    if (validWords.length === 0) {
      throw new ValidationError('No valid words to add', { invalid: invalidWords });
    }

    // Check for duplicates in database within the same language
    // This is a simplified check; for high volume, a more robust approach is needed
    const existingWords = await Vocabulary.find({
      izonWord: { $in: validWords.map(w => w.izonWord) },
      language_id: targetLanguageId || { $in: validWords.map(w => w.language_id) }
    });

    const existingMap = new Map(existingWords.map(w => [`${w.izonWord.toLowerCase()}_${w.language_id}`, w]));

    // Prepare words for insertion
    const wordsToInsert = await Promise.all(validWords
      .filter(w => {
        const langId = targetLanguageId || w.language_id;
        return !existingMap.has(`${w.izonWord.toLowerCase()}_${langId}`);
      })
      .map(async w => {
        let langId = targetLanguageId || w.language_id;
        if (!langId && w.languageCode) {
           const language = await Language.findOne({ code: w.languageCode.toUpperCase() });
           langId = language?._id;
        }

        return {
          ...w,
          language_id: langId,
          lessonId: w.lessonId,
          createdBy: userId,
          createdAt: new Date(),
          lastUpdated: new Date(),
          verified: isAdmin,
          verificationHistory: [{
            verifiedBy: userId,
            verifiedAt: new Date(),
            status: isAdmin ? 'verified' : 'pending',
          }],
          metadata: {
            source: 'bulk_upload',
            contributor: userId,
            confidence: isAdmin ? 1.0 : 0.5,
          }
        };
      }));

    if (wordsToInsert.length === 0) {
      throw new ValidationError('All words already exist in database');
    }

    // Insert in batch
    const insertedWords = await Vocabulary.insertMany(wordsToInsert);

  // ============================================================================
    // NEW: BULK LINK TO LESSONS
    // ============================================================================
    const lessonUpdates = insertedWords.reduce((acc, word) => {
      if (word.lessonId) {
        if (!acc[word.lessonId]) acc[word.lessonId] = [];
        acc[word.lessonId].push(word._id);
      }
      return acc;
    }, {});

    const updatePromises = Object.keys(lessonUpdates).map(lessonId => 
      Lesson.findByIdAndUpdate(lessonId, {
        $push: { vocabulary: { $each: lessonUpdates[lessonId] } },
        $inc: { totalVocabulary: lessonUpdates[lessonId].length }
      })
    );
    await Promise.all(updatePromises);
    // ============================================================================
  
    // Update category statistics
    const categories = [...new Set(insertedWords.map(w => w.category))];
    await Promise.all(categories.map(c => updateCategoryStats(c)));

    // Clear caches
    await clearVocabularyCaches();

    // Notify admins
    if (!isAdmin) {
      await notifyAdminsForBulkReview(insertedWords.length);
    }

    logger.info(`Bulk vocabulary added: ${insertedWords.length} words by user ${userId}`);

    res.status(201).json({
      success: true,
      message: `${insertedWords.length} words added successfully`,
      data: {
        added: insertedWords.map(formatWordResponse),
        skipped: invalidWords.length,
        duplicates: validWords.length - wordsToInsert.length,
        total: words.length,
      },
      validation: {
        invalid: invalidWords,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// VOCABULARY QUERYING
// ============================================================================

/**
 * Get all vocabulary with filters
 * GET /api/vocabulary
 */
exports.getAllVocabulary = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      difficulty,
      language_id,
      lang,
      search,
      sortBy = 'izonWord',
      order = 'asc',
      verified,
      includePending = false,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Apply filters
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    
    // Support language filtering by ID or Code
    if (language_id) {
      query.language_id = language_id;
    } else if (lang) {
      const language = await Language.findOne({ code: lang.toUpperCase() });
      if (language) {
        query.language_id = language._id;
      }
    }

    if (verified !== undefined) query.verified = verified === 'true';
    if (!includePending) query.verified = true;

    // Search functionality
    if (search) {
      query.$or = [
        { izonWord: { $regex: search, $options: 'i' } },
        { englishTranslation: { $regex: search, $options: 'i' } },
        { partOfSpeech: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    // Try cache first
    const cacheKey = `vocabulary:${JSON.stringify({ page, limit, category, difficulty, language_id: query.language_id, search, sortBy, order })}`;
    const cached = await redis.get(cacheKey);

    if (cached && !req.query.refresh) {
      return res.json({
        success: true,
        ...JSON.parse(cached),
        fromCache: true,
      });
    }

    // Execute query
    const [words, total] = await Promise.all([
      Vocabulary.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('language_id', 'name code')
        .populate('createdBy', 'username')
        .populate('relatedWords.wordId', 'izonWord englishTranslation'),
      Vocabulary.countDocuments(query),
    ]);

    // Get related words for each entry
    const enrichedWords = await enrichWordsWithRelations(words);

    const response = {
      data: enrichedWords.map(formatWordResponse),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      filters: {
        category,
        difficulty,
        language_id: query.language_id,
        verified,
      },
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(response));

    res.json({
      success: true,
      ...response,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get vocabulary by ID
 * GET /api/vocabulary/:id
 */
exports.getVocabularyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const word = await Vocabulary.findById(id)
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .populate('relatedWords.wordId', 'izonWord englishTranslation category')
      .populate('variants', 'izonWord')
      .populate('examples.addedBy', 'username');

    if (!word) {
      throw new AppError('Vocabulary not found', 404);
    }

    // Increment view count
    word.metadata.views = (word.metadata.views || 0) + 1;
    await word.save();

    // Get user-specific data if authenticated
    let userData = {};
    if (req.userId) {
      userData = await getUserVocabularyData(req.userId, id);
    }

    // Get related words with context
    const relatedWords = await getRelatedWordsWithContext(word);

    res.json({
      success: true,
      data: {
        ...formatWordResponse(word),
        userData,
        relatedWords,
        suggestions: word.aiSuggestions,
        history: word.verificationHistory,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// VOCABULARY UPDATE & DELETE
// ============================================================================

/**
 * Update vocabulary
 * PUT /api/vocabulary/:id
 */
exports.updateVocabulary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    const word = await Vocabulary.findById(id);

    if (!word) {
      throw new AppError('Vocabulary not found', 404);
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
    word.updatedBy = userId;

    // Reset verification if not admin
    if (!isAdmin) {
      word.verified = false;
      word.metadata.confidence = 0.5;
    }

    // Add to history
    word.updateHistory.push({
      updatedBy: userId,
      updatedAt: new Date(),
      changes,
    });

    await word.save();

    // Clear caches
    await clearVocabularyCaches(id);

    logger.info(`Vocabulary updated: ${word.izonWord} by user ${userId}`);

    res.json({
      success: true,
      message: 'Word updated successfully',
      data: formatWordResponse(word),
      changes: changes.length,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Delete vocabulary
 * DELETE /api/vocabulary/:id
 */
exports.deleteVocabulary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    if (!isAdmin) {
      throw new AppError('Admin access required', 403);
    }

    const word = await Vocabulary.findByIdAndDelete(id);

    if (!word) {
      throw new AppError('Vocabulary not found', 404);
    }

    // Remove from user mastery lists
    await User.updateMany(
      { 'vocabularyMastery.wordId': id },
      { $pull: { vocabularyMastery: { wordId: id } } }
    );

    // Clear caches
    await clearVocabularyCaches(id);

    logger.info(`Vocabulary deleted: ${word.izonWord} by admin ${userId}`);

    res.json({
      success: true,
      message: 'Word deleted successfully',
      data: { id, izonWord: word.izonWord },
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// ADVANCED FEATURES
// ============================================================================

/**
 * Search vocabulary with advanced options
 * GET /api/vocabulary/search
 */
exports.searchVocabulary = async (req, res, next) => {
  try {
    const { q, type = 'all', limit = 10, fuzzy = true } = req.query;

    if (!q || q.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    let results = [];

    if (fuzzy) {
      // Fuzzy search using text index
      results = await Vocabulary.find(
        { $text: { $search: q } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(parseInt(limit));
    } else {
      // Exact matches with regex
      const regex = new RegExp(q, 'i');
      const query = {
        $or: [
          { izonWord: regex },
          { englishTranslation: regex },
        ],
      };

      if (type !== 'all') {
        if (type === 'izon') query.$or = [{ izonWord: regex }];
        if (type === 'english') query.$or = [{ englishTranslation: regex }];
      }

      results = await Vocabulary.find(query).limit(parseInt(limit));
    }

    // Group results by relevance
    const grouped = {
      exact: [],
      partial: [],
      related: [],
    };

    results.forEach(word => {
      if (word.izonWord.toLowerCase() === q.toLowerCase()) {
        grouped.exact.push(formatWordResponse(word));
      } else if (word.izonWord.toLowerCase().includes(q.toLowerCase())) {
        grouped.partial.push(formatWordResponse(word));
      } else {
        grouped.related.push(formatWordResponse(word));
      }
    });

    res.json({
      success: true,
      data: grouped,
      total: results.length,
      query: q,
      fuzzy: fuzzy,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get vocabulary by category
 * GET /api/vocabulary/category/:category
 */
exports.getByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { limit = 50, difficulty } = req.query;

    const query = { category };
    if (difficulty) query.difficulty = difficulty;

    const words = await Vocabulary.find(query)
      .sort({ frequency: -1, izonWord: 1 })
      .limit(parseInt(limit));

    // Get category info
    const categoryInfo = await Category.findOne({ name: category });

    res.json({
      success: true,
      data: words.map(formatWordResponse),
      category: categoryInfo || { name: category },
      count: words.length,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get daily word
 * GET /api/vocabulary/daily
 */
exports.getDailyWord = async (req, res, next) => {
  try {
    const today = new Date().toDateString();
    const cacheKey = `daily:word:${today}`;

    // Try cache
    let word = await redis.get(cacheKey);
    if (word) {
      return res.json({
        success: true,
        data: word,
        fromCache: true,
      });
    }

    // Get random word
    const count = await Vocabulary.countDocuments({ verified: true });
    const random = Math.floor(Math.random() * count);
    word = await Vocabulary.findOne({ verified: true })
      .skip(random)
      .populate('createdBy', 'username');

    if (!word) {
      throw new AppError('No vocabulary available', 404);
    }

    const response = formatWordResponse(word);

    // Cache for 24 hours
    await redis.set(cacheKey, response, 86400);

    res.json({
      success: true,
      data: response,
      date: today,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Get word of the day with cultural context
 * GET /api/vocabulary/word-of-day
 */
exports.getWordOfDay = async (req, res, next) => {
  try {
    const today = new Date().toDateString();
    
    // Use consistent seed for the day
    const seed = today.split('/').join('');
    const count = await Vocabulary.countDocuments({ verified: true });
    const index = (parseInt(seed) * 9301 + 49297) % count;
    
    const word = await Vocabulary.findOne({ verified: true })
      .skip(index)
      .populate('createdBy', 'username');

    // Generate cultural context using AI
    const culturalContext = await generateCulturalContext(word);

    res.json({
      success: true,
      data: {
        ...formatWordResponse(word),
        culturalContext,
        proverb: await getRelatedProverb(word),
        usage: await getCommonUsage(word),
      },
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// RELATIONSHIP MANAGEMENT
// ============================================================================

/**
 * Add word relationship
 * POST /api/vocabulary/relations
 */
exports.addWordRelation = async (req, res, next) => {
  try {
    const { wordId, relatedWordId, relationType, strength } = req.body;

    // Validate
    if (!wordId || !relatedWordId || !relationType) {
      throw new ValidationError('Missing required fields');
    }

    // Check if words exist
    const [word, relatedWord] = await Promise.all([
      Vocabulary.findById(wordId),
      Vocabulary.findById(relatedWordId),
    ]);

    if (!word || !relatedWord) {
      throw new AppError('One or both words not found', 404);
    }

    // Create relation
    const relation = new WordRelation({
      wordId,
      relatedWordId,
      relationType,
      strength: strength || 0.5,
      createdBy: req.userId,
    });

    await relation.save();

    // Update both words' relatedWords array
    await Promise.all([
      Vocabulary.findByIdAndUpdate(wordId, {
        $push: {
          relatedWords: {
            wordId: relatedWordId,
            type: relationType,
            strength: strength || 0.5,
          },
        },
      }),
      Vocabulary.findByIdAndUpdate(relatedWordId, {
        $push: {
          relatedWords: {
            wordId: wordId,
            type: relationType,
            strength: strength || 0.5,
          },
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'Word relationship added',
      data: relation,
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================================
// AI ENRICHMENT FUNCTIONS
// ============================================================================

/**
 * Enrich word data with AI
 */
const enrichWordData = async (data) => {
  try {
    // Use AI to generate additional content
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a linguistic expert in the Izon language. Enrich vocabulary data with accurate information."
        },
        {
          role: "user",
          content: `Enrich this Izon word with additional data:
            Word: ${data.izonWord}
            Translation: ${data.englishTranslation}
            Category: ${data.category || 'unknown'}
            
            Provide:
            1. Part of speech
            2. Example sentences (3)
            3. Etymology
            4. Cultural notes
            5. Common collocations
            6. Synonyms and antonyms
            7. Difficulty level (beginner/intermediate/advanced)`
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Parse AI response and merge with existing data
    const enriched = {
      ...data,
      partOfSpeech: data.partOfSpeech || extractPartOfSpeech(aiResponse),
      examples: data.examples || extractExamples(aiResponse),
      etymology: data.etymology || extractEtymology(aiResponse),
      culturalNotes: data.culturalNotes || extractCulturalNotes(aiResponse),
      collocations: data.collocations || extractCollocations(aiResponse),
      synonyms: data.synonyms || extractSynonyms(aiResponse),
      antonyms: data.antonyms || extractAntonyms(aiResponse),
      difficulty: data.difficulty || extractDifficulty(aiResponse),
      metadata: {
        ...data.metadata,
        aiEnriched: true,
        enrichmentDate: new Date(),
      },
    };

    return enriched;

  } catch (error) {
    logger.error('AI enrichment failed:', error);
    return data; // Return original data if AI fails
  }
};

/**
 * Validate word with AI
 */
const validateWordWithAI = async (word) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an Izon language expert. Validate and provide suggestions for vocabulary entries."
        },
        {
          role: "user",
          content: `Validate this Izon word entry:
            Izon: ${word.izonWord}
            English: ${word.englishTranslation}
            Category: ${word.category}
            
            Provide:
            1. Confidence score (0-1)
            2. Suggestions for improvement
            3. Alternative translations if any
            4. Common mistakes to avoid`
        }
      ],
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content;
    
    return {
      confidence: extractConfidence(response),
      suggestions: extractSuggestions(response),
      alternatives: extractAlternatives(response),
      warnings: extractWarnings(response),
    };

  } catch (error) {
    logger.error('AI validation failed:', error);
    return { confidence: 0.5, suggestions: [] };
  }
};

/**
 * Generate cultural context
 */
const generateCulturalContext = async (word) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert in Izon culture and traditions."
        },
        {
          role: "user",
          content: `Provide cultural context for the Izon word "${word.izonWord}" which means "${word.englishTranslation}" in English. Include:
            1. Cultural significance
            2. Traditional usage
            3. Related customs or beliefs
            4. Modern usage if applicable`
        }
      ],
      temperature: 0.8,
    });

    return completion.choices[0].message.content;

  } catch (error) {
    logger.error('Cultural context generation failed:', error);
    return null;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format word response
 */
const formatWordResponse = (word) => {
  return {
    id: word._id,
    izonWord: word.izonWord,
    englishTranslation: word.englishTranslation,
    language_id: word.language_id?._id || word.language_id,
    language: word.language_id?.name || undefined,
    partOfSpeech: word.partOfSpeech,
    category: word.category,
    difficulty: word.difficulty,
    pronunciation: word.pronunciation,
    audioUrl: word.audioUrl,
    imageUrl: word.imageUrl,
    examples: word.examples || [],
    etymology: word.etymology,
    culturalNotes: word.culturalNotes,
    tags: word.tags || [],
    synonyms: word.synonyms || [],
    antonyms: word.antonyms || [],
    relatedWords: word.relatedWords || [],
    frequency: word.frequency || 0,
    verified: word.verified || false,
    createdBy: word.createdBy?.username || 'system',
    createdAt: word.createdAt,
    metadata: word.metadata,
  };
};

/**
 * Validate bulk words
 */
const validateBulkWords = async (words) => {
  const valid = [];
  const invalid = [];

  words.forEach((word, index) => {
    if (!word.izonWord || !word.englishTranslation) {
      invalid.push({
        index,
        word: word.izonWord || 'unknown',
        reason: 'Missing required fields',
      });
    } else {
      valid.push(word);
    }
  });

  return { valid, invalid };
};

/**
 * Update category statistics
 */
const updateCategoryStats = async (category) => {
  try {
    const stats = await Vocabulary.aggregate([
      { $match: { category } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          byDifficulty: {
            $push: '$difficulty',
          },
        },
      },
    ]);

    await Category.findOneAndUpdate(
      { name: category },
      {
        $set: {
          wordCount: stats[0]?.count || 0,
          lastUpdated: new Date(),
        },
      },
      { upsert: true }
    );

  } catch (error) {
    logger.error('Failed to update category stats:', error);
  }
};

/**
 * Clear vocabulary caches
 */
const clearVocabularyCaches = async (wordId = null) => {
  try {
    const keys = await redis.keys('vocabulary:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
    
    if (wordId) {
      await redis.del(`vocabulary:${wordId}`);
    }
  } catch (error) {
    logger.error('Failed to clear vocabulary caches:', error);
  }
};

/**
 * Get user vocabulary data
 */
const getUserVocabularyData = async (userId, wordId) => {
  const user = await User.findById(userId);
  
  const mastery = user.vocabularyMastery?.find(
    v => v.wordId.toString() === wordId.toString()
  );

  return {
    mastered: !!mastery,
    stage: mastery?.stage || 0,
    lastReviewed: mastery?.lastReviewed,
    nextReview: mastery?.nextReview,
    reviewCount: mastery?.reviewCount || 0,
    inFavorites: user.favorites?.includes(wordId),
    inLearningList: user.learningList?.includes(wordId),
  };
};

/**
 * Get related words with context
 */
const getRelatedWordsWithContext = async (word) => {
  if (!word.relatedWords || word.relatedWords.length === 0) {
    return [];
  }

  const relatedIds = word.relatedWords.map(r => r.wordId);
  const relatedWords = await Vocabulary.find({
    _id: { $in: relatedIds },
  }).select('izonWord englishTranslation category');

  return word.relatedWords.map(rel => {
    const wordInfo = relatedWords.find(w => 
      w._id.toString() === rel.wordId.toString()
    );
    return {
      ...rel.toObject(),
      word: wordInfo,
    };
  });
};

/**
 * Notify admins for review
 */
const notifyAdminsForReview = async (word) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    
    for (const admin of admins) {
      await notificationService.sendNotification(admin._id,
      {
        type: 'review_needed',
        title: 'New Word Pending Review',
        body: `"${word.izonWord}" needs verification`,
        data: { wordId: word._id },
      });
    }
  } catch (error) {
    logger.error('Failed to notify admins:', error);
  }
};

/**
 * Notify admins for bulk review
 */
const notifyAdminsForBulkReview = async (count) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    
    for (const admin of admins) {
      await notificationService.sendNotification(admin._id,
      {
        type: 'bulk_review_needed',
        title: 'Bulk Upload Pending Review',
        body: `${count} new words need verification`,
      });
    }
  } catch (error) {
    logger.error('Failed to notify admins:', error);
  }
};

/**
 * Get related proverb
 */
const getRelatedProverb = async (word) => {
  // This would query a Proverbs collection
  return null;
};

/**
 * Get common usage
 */
const getCommonUsage = async (word) => {
  return null;
};

// ============================================================================
// AI PARSING FUNCTIONS
// ============================================================================

const extractPartOfSpeech = (text) => {
  // Parse AI response for part of speech
  return null;
};

const extractExamples = (text) => {
  // Parse AI response for examples
  return [];
};

const extractEtymology = (text) => {
  // Parse AI response for etymology
  return null;
};

const extractCulturalNotes = (text) => {
  // Parse AI response for cultural notes
  return null;
};

const extractCollocations = (text) => {
  // Parse AI response for collocations
  return [];
};

const extractSynonyms = (text) => {
  // Parse AI response for synonyms
  return [];
};

const extractAntonyms = (text) => {
  // Parse AI response for antonyms
  return [];
};

const extractDifficulty = (text) => {
  // Parse AI response for difficulty
  return 'intermediate';
};

const extractConfidence = (text) => {
  // Parse AI response for confidence score
  return 0.8;
};

const extractSuggestions = (text) => {
  // Parse AI response for suggestions
  return [];
};

const extractAlternatives = (text) => {
  // Parse AI response for alternatives
  return [];
};

const extractWarnings = (text) => {
  // Parse AI response for warnings
  return [];
};

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Enrich words in batch
 */
const enrichWordsWithRelations = async (words) => {
  // This would batch enrich words with related data
  return words;
};

module.exports = exports;
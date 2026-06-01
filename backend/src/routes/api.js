const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');
const { logger } = require('../config/logger');
const { cacheMiddleware } = require('../middleware/cache');
const { validateApiKey } = require('../middleware/apiKey');
const { AppError } = require('../middleware/errorHandler');

const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const Category = require('../models/Category');
const Proverb = require('../models/Proverb');
const notificationService = require('../services/notificationService');

// ============================================================================
// INITIALIZATION & CONFIGURATION
// ============================================================================

// Rate limiting for public endpoints
const publicLimiter = rateLimit({
  store: redis.client ? new RedisStore({
    client: redis.client,
    prefix: 'url:public:',
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});

// Apply rate limiting to all public routes
router.use(publicLimiter);

// Apply API key authentication
router.use(validateApiKey);

// Initialize Gemini
let geminiClient = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiClient = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

const PRONUNCIATION_GUIDE = {
  vowels: {
    "a": { description: "like 'a' in 'father'", ipa: "ä", type: "open back unrounded", audio: "/audio/vowels/a.mp3" },
    "e": { description: "like 'e' in 'bed'", ipa: "e", type: "close-mid front unrounded", audio: "/audio/vowels/e.mp3" },
    "ẹ": { description: "like 'e' but with slightly rounded lips", ipa: "ɛ", type: "open-mid front unrounded", audio: "/audio/vowels/e-dot.mp3" },
    "i": { description: "like 'ee' in 'see'", ipa: "i", type: "close front unrounded", audio: "/audio/vowels/i.mp3" },
    "ị": { description: "higher pitch than regular 'i'", ipa: "ɪ", type: "near-close near-front", audio: "/audio/vowels/i-dot.mp3" },
    "o": { description: "like 'o' in 'go'", ipa: "o", type: "close-mid back rounded", audio: "/audio/vowels/o.mp3" },
    "ọ": { description: "like 'o' but deeper in throat", ipa: "ɔ", type: "open-mid back rounded", audio: "/audio/vowels/o-dot.mp3" },
    "u": { description: "like 'oo' in 'food'", ipa: "u", type: "close back rounded", audio: "/audio/vowels/u.mp3" },
    "ụ": { description: "like 'u' but with tension", ipa: "ʊ", type: "near-close near-back", audio: "/audio/vowels/u-dot.mp3" }
  },
  consonants: {
    "b": { description: "like 'b' in 'bat'", ipa: "b", type: "voiced bilabial plosive", audio: "/audio/consonants/b.mp3" },
    "d": { description: "like 'd' in 'dog'", ipa: "d", type: "voiced alveolar plosive", audio: "/audio/consonants/d.mp3" },
    "f": { description: "like 'f' in 'fish'", ipa: "f", type: "voiceless labiodental fricative", audio: "/audio/consonants/f.mp3" },
    "g": { description: "like 'g' in 'go'", ipa: "ɡ", type: "voiced velar plosive", audio: "/audio/consonants/g.mp3" },
    "gb": { description: "simultaneous g and b sounds", ipa: "ɡ͡b", type: "voiced labial-velar plosive", audio: "/audio/consonants/gb.mp3" },
    "gh": { description: "voiced velar fricative (like French 'r')", ipa: "ɣ", type: "voiced velar fricative", audio: "/audio/consonants/gh.mp3" },
    "h": { description: "like 'h' in 'house'", ipa: "h", type: "voiceless glottal fricative", audio: "/audio/consonants/h.mp3" },
    "j": { description: "like 'j' in 'judge'", ipa: "d͡ʒ", type: "voiced postalveolar affricate", audio: "/audio/consonants/j.mp3" },
    "k": { description: "like 'k' in 'kite'", ipa: "k", type: "voiceless velar plosive", audio: "/audio/consonants/k.mp3" },
    "kp": { description: "simultaneous k and p sounds", ipa: "k͡p", type: "voiceless labial-velar plosive", audio: "/audio/consonants/kp.mp3" },
    "l": { description: "like 'l' in 'love'", ipa: "l", type: "alveolar lateral approximant", audio: "/audio/consonants/l.mp3" },
    "m": { description: "like 'm' in 'man'", ipa: "m", type: "bilabial nasal", audio: "/audio/consonants/m.mp3" },
    "n": { description: "like 'n' in 'no'", ipa: "n", type: "alveolar nasal", audio: "/audio/consonants/n.mp3" },
    "ny": { description: "like 'ñ' in Spanish 'señor'", ipa: "ɲ", type: "palatal nasal", audio: "/audio/consonants/ny.mp3" },
    "p": { description: "like 'p' in 'pat'", ipa: "p", type: "voiceless bilabial plosive", audio: "/audio/consonants/p.mp3" },
    "r": { description: "flapped 'r' like in Spanish", ipa: "ɾ", type: "alveolar tap", audio: "/audio/consonants/r.mp3" },
    "s": { description: "like 's' in 'sun'", ipa: "s", type: "voiceless alveolar fricative", audio: "/audio/consonants/s.mp3" },
    "t": { description: "like 't' in 'top'", ipa: "t", type: "voiceless alveolar plosive", audio: "/audio/consonants/t.mp3" },
    "v": { description: "like 'v' in 'vat'", ipa: "v", type: "voiced labiodental fricative", audio: "/audio/consonants/v.mp3" },
    "w": { description: "like 'w' in 'water'", ipa: "w", type: "labial-velar approximant", audio: "/audio/consonants/w.mp3" },
    "y": { description: "like 'y' in 'yes'", ipa: "j", type: "palatal approximant", audio: "/audio/consonants/y.mp3" },
    "z": { description: "like 'z' in 'zoo'", ipa: "z", type: "voiced alveolar fricative", audio: "/audio/consonants/z.mp3" }
  }
};

const TONE_MARKS = {
  high: "́", // acute accent
  mid: "̄", // macron
  low: "̀", // grave accent
  rising: "̌", // caron
  falling: "̂", // circumflex
};

// Helper function to generate IPA pronunciation
function generateIPA(word, includeTones = false) {
  const ipaMap = {
    "a": "ä", "ẹ": "ɛ", "e": "e", "i": "i", "ị": "ɪ", 
    "o": "o", "ọ": "ɔ", "u": "u", "ụ": "ʊ",
    "gb": "ɡ͡b", "kp": "k͡p", "ny": "ɲ", "gh": "ɣ",
    "b": "b", "d": "d", "f": "f", "g": "ɡ", "h": "h",
    "j": "d͡ʒ", "k": "k", "l": "l", "m": "m", "n": "n",
    "p": "p", "r": "ɾ", "s": "s", "t": "t", "v": "v",
    "w": "w", "y": "j", "z": "z"
  };
  
  let ipa = word.toLowerCase();
  
  // Handle multi-character sounds first
  for (const [sound, ipaSound] of Object.entries(ipaMap)) {
    if (sound.length > 1) {
      const regex = new RegExp(sound, 'g');
      ipa = ipa.replace(regex, ipaSound);
    }
  }
  
  // Handle single characters
  for (const [sound, ipaSound] of Object.entries(ipaMap)) {
    if (sound.length === 1) {
      const regex = new RegExp(sound, 'g');
      ipa = ipa.replace(regex, ipaSound);
    }
  }
  
  return `/${ipa}/`;
}

// Helper to generate syllable breakdown
function generateSyllables(word) {
  const vowels = new Set(['a', 'e', 'ẹ', 'i', 'ị', 'o', 'ọ', 'u', 'ụ']);
  const syllables = [];
  let currentSyllable = '';
  
  for (const char of word) {
    currentSyllable += char;
    if (vowels.has(char)) {
      syllables.push(currentSyllable);
      currentSyllable = '';
    }
  }
  
  if (currentSyllable) {
    syllables.push(currentSyllable);
  }
  
  return syllables;
}

// Helper to safely escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Gemini translation function with enhanced prompting
async function translateWithGemini(text, from, to, context = {}) {
  if (!geminiClient) return null;
  
  try {
    const promptFrom = from === 'en' ? 'English' : 'Izon (Ijaw, primarily Kolokuma dialect)';
    const promptTo = to === 'izon' ? 'natural Izon (Ijaw, Kolokuma dialect)' : 'natural English';
    
    let contextPrompt = '';
    if (context.category) {
      contextPrompt = `\nContext: This is related to ${context.category}.`;
    }
    if (context.formality) {
      contextPrompt += `\nFormality level: ${context.formality}.`;
    }
    
    const systemPrompt = `You are an expert translator for Izon (Ijaw language, primarily Kolokuma dialect, Niger Delta). 
Translate accurately and naturally. Preserve meaning and handle SOV word order in Izon.
Important: For Izon translations, use proper diacritics and tone markings (ẹ, ọ, ị, ụ).
Output ONLY the translation — no explanations, no quotes, no additional text.${contextPrompt}`;

    const userPrompt = `Translate from ${promptFrom} to ${promptTo}: "${text}"`;
    
    const result = await geminiClient.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { 
        temperature: 0.2, 
        maxOutputTokens: 512,
        topP: 0.8,
        topK: 40,
      },
    });
    
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    logger.error('[Gemini Error]:', error.message);
    return null;
  }
}

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Izon Public API is operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      vocabulary: '/api/public/vocabulary',
      search: '/api/public/vocabulary/search',
      pronunciation: '/api/public/pronunciation/guide',
      translate: '/api/public/translate',
      validate: '/api/public/validate',
      lessons: '/api/public/lessons',
      categories: '/api/public/categories',
      proverbs: '/api/public/proverbs',
      wordOfDay: '/api/public/word-of-day',
    },
  });
});

// ============================================================================
// VOCABULARY ENDPOINTS
// ============================================================================

/**
 * Get vocabulary with enhanced features
 * GET /api/public/vocabulary
 */
router.get('/vocabulary', cacheMiddleware(300), async (req, res, next) => {
  try {
    const { 
      limit = 50, 
      page = 1,
      category, 
      difficulty,
      language_id,
      lang,
      includePronunciation = 'true',
      includeExamples = 'false',
      sortBy = 'izonWord',
      sortOrder = 'asc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { isPublished: true, isActive: true };
    
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    
    const { dialect } = req.query;
    if (language_id) {
      query.language_id = language_id;
    } else if (lang) {
      const language = await Language.findOne({ code: lang.toUpperCase() });
      if (language) query.language_id = language._id;
    } else if (dialect) {
      const langDoc = await Language.findOne({ 
        $or: [
          { code: dialect.toUpperCase() },
          { name: new RegExp(`^${dialect}$`, 'i') }
        ]
      });
      if (langDoc) query.language_id = langDoc._id;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [words, total] = await Promise.all([
      Vocabulary.find(query)
        .select(includeExamples === 'true' ? '-__v -contributions -flags' : 'izonWord englishTranslation language_id pronunciation category difficulty examples')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('language_id', 'name code icon color'),
      Vocabulary.countDocuments(query),
    ]);

    // ... (rest of the enhancement logic)

    res.json({
      success: true,
      data: enhancedWords,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      filters: { category, difficulty, language_id: query.language_id },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Search vocabulary with advanced options
 * GET /api/public/vocabulary/search
 */
router.get('/vocabulary/search', cacheMiddleware(60), async (req, res, next) => {
  try {
    const { 
      q, 
      type = 'all',
      limit = 20,
      includePronunciation = 'true',
      fuzzy = true,
    } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    let results = [];
    let searchStats = {};

    if (fuzzy) {
      // Fuzzy search using text index
      results = await Vocabulary.find(
        { 
          $text: { $search: q },
          isPublished: true,
          isActive: true,
        },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(parseInt(limit))
        .select('izonWord englishTranslation category difficulty pronunciation examples');
      
      searchStats.method = 'fuzzy';
    } else {
      // Exact matches with regex
      const regex = new RegExp(q, 'i');
      const query = {
        $or: [],
        isPublished: true,
        isActive: true,
      };

      if (type === 'all' || type === 'izon') {
        query.$or.push({ izonWord: regex });
      }
      if (type === 'all' || type === 'english') {
        query.$or.push({ englishTranslation: regex });
      }
      if (type === 'all' || type === 'category') {
        query.$or.push({ category: regex });
      }

      results = await Vocabulary.find(query)
        .limit(parseInt(limit))
        .select('izonWord englishTranslation category difficulty');
      
      searchStats.method = 'exact';
    }

    // Enhance results
    const enhancedResults = results.map(word => {
      const enhanced = word.toObject();
      
      if (includePronunciation === 'true') {
        enhanced.pronunciation = {
          ipa: generateIPA(word.izonWord),
          guide: word.pronunciation?.guide || 'See pronunciation guide',
        };
      }
      
      return enhanced;
    });

    // Group results by relevance
    const grouped = {
      exact: [],
      partial: [],
      related: [],
    };

    enhancedResults.forEach(word => {
      if (word.izonWord.toLowerCase() === q.toLowerCase()) {
        grouped.exact.push(word);
      } else if (word.izonWord.toLowerCase().includes(q.toLowerCase())) {
        grouped.partial.push(word);
      } else {
        grouped.related.push(word);
      }
    });

    res.json({
      success: true,
      data: grouped,
      stats: {
        total: enhancedResults.length,
        ...searchStats,
        query: q,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get vocabulary by category
 * GET /api/public/vocabulary/category/:category
 */
router.get('/vocabulary/category/:category', cacheMiddleware(600), async (req, res, next) => {
  try {
    const { category } = req.params;
    const { limit = 50, difficulty, includePronunciation = 'true' } = req.query;

    const query = { 
      category, 
      isPublished: true, 
      isActive: true,
    };
    
    if (difficulty) query.difficulty = difficulty;

    const [words, categoryInfo] = await Promise.all([
      Vocabulary.find(query)
        .select('izonWord englishTranslation difficulty examples')
        .limit(parseInt(limit)),
      Category.findOne({ name: category }),
    ]);

    // Enhance words
    const enhancedWords = words.map(word => ({
      ...word.toObject(),
      pronunciation: includePronunciation === 'true' ? {
        ipa: generateIPA(word.izonWord),
      } : null,
    }));

    res.json({
      success: true,
      data: enhancedWords,
      category: categoryInfo || { 
        name: category,
        description: `Words related to ${category}`,
      },
      count: words.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get word of the day
 * GET /api/public/word-of-day
 */
router.get('/word-of-day', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const today = new Date().toDateString();
    
    // Use consistent seed for the day
    const seed = parseInt(today.split('/').join('').replace(/\D/g, ''));
    const count = await Vocabulary.countDocuments({ isPublished: true, isActive: true });
    const index = (seed * 9301 + 49297) % count;
    
    const word = await Vocabulary.findOne({ isPublished: true, isActive: true })
      .skip(index)
      .select('izonWord englishTranslation pronunciation examples category culturalContext');

    if (!word) {
      throw new AppError('No vocabulary available', 404);
    }

    // Enhance with additional content
    const response = {
      word: word.izonWord,
      translation: word.englishTranslation,
      pronunciation: {
        ipa: generateIPA(word.izonWord),
        audio: word.pronunciation?.audio?.url,
        guide: {
          breakdown: word.izonWord.split('').map(char => ({
            char,
            sound: PRONUNCIATION_GUIDE.vowels[char]?.description || 
                   PRONUNCIATION_GUIDE.consonants[char]?.description,
          })),
          syllables: generateSyllables(word.izonWord),
        },
      },
      category: word.category,
      examples: word.examples?.slice(0, 3) || [],
      culturalContext: word.culturalContext?.significance || null,
      date: today,
      shareText: `Today's Izon word: ${word.izonWord} - ${word.englishTranslation}`,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PRONUNCIATION ENDPOINTS
// ============================================================================

/**
 * Get comprehensive pronunciation guide
 * GET /api/public/pronunciation/guide
 */
router.get('/pronunciation/guide', cacheMiddleware(86400), (req, res) => {
  const { lang = 'en' } = req.query;
  
  const guide = {
    vowels: Object.entries(PRONUNCIATION_GUIDE.vowels).map(([char, data]) => ({
      character: char,
      ...data,
      examples: getExampleWords(char, 'vowel'),
    })),
    consonants: Object.entries(PRONUNCIATION_GUIDE.consonants).map(([char, data]) => ({
      character: char,
      ...data,
      examples: getExampleWords(char, 'consonant'),
    })),
    tips: [
      "Izon is a tonal language - pitch changes meaning",
      "The same word can have different meanings based on tone",
      "Press your tongue to the roof of your mouth for 'ny' sound",
      "Practice 'gb' and 'kp' as single sounds, not two separate sounds",
      "Listen for nasalization in vowels following m/n",
      "Start with simple words before attempting tones",
      "Record yourself and compare with native speakers",
      "Practice minimal pairs to distinguish similar sounds",
    ],
    tones: [
      { name: "High", mark: TONE_MARKS.high, example: "á", description: "High pitch, steady" },
      { name: "Mid", mark: TONE_MARKS.mid, example: "ā", description: "Middle pitch, steady" },
      { name: "Low", mark: TONE_MARKS.low, example: "à", description: "Low pitch, steady" },
      { name: "Rising", mark: TONE_MARKS.rising, example: "ǎ", description: "Low to high" },
      { name: "Falling", mark: TONE_MARKS.falling, example: "â", description: "High to low" },
    ],
    commonMistakes: [
      {
        sound: "gb/kp",
        mistake: "Pronouncing as separate sounds",
        correction: "Pronounce simultaneously - like a single sound",
      },
      {
        sound: "ny",
        mistake: "Pronouncing as n + y",
        correction: "Like Spanish 'ñ' - single palatal sound",
      },
      {
        sound: "ọ/ọ",
        mistake: "Confusing open and closed o",
        correction: "ọ is deeper, almost like 'aw'",
      },
    ],
  };

  res.json({
    success: true,
    data: guide,
    totalSounds: guide.vowels.length + guide.consonants.length,
  });
});

/**
 * Get pronunciation for a specific word
 * GET /api/public/pronunciation/word/:word
 */
router.get('/pronunciation/word/:word', async (req, res, next) => {
  try {
    const { word } = req.params;
    const { slow = 'false' } = req.query;

    const vocabulary = await Vocabulary.findOne({
      izonWord: new RegExp(`^${escapeRegExp(word)}$`, 'i'),
      isPublished: true,
    });

    if (!vocabulary) {
      return res.status(404).json({
        success: false,
        error: 'Word not found',
      });
    }

    const pronunciation = {
      word: vocabulary.izonWord,
      ipa: generateIPA(vocabulary.izonWord),
      syllables: generateSyllables(vocabulary.izonWord),
      breakdown: vocabulary.izonWord.split('').map((char, index) => ({
        position: index + 1,
        character: char,
        sound: PRONUNCIATION_GUIDE.vowels[char]?.description || 
               PRONUNCIATION_GUIDE.consonants[char]?.description,
        ipa: PRONUNCIATION_GUIDE.vowels[char]?.ipa || 
             PRONUNCIATION_GUIDE.consonants[char]?.ipa,
        type: PRONUNCIATION_GUIDE.vowels[char] ? 'vowel' : 'consonant',
        audio: PRONUNCIATION_GUIDE.vowels[char]?.audio || 
               PRONUNCIATION_GUIDE.consonants[char]?.audio,
      })),
      audio: vocabulary.pronunciation?.audio,
      slowAudio: slow === 'true' ? vocabulary.pronunciation?.audio?.url?.replace('.mp3', '-slow.mp3') : null,
      tips: [
        `Practice saying each syllable separately: ${generateSyllables(vocabulary.izonWord).join(' - ')}`,
        `Focus on the ${vocabulary.izonWord.includes('gb') ? 'gb' : 
                     vocabulary.izonWord.includes('kp') ? 'kp' : 
                     'vowel'} sounds`,
        "Record yourself and compare",
      ],
    };

    res.json({
      success: true,
      data: pronunciation,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TRANSLATION ENDPOINTS
// ============================================================================

/**
 * Translate text with enhanced features
 * POST /api/public/translate
 */
router.post('/translate', async (req, res, next) => {
  try {
    const { 
      text, 
      from = 'en', 
      to = 'izon', 
      includePronunciation = 'true',
      context = {},
      formality = 'neutral',
    } = req.body;

    if (!text?.trim()) {
      return next(new AppError('text is required', 400));
    }

    const input = text.trim();
    let translated = '';
    let pronunciation = null;
    let type = 'unknown';
    let confidence = 'high';
    let alternatives = [];
    let note = null;
    let provider = null;
    let wordBreakdown = [];

    // Validate language pair
    const validPairs = ['en→izon', 'izon→en'];
    if (!validPairs.includes(`${from}→${to}`)) {
      return res.status(400).json({
        success: false,
        error: 'Supported pairs: en→izon or izon→en',
      });
    }

    // 1. Exact dictionary match
    let query = {};
    if (from === 'en' && to === 'izon') {
      query = { englishTranslation: new RegExp(`^\\s*${escapeRegExp(input)}\\s*$`, 'i'), isPublished: true };
    } else {
      query = { izonWord: new RegExp(`^\\s*${escapeRegExp(input)}\\s*$`, 'i'), isPublished: true };
    }

    const exact = await Vocabulary.findOne(query)
      .select('izonWord englishTranslation pronunciation examples synonyms antonyms')
      .populate('synonyms.relatedWord', 'izonWord englishTranslation');

    if (exact) {
      translated = from === 'en' ? exact.izonWord : exact.englishTranslation;
      type = 'exact_dictionary';
      confidence = 'high';
      
      // Get alternative translations
      if (exact.synonyms && exact.synonyms.length > 0) {
        alternatives = exact.synonyms
          .filter(s => s.relationType === 'synonym')
          .map(s => ({
            word: from === 'en' ? s.relatedWord?.izonWord : s.relatedWord?.englishTranslation,
            translation: from === 'en' ? s.relatedWord?.englishTranslation : s.relatedWord?.izonWord,
            strength: s.strength,
          }));
      }
      
      // Word breakdown
      wordBreakdown = [{
        original: input,
        translated: translated,
        confidence: 1,
        type: 'exact',
      }];
    } else {
      // 2. Word-by-word fallback
      const words = input.split(/\s+/).filter(Boolean);
      const translatedParts = [];
      const wordDetails = [];

      for (const w of words) {
        const matchQuery = from === 'en'
          ? { englishTranslation: new RegExp(`^\\s*${escapeRegExp(w)}\\s*$`, 'i'), isPublished: true }
          : { izonWord: new RegExp(`^\\s*${escapeRegExp(w)}\\s*$`, 'i'), isPublished: true };

        const match = await Vocabulary.findOne(matchQuery)
          .select('izonWord englishTranslation');

        if (match) {
          translatedParts.push(from === 'en' ? match.izonWord : match.englishTranslation);
          wordDetails.push({
            original: w,
            translated: from === 'en' ? match.izonWord : match.englishTranslation,
            confidence: 0.9,
            type: 'dictionary',
          });
        } else {
          translatedParts.push(`[${w}]`);
          wordDetails.push({
            original: w,
            translated: null,
            confidence: 0,
            type: 'unknown',
          });
        }
      }

      translated = translatedParts.join(' ');
      wordBreakdown = wordDetails;
      type = 'word_by_word';
      confidence = 'medium';
      note = 'Word-by-word translation — grammar may not be perfect (Izon uses SOV order)';

      // 3. LLM fallback for complex sentences
      if (words.length > 2 || /[.,!?]/.test(input)) {
        const llmResult = await translateWithGemini(input, from, to, { ...context, formality });
        
        if (llmResult && llmResult.trim()) {
          translated = llmResult.trim();
          type = 'llm_fallback';
          confidence = 'medium';
          note = 'AI-generated translation — review by native Izon speaker recommended';
          provider = 'gemini';
          
          // Add word breakdown for LLM translation
          wordBreakdown = [{
            original: input,
            translated: llmResult,
            confidence: 0.7,
            type: 'llm',
          }];
        }
      }
    }

    // Add IPA pronunciation for Izon words
    if (includePronunciation === 'true' && to === 'izon' && translated && !translated.includes('[')) {
      pronunciation = {
        ipa: generateIPA(translated),
        syllables: generateSyllables(translated),
        breakdown: translated.split('').map(char => ({
          char,
          sound: PRONUNCIATION_GUIDE.vowels[char]?.description || 
                 PRONUNCIATION_GUIDE.consonants[char]?.description,
          audio: PRONUNCIATION_GUIDE.vowels[char]?.audio || 
                 PRONUNCIATION_GUIDE.consonants[char]?.audio,
        })),
        guide: 'Practice each sound individually before combining',
        tips: [
          "Record yourself and compare with native speakers",
          "Pay attention to tone - it can change meaning",
          "Practice with minimal pairs",
        ],
      };
    }

    // Track translation for analytics
    trackTranslation(input, from, to, type, confidence);

    res.json({
      success: true,
      data: {
        original: input,
        translated,
        direction: `${from} → ${to}`,
        type,
        confidence,
        alternatives: alternatives.slice(0, 3),
        pronunciation,
        wordBreakdown,
        note,
        provider,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Translate batch of texts
 * POST /api/public/translate/batch
 */
router.post('/translate/batch', async (req, res, next) => {
  try {
    const { texts, from = 'en', to = 'izon' } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return next(new AppError('Array of texts required', 400));
    }

    if (texts.length > 50) {
      return next(new AppError('Maximum 50 texts per batch', 400));
    }

    const results = [];
    
    for (const text of texts) {
      const result = await translateWithGemini(text, from, to);
      results.push({
        original: text,
        translated: result || '[Translation failed]',
        success: !!result,
      });
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// VALIDATION ENDPOINTS
// ============================================================================

/**
 * Validate translation with detailed feedback
 * POST /api/public/validate
 */
router.post('/validate', async (req, res, next) => {
  try {
    const { izon, english, pronunciationAttempt, context } = req.body;
    
    if (!izon || !english) {
      return res.status(400).json({
        success: false,
        error: 'Both izon and english fields required',
      });
    }
    
    // Find word in database
    const word = await Vocabulary.findOne({
      izonWord: new RegExp(`^\\s*${escapeRegExp(izon)}\\s*$`, 'i'),
      isPublished: true,
    }).select('izonWord englishTranslation pronunciation examples synonyms');

    if (!word) {
      return res.json({
        success: true,
        valid: false,
        message: 'Word not found in database',
        suggestions: await findSimilarWords(izon),
      });
    }
    
    const isCorrect = word.englishTranslation.toLowerCase() === english.toLowerCase();
    
    // Generate detailed feedback
    const feedback = {
      success: true,
      valid: isCorrect,
      correctAnswer: word.englishTranslation,
      accuracy: isCorrect ? 100 : calculateSimilarity(english, word.englishTranslation),
      pronunciation: {
        izon: word.izonWord,
        ipa: generateIPA(word.izonWord),
        syllableBreakdown: generateSyllables(word.izonWord).join('-'),
        audio: word.pronunciation?.audio?.url,
      },
    };

    // Add pronunciation feedback if attempted
    if (pronunciationAttempt) {
      feedback.pronunciationFeedback = {
        attempt: pronunciationAttempt,
        target: word.izonWord,
        similarity: calculatePronunciationSimilarity(pronunciationAttempt, word.izonWord),
        issues: identifyPronunciationIssues(pronunciationAttempt, word.izonWord),
        tips: generatePronunciationTips(pronunciationAttempt, word.izonWord),
      };
    }

    // Add example sentences
    if (word.examples && word.examples.length > 0) {
      feedback.examples = word.examples.slice(0, 3).map(ex => ({
        izon: ex.izon,
        english: ex.english,
        context: ex.context,
      }));
    }

    // Track validation for analytics
    trackValidation(izon, english, isCorrect, context);

    res.json(feedback);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// LESSON ENDPOINTS
// ============================================================================

/**
 * Get lessons (public metadata)
 * GET /api/public/lessons
 */
router.get('/lessons', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { 
      level, 
      category,
      limit = 20,
      page = 1,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { status: 'published' };
    
    if (level) query.level = level;
    if (category) query.category = category;

    const [lessons, total] = await Promise.all([
      Lesson.find(query)
        .select('title.english description.english level category order estimatedTime rewards.badges')
        .sort({ order: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Lesson.countDocuments(query),
    ]);

    // Enhance with progress info (would need user context for actual progress)
    const enhancedLessons = lessons.map(lesson => ({
      ...lesson.toObject(),
      estimatedTimeMinutes: lesson.estimatedTime?.minutes || 15,
      badgesAvailable: lesson.rewards?.badges?.length || 0,
    }));

    res.json({
      success: true,
      data: enhancedLessons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      filters: { level, category },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get lesson by ID
 * GET /api/public/lessons/:id
 */
router.get('/lessons/:id', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid lesson ID', 400));
    }

    const lesson = await Lesson.findOne({ 
      _id: id, 
      status: 'published' 
    }).select('-__v -internalNotes -versionHistory');

    if (!lesson) {
      return next(new AppError('Lesson not found', 404));
    }

    // Get related lessons
    const relatedLessons = await Lesson.find({
      category: lesson.category,
      level: lesson.level,
      _id: { $ne: lesson._id },
      status: 'published',
    })
      .limit(3)
      .select('title.english level order');

    res.json({
      success: true,
      data: {
        ...lesson.toObject(),
        relatedLessons,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CATEGORY ENDPOINTS
// ============================================================================

/**
 * Get all categories
 * GET /api/public/categories
 */
router.get('/categories', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name displayName description icon color statistics.wordCount')
      .sort({ order: 1 });

    // Add word counts
    const enhancedCategories = await Promise.all(
      categories.map(async (cat) => {
        const wordCount = await Vocabulary.countDocuments({ 
          category: cat.name, 
          isPublished: true 
        });
        
        return {
          ...cat.toObject(),
          wordCount,
          lessonCount: cat.statistics?.lessonCount || 0,
        };
      })
    );

    res.json({
      success: true,
      data: enhancedCategories,
      total: enhancedCategories.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get category details
 * GET /api/public/categories/:name
 */
router.get('/categories/:name', cacheMiddleware(1800), async (req, res, next) => {
  try {
    const { name } = req.params;

    const category = await Category.findOne({ 
      name: new RegExp(`^${name}$`, 'i'),
      isActive: true,
    });

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // Get popular words in this category
    const popularWords = await Vocabulary.find({ 
      category: category.name,
      isPublished: true,
    })
      .sort({ 'usage.popularity.views': -1 })
      .limit(10)
      .select('izonWord englishTranslation difficulty');

    // Get recent words
    const recentWords = await Vocabulary.find({ 
      category: category.name,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('izonWord englishTranslation createdAt');

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        popularWords,
        recentWords,
        totalWords: await Vocabulary.countDocuments({ category: category.name, isPublished: true }),
        totalLessons: await Lesson.countDocuments({ category: category.name, status: 'published' }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PROVERB ENDPOINTS
// ============================================================================

/**
 * Get proverbs
 * GET /api/public/proverbs
 */
router.get('/proverbs', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const { limit = 20, random = false, lang } = req.query;

    const queryObj = { isPublished: true };

    if (lang) {
      const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
      if (languageDoc) {
        queryObj.language_id = languageDoc._id;
      }
    }

    let query = Proverb.find(queryObj)
      .select('izon english meaning category culturalContext');

    if (random === 'true') {
      const count = await Proverb.countDocuments(queryObj);
      if (count === 0) {
        return res.json({ success: true, data: [], count: 0 });
      }
      const randomIndex = Math.floor(Math.random() * count);
      query = query.skip(randomIndex).limit(1);
    } else {
      query = query.limit(parseInt(limit)).sort({ createdAt: -1 });
    }

    const proverbs = await query;

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
 * Get proverb of the day
 * GET /api/public/proverbs/today
 */
router.get('/proverbs/today', cacheMiddleware(86400), async (req, res, next) => {
  try {
    const today = new Date().toDateString();
    const seed = parseInt(today.split('/').join('').replace(/\D/g, ''));
    
    const count = await Proverb.countDocuments({ isPublished: true });
    const index = (seed * 9301 + 49297) % count;
    
    const proverb = await Proverb.findOne({ isPublished: true })
      .skip(index)
      .select('izon english meaning culturalContext category');

    if (!proverb) {
      return next(new AppError('No proverb available', 404));
    }

    res.json({
      success: true,
      data: {
        ...proverb.toObject(),
        date: today,
        shareText: `Today's Izon proverb: ${proverb.izon} - ${proverb.english}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// STATISTICS ENDPOINT
// ============================================================================

/**
 * Get public statistics
 * GET /api/public/stats
 */
router.get('/stats', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const [
      totalWords,
      totalLessons,
      totalCategories,
      totalProverbs,
      wordsByDifficulty,
      wordsByCategory,
    ] = await Promise.all([
      Vocabulary.countDocuments({ isPublished: true }),
      Lesson.countDocuments({ status: 'published' }),
      Category.countDocuments({ isActive: true }),
      Proverb.countDocuments({ isPublished: true }),
      Vocabulary.aggregate([
        { $match: { isPublished: true } },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]),
      Vocabulary.aggregate([
        { $match: { isPublished: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalWords,
        totalLessons,
        totalCategories,
        totalProverbs,
        wordsByDifficulty: wordsByDifficulty.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        topCategories: wordsByCategory,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// FEEDBACK ENDPOINT
// ============================================================================

/**
 * Submit feedback
 * POST /api/public/feedback
 */
router.post('/feedback', async (req, res, next) => {
  try {
    const { type, content, email, metadata } = req.body;

    if (!type || !content) {
      return res.status(400).json({
        success: false,
        error: 'Type and content are required',
      });
    }

    // Log feedback
    logger.info('Public feedback received:', {
      type,
      content: content.substring(0, 100),
      email,
      metadata,
      timestamp: new Date(),
    });

    // Send notification to admins
    if (type === 'bug' || type === 'suggestion') {
      const admins = await User.find({ role: 'admin' }).select('_id');
      if (admins.length > 0) {
        await notificationService.sendToMany(admins.map(a => a._id), {
          type: 'feedback_received',
          title: `New ${type} feedback`,
          body: content.substring(0, 200),
          data: { type, content, email },
          priority: 3,
        }, { channels: ['in_app', 'email'] });
      }
    }

    res.json({
      success: true,
      message: 'Feedback received. Thank you for helping improve Izon language learning!',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get example words for a sound
 */
function getExampleWords(char, type) {
  const examples = {
    a: ['ari', 'ama'],
    e: ['emi', 'eri'],
    i: ['izi', 'ibi'],
    o: ['omo', 'oro'],
    u: ['umu', 'uku'],
    b: ['bara', 'bere'],
    d: ['duba', 'diri'],
    f: ['fini', 'fou'],
    g: ['gbani', 'gboro'],
    gb: ['gbani', 'gbara'],
    k: ['kiri', 'kala'],
    kp: ['kpaki', 'kpala'],
    m: ['mama', 'mie'],
    n: ['nana', 'nimi'],
    ny: ['nyana', 'nyim'],
    p: ['piri', 'polo'],
    r: ['ruku', 'rara'],
    s: ['sara', 'siri'],
    t: ['tari', 'timi'],
    w: ['wara', 'woni'],
    y: ['yara', 'yiri'],
    z: ['zizi', 'zana'],
  };
  
  return examples[char] || [];
}

/**
 * Find similar words for suggestions
 */
async function findSimilarWords(word) {
  const similar = await Vocabulary.find({
    izonWord: new RegExp(word, 'i'),
    isPublished: true,
  })
    .limit(5)
    .select('izonWord englishTranslation');
  
  return similar;
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return 100;
  
  // Simple character match percentage
  let matches = 0;
  for (let i = 0; i < Math.min(len1, len2); i++) {
    if (str1[i].toLowerCase() === str2[i].toLowerCase()) {
      matches++;
    }
  }
  
  return Math.round((matches / maxLen) * 100);
}

/**
 * Calculate pronunciation similarity
 */
function calculatePronunciationSimilarity(attempt, target) {
  // Simplified - would use phonetic algorithms in production
  return calculateSimilarity(attempt, target);
}

/**
 * Identify pronunciation issues
 */
function identifyPronunciationIssues(attempt, target) {
  const issues = [];
  
  if (attempt.length !== target.length) {
    issues.push('Length mismatch - word may be incomplete');
  }
  
  for (let i = 0; i < Math.min(attempt.length, target.length); i++) {
    if (attempt[i] !== target[i]) {
      issues.push(`Issue with sound '${target[i]}' - pronounced as '${attempt[i]}'`);
    }
  }
  
  return issues.slice(0, 3);
}

/**
 * Generate pronunciation tips
 */
function generatePronunciationTips(attempt, target) {
  const tips = [];
  
  if (attempt.includes('g') && target.includes('gb')) {
    tips.push('Try pronouncing "gb" as a single sound - press both lips together while saying "g"');
  }
  
  if (attempt.includes('k') && target.includes('kp')) {
    tips.push('Try pronouncing "kp" as a single sound - close your throat while saying "p"');
  }
  
  if (target.includes('ny') && !attempt.includes('ny')) {
    tips.push('For "ny", press the middle of your tongue to the roof of your mouth');
  }
  
  return tips.length > 0 ? tips : ['Keep practicing - record yourself and compare'];
}

/**
 * Track translation for analytics
 */
async function trackTranslation(text, from, to, type, confidence) {
  // In production, save to analytics database
  logger.debug('Translation tracked:', { text: text.substring(0, 50), from, to, type, confidence });
}

/**
 * Track validation for analytics
 */
async function trackValidation(izon, english, isCorrect, context) {
  // In production, save to analytics database
  logger.debug('Validation tracked:', { izon, english, isCorrect, context });
}

module.exports = router;
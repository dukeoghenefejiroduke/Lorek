const fetch = require('node-fetch'); 
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const Vocabulary = require('../models/Vocabulary');
const Translation = require('../models/Translation');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { validateApiKey } = require('../middleware/apiKey');
const { logger } = require('../config/logger');
const { cacheMiddleware } = require('../middleware/cache');
const redis = require('../config/redis');

// ============================================================================
// RATE LIMITING
// ============================================================================

const translatorLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Too many translation requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(translatorLimiter);

// ============================================================================
// PRONUNCIATION GUIDE
// ============================================================================

const PRONUNCIATION_GUIDE = {
  vowels: {
    "a": { description: "like 'a' in 'father'", ipa: "ä", audio: "/audio/vowels/a.mp3" },
    "e": { description: "like 'e' in 'bed'", ipa: "e", audio: "/audio/vowels/e.mp3" },
    "ẹ": { description: "like 'e' but with slightly rounded lips", ipa: "ɛ", audio: "/audio/vowels/e-dot.mp3" },
    "i": { description: "like 'ee' in 'see'", ipa: "i", audio: "/audio/vowels/i.mp3" },
    "ị": { description: "higher pitch than regular 'i'", ipa: "ɪ", audio: "/audio/vowels/i-dot.mp3" },
    "o": { description: "like 'o' in 'go'", ipa: "o", audio: "/audio/vowels/o.mp3" },
    "ọ": { description: "like 'o' but deeper in throat", ipa: "ɔ", audio: "/audio/vowels/o-dot.mp3" },
    "u": { description: "like 'oo' in 'food'", ipa: "u", audio: "/audio/vowels/u.mp3" },
    "ụ": { description: "like 'u' but with tension", ipa: "ʊ", audio: "/audio/vowels/u-dot.mp3" }
  },
  consonants: {
    "b": { description: "like 'b' in 'bat'", ipa: "b", audio: "/audio/consonants/b.mp3" },
    "d": { description: "like 'd' in 'dog'", ipa: "d", audio: "/audio/consonants/d.mp3" },
    "f": { description: "like 'f' in 'fish'", ipa: "f", audio: "/audio/consonants/f.mp3" },
    "g": { description: "like 'g' in 'go'", ipa: "ɡ", audio: "/audio/consonants/g.mp3" },
    "gb": { description: "simultaneous g and b sounds", ipa: "ɡ͡b", audio: "/audio/consonants/gb.mp3" },
    "gh": { description: "voiced velar fricative (like French 'r')", ipa: "ɣ", audio: "/audio/consonants/gh.mp3" },
    "h": { description: "like 'h' in 'house'", ipa: "h", audio: "/audio/consonants/h.mp3" },
    "j": { description: "like 'j' in 'judge'", ipa: "d͡ʒ", audio: "/audio/consonants/j.mp3" },
    "k": { description: "like 'k' in 'kite'", ipa: "k", audio: "/audio/consonants/k.mp3" },
    "kp": { description: "simultaneous k and p sounds", ipa: "k͡p", audio: "/audio/consonants/kp.mp3" },
    "l": { description: "like 'l' in 'love'", ipa: "l", audio: "/audio/consonants/l.mp3" },
    "m": { description: "like 'm' in 'man'", ipa: "m", audio: "/audio/consonants/m.mp3" },
    "n": { description: "like 'n' in 'no'", ipa: "n", audio: "/audio/consonants/n.mp3" },
    "ny": { description: "like 'ñ' in Spanish 'señor'", ipa: "ɲ", audio: "/audio/consonants/ny.mp3" },
    "p": { description: "like 'p' in 'pat'", ipa: "p", audio: "/audio/consonants/p.mp3" },
    "r": { description: "flapped 'r' like in Spanish", ipa: "ɾ", audio: "/audio/consonants/r.mp3" },
    "s": { description: "like 's' in 'sun'", ipa: "s", audio: "/audio/consonants/s.mp3" },
    "t": { description: "like 't' in 'top'", ipa: "t", audio: "/audio/consonants/t.mp3" },
    "v": { description: "like 'v' in 'vat'", ipa: "v", audio: "/audio/consonants/v.mp3" },
    "w": { description: "like 'w' in 'water'", ipa: "w", audio: "/audio/consonants/w.mp3" },
    "y": { description: "like 'y' in 'yes'", ipa: "j", audio: "/audio/consonants/y.mp3" },
    "z": { description: "like 'z' in 'zoo'", ipa: "z", audio: "/audio/consonants/z.mp3" }
  }
};

// Helper function to generate IPA pronunciation
function generateIPA(word) {
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
      const regex = new RegExp(sound, 'gu');
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
  if (!word) return [];
  
  // Normalize and clean punctuation
  const cleanWord = word.normalize('NFC').replace(/[.,!?;:]/g, ''); 
  // Ensure this is inside generateSyllables
   const vowels = new Set(['a', 'e', 'ẹ', 'i', 'ị', 'o', 'ọ', 'u', 'ụ', 'ɩ']);

  return cleanWord.split(' ').flatMap(w => {
    const wordSyllables = [];
    let currentSyllable = '';
    const chars = Array.from(w);
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      currentSyllable += char;
      
      // Lookahead check for combining marks/dots
      const nextChar = chars[i + 1];
      const isCombiningMark = nextChar && nextChar.match(/[\u0300-\u036f\u0323]/);
      
      if (vowels.has(char.toLowerCase()) && !isCombiningMark) {
        wordSyllables.push(currentSyllable);
        currentSyllable = '';
      }
    }
    
    if (currentSyllable) wordSyllables.push(currentSyllable);
    return wordSyllables.filter(s => s.trim() !== '');
  });
}

// Helper to safely escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize Gemini if available
let geminiClient = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiClient = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// Add this near your other helper functions
async function translateWithGroq(original, dictMap, hint) {
  const systemPrompt = `You are a translator for Kolokuma Izon.
  DICTIONARY: ${dictMap}
  
  RULES:
  1. Use ONLY the Izon words provided in the DICTIONARY.
  2. If a word is "mother->ọmọ", you MUST use "ọmọ".
  3. Word order: Subject-Object-Verb.
  4. Output ONLY the translated string. No explanations.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Translate: ${original}. Hint: ${hint}` }
        ],
        temperature: 0 // Keep it predictable
      })
    });
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim().replace(/[".]/g, '').toLowerCase();
  } catch (e) { return null; }
}


// Gemini translation function
async function translateWithGemini(text, from, to, context = {}, dictionaryContext = "") {
  if (!geminiClient) return null;
  
  try {
    const contextInstruction = dictionaryContext 
      ? `\nMandatory Vocabulary: ${dictionaryContext}` 
      : "";

    const systemPrompt = `You are a native speaker of the Izon language (Kolokuma dialect).
    RULES:
    1. WORD ORDER: Strictly Subject-Object-Verb (SOV). 
    2. DIACRITICS: Use ẹ, ọ, ị, ụ correctly. ${contextInstruction}
    3. Output ONLY the translation.`;

    const result = await geminiClient.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nTranslate: "${text}"` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    });
    
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    logger.error('[Gemini Error]:', error.message);
    return null;
  }
}

/**
 * Advanced SOV Reordering
 * Ensures Verbs move to the end and handles inflection.
 */
function applyIzonSyntax(translatedObjects) {
  // If only one word or no words, just return the word strings
  if (translatedObjects.length < 2) {
    return translatedObjects.map(obj => typeof obj === 'string' ? obj : obj.word);
  }

  // Identify verbs based on POS tag from Schema
  const verbs = translatedObjects.filter(obj => obj.pos === 'verb');
  const others = translatedObjects.filter(obj => obj.pos !== 'verb');

  if (verbs.length > 0) {
    // Take the first verb found and move it to the end
    const mainVerbObj = verbs[0];
    const mainVerb = mainVerbObj.word;
    const rest = others.map(obj => obj.word);
    
    // Add Kolokuma present continuous suffix if missing
    const inflectedVerb = mainVerb.endsWith('mí') ? mainVerb : `${mainVerb}-mí`;
    
    return [...rest, inflectedVerb];
  }

  // Fallback: If no verb (like "one two three"), keep the original order
  return translatedObjects.map(obj => obj.word);
}

/**
 * DETERMINISTIC PRE-PROCESSOR
 * Parses English structure and returns an Izon Template using SOV
 */
function preprocessEnglish(text, wordObjects) {
  const input = text.toLowerCase();
  const isNegative = input.includes("not") || input.includes("don't");
  const isQuestion = text.trim().endsWith("?");
  
  // 1. Categorize parts of the sentence
  // We prioritize tagged verbs. If no verb is found, we assume the last word isn't a verb
  // unless it's a very simple sentence.
  const subject = wordObjects.find(o => o.pos === 'noun' || o.pos === 'pronoun') || wordObjects[0];
  const verb = wordObjects.find(o => o.pos === 'verb');
  
  // Numbers in Izon usually follow the noun (e.g., "Lizard two" not "Two lizard")
  const numbers = wordObjects.filter(o => o.pos === 'number' || o.pos === 'numeral');
  
  // Objects are everything else that isn't the subject, the verb, or a number
  const objects = wordObjects.filter(o => 
    o !== subject && 
    o !== verb && 
    !numbers.includes(o)
  );

  let izonParts = [];

  // 2. Build the Izon Structure: [Subject] [Objects] [Numbers] [Verb]
  if (subject) izonParts.push(subject.word);
  
  // Add Objects (Direct/Indirect)
  objects.forEach(obj => {
    izonParts.push(obj.word);
  });

  // Apply Post-positional Numbering (Linguistically accurate for Kolokuma)
  numbers.forEach(num => {
    izonParts.push(num.word);
  });
  
  if (verb) {
    let v = verb.word;
    // Apply Negation (ghá)
    if (isNegative) v = v.endsWith(' ghá') ? v : `${v} ghá`; 
    // Apply Question marker (yee)
    if (isQuestion) v = `${v} yee`;
    izonParts.push(v);
  }

  // 3. Final Clean-up: Remove any structural duplicates and join
  // This prevents the "abedí mami abedí" error if a word was double-categorized
  const finalResult = [];
  const seenWords = new Set();
  
  for (const word of izonParts) {
    if (!seenWords.has(word)) {
      finalResult.push(word);
      seenWords.add(word);
    }
  }

  return finalResult.join(' ');
}



async function handleTranslationLogic(params, currentUser = null) {
  const { text, from = 'en', to = 'izon', lang } = params;
  const input = text.trim().normalize('NFC');

  let languageId = null;
  if (lang) {
    const Language = mongoose.model('Language');
    const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
    if (languageDoc) languageId = languageDoc._id;
  }
  
  // 1. Tokenize
  const rawWords = input.toLowerCase().replace(/[.,!?;:]/g, '').split(' ');
  const wordObjects = [];
  
  // 2. PHASED LOOKUP (Check for phrases first)
  for (let i = 0; i < rawWords.length; i++) {
    const current = rawWords[i];
    const next = rawWords[i + 1];
    const phrase = next ? `${current} ${next}` : null;
    const phraseLemma = phrase ? phrase.replace(/s$/, '').replace(/es$/, '') : null;

    let entry = null;

    // A. Check for 2-word phrase (e.g., "monitor lizard")
    if (phrase) {
      const phraseQuery = {
        $or: [
          { englishTranslation: new RegExp(`^${phrase}$`, 'i') },
          { englishTranslation: new RegExp(`^${phraseLemma}$`, 'i') }
        ],
        isPublished: true,
        isActive: true
      };
      if (languageId) phraseQuery.language_id = languageId;
      
      entry = await Vocabulary.findOne(phraseQuery).select('izonWord grammar.partOfSpeech').lean();
    }

    if (entry) {
      wordObjects.push({
        word: entry.izonWord,
        pos: entry.grammar?.partOfSpeech || 'noun',
        isFound: true,
        original: phrase
      });
      i++; // Skip the next word since we matched the pair
    } else {
      // B. Fallback to single word lookup
      const lemma = current.replace(/es$/, '').replace(/s$/, '').replace(/ing$/, '');
      const wordQuery = {
        $or: [
          { englishTranslation: new RegExp(`^${current}$`, 'i') },
          { englishTranslation: new RegExp(`^${lemma}$`, 'i') }
        ],
        isPublished: true,
        isActive: true
      };
      if (languageId) wordQuery.language_id = languageId;

      const singleEntry = await Vocabulary.findOne(wordQuery).select('izonWord grammar.partOfSpeech').lean();


      wordObjects.push({
        word: singleEntry ? singleEntry.izonWord : current,
        pos: singleEntry?.grammar?.partOfSpeech || 'unknown',
        isFound: !!singleEntry,
        original: current
      });
    }
  }

  // 3. GRAMMAR BUILDER (SOV Enforcement)
  const deterministicHint = preprocessEnglish(input, wordObjects);

  // 4. AI REFINE (Groq)
  const dictMap = wordObjects.filter(o => o.isFound).map(o => `${o.original}->${o.word}`).join(',');
  let aiSuggestion = await translateWithGroq(input, dictMap, deterministicHint);
  
  // 5. FINAL OUTPUT (The "No English" Filter)
  const containsEnglish = wordObjects
    .filter(o => !o.isFound && o.original.length > 2)
    .some(o => aiSuggestion?.toLowerCase().includes(o.original));
  
  // Check if AI kept untranslated English words that ARE in our wordObjects
  const aiIsHallucinating = containsEnglish || !aiSuggestion;
  
  const finalOutput = aiIsHallucinating ? deterministicHint : aiSuggestion;

  let resultData = {
    original: input,
    translated: finalOutput,
    type: aiIsHallucinating ? 'grammar_builder_enforced' : 'groq_refined'
  };

  if (to === 'izon') {
    resultData.pronunciation = {
      ipa: generateIPA(resultData.translated),
      syllables: generateSyllables(resultData.translated)
    };
  }

  return resultData;
}

// ============================================================================
// TRANSLATE ENDPOINT
// ============================================================================

/**
 * Translate text
 * POST /api/translator/translate
 */

router.post('/translate', [
  body('text').trim().notEmpty().withMessage('Text is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await handleTranslationLogic(req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});


// ============================================================================
// TRANSLATE GET ENDPOINT (for query params)
// ============================================================================

/**
 * Translate text using query parameters
 * GET /api/translator/translate?text=hello&from=en&to=izon
 */
router.get('/translate', async (req, res, next) => {
  try {
    if (!req.query.text) return next(new AppError('Text required', 400));

    // Passing req.user here is safe; it will be null if not logged in
    const result = await handleTranslationLogic(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DETECT LANGUAGE
// ============================================================================

/**
 * Detect language of text
 * POST /api/translator/detect
 */
router.post('/detect', [
  body('text').trim().notEmpty().withMessage('Text is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { text } = req.body;
    const input = text.trim();
    
    // Simple language detection
    // Check if text contains Izon characters or common Izon words
    const izonChars = /[ẹọịụgbkpny]/i;
    const commonIzonWords = ['adú', 'fin', 'agá', 'tari', 'aua', 'duba', 'emi', 'bere'];
    
    let detectedLanguage = 'en';
    let confidence = 0;
    
    if (izonChars.test(input)) {
      detectedLanguage = 'izon';
      confidence = 0.8;
    } else {
      // Check for common Izon words
      for (const word of commonIzonWords) {
        if (input.toLowerCase().includes(word)) {
          detectedLanguage = 'izon';
          confidence = 0.6;
          break;
        }
      }
    }
    
    // Use Gemini for better detection if available
    if (geminiClient && input.length > 10) {
      try {
        const result = await geminiClient.generateContent({
          contents: [{ role: 'user', parts: [{ text: `Detect the language of this text. Answer with only "en" or "izon": "${input}"` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
        });
        const response = await result.response;
        const geminiResult = response.text().trim().toLowerCase();
        if (geminiResult === 'izon' || geminiResult === 'en') {
          detectedLanguage = geminiResult;
          confidence = 0.9;
        }
      } catch (err) {
        logger.error('Gemini language detection failed:', err);
      }
    }

    res.json({
      success: true,
      data: {
        text: input,
        language: detectedLanguage,
        confidence: confidence,
        isIzon: detectedLanguage === 'izon',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// SAVE TRANSLATION
// ============================================================================

// Helper to get language ID by code
async function getLanguageIdByCode(code) {
  const cacheKey = `lang_id:${code.toUpperCase()}`;
  let id = await redis.get(cacheKey);
  if (id) return id;

  const Language = mongoose.model('Language');
  const lang = await Language.findOne({ code: code.toUpperCase() });
  if (lang) {
    await redis.set(cacheKey, lang._id.toString(), 'EX', 86400); // Cache for 24h
    return lang._id;
  }
  return null;
}

/**
 * Save translation to history
 * POST /api/translator/translations
 */
router.post('/translations', auth, [
  body('original').trim().notEmpty().withMessage('Original text is required'),
  body('translated').trim().notEmpty().withMessage('Translated text is required'),
  body('direction').optional().isIn(['en_to_izon', 'izon_to_en']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { original, translated, direction, confidence, pronunciation } = req.body;
    
    const sourceCode = direction === 'en_to_izon' ? 'en' : 'izon';
    const targetCode = direction === 'en_to_izon' ? 'izon' : 'en';

    const [sourceLanguageId, targetLanguageId] = await Promise.all([
      getLanguageIdByCode(sourceCode),
      getLanguageIdByCode(targetCode)
    ]);

    if (!sourceLanguageId || !targetLanguageId) {
      return next(new AppError('Invalid language configuration', 400));
    }

    const TranslationModel = mongoose.model('Translation');
    const translation = new TranslationModel({
      user: req.user._id,
      sourceText: original,
      targetText: translated,
      sourceLanguageId,
      targetLanguageId,
      translationType: 'saved',
      confidence: confidence || 'medium',
      pronunciation: pronunciation,
    });
    
    await translation.save();

    res.json({
      success: true,
      data: translation,
      message: 'Translation saved successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET TRANSLATION HISTORY
// ============================================================================

/**
 * Get user's translation history
 * GET /api/translator/translations
 */
router.get('/translations', auth, async (req, res, next) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const Translation = mongoose.model('Translation');
    
    const [translations, total] = await Promise.all([
      Translation.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Translation.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      success: true,
      data: translations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET FAVORITE TRANSLATIONS
// ============================================================================

/**
 * Get user's favorite translations
 * GET /api/translator/translations/favorites
 */
router.get('/translations/favorites', auth, async (req, res, next) => {
  try {
    const Translation = mongoose.model('Translation');
    
    const favorites = await Translation.find({ 
      user: req.user._id,
      isFavorite: true,
    }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: favorites,
      count: favorites.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TOGGLE FAVORITE
// ============================================================================

/**
 * Toggle favorite status of a translation
 * PUT /api/translator/translations/:id/favorite
 */
router.put('/translations/:id/favorite', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const Translation = mongoose.model('Translation');
    
    const translation = await Translation.findOne({ _id: id, user: req.user._id });
    
    if (!translation) {
      return res.status(404).json({
        success: false,
        error: 'Translation not found',
      });
    }
    
    translation.isFavorite = !translation.isFavorite;
    await translation.save();

    res.json({
      success: true,
      data: {
        isFavorite: translation.isFavorite,
      },
      message: translation.isFavorite ? 'Added to favorites' : 'Removed from favorites',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE TRANSLATION
// ============================================================================

/**
 * Delete a translation from history
 * DELETE /api/translator/translations/:id
 */
router.delete('/translations/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const Translation = mongoose.model('Translation');
    
    const translation = await Translation.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!translation) {
      return res.status(404).json({
        success: false,
        error: 'Translation not found',
      });
    }

    res.json({
      success: true,
      message: 'Translation deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET OFFLINE PACK
// ============================================================================

/**
 * Get offline translation pack
 * GET /api/translator/translations/offline-pack
 */
router.get('/translations/offline-pack', cacheMiddleware(86400), async (req, res, next) => {
  const cachedPack = await redis.get('offline-pack');
   if (cachedPack) {
    return res.json({ success: true, data: JSON.parse(cachedPack), _cached: true });
  }
  try {
    // Get most common words for offline use
    const commonWords = await Vocabulary.find({ 
      isPublished: true,
      difficulty: { $in: ['beginner', 'intermediate'] },
    })
      .limit(500)
      .select('izonWord englishTranslation pronunciation category difficulty');

    // Get common phrases
    const commonPhrases = [
      { izon: "Aua", english: "Greetings / Hello" },
      { izon: "I bini duba?", english: "How are you?" },
      { izon: "E duba emi", english: "I am fine" },
      { izon: "Ye nua", english: "Thank you" },
      { izon: "Bara", english: "Please" },
      { izon: "Ere", english: "Yes" },
      { izon: "Owu", english: "No" },
      { izon: "Agá", english: "Go" },
      { izon: "Bie", english: "Come" },
      { izon: "Tari be", english: "Eat food" },
    ];

    // Create offline pack
    const offlinePack = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      vocabulary: commonWords.map(w => ({
        izon: w.izonWord,
        english: w.englishTranslation,
        pronunciation: w.pronunciation,
        category: w.category,
      })),
      phrases: commonPhrases,
      pronunciationGuide: PRONUNCIATION_GUIDE,
    };
    
  // Cache in Redis
  await redis.set('offline-pack', JSON.stringify(offlinePack), 'EX', 86400);

    res.json({
      success: true,
      data: offlinePack,
      size: JSON.stringify(offlinePack).length,
      wordCount: commonWords.length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CLEAR TRANSLATION HISTORY
// ============================================================================

/**
 * Clear all translation history
 * DELETE /api/translator/translations/clear
 */
router.delete('/translations/clear', auth, async (req, res, next) => {
  try {
    const Translation = mongoose.model('Translation');
    
    const result = await Translation.deleteMany({ user: req.user._id });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} translations`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Track translation for analytics
 */
async function trackTranslation(text, from, to, type, confidence) {
  try {
    // In production, save to analytics database
    logger.debug('Translation tracked:', {
      text: text.substring(0, 50),
      from,
      to,
      type,
      confidence,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to track translation:', error);
  }
}

async function saveToHistory(userId, data, from, to) {
  try {
    const [sourceLanguageId, targetLanguageId] = await Promise.all([
      getLanguageIdByCode(from),
      getLanguageIdByCode(to)
    ]);

    if (!sourceLanguageId || !targetLanguageId) {
      logger.error('History save failed: Invalid language configuration', { from, to });
      return;
    }

    const TranslationModel = mongoose.model('Translation');
    await TranslationModel.findOneAndUpdate(
      { 
        user: userId, 
        sourceText: data.original, 
        sourceLanguageId: sourceLanguageId 
      },
      { 
        $set: { 
          targetText: data.translated, 
          targetLanguageId: targetLanguageId,
          translationType: data.type,
          lastUsedAt: new Date() 
        },
        $inc: { usageCount: 1 } 
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    logger.error('History save failed', err);
  }
}

module.exports = router;
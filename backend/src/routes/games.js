const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { contentLimiter } = require('../middleware/rateLimit');
const { body, param, query, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const GameSession = require('../models/GameSession');
const User = require('../models/User');
const Vocabulary = require('../models/Vocabulary');
const Language = require('../models/Language');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const redis = require('../config/redis');

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(contentLimiter);
router.use(auth);

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const GAME_TYPES = {
  MATCH: 'match',
  SPELLING: 'spelling',
  QUIZ: 'quiz',
  WORD_SEARCH: 'word_search',
  FLASHCARDS: 'flashcards',
  HANGMAN: 'hangman',
};

const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

// Game configurations
const GAME_CONFIG = {
  [GAME_TYPES.MATCH]: {
    name: 'Match the Words',
    icon: '🎯',
    defaultQuestions: 4,
    pointsPerCorrect: 10,
    timeLimit: 60,
  },
  [GAME_TYPES.SPELLING]: {
    name: 'Spelling Bee',
    icon: '🐝',
    defaultQuestions: 5,
    pointsPerCorrect: 10,
    timeLimit: 90,
  },
  [GAME_TYPES.QUIZ]: {
    name: 'Quick Quiz',
    icon: '⚡',
    defaultQuestions: 10,
    pointsPerCorrect: 10,
    timeLimit: 120,
  },
  [GAME_TYPES.WORD_SEARCH]: {
    name: 'Word Search',
    icon: '🔍',
    defaultQuestions: 1,
    pointsPerCorrect: 50,
    timeLimit: 180,
  },
  [GAME_TYPES.FLASHCARDS]: {
    name: 'Flashcards',
    icon: '🃏',
    defaultQuestions: 20,
    pointsPerCorrect: 5,
    timeLimit: 300,
  },
  [GAME_TYPES.HANGMAN]: {
    name: 'Hangman',
    icon: '🔤',
    defaultQuestions: 5,
    pointsPerCorrect: 20,
    timeLimit: 120,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get random words for games
 */
async function getRandomWords(count = 10, difficulty = null, language = null) {
  const filter = { isPublished: true, isActive: true };
  if (difficulty) filter.difficulty = difficulty;
  
  if (language) {
    if (mongoose.Types.ObjectId.isValid(language)) {
      filter.language_id = language;
    } else {
      const langDoc = await Language.findOne({ code: language.toUpperCase() });
      if (langDoc) {
        filter.language_id = langDoc._id;
      }
    }
  }

  // 1. Fetch only the IDs first (very light on memory)
  const allWords = await Vocabulary.find(filter).select('_id');
  
  if (!allWords.length) {
    // Fallback: If no words found for specific language, try without language filter
    delete filter.language_id;
    const fallbackWords = await Vocabulary.find(filter).select('_id');
    if (!fallbackWords.length) return [];
    
    const shuffledIds = fallbackWords
      .sort(() => 0.5 - Math.random())
      .slice(0, count)
      .map(doc => doc._id);

    return await Vocabulary.find({ _id: { $in: shuffledIds } })
      .select('izonWord englishTranslation category difficulty pronunciation')
      .lean();
  }

  // 2. Shuffle and pick random IDs
  const shuffledIds = allWords
    .sort(() => 0.5 - Math.random())
    .slice(0, count)
    .map(doc => doc._id);

  // 3. Fetch the full documents for those IDs
  return await Vocabulary.find({ _id: { $in: shuffledIds } })
    .select('izonWord englishTranslation category difficulty pronunciation')
    .lean();
}


/**
 * Generate match game questions
 */
async function generateMatchGameQuestions(count = 4, difficulty = null, language = null) {
  const words = await getRandomWords(count, difficulty, language);
  
  const questions = words.map(word => ({
    id: word._id,
    izon: word.izonWord,
    english: word.englishTranslation,
    category: word.category,
    difficulty: word.difficulty,
  }));

  return questions;
}

/**
 * Generate spelling bee questions
 */
async function generateSpellingQuestions(count = 5, difficulty = null, language = null) {
  const words = await getRandomWords(count, difficulty, language);
  
  if (!words.length) return []; // Safety check

  return words.map(word => ({
    id: word._id,
    izonWord: word.izonWord,
    englishTranslation: word.englishTranslation,
    pronunciation: word.pronunciation,
  }));
}


/**
 * Generate quiz questions
 */
async function generateQuizQuestions(count = 10, difficulty = null, language = null) {
  const words = await getRandomWords(count, difficulty, language);
  
  const questions = words.map(word => {
    // Generate distractors
    const distractors = generateDistractors(word.englishTranslation, words);
    
    return {
      id: word._id,
      question: `What does "${word.izonWord}" mean?`,
      correctAnswer: word.englishTranslation,
      options: [word.englishTranslation, ...distractors].sort(() => Math.random() - 0.5),
      category: word.category,
      difficulty: word.difficulty,
    };
  });

  return questions;
}

/**
 * Generate distractors for quiz
 */
function generateDistractors(correctAnswer, allWords, count = 3) {
  const distractors = new Set();
  const otherWords = allWords.filter(w => w.englishTranslation !== correctAnswer);
  
  for (let i = 0; i < count && i < otherWords.length; i++) {
    const randomIndex = Math.floor(Math.random() * otherWords.length);
    distractors.add(otherWords[randomIndex].englishTranslation);
  }
  
  return Array.from(distractors);
}

/**
 * Calculate experience points earned
 */
function calculateExpEarned(score, maxScore, timeSpent, timeLimit) {
  let exp = Math.floor((score / maxScore) * 50);
  
  // Time bonus
  const timeBonus = Math.max(0, Math.floor((timeLimit - timeSpent) / 10) * 5);
  exp += Math.min(30, timeBonus);
  
  // Perfect score bonus
  if (score === maxScore) {
    exp += 25;
  }
  
  return Math.min(100, exp);
}

// ============================================================================
// GET GAME SESSION
// ============================================================================

/**
 * Start a new game session
 * POST /api/games/start
 */
router.post('/start', [
  body('gameType').isIn(['match','spelling','quiz','word_search','flashcards','hangman']),
  body('questionCount').optional().isInt({ min: 3, max: 20 }),
  body('lang').optional().isString(), // Support 'lang' for consistency
], async (req, res, next) => {
  try {
    const { gameType, questionCount = 5, lang, language } = req.body;
    const langCode = lang || language;

    let languageId = null;
    if (langCode) {
      const languageDoc = await Language.findOne({ code: langCode.toUpperCase() });
      if (languageDoc) {
        languageId = languageDoc._id;
      }
    }

    let questions = [];
    let maxScore = 0;

    switch (gameType) {
     case 'match':
       const matchWords = await getRandomWords(questionCount, null, languageId);
       questions = matchWords.map(w => ({
         questionId: w._id.toString(),
         questionData: { izon: w.izonWord, english: w.englishTranslation } 
        }));
      maxScore = questionCount * 10;
      break;
      
      case 'spelling':
        const spellWords = await getRandomWords(questionCount, null, languageId);
        questions = spellWords.map(w => ({
          questionId: w._id,
          questionData: { 
            izon: w.izonWord, 
            english: w.englishTranslation 
          },
          izonWord: w.izonWord, 
          englishTranslation: w.englishTranslation,
        }));
        maxScore = questionCount * 10;
        break;
  
      case 'quiz':
        const quizWords = await getRandomWords(questionCount * 2, null, languageId);
        questions = quizWords.slice(0, questionCount).map(w => ({
          questionId: w._id,
          questionData: {
            question: `What does "${w.izonWord}" mean?`,
            correctAnswer: w.englishTranslation,
            options: [w.englishTranslation, ...quizWords
              .filter(x => x._id !== w._id)
              .slice(0, 3)
              .map(x => x.englishTranslation)
            ].sort(() => Math.random() - 0.5)
          }
        }));
        maxScore = questionCount * 10;
        break;

      case 'flashcards':
        const flashWords = await getRandomWords(questionCount, null, languageId);
        questions = flashWords.map(w => ({
          questionId: w._id.toString(),
          questionData: { 
            izon: w.izonWord, 
            english: w.englishTranslation 
          },
          izonWord: w.izonWord,
          englishTranslation: w.englishTranslation
        }));
        maxScore = questionCount * 5;
        break;

      case 'hangman':
        const hangWords = await getRandomWords(questionCount, null, languageId);
        questions = hangWords.map(w => ({
          questionId: w._id.toString(),
          questionData: { 
            izon: w.izonWord, 
            english: w.englishTranslation,
            correctAnswer: w.izonWord
          },
          izonWord: w.izonWord,
          englishTranslation: w.englishTranslation
        }));
        maxScore = questionCount * 10;
        break;

      case 'word_search':
        const searchWords = await getRandomWords(8, null, languageId);
        questions = searchWords;
        maxScore = 50;
        break;

      default:
        throw new AppError('Invalid game type', 400);
    }

    const session = new GameSession({
      user: req.user._id,
      gameType,
      questions,
      maxScore,
      startedAt: new Date(),
    });

    await session.save();

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        questions,
        maxScore,
      }
    });

  } catch (err) {
    next(err);
  }
});


// ============================================================================
// SUBMIT GAME RESULT
// ============================================================================

/**
 * Submit game result
 * POST /api/games/submit
 */
router.post('/submit', [
  body('sessionId').isMongoId().withMessage('Invalid session ID'),
  body('answers').isArray().withMessage('Answers must be an array'),
  body('timeSpent').isInt({ min: 0 }).withMessage('Time spent must be a positive number'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { sessionId, answers, timeSpent } = req.body;

    const session = await GameSession.findOne({ _id: sessionId, user: req.user._id });
    if (!session) {
      throw new AppError('Game session not found', 404);
    }

    if (session.completed) {
      throw new AppError('Game session already completed', 400);
    }

    // Calculate score
    let totalScore = 0;
    const processedAnswers = [];
   
for (let i = 0; i < session.questions.length; i++) {
  const question = session.questions[i];
  
  // CHANGE THIS: Use questionId (the Vocabulary ID) instead of the subdoc _id
  const storedId = (question.questionId || question.id || question._id).toString();
  
  const userAnswer = answers.find(a => {
    const submittedId = a.questionId || a.id;
    return submittedId && submittedId.toString() === storedId;
  });
  
if (userAnswer) {
  let isCorrect = false;
  
  switch (session.gameType) {
    case 'spelling':
      isCorrect = checkSpellingAnswer(question, userAnswer.answer);
      break;
    case 'match':
      isCorrect = checkMatchAnswer(question, userAnswer.answer);
      break;
    case 'quiz':
      isCorrect = checkQuizAnswer(question, userAnswer.answer);
      break;
    case 'hangman':
      isCorrect = checkHangmanAnswer(question, userAnswer.answer);
      break;

    case 'flashcards':
    // If frontend sends isCorrect: true, or if testing via curl with the word
    isCorrect = userAnswer.isCorrect === true || 
              userAnswer.answer === 'known' || 
              checkFlashcardAnswer(question, userAnswer.answer) ||
              (userAnswer.answer === (question.izonWord || question.questionData?.izon));
  break;

  }

  // Debug log to see why it fails in Termux console

  if (isCorrect) {
    const points = 10; 
    totalScore += points;
    
    processedAnswers.push({
      questionId: storedId,
      userAnswer: userAnswer.answer,
      isCorrect: true,
      score: points,
    });
  }
}
}
    // Calculate percentage
    const percentage = (totalScore / session.maxScore) * 100;

    // Update session
    session.answers = processedAnswers;
    session.score = totalScore;
    session.percentage = percentage;
    session.timeSpent = timeSpent;
    session.completed = true;
    session.completedAt = new Date();
    await session.save();

    // Update user stats
    const user = await User.findById(req.user._id);
    
    // Add points
    const pointsEarned = totalScore;
    user.progress.totalPoints += pointsEarned;
    user.gamification.points.total += pointsEarned;
    user.gamification.points.history.push({
      amount: pointsEarned,
      reason: `game_${session.gameType}`,
      timestamp: new Date(),
    });

    // Add experience
    const expEarned = calculateExpEarned(totalScore, session.maxScore, timeSpent, session.timeLimit);
    user.gamification.experience += expEarned;
    user.updateLevel();

    // Update game stats
    if (!user.gamification.gameStats) {
      user.gamification.gameStats = {};
    }
    if (!user.gamification.gameStats[session.gameType]) {
      user.gamification.gameStats[session.gameType] = {
        played: 0,
        wins: 0,
        totalScore: 0,
        bestScore: 0,
      };
    }

    const gameStat = user.gamification.gameStats[session.gameType];
    gameStat.played += 1;
    if (percentage >= 70) gameStat.wins += 1;
    gameStat.totalScore += totalScore;
    gameStat.bestScore = Math.max(gameStat.bestScore, totalScore);

    await user.save();

    // Check for achievements
    const achievements = await checkGameAchievements(user, session, percentage);

    // Send notifications for achievements
    for (const achievement of achievements) {
      await notificationService.sendAchievementUnlocked(req.user._id, achievement);
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        score: totalScore,
        maxScore: session.maxScore,
        percentage: Math.round(percentage),
        timeSpent,
        pointsEarned,
        expEarned,
        answers: processedAnswers,
        achievements,
        passed: percentage >= 70,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET GAME STATISTICS
// ============================================================================

/**
 * Get user's game statistics
 * GET /api/games/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    // 1. Get total games count (Supported)
    const totalGamesPlayed = await GameSession.countDocuments({ 
      user: req.user._id, 
      completed: true 
    });

    // 2. Get sessions for win rate calculation
    // Avoid $avg in aggregation; just fetch the percentages
    const sessions = await GameSession.find({ 
      user: req.user._id, 
      completed: true 
    }).select('percentage score gameType');

    const totalWins = sessions.filter(s => s.percentage >= 70).length;
    const totalScore = sessions.reduce((acc, s) => acc + (s.score || 0), 0);
    
    // 3. Get Recent Sessions (Supported)
    const recentSessions = await GameSession.find({ user: req.user._id, completed: true })
      .sort({ completedAt: -1 })
      .limit(10);

    // 4. Get best scores per game type manually
    const byGame = {};
    sessions.forEach(s => {
      if (!byGame[s.gameType] || s.score > byGame[s.gameType].bestScore) {
        byGame[s.gameType] = {
          played: (byGame[s.gameType]?.played || 0) + 1,
          bestScore: s.score
        };
      }
    });

    res.json({
      success: true,
      data: {
        byGame,
        overall: {
          totalGamesPlayed,
          totalWins,
          winRate: totalGamesPlayed > 0 ? Math.round((totalWins / totalGamesPlayed) * 100) : 0,
          totalScore,
        },
        recentSessions
      }
    });
  } catch (err) {
    next(err);
  }
});


// ============================================================================
// GET LEADERBOARD FOR GAME
// ============================================================================

/**
 * Get leaderboard for specific game
 * GET /api/games/leaderboard/:gameType
 */

router.get('/leaderboard/:gameType', [
  param('gameType').isIn(Object.values(GAME_TYPES)),
], async (req, res, next) => {
  try {
    const { gameType } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // cap for safety

    // Step 1: Get all completed sessions for this game type (FerretDB friendly)
    const sessions = await GameSession.find({
      gameType,
      completed: true
    })
      .select('user score percentage completedAt')
      .lean();   // faster + plain objects

    if (sessions.length === 0) {
      return res.json({
        success: true,
        data: { leaderboard: [], userRank: null, gameType }
      });
    }

    // Step 2: Group and find best score per user in JavaScript (no $max needed)
    const userStats = {};

    for (const session of sessions) {
      const userId = session.user.toString();

      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          bestScore: session.score,
          bestPercentage: session.percentage,
          totalGames: 1,
          lastPlayed: session.completedAt
        };
      } else {
        // Update best score
        if (session.score > userStats[userId].bestScore) {
          userStats[userId].bestScore = session.score;
          userStats[userId].bestPercentage = session.percentage;
        }
        userStats[userId].totalGames += 1;
        // Optional: keep most recent play
        if (session.completedAt > userStats[userId].lastPlayed) {
          userStats[userId].lastPlayed = session.completedAt;
        }
      }
    }

    // Step 3: Convert to array and sort by bestScore descending
    let leaderboard = Object.values(userStats)
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, limit);

    // Step 4: Populate user details (username + avatar)
    leaderboard = await Promise.all(
      leaderboard.map(async (entry) => {
        const user = await User.findById(entry.userId)
          .select('username profile.avatar.thumbnail')
          .lean();

        return {
          userId: entry.userId,
          username: user?.username || 'Unknown',
          avatar: user?.profile?.avatar?.thumbnail || null,
          bestScore: entry.bestScore,
          totalGames: entry.totalGames,
          bestPercentage: Math.round(entry.bestPercentage || 0),
        };
      })
    );

    // Step 5: Find current user's rank
    let userRank = null;
    const userIndex = leaderboard.findIndex(l => l.userId.toString() === req.user._id.toString());

    if (userIndex !== -1) {
      userRank = {
        rank: userIndex + 1,
        ...leaderboard[userIndex]
      };
    } else {
      // Optional: If user has played but not in top N, you can calculate their rank separately
      // For now we leave it null (common behavior)
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        userRank,
        gameType,
        totalPlayers: Object.keys(userStats).length
      }
    });

  } catch (err) {
    next(err);
  }
});


// ============================================================================
// GET GAME HISTORY
// ============================================================================

/**
 * Get user's game history
 * GET /api/games/history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, gameType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { user: req.user._id, completed: true };
    if (gameType) query.gameType = gameType;

    const [sessions, total] = await Promise.all([
      GameSession.find(query)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      GameSession.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: sessions,
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
// GET AVAILABLE WORDS FOR WORD SEARCH
// ============================================================================

/**
 * Get words for word search game
 * GET /api/games/words
 */
router.get('/words', async (req, res, next) => {
  try {
    const { count = 10, category, difficulty, lang } = req.query;
    const filter = { isPublished: true, isActive: true };
    
    if (lang) {
      const languageDoc = await Language.findOne({ code: lang.toUpperCase() });
      if (languageDoc) {
        filter.language_id = languageDoc._id;
      }
    }

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;

    const allWords = await Vocabulary.find(filter).select('_id');
    const shuffledIds = allWords
      .sort(() => 0.5 - Math.random())
      .slice(0, parseInt(count))
      .map(doc => doc._id);

    const words = await Vocabulary.find({ _id: { $in: shuffledIds } })
      .select('izonWord englishTranslation')
      .lean();

    res.json({ success: true, data: words, count: words.length });
  } catch (err) {
    next(err);
  }
});


// ============================================================================
// HELPER FUNCTIONS FOR ANSWER CHECKING
// ============================================================================
function checkMatchAnswer(question, answer) {
  const data = question.questionData || question;
  return data.izon === answer || data.english === answer;
}

function checkSpellingAnswer(question, answer) {
  // Based on your curl, it's inside questionData.izon OR izonWord
  const target = question.izonWord || question.questionData?.izon;
  if (!target || !answer) return false;
  return target.toLowerCase().trim() === answer.toLowerCase().trim();
}

function checkQuizAnswer(question, answer) {
  const data = question.questionData || question;
  // answer might be the string value or the index. 
  // If frontend sends index, compare to options[answer]
  if (typeof answer === 'number') {
    return data.options[answer] === data.correctAnswer;
  }
  return data.correctAnswer === answer;
}

function checkWordSearchAnswer(question, answer) {
  return question.izonWord?.toLowerCase() === answer?.toLowerCase();
}

function checkHangmanAnswer(question, answer) {
  const target = question.izonWord || question.questionData?.izon;
  return target?.toLowerCase() === answer?.toLowerCase();
}

function checkFlashcardAnswer(question, answer) {
  const data = question.questionData || question;
  const targetIzon = (data.izon || data.izonWord)?.toLowerCase().trim();
  const targetEnglish = (data.english || data.englishTranslation)?.toLowerCase().trim();
  const userAns = answer?.toLowerCase().trim();

  // Return true if it matches either side (useful for testing)
  return userAns === targetIzon || userAns === targetEnglish;
}

/**
 * Generate a simple word search grid
 */
function generateWordSearchGrid(words, size = 12) {
  // Simplified grid generation - in production, implement proper word search algorithm
  const grid = Array(size).fill().map(() => Array(size).fill(''));
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      grid[i][j] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
  }
  
  return grid;
}

/**
 * Check game achievements
 */
async function checkGameAchievements(user, session, percentage) {
  const achievements = [];
  const gameStats = user.gamification?.gameStats || {};
  
  // First win
  if (percentage >= 70) {
    const gameTypeStat = gameStats[session.gameType];
    if (gameTypeStat?.played === 1 && gameTypeStat?.wins === 1) {
      achievements.push({
        type: 'achievement',
        name: `${GAME_CONFIG[session.gameType]?.name} Winner`,
        description: `Won your first game of ${GAME_CONFIG[session.gameType]?.name}`,
        icon: '🏆',
      });
    }
  }
  
  // Perfect score
  if (percentage === 100) {
    achievements.push({
      type: 'badge',
      name: 'Perfect Score',
      description: `Achieved a perfect score in ${GAME_CONFIG[session.gameType]?.name}`,
      icon: '💯',
      tier: 'gold',
    });
  }
  
  // Master of all games
  const allGamesPlayed = Object.keys(gameStats).length === Object.keys(GAME_CONFIG).length;
  if (allGamesPlayed && gameStats[session.gameType]?.played === 1) {
    const allWon = Object.values(gameStats).every(stat => stat.wins > 0);
    if (allWon) {
      achievements.push({
        type: 'badge',
        name: 'Game Master',
        description: 'Won at least one game of every type',
        icon: '👑',
        tier: 'platinum',
      });
    }
  }
  
  return achievements;
}

module.exports = router;
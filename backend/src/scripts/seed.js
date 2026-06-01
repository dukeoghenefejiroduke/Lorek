require('dotenv').config();
const mongoose = require('mongoose');
const Vocabulary = require('../models/Vocabulary');
const Lesson = require('../models/Lesson');
const Category = require('../models/Category');
const User = require('../models/User');
const Language = require('../models/Language');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  CLEAR_EXISTING: process.argv.includes('--clear') || process.argv.includes('-c'),
  CREATE_ADMIN: process.argv.includes('--admin') || process.argv.includes('-a'),
  VERBOSE: process.argv.includes('--verbose') || process.argv.includes('-v'),
  DRY_RUN: process.argv.includes('--dry-run') || process.argv.includes('-d'),
  UPSERT: process.argv.includes('--upsert') || process.argv.includes('-u'),
};

let ADMIN_USER_ID = null;

// ============================================================================
// SEED DATA
// ============================================================================

const categories = [
  { name: 'nature', displayName: { english: 'Nature', izon: 'Teme' }, icon: '🌿', color: '#4CAF50', order: 1 },
  { name: 'actions', displayName: { english: 'Verbs', izon: 'Agá' }, icon: '🏃', color: '#2196F3', order: 2 },
  { name: 'food', displayName: { english: 'Food', izon: 'Tari' }, icon: '🍲', color: '#FF9800', order: 3 },
  { name: 'greetings', displayName: { english: 'Greetings', izon: 'Aua' }, icon: '👋', color: '#9C27B0', order: 4 },
  { name: 'family', displayName: { english: 'Family', izon: 'Wari' }, icon: '👪', color: '#E91E63', order: 5 },
  { name: 'numbers', displayName: { english: 'Numbers', izon: 'Akpo' }, icon: '🔢', color: '#00BCD4', order: 6 },
  { name: 'other', displayName: { english: 'Other', izon: 'Feni' }, icon: '📦', color: '#9E9E9E', order: 10 },
];

const words = [
  // Nature & Environment
  { izonWord: "abadɩ", englishTranslation: "Ocean / Sea", category: "nature", difficulty: "beginner", pronunciation: { ipa: "/äbädɪ/", syllables: [ {text: "a"}, {text: "ba"}, {text: "dɩ"}] } },
  { izonWord: "abadɩ-aká", englishTranslation: "Sea coast", category: "nature", difficulty: "intermediate", pronunciation: { ipa: "/äbädɪ äkä/" } },
  { izonWord: "abadɩbení", englishTranslation: "Sea water", category: "nature", difficulty: "beginner" },
  { izonWord: "adí", englishTranslation: "Stone", category: "nature", difficulty: "beginner" },
  { izonWord: "adú", englishTranslation: "Fire", category: "nature", difficulty: "beginner" },
  { izonWord: "agúì", englishTranslation: "Hill", category: "nature", difficulty: "beginner" },
  { izonWord: "agúmó", englishTranslation: "Smoke", category: "nature", difficulty: "intermediate" },
  { izonWord: "agúrù", englishTranslation: "Ashes", category: "nature", difficulty: "intermediate" },
  { izonWord: "abedí", englishTranslation: "Monitor lizard", category: "nature", difficulty: "intermediate" },
  { izonWord: "abálà", englishTranslation: "Soft wood", category: "nature", difficulty: "intermediate" },
  
  // Verbs & Actions
  { izonWord: "adɩ́ɩ́", englishTranslation: "Sleep", category: "actions", difficulty: "beginner", examples: [{ izon: "Mie adɩ́ɩ́", english: "I am sleeping" }] },
  { izonWord: "agá", englishTranslation: "Go", category: "actions", difficulty: "beginner", examples: [{ izon: "Wó agá", english: "He/She goes" }] },
  { izonWord: "agɩ́", englishTranslation: "Climb", category: "actions", difficulty: "beginner" },
  { izonWord: "adáda", englishTranslation: "Grope", category: "actions", difficulty: "advanced" },
  { izonWord: "adɩɩmɩ", englishTranslation: "Dream", category: "actions", difficulty: "intermediate" },
  
  // Food & Cooking
  { izonWord: "abálaba", englishTranslation: "Wooden spatula", category: "food", difficulty: "intermediate" },
  { izonWord: "abáneri", englishTranslation: "Bonga fish", category: "food", difficulty: "beginner" },
  { izonWord: "aberéi", englishTranslation: "Fish basket", category: "food", difficulty: "beginner" },
  { izonWord: "tari", englishTranslation: "Food", category: "food", difficulty: "beginner" },
  { izonWord: "fin", englishTranslation: "Water", category: "food", difficulty: "beginner" },
  
  // Greetings & Expressions
  { izonWord: "abóoò", englishTranslation: "Surprise exclamation", category: "greetings", difficulty: "beginner" },
  { izonWord: "aua", englishTranslation: "Greetings / Hello", category: "greetings", difficulty: "beginner" },
  { izonWord: "duba", englishTranslation: "How are you?", category: "greetings", difficulty: "beginner" },
  { izonWord: "emi", englishTranslation: "I am fine", category: "greetings", difficulty: "beginner" },
  { izonWord: "bere", englishTranslation: "Very well", category: "greetings", difficulty: "beginner" },
  
  // Family & People
  { izonWord: "ere", englishTranslation: "Wife", category: "family", difficulty: "beginner" },
  { izonWord: "ọkpọ", englishTranslation: "Husband", category: "family", difficulty: "beginner" },
  { izonWord: "wọñí", englishTranslation: "Child", category: "family", difficulty: "beginner" },
  { izonWord: "ọmọ", englishTranslation: "Mother", category: "family", difficulty: "beginner" },
  { izonWord: "ọba", englishTranslation: "Father", category: "family", difficulty: "beginner" },
  
  // Numbers
  { izonWord: "keni", englishTranslation: "One", category: "numbers", difficulty: "beginner" },
  { izonWord: "mami", englishTranslation: "Two", category: "numbers", difficulty: "beginner" },
  { izonWord: "tẹrẹ", englishTranslation: "Three", category: "numbers", difficulty: "beginner" },
  { izonWord: "nẹi", englishTranslation: "Four", category: "numbers", difficulty: "beginner" },
  { izonWord: "sọnọ", englishTranslation: "Five", category: "numbers", difficulty: "beginner" },
  { izonWord: "sọnịdịa", englishTranslation: "Six", category: "numbers", difficulty: "intermediate" },
  { izonWord: "sọnịama", englishTranslation: "Seven", category: "numbers", difficulty: "intermediate" },
  { izonWord: "sọnịtẹrẹ", englishTranslation: "Eight", category: "numbers", difficulty: "intermediate" },
  { izonWord: "sọnịnẹi", englishTranslation: "Nine", category: "numbers", difficulty: "intermediate" },
  { izonWord: "ọy", englishTranslation: "Ten", category: "numbers", difficulty: "intermediate" },
];

const lessons = [
  {
    title: { izon: "Teme", english: "Nature & Environment" },
    description: { english: "Learn basic Izon words for the natural world around you." },
    level: "beginner",
    lessonType: "grammar",
    category: "nature",
    order: 1,
    estimatedTime: { minutes: 15 },
    content: {
      grammar: [{
        title: { english: "Sentence Structure", izon: "" },
        explanation: { 
          english: "In Izon, the verb often comes at the end of the sentence. For example: 'Adú iye' (Fire is burning).",
          izon: "" 
        }
      }],
      examples: [
        { izon: "Adú iye", english: "The fire is burning" },
        { izon: "Adí bọ", english: "The stone is heavy" },
        { izon: "Agúì bọ", english: "The hill is high" },
      ],
      culturalNotes: [{
        title: { english: "Fire in Izon Culture", izon: "" },
        category: "tradition",
        content: { english: "Fire (adú) is considered sacred in many Izon communities.", izon: "" }
      }]
    },
    exercises: [
      {
        type: "multiple-choice",
        difficulty: "easy",
        question: { english: "What does 'adú' mean?" },
        options: [
          { id: "a", english: "Water", isCorrect: false },
          { id: "b", english: "Fire", isCorrect: true },
          { id: "c", english: "Stone", isCorrect: false }
        ],
        points: 10
      }
    ],
    status: "published"
  },
  {
    title: { izon: "Agá", english: "Actions & Verbs" },
    description: { english: "Learn common Izon verbs for everyday actions." },
    level: "beginner",
    lessonType: "vocabulary",
    category: "nature",
    order: 2,
    estimatedTime: { minutes: 20 },
    content: {
      grammar: [{
        title: { english: "Verb Usage", izon: "" },
        explanation: { 
          english: "Izon verbs don't change form based on the subject.",
          izon: "" 
        }
      }],
      examples: [
        { izon: "Mie adɩ́ɩ́", english: "I am sleeping" },
        { izon: "Wó agá", english: "He/She goes" },
      ]
    },
    exercises: [],
    status: "published"
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const log = (message, type = 'info') => {
  if (!CONFIG.VERBOSE && type === 'debug') return;
  const colors = { info: '\x1b[36m%s\x1b[0m', success: '\x1b[32m%s\x1b[0m', warning: '\x1b[33m%s\x1b[0m', error: '\x1b[31m%s\x1b[0m' };
  const prefix = { info: '📘', success: '✅', warning: '⚠️', error: '❌' };
};

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

const seedDatabase = async () => {
  const startTime = Date.now();
  
  try {
    log('🌱 Starting database seeding...', 'info');
    await mongoose.connect(process.env.MONGODB_URI);
    log(`📊 Connected to MongoDB: ${mongoose.connection.host}`, 'success');

    if (CONFIG.CLEAR_EXISTING) {
      log('🧹 Clearing existing data...', 'warning');
      await Vocabulary.deleteMany({});
      await Lesson.deleteMany({});
      await Category.deleteMany({});
      if (CONFIG.CREATE_ADMIN) await User.deleteMany({ role: 'admin' });
      log('Existing data cleared', 'success');
    }

    log('📁 Seeding categories...', 'info');
    let createdCategories = [];
    for (const cat of categories) {
      const result = await Category.findOneAndUpdate({ name: cat.name }, cat, { upsert: true, new: true });
      createdCategories.push(result);
    }
    log(`✅ Processed ${createdCategories.length} categories`, 'success');

    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser && CONFIG.CREATE_ADMIN) {
      adminUser = new User({
        username: 'admin',
        email: 'admin@izonlanguage.com',
        password: 'Admin123!',
        role: 'admin',
        status: 'active',
        profile: { firstName: 'Admin', lastName: 'User', displayName: 'Admin' },
      });
      await adminUser.save();
      log('✅ Admin created: admin@izonlanguage.com / Admin123!', 'success');
    }
    ADMIN_USER_ID = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

    // Find Izon Language
    const izonLanguage = await Language.findOne({ code: 'IZON' });
    if (!izonLanguage) {
      log('Izon language not found in database. Please run LanguageSeed.js first.', 'error');
      process.exit(1);
    }
    const izonLanguageId = izonLanguage._id;

    log('📚 Seeding vocabulary...', 'info');
    let createdWords = [];
    for (const word of words) {
      const result = await Vocabulary.findOneAndUpdate(
        { izonWord: word.izonWord, language_id: izonLanguageId },
        { 
          ...word, 
          language_id: izonLanguageId,
          createdBy: ADMIN_USER_ID, 
          isPublished: true, 
          verificationStatus: 'verified' 
        },
        { upsert: true, new: true }
      );
      createdWords.push(result);
    }
    log(`✅ Processed ${createdWords.length} Izon words`, 'success');

    const wordMap = {};
    createdWords.forEach(w => wordMap[w.izonWord] = w._id);

    log('📖 Seeding lessons...', 'info');
    for (const lesson of lessons) {
      let wordNames = [];
      if (lesson.category === 'nature') wordNames = ['abadɩ', 'adí', 'adú', 'agúì'];
      
      const lessonVocab = wordNames
        .map(name => wordMap[name])
        .filter(Boolean)
        .map(id => ({ wordId: id }));

      const lessonData = {
        ...lesson,
        language_id: izonLanguageId,
        content: { ...lesson.content, vocabulary: lessonVocab },
        createdBy: ADMIN_USER_ID
      };

      await Lesson.findOneAndUpdate(
        { 'title.english': lesson.title.english, order: lesson.order },
        lessonData,
        { upsert: true, new: true }
      );
    }
    
    log(`✅ Seeding complete in ${((Date.now() - startTime)/1000).toFixed(2)}s`, 'success');
    process.exit(0);
    
  } catch (err) {
    log(`Seeding error: ${err.message}`, 'error');
    process.exit(1);
  }
};

seedDatabase();

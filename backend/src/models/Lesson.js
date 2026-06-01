const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  MASTER: 'master',
  CULTURAL: 'cultural',
};

const LESSON_TYPES = {
  GRAMMAR: 'grammar',
  VOCABULARY: 'vocabulary',
  CONVERSATION: 'conversation',
  CULTURE: 'culture',
  LISTENING: 'listening',
  SPEAKING: 'speaking',
  READING: 'reading',
  WRITING: 'writing',
  REVIEW: 'review',
  ASSESSMENT: 'assessment',
};

const EXERCISE_TYPES = {
  MULTIPLE_CHOICE: 'multiple-choice',
  TRANSLATION: 'translation',
  FILL_BLANK: 'fill-blank',
  MATCHING: 'matching',
  LISTENING: 'listening',
  SPEAKING: 'speaking',
  WRITING: 'writing',
  REORDER: 'reorder',
  TRUE_FALSE: 'true-false',
  PRONUNCIATION: 'pronunciation',
  CONVERSATION: 'conversation',
  GRAMMAR_DRILL: 'grammar-drill',
  CONTEXT_COMPLETION: 'context-completion',
};

const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  CHALLENGING: 'challenging',
};

const PREREQUISITE_TYPES = {
  LESSON: 'lesson',
  LEVEL: 'level',
  MASTERY: 'mastery',
  BADGE: 'badge',
  POINTS: 'points',
};

const MEDIA_TYPES = {
  AUDIO: 'audio',
  VIDEO: 'video',
  IMAGE: 'image',
  DOCUMENT: 'document',
  INTERACTIVE: 'interactive',
};

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

/**
 * Media schema for rich content
 */
const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(MEDIA_TYPES),
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  thumbnailUrl: String,
  title: String,
  description: String,
  duration: Number, // in seconds for audio/video
  transcript: String, // for audio/video
  subtitles: [{
    language: String,
    url: String,
  }],
  attribution: String,
  license: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
});

/**
 * Enhanced vocabulary schema for lessons
 */
const lessonVocabularySchema = new mongoose.Schema({
  wordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
    required: true,
  },
  phonetic: String, 
  toneMarks: [String],
  context: String,
  example: {
    izon: String,
    english: String,
    audio: mediaSchema,
  },
  notes: String,
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  masteryLevel: {
    type: String,
    enum: ['introduce', 'practice', 'master'],
    default: 'introduce',
  },
});

/**
 * Enhanced exercise schema
 */
const exerciseSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(EXERCISE_TYPES),
    required: true,
  },
  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY),
    default: DIFFICULTY.MEDIUM,
  },
  
  // Core content
  question: {
    izon: String,
    english: String,
    audio: mediaSchema,
    image: mediaSchema,
    video: mediaSchema,
  },
  
  // For multiple choice, matching, etc.
  options: [{
    id: String,
    izon: String,
    english: String,
    audio: mediaSchema,
    image: mediaSchema,
    isCorrect: Boolean,
    feedback: String, // Explanation why correct/incorrect
  }],
  
  // For fill-in-blank, translation
  correctAnswer: {
    izon: String,
    english: String,
    alternatives: [String], // Acceptable variations
    regex: String, // For pattern matching
  },
  
  // For matching exercises
  matchingPairs: [{
    left: {
      id: String,
      text: String,
      audio: mediaSchema,
    },
    right: {
      id: String,
      text: String,
      audio: mediaSchema,
    },
  }],
  
  // For reorder exercises
  correctOrder: [String], // IDs in correct order
  
  // Context for completion exercises
  context: {
    izon: String,
    english: String,
    audio: mediaSchema,
    blanks: [{
      position: Number,
      correctAnswer: String,
      hint: String,
    }],
  },
  
  // Hints and feedback
  hints: [{
    level: Number, // 1,2,3 - progressive hints
    content: String,
    media: mediaSchema,
  }],
  
  feedback: {
    correct: String,
    incorrect: String,
    partial: String,
    explanation: String,
  },
  
  // Scoring
  points: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
  timeLimit: Number, // in seconds
  attemptsAllowed: {
    type: Number,
    default: 3,
  },
  
  // Learning objectives
  skills: [{
    type: String,
    enum: ['reading', 'writing', 'listening', 'speaking', 'comprehension', 'translation'],
  }],
  
  tags: [String],
  
  // Metadata
  order: Number,
  required: {
    type: Boolean,
    default: true,
  },
  bonus: {
    type: Boolean,
    default: false,
  },
  
  // Adaptive learning
  adaptiveRules: {
    ifCorrect: {
      nextExercise: String,
      skipNext: Boolean,
      bonusPoints: Number,
    },
    ifIncorrect: {
      showHint: Boolean,
      repeatAfter: Number, // seconds
      simplify: Boolean,
      additionalPractice: String, // exercise ID
    },
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

/**
 * Cultural note schema
 */
const culturalNoteSchema = new mongoose.Schema({
  title: {
    izon: String,
    english: String,
  },
  content: {
    izon: String,
    english: String,
    html: String,
  },
  category: {
    type: String,
    enum: ['tradition', 'history', 'customs', 'beliefs', 'etiquette', 'proverbs', 'festivals', 'food', 'clothing', 'music', 'dance'],
  },
  media: [mediaSchema],
  sources: [{
    title: String,
    url: String,
    author: String,
    year: Number,
  }],
  relatedProverbs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proverb',
  }],
  importance: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
  },
});

/**
 * Prerequisite schema
 */
const prerequisiteSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(PREREQUISITE_TYPES),
    required: true,
  },
  
  // For lesson prerequisites
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  },
  
  // For level prerequisites
  level: {
    type: String,
    enum: Object.values(LEVELS),
  },
  
  // For mastery prerequisites
  masteryLevel: {
    type: Number,
    min: 1,
    max: 5,
  },
  
  // For badge prerequisites
  badgeName: String,
  
  // For points prerequisites
  minimumPoints: {
    type: Number,
    min: 0,
  },
  
  // Minimum score required
  minimumScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 70,
  },
  
  description: String,
});

/**
 * Resource schema for additional learning materials
 */
const resourceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pdf', 'link', 'video', 'audio', 'image', 'interactive'],
    required: true,
  },
  title: {
    izon: String,
    english: String,
  },
  description: String,
  url: String,
  file: mediaSchema,
  duration: Number, // minutes
  downloadUrl: String,
  isRequired: {
    type: Boolean,
    default: false,
  },
  tags: [String],
});

// ============================================================================
// MAIN LESSON SCHEMA
// ============================================================================

const lessonSchema = new mongoose.Schema({
  // Basic Information
  title: {
    izon: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    english: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  
  description: {
    izon: String,
    english: {
      type: String,
      required: true,
    },
  },
  
  shortDescription: {
    izon: String,
    english: String,
  },
  
  // Categorization
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: [true, 'Language ID is required'],
    index: true,
  },
  
  level: {
    type: String,
    enum: Object.values(LEVELS),
    required: true,
    index: true,
  },
  
  lessonType: {
    type: String,
    enum: Object.values(LESSON_TYPES),
    required: true,
    index: true,
  },
  
  category: {
    type: String,
    enum: ['greetings', 'family', 'food', 'travel', 'work', 'school', 'health', 'nature', 'numbers', 'time', 'colors', 'emotions'],
    required: true,
    index: true,
  },
  
  tags: [{
    type: String,
    index: true,
  }],
  
  // Ordering
  order: {
    type: Number,
    required: true,
    index: true,
  },
  
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    index: true,
  },
  
  // Prerequisites
  prerequisites: [prerequisiteSchema],
  
  // Learning Objectives
  objectives: [{
    izon: String,
    english: String,
    skill: {
      type: String,
      enum: ['vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing', 'culture'],
    },
  }],
  
  // Estimated time
  estimatedTime: {
    minutes: {
      type: Number,
      default: 15,
      min: 1,
    },
    hours: Number,
  },
  
  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY),
    default: DIFFICULTY.MEDIUM,
  },
  
  popularity: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Main Content
  content: {
    // Introduction
    introduction: {
      izon: String,
      english: String,
      audio: mediaSchema,
      video: mediaSchema,
    },
    
    // Grammar section
    grammar: [{
      title: {
        izon: String,
        english: String,
      },
      explanation: {
        izon: String,
        english: String,
        html: String,
      },
      rules: [{
        rule: String,
        examples: [{
          izon: String,
          english: String,
          audio: mediaSchema,
        }],
      }],
      exceptions: [String],
      diagrams: [mediaSchema],
      videos: [mediaSchema],
    }],
    
    // Vocabulary section
    vocabulary: [lessonVocabularySchema],
    
    // Example sentences
    examples: [{
      izon: {
        type: String,
        required: true,
      },
      english: {
        type: String,
        required: true,
      },
      transliteration: String,
      audio: mediaSchema,
      vocabulary: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary',
      }],
      grammar: String,
      notes: String,
      difficulty: {
        type: String,
        enum: Object.values(DIFFICULTY),
      },
    }],
    
    // Cultural notes
    culturalNotes: [culturalNoteSchema],
    
    // Conversation practice
    conversations: [{
      title: String,
      scenario: String,
      participants: [{
        name: String,
        role: String,
      }],
      lines: [{
        speaker: String,
        izon: String,
        english: String,
        transliteration: String,
        audio: mediaSchema,
        vocabulary: [String],
        grammar: String,
      }],
      audio: mediaSchema,
    }],
    
    // Listening comprehension
    listeningExercises: [{
      title: String,
      audio: mediaSchema,
      transcript: {
        izon: String,
        english: String,
      },
      questions: [exerciseSchema],
    }],
    
    // Reading passages
    readingPassages: [{
      title: String,
      content: {
        izon: String,
        english: String,
      },
      audio: mediaSchema,
      vocabulary: [lessonVocabularySchema],
      questions: [exerciseSchema],
    }],
    
    // Visual aids
    images: [mediaSchema],
    infographics: [mediaSchema],
    videos: [mediaSchema],
  },
  
  // Exercises
  exercises: [exerciseSchema],
  
  // Review section
  review: {
    summary: {
      izon: String,
      english: String,
    },
    keyPoints: [{
      izon: String,
      english: String,
    }],
    quickQuiz: [exerciseSchema],
    flashcards: [{
      front: {
        izon: String,
        audio: mediaSchema,
      },
      back: {
        english: String,
        audio: mediaSchema,
        image: mediaSchema,
      },
      hint: String,
    }],
  },
  
  // Assessment
  assessment: {
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 70,
    },
    timeLimit: Number, // minutes
    attemptsAllowed: {
      type: Number,
      default: 3,
    },
    questions: [exerciseSchema],
    adaptiveTesting: {
      type: Boolean,
      default: false,
    },
    certificationEligible: {
      type: Boolean,
      default: false,
    },
  },
  
  // Resources
  resources: [resourceSchema],
  
  // Homework/Assignments
  homework: [{
    title: String,
    description: String,
    type: {
      type: String,
      enum: ['writing', 'speaking', 'research', 'practice', 'project'],
    },
    instructions: String,
    dueDays: Number, // days after lesson completion
    points: Number,
    rubric: [{
      criterion: String,
      points: Number,
      description: String,
    }],
  }],
  
  // Rewards
  rewards: {
    basePoints: {
      type: Number,
      default: 50,
    },
    bonusPoints: {
      perfectScore: Number,
      noHints: Number,
      fastCompletion: Number,
    },
    badges: [{
      name: String,
      description: String,
      icon: String,
      criteria: String,
    }],
    achievements: [{
      name: String,
      description: String,
    }],
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1,
  },
  
  previousVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  },
  
  changeLog: [{
    version: Number,
    date: Date,
    changes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'review', 'published', 'archived'],
    default: 'draft',
    index: true,
  },
  
  publishedAt: Date,
  archivedAt: Date,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  reviewers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    feedback: String,
    approved: Boolean,
    reviewedAt: Date,
  }],
  
  // Analytics
  analytics: {
    views: {
      type: Number,
      default: 0,
    },
    completions: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    averageTime: {
      type: Number, // minutes
      default: 0,
    },
    difficultyRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 4,
    },
    commonMistakes: [{
      exerciseId: String,
      mistakeType: String,
      count: Number,
    }],
    dropoutRate: {
      type: Number,
      default: 0,
    },
  },
  
  // Search and Discovery
  keywords: [{
    type: String,
    index: true,
  }],
  
  relatedLessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  }],
  
  recommendedAfter: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  }],
  
  // Accessibility
  accessibility: {
    hasAudioDescriptions: {
      type: Boolean,
      default: false,
    },
    hasSubtitles: {
      type: Boolean,
      default: false,
    },
    hasTranscripts: {
      type: Boolean,
      default: false,
    },
    hasSignLanguage: {
      type: Boolean,
      default: false,
    },
    textSize: {
      type: String,
      enum: ['normal', 'large', 'x-large'],
      default: 'normal',
    },
    highContrast: {
      type: Boolean,
      default: false,
    },
  },
  
  // Localization
  availableLanguages: [{
    type: String,
    enum: ['izon', 'english', 'french', 'spanish', 'portuguese'],
  }],
  
  // Feedback
  feedback: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: String,
    difficulty: String,
    suggestions: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ============================================================================
// INDEXES
// ============================================================================

// Text search indexes
lessonSchema.index({ 'title.izon': 'text', 'title.english': 'text', 'description.english': 'text', 'tags': 'text' });

// Compound indexes for efficient querying
lessonSchema.index({ level: 1, order: 1 });
lessonSchema.index({ category: 1, level: 1 });
lessonSchema.index({ status: 1, publishedAt: -1 });
lessonSchema.index({ 'analytics.popularity': -1 });
lessonSchema.index({ tags: 1, level: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

// Get total number of exercises
lessonSchema.virtual('totalExercises').get(function() {
  return this.exercises?.length || 0;
});

// Get total vocabulary count
lessonSchema.virtual('totalVocabulary').get(function() {
  return this.content?.vocabulary?.length || 0;
});

// Get estimated points possible
lessonSchema.virtual('totalPoints').get(function() {
  const exercisePoints = this.exercises?.reduce((sum, ex) => sum + (ex.points || 10), 0) || 0;
  const assessmentPoints = this.assessment?.questions?.reduce((sum, q) => sum + (q.points || 10), 0) || 0;
  return exercisePoints + assessmentPoints + (this.rewards?.basePoints || 50);
});

// Get completion rate
lessonSchema.virtual('completionRate').get(function() {
  if (!this.analytics?.views) return 0;
  return ((this.analytics?.completions || 0) / this.analytics.views) * 100;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Check if user meets prerequisites
 */
lessonSchema.methods.checkPrerequisites = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!this.prerequisites || this.prerequisites.length === 0) {
    return { met: true, missing: [] };
  }
  
  const missing = [];
  
  for (const prereq of this.prerequisites) {
    let met = false;
    
    switch (prereq.type) {
      case PREREQUISITE_TYPES.LESSON:
        const completed = user.completedLessons?.includes(prereq.lessonId);
        const score = user.lessonScores?.get(prereq.lessonId.toString());
        met = completed && (score >= (prereq.minimumScore || 70));
        break;
        
      case PREREQUISITE_TYPES.LEVEL:
        met = user.progress?.level === prereq.level;
        break;
        
      case PREREQUISITE_TYPES.MASTERY:
        const masteredCount = user.vocabularyMastery?.filter(v => v.stage >= 4).length || 0;
        met = masteredCount >= (prereq.masteryLevel || 1);
        break;
        
      case PREREQUISITE_TYPES.BADGE:
        met = user.progress?.badges?.some(b => b.name === prereq.badgeName);
        break;
        
      case PREREQUISITE_TYPES.POINTS:
        met = (user.progress?.totalPoints || 0) >= (prereq.minimumPoints || 0);
        break;
    }
    
    if (!met) {
      missing.push({
        type: prereq.type,
        description: prereq.description,
        required: prereq,
      });
    }
  }
  
  return {
    met: missing.length === 0,
    missing,
  };
};

/**
 * Get next lesson in sequence
 */
lessonSchema.methods.getNextLesson = async function() {
  const Lesson = mongoose.model('Lesson');
  
  const nextLesson = await Lesson.findOne({
    moduleId: this.moduleId,
    order: this.order + 1,
    status: 'published',
  });
  
  return nextLesson;
};

/**
 * Get recommended lessons
 */
lessonSchema.methods.getRecommendedLessons = async function(limit = 3) {
  const Lesson = mongoose.model('Lesson');
  
  const recommended = await Lesson.find({
    _id: { $in: this.recommendedAfter },
    status: 'published',
  }).limit(limit);
  
  return recommended;
};

/**
 * Update analytics
 */
lessonSchema.methods.updateAnalytics = async function(sessionData) {
  const newCompletions = (this.analytics.completions || 0) + 1;
  const newAverageScore = 
    ((this.analytics.averageScore || 0) * (newCompletions - 1) + sessionData.score) / 
    newCompletions;
  
  const newAverageTime = 
    ((this.analytics.averageTime || 0) * (newCompletions - 1) + sessionData.timeSpent) / 
    newCompletions;
  
  return this.constructor.updateOne(
    { _id: this._id },
    { 
      $set: { 
        'analytics.completions': newCompletions,
        'analytics.averageScore': newAverageScore,
        'analytics.averageTime': newAverageTime
      } 
    }
  );
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get lessons by level
 */
lessonSchema.statics.findByLevel = function(level, limit = 20) {
  return this.find({ level, status: 'published' })
    .sort({ order: 1 })
    .limit(limit);
};

/**
 * Get popular lessons
 */
lessonSchema.statics.findPopular = function(limit = 10) {
  return this.find({ status: 'published' })
    .sort({ 'analytics.views': -1 })
    .limit(limit);
};

/**
 * Get recommended lessons for user
 */
lessonSchema.statics.getRecommendations = async function(userId, limit = 5) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  const completedIds = user.completedLessons || [];
  
  // Get lessons based on user's level and interests
  const recommendations = await this.aggregate([
    {
      $match: {
        _id: { $nin: completedIds },
        status: 'published',
        level: user.progress?.level || 'beginner',
      },
    },
    {
      $addFields: {
        relevanceScore: {
          $add: [
            { $multiply: ['$analytics.popularity', 0.3] },
            { $multiply: [{ $size: { $ifNull: ['$content.vocabulary', []] } }, 0.2] },
            { $multiply: ['$rewards.basePoints', 0.1] },
          ],
        },
      },
    },
    { $sort: { relevanceScore: -1 } },
    { $limit: limit },
  ]);
  
  return recommendations;
};

/**
 * Search lessons
 */
lessonSchema.statics.search = function(query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: 'published',
    ...filters,
  };
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(20);
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Pre-save middleware
lessonSchema.pre('save', function() { // Removed 'next' here
  // Update timestamps
  this.updatedAt = new Date();
  
  // Set published date if status changed to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Set archived date if status changed to archived
  if (this.isModified('status') && this.status === 'archived' && !this.archivedAt) {
    this.archivedAt = new Date();
  }
  
  // Generate keywords for search
  if (this.isModified('title') || this.isModified('description') || this.isModified('tags')) {
    this.keywords = [
      ...this.title.izon.toLowerCase().split(' '),
      ...this.title.english.toLowerCase().split(' '),
      ...this.description.english.toLowerCase().split(' '),
      ...(this.tags || []),
    ];
    this.keywords = [...new Set(this.keywords)]; // Remove duplicates
  }
  
  // No next() call needed!
});


// Post-save middleware
lessonSchema.post('save', async function(doc) {
  // Update module lesson count if this lesson belongs to a module
  if (doc.moduleId) {
    const Module = mongoose.model('Module');
    await Module.findByIdAndUpdate(doc.moduleId, {
      $addToSet: { lessons: doc._id },
    });
  }
});

// ============================================================================
// INDEXES (continued)
// ============================================================================

// Ensure unique order within module
lessonSchema.index({ moduleId: 1, order: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Lesson', lessonSchema);
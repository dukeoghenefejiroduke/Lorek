const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
  CULTURAL: 'cultural',
};

const PARTS_OF_SPEECH = {
  NOUN: 'noun',
  VERB: 'verb',
  ADJECTIVE: 'adjective',
  ADVERB: 'adverb',
  PRONOUN: 'pronoun',
  PREPOSITION: 'preposition',
  CONJUNCTION: 'conjunction',
  INTERJECTION: 'interjection',
  PARTICLE: 'particle',
  IDIOM: 'idiom',
  PROVERB: 'proverb',
};

const WORD_CLASSES = {
  SIMPLE: 'simple',
  COMPOUND: 'compound',
  DERIVED: 'derived',
  BORROWED: 'borrowed',
  ARCHAIC: 'archaic',
  MODERN: 'modern',
};

const CATEGORIES = {
  GREETINGS: 'greetings',
  FAMILY: 'family',
  VERBS: 'verbs',
  FOOD: 'food',
  ANIMALS: 'animals',
  NATURE: 'nature',
  NUMBERS: 'numbers',
  TIME: 'time',
  COLORS: 'colors',
  BODY: 'body_parts',
  CLOTHING: 'clothing',
  HOUSEHOLD: 'household',
  EMOTIONS: 'emotions',
  ACTIONS: 'actions',
  PROFESSIONS: 'professions',
  EDUCATION: 'education',
  RELIGION: 'religion',
  TRADITIONS: 'traditions',
  MUSIC: 'music',
  DANCE: 'dance',
  FESTIVALS: 'festivals',
  PROVERBS: 'proverbs',
  IDIOMS: 'idioms',
  OTHER: 'other',
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REVIEWING: 'reviewing',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
};

const FREQUENCY_LEVELS = {
  RARE: 'rare',
  UNCOMMON: 'uncommon',
  COMMON: 'common',
  FREQUENT: 'frequent',
  VERY_FREQUENT: 'very_frequent',
};

const DIALECTS = {
  CENTRAL: 'Central',
  WESTERN: 'Western',
  EASTERN: 'Eastern',
  KOLOKUMA: 'Kolokuma',
  OKRIKA: 'Okrika',
  NEMBE: 'Nembe',
  EPIE: 'Epie',
  BASAN: 'Basan',
  ALL: 'All',
};

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

/**
 * Comprehensive pronunciation schema
 */
const pronunciationSchema = new mongoose.Schema({
  ipa: {
    type: String,
    description: "International Phonetic Alphabet representation",
  },
  
  phonetic: {
    type: String,
    description: "Simplified phonetic spelling",
  },
  
  syllables: [{
    text: String,
    stress: {
      type: Boolean,
      default: false,
    },
    tone: {
      type: String,
      enum: ['high', 'mid', 'low', 'rising', 'falling'],
    },
    duration: Number, // milliseconds
  }],
  
  audio: {
    url: String,
    duration: Number, // seconds
    format: String,
    quality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedAt: Date,
    verified: { type: Boolean, default: false },
  },
  
  alternativePronunciations: [{
    language_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Language',
    },
    ipa: String,
    phonetic: String,
    audio: {
      url: String,
      duration: Number,
    },
    notes: String,
  }],
  
  toneMarks: String,
  pitchPattern: [Number],
  stressPattern: String,
  
  notes: String,
});

/**
 * Comprehensive example schema
 */
const exampleSchema = new mongoose.Schema({
  izon: {
    type: String,
    required: true,
    trim: true,
  },
  
  english: {
    type: String,
    required: true,
    trim: true,
  },
  
  literalTranslation: String,
  
  pronunciation: pronunciationSchema,
  
  audio: {
    url: String,
    duration: Number,
    speaker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  
  context: {
    situation: String,
    formality: {
      type: String,
      enum: ['formal', 'informal', 'neutral'],
      default: 'neutral',
    },
    region: {
      type: String,
      enum: Object.values(DIALECTS),
    },
  },
  
  vocabulary: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
  }],
  
  grammar: {
    focus: [String],
    explanation: String,
  },
  
  culturalNotes: String,
  
  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY_LEVELS),
    default: DIFFICULTY_LEVELS.INTERMEDIATE,
  },
  
  frequency: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  tags: [String],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
});

/**
 * Word relationships schema
 */
const wordRelationSchema = new mongoose.Schema({
  relatedWord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
    required: true,
  },
  
  relationType: {
    type: String,
    enum: [
      'synonym',
      'antonym',
      'hyponym',
      'hypernym',
      'meronym',
      'holonym',
      'variant',
      'derived',
      'compound',
      'see_also',
      'related',
      'cognate',
    ],
    required: true,
  },
  
  strength: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  
  context: String,
  
  bidirectional: {
    type: Boolean,
    default: true,
  },
  
  notes: String,
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

/**
 * Semantic field schema
 */
const semanticFieldSchema = new mongoose.Schema({
  name: String,
  description: String,
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SemanticField',
  },
  relatedFields: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SemanticField',
  }],
  color: String,
  icon: String,
  order: Number,
});

/**
 * Etymology schema
 */
const etymologySchema = new mongoose.Schema({
  origin: {
    type: String,
    enum: ['izon', 'proto-izon', 'ijoid', 'borrowed', 'unknown'],
  },
  
  source: {
    language: String,
    word: String,
    meaning: String,
  },
  
  historicalForms: [{
    period: String,
    form: String,
    source: String,
  }],
  
  development: String,
  
  notes: String,
  
  references: [{
    author: String,
    title: String,
    year: Number,
    page: Number,
    url: String,
  }],
});

/**
 * Grammar information schema
 */
const grammarSchema = new mongoose.Schema({
  partOfSpeech: {
    type: String,
    enum: Object.values(PARTS_OF_SPEECH),
    required: true,
  },
  
  wordClass: {
    type: String,
    enum: Object.values(WORD_CLASSES),
    default: WORD_CLASSES.SIMPLE,
  },
  
  // For verbs
  verbClass: {
    type: String,
    enum: ['strong', 'weak', 'irregular', 'auxiliary'],
  },
  conjugation: mongoose.Schema.Types.Mixed,
  
  // For nouns
  nounClass: String,
  plural: String,
  gender: {
    type: String,
    enum: ['masculine', 'feminine', 'neuter', 'common'],
  },
  
  // For adjectives
  comparative: String,
  superlative: String,
  
  // Derivational morphology
  root: String,
  prefixes: [String],
  suffixes: [String],
  infixes: [String],
  
  // Syntactic information
  argumentStructure: String,
  transitivity: {
    type: String,
    enum: ['transitive', 'intransitive', 'ditransitive'],
  },
  
  // Grammatical notes
  notes: String,
});

/**
 * Usage statistics schema
 */
const usageStatsSchema = new mongoose.Schema({
  frequency: {
    type: String,
    enum: Object.values(FREQUENCY_LEVELS),
    default: FREQUENCY_LEVELS.UNCOMMON,
  },
  
  frequencyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  occurrences: {
    total: { type: Number, default: 0 },
    inTexts: { type: Number, default: 0 },
    inSpeech: { type: Number, default: 0 },
  },
  
  commonality: {
    byRegion: {
      type: Map,
      of: Number,
    },
    byAge: {
      type: Map,
      of: Number,
    },
    byContext: {
      type: Map,
      of: Number,
    },
  },
  
  popularity: {
    searches: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
  },
  
  lastUpdated: { type: Date, default: Date.now },
});

/**
 * Cultural context schema
 */
const culturalContextSchema = new mongoose.Schema({
  significance: String,
  traditions: [String],
  taboos: [String],
  ceremonies: [String],
  proverbs: [{
    proverb: String,
    meaning: String,
    usage: String,
  }],
  historicalContext: String,
  modernUsage: String,
  regionalVariations: [{
    region: String,
    variation: String,
    notes: String,
  }],
  references: [{
    title: String,
    author: String,
    year: Number,
    type: {
      type: String,
      enum: ['book', 'article', 'interview', 'oral_history'],
    },
  }],
});

/**
 * Media schema
 */
const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'illustration', 'diagram'],
    required: true,
  },
  
  url: {
    type: String,
    required: true,
  },
  
  thumbnail: String,
  
  title: String,
  description: String,
  
  caption: {
    izon: String,
    english: String,
  },
  
  alt: String, // for accessibility
  
  credit: String,
  license: String,
  source: String,
  
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    format: String,
    size: Number,
  },
  
  tags: [String],
  
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  
  verified: { type: Boolean, default: false },
});

// ============================================================================
// MAIN VOCABULARY SCHEMA
// ============================================================================

const vocabularySchema = new mongoose.Schema({
  // Core word data
  izonWord: {
    type: String,
    required: [true, 'Izon word is required'],
    trim: true,
  },
  englishTranslation: {
    type: String,
    required: [true, 'English translation is required'],
    trim: true,
  },
 // Language reference for consolidation
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: [true, 'Language ID is required'],
    index: true,
  },

 // Dialect and Category for top-level filtering
  category: {
    type: String,
    enum: Object.values(CATEGORIES),
    default: CATEGORIES.OTHER,
    required: true
  },

  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY_LEVELS),
    default: DIFFICULTY_LEVELS.BEGINNER,
    required: true
  },
  alternativeTranslations: [{
    translation: String,
    context: String,
    usage: String,
    frequency: Number,
  }],
  
  // Pronunciation
  pronunciation: pronunciationSchema,
  
  // Grammar
  grammar: grammarSchema,
  
  subCategory: String,
  
  semanticFields: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SemanticField',
  }],
  
  tags: [{
    type: String,
  }],
  
  difficultyScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
  },
  
  // Examples
  examples: [exampleSchema],
  
  // Relationships
  synonyms: [wordRelationSchema],
  antonyms: [wordRelationSchema],
  relatedWords: [wordRelationSchema],
  
  // Etymology
  etymology: etymologySchema,
  
  // Cultural context
  culturalContext: culturalContextSchema,
  
  // Media
  images: [mediaSchema],
  videos: [mediaSchema],
  
  // Usage statistics
  usage: usageStatsSchema,
  
  // Learning metadata
  learning: {
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    essential: {
      type: Boolean,
      default: false,
    },
    frequencyRank: Number,
    commonMistakes: [{
      mistake: String,
      correction: String,
      explanation: String,
      count: Number,
    }],
    teachingTips: String,
    mnemonics: [{
      text: String,
      type: {
        type: String,
        enum: ['memory', 'association', 'visual', 'audio'],
      },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      helpful: { type: Number, default: 0 },
    }],
  },
  
  verificationHistory: [{
    status: String,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    notes: String,
    changes: mongoose.Schema.Types.Mixed,
  }],
  
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  completeness: {
    pronunciation: { type: Boolean, default: false },
    examples: { type: Boolean, default: false },
    grammar: { type: Boolean, default: false },
    etymology: { type: Boolean, default: false },
    culturalContext: { type: Boolean, default: false },
    media: { type: Boolean, default: false },
  },
  
  // Community contributions
  contributions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['add', 'edit', 'suggestion', 'correction'],
    },
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
  }],
  
  // Feedback from learners
  feedback: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: {
      clarity: { type: Number, min: 1, max: 5 },
      usefulness: { type: Number, min: 1, max: 5 },
      difficulty: { type: Number, min: 1, max: 5 },
    },
    comment: String,
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }],
  
  averageRating: {
    clarity: { type: Number, default: 0 },
    usefulness: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
  },
  
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
  
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  source: {
    type: String,
    enum: ['native_speaker', 'linguist', 'researcher', 'community', 'imported'],
  },
  
  sourceDetails: String,
  
  // Versioning
  version: {
    type: Number,
    default: 1,
  },
  
  previousVersions: [{
    version: Number,
    data: mongoose.Schema.Types.Mixed,
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
  }],
  
  // Change log
  changeLog: [{
    version: Number,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: Date,
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
    }],
    reason: String,
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  reviewedAt: Date,
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  isPublished: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  isArchived: {
    type: Boolean,
    default: false,
  },
  
  // Notes
  internalNotes: String,
  
  // Flags
  flags: [{
    type: {
      type: String,
      enum: ['spelling', 'pronunciation', 'meaning', 'offensive', 'duplicate'],
    },
    description: String,
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedAt: Date,
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
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
vocabularySchema.index({
  izonWord: 'text',
  englishTranslation: 'text',
  'alternativeTranslations.translation': 'text',
  'examples.izon': 'text',
  'examples.english': 'text',
  tags: 'text',
});

// Compound indexes for efficient querying
vocabularySchema.index({ category: 1, difficulty: 1 });
vocabularySchema.index({ language_id: 1, category: 1 });
vocabularySchema.index({ 'usage.frequencyScore': -1 });
vocabularySchema.index({ createdAt: -1 });
vocabularySchema.index({ 'grammar.partOfSpeech': 1 });
vocabularySchema.index({ difficultyScore: 1 });
vocabularySchema.index({ verificationStatus: 1, createdAt: 1 });
vocabularySchema.index({ isPublished: 1, isActive: 1 });

// Unique index for preventing duplicates (case-insensitive)
vocabularySchema.index(
  { izonWord: 1, language_id: 1 },
  { 
    unique: true,
    collation: { locale: 'en', strength: 2 } // Case-insensitive
  }
);

// ============================================================================
// VIRTUALS
// ============================================================================

// Get example count
vocabularySchema.virtual('exampleCount').get(function() {
  return this.examples?.length || 0;
});

// Get synonym count
vocabularySchema.virtual('synonymCount').get(function() {
  return this.synonyms?.length || 0;
});

// Get related word count
vocabularySchema.virtual('relatedCount').get(function() {
  return (this.synonyms?.length || 0) + 
         (this.antonyms?.length || 0) + 
         (this.relatedWords?.length || 0);
});

// Get completeness percentage
vocabularySchema.virtual('completenessPercentage').get(function() {
  const fields = this.completeness || {};
  const total = Object.keys(fields).length;
  const completed = Object.values(fields).filter(v => v).length;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
});

// Get primary audio URL
vocabularySchema.virtual('primaryAudioUrl').get(function() {
  return this.pronunciation?.audio?.url || 
         this.pronunciation?.alternativePronunciations?.[0]?.audio?.url;
});

// Get primary image URL
vocabularySchema.virtual('primaryImageUrl').get(function() {
  return this.images?.[0]?.url;
});

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================

// Update timestamps
vocabularySchema.pre('save', function() {
  this.updatedAt = new Date();
  
  // Update completeness
  this.completeness = {
    pronunciation: !!(this.pronunciation?.ipa || this.pronunciation?.audio),
    examples: !!(this.examples && this.examples.length > 0),
    grammar: !!(this.grammar?.partOfSpeech),
    etymology: !!(this.etymology?.origin),
    culturalContext: !!(this.culturalContext?.significance),
    media: !!(this.images && this.images.length > 0),
  };
  
  // Update average ratings
  if (this.feedback && this.feedback.length > 0) {
    const ratings = this.feedback.filter(f => f.rating);
    if (ratings.length > 0) {
      const sum = ratings.reduce((acc, f) => ({
        clarity: acc.clarity + (f.rating.clarity || 0),
        usefulness: acc.usefulness + (f.rating.usefulness || 0),
        difficulty: acc.difficulty + (f.rating.difficulty || 0),
      }), { clarity: 0, usefulness: 0, difficulty: 0 });
      
      this.averageRating = {
        clarity: sum.clarity / ratings.length,
        usefulness: sum.usefulness / ratings.length,
        difficulty: sum.difficulty / ratings.length,
        overall: (sum.clarity + sum.usefulness + sum.difficulty) / (ratings.length * 3),
      };
    }
  }
  
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Add an example sentence
 */
vocabularySchema.methods.addExample = async function(exampleData, userId) {
  const example = {
    ...exampleData,
    createdBy: userId,
    createdAt: new Date(),
  };
  
  this.examples.push(example);
  this.updatedBy = userId;
  
  return this.save();
};

/**
 * Add a synonym relationship
 */
vocabularySchema.methods.addSynonym = async function(wordId, userId, strength = 0.5) {
  // Check if already exists
  const exists = this.synonyms.some(s => 
    s.relatedWord.toString() === wordId.toString()
  );
  
  if (!exists) {
    this.synonyms.push({
      relatedWord: wordId,
      relationType: 'synonym',
      strength,
      createdBy: userId,
    });
    
    this.updatedBy = userId;
    return this.save();
  }
  
  return this;
};

/**
 * Add feedback
 */
vocabularySchema.methods.addFeedback = async function(feedbackData, userId) {
  this.feedback.push({
    ...feedbackData,
    user: userId,
    createdAt: new Date(),
  });
  
  return this.save();
};

/**
 * Increment usage count
 */
vocabularySchema.methods.incrementUsage = async function(type = 'views') {
  const update = {
    $inc: { [`usage.popularity.${type}`]: 1 },
    $set: { 'usage.lastUpdated': new Date() }
  };
  
  return this.constructor.updateOne({ _id: this._id }, update);
};

/**
 * Get related words by type
 */
vocabularySchema.methods.getRelatedWords = async function(relationType = null) {
  const relations = [];
  
  if (!relationType || relationType === 'synonym') {
    relations.push(...this.synonyms);
  }
  
  if (!relationType || relationType === 'antonym') {
    relations.push(...this.antonyms);
  }
  
  if (!relationType || relationType === 'related') {
    relations.push(...this.relatedWords);
  }
  
  // Populate the related words
  await this.populate('synonyms.relatedWord antonyms.relatedWord relatedWords.relatedWord');
  
  return relations;
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find by category with pagination
 */
vocabularySchema.statics.findByCategory = function(category, options = {}) {
  const {
    limit = 20,
    skip = 0,
    difficulty,
    language_id,
    sortBy = 'izonWord',
  } = options;
  
  const query = { category, isPublished: true, isActive: true };
  
  if (difficulty) query.difficulty = difficulty;
  if (language_id) query.language_id = language_id;
  
  return this.find(query)
    .sort({ [sortBy]: 1 })
    .limit(limit)
    .skip(skip);
};

/**
 * Search vocabulary with advanced options
 */
vocabularySchema.statics.advancedSearch = async function(query, options = {}) {
  const {
    limit = 20,
    skip = 0,
    category,
    difficulty,
    language_id,
    partOfSpeech,
    minDifficulty = 1,
    maxDifficulty = 10,
    exact = false,
  } = options;
  
  const searchQuery = { isPublished: true, isActive: true };
  
  if (query) {
    if (exact) {
      searchQuery.$or = [
        { izonWord: new RegExp(`^${query}$`, 'i') },
        { englishTranslation: new RegExp(`^${query}$`, 'i') },
      ];
    } else {
      searchQuery.$text = { $search: query };
    }
  }
  
  if (category) searchQuery.category = category;
  if (difficulty) searchQuery.difficulty = difficulty;
  if (language_id) searchQuery.language_id = language_id;
  if (partOfSpeech) searchQuery['grammar.partOfSpeech'] = partOfSpeech;
  
  searchQuery.difficultyScore = { $gte: minDifficulty, $lte: maxDifficulty };
  
  let queryBuilder = this.find(searchQuery);
  
  if (!exact && query) {
    queryBuilder = queryBuilder.sort({ score: { $meta: 'textScore' } });
  } else {
    queryBuilder = queryBuilder.sort({ izonWord: 1 });
  }
  
  const [results, total] = await Promise.all([
    queryBuilder.limit(limit).skip(skip),
    this.countDocuments(searchQuery),
  ]);
  
  return {
    results,
    total,
    page: Math.floor(skip / limit) + 1,
    pages: Math.ceil(total / limit),
  };
};

/**
 * Get random words
 */
vocabularySchema.statics.getRandom = async function(count = 10, filters = {}) {
  const pipeline = [
    { $match: { isPublished: true, isActive: true, ...filters } },
    { $sample: { size: count } },
  ];
  
  return this.aggregate(pipeline);
};

/**
 * Get words needing review
 */
vocabularySchema.statics.needsReview = async function(limit = 50) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.find({
    $or: [
      { verificationStatus: VERIFICATION_STATUS.PENDING },
      { 
        verificationStatus: VERIFICATION_STATUS.VERIFIED,
        reviewedAt: { $lt: thirtyDaysAgo },
      },
      { qualityScore: { $lt: 70 } },
    ],
    isActive: true,
  })
    .sort({ qualityScore: 1, reviewedAt: 1 })
    .limit(limit);
};

/**
 * Get popular words
 */
vocabularySchema.statics.getPopular = async function(limit = 20) {
  return this.find({ isPublished: true, isActive: true })
    .sort({ 'usage.popularity.views': -1, 'usage.popularity.searches': -1 })
    .limit(limit);
};

/**
 * Get statistics
 */
vocabularySchema.statics.getStats = async function() {
  const [
    totalWords,
    verifiedWords,
    pendingWords,
    byCategory,
    byDifficulty,
    byLanguage,
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ verificationStatus: VERIFICATION_STATUS.VERIFIED }),
    this.countDocuments({ verificationStatus: VERIFICATION_STATUS.PENDING }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$language_id', count: { $sum: 1 } } },
    ]),
  ]);
  
  return {
    total: totalWords,
    verified: verifiedWords,
    pending: pendingWords,
    completion: Math.round((verifiedWords / totalWords) * 100),
    byCategory,
    byDifficulty,
    byLanguage,
  };
};

// ============================================================================
// POST-SAVE MIDDLEWARE
// ============================================================================

vocabularySchema.post('save', async function(doc) {
  // Update search indexes if needed
  // Could trigger reindexing or cache updates
});

// Essential for fast category/difficulty filtering on SQLite
vocabularySchema.index({ category: 1, isPublished: 1 });
vocabularySchema.index({ difficulty: 1, isPublished: 1 });

// Essential for the "Exact Match" strategy in your search route
vocabularySchema.index({ izonWord: 1 }, { collation: { locale: 'en', strength: 2 } });
vocabularySchema.index({ englishTranslation: 1 }, { collation: { locale: 'en', strength: 2 } });


module.exports = mongoose.model('Vocabulary', vocabularySchema);
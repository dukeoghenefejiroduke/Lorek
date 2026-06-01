const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const PROVERB_CATEGORIES = {
  WISDOM: 'wisdom',
  LIFE: 'life',
  FAMILY: 'family',
  COMMUNITY: 'community',
  NATURE: 'nature',
  HARD_WORK: 'hard_work',
  PATIENCE: 'patience',
  RESPECT: 'respect',
  TRADITION: 'tradition',
  LOVE: 'love',
  FRIENDSHIP: 'friendship',
  SUCCESS: 'success',
  CAUTION: 'caution',
  HUMOR: 'humor',
};

const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REVIEWING: 'reviewing',
  REJECTED: 'rejected',
};

// ============================================================================
// PROVERB SCHEMA
// ============================================================================

const proverbSchema = new mongoose.Schema({
  // Core proverb data
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
  
  literalTranslation: {
    type: String,
    trim: true,
  },
  
  // Meaning and interpretation
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: [true, 'Language ID is required'],
    index: true,
  },
  
  meaning: {
    type: String,
    required: true,
  },
  
  interpretation: {
    short: String,
    detailed: String,
    modernContext: String,
  },
  
  // Cultural context
  culturalContext: {
    origin: String,
    historicalBackground: String,
    culturalSignificance: String,
    traditionalUse: String,
    region: {
      type: String,
      enum: ['Central', 'Western', 'Eastern', 'Kolokuma', 'Okrika', 'Nembe', 'Epie', 'Basan', 'All'],
      default: 'All',
    },
    timePeriod: String,
  },
  
  // Categorization
  category: {
    type: String,
    enum: Object.values(PROVERB_CATEGORIES),
    required: true,
    index: true,
  },
  
  subCategory: String,
  
  tags: [{
    type: String,
    index: true,
  }],
  
  difficulty: {
    type: String,
    enum: Object.values(DIFFICULTY_LEVELS),
    default: DIFFICULTY_LEVELS.INTERMEDIATE,
  },
  
  // Usage examples
  usageExamples: [{
    izon: String,
    english: String,
    context: String,
    situation: String,
    audio: {
      url: String,
      duration: Number,
    },
  }],
  
  // Related proverbs
  relatedProverbs: [{
    proverbId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proverb',
    },
    relationType: {
      type: String,
      enum: ['similar', 'opposite', 'extension', 'variation'],
    },
  }],
  
  // Vocabulary used in this proverb
  vocabulary: [{
    wordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
    },
    word: String,
    meaning: String,
    notes: String,
  }],
  
  // Pronunciation
  pronunciation: {
    ipa: String,
    audio: {
      url: String,
      duration: Number,
      speaker: String,
    },
    syllableBreakdown: [String],
  },
  
  // Media
  images: [{
    url: String,
    caption: String,
    credit: String,
  }],
  
  // Educational content
  lessonIdeas: [{
    title: String,
    description: String,
    activities: [String],
    discussionQuestions: [String],
  }],
  
  // Verification and quality
  verificationStatus: {
    type: String,
    enum: Object.values(VERIFICATION_STATUS),
    default: VERIFICATION_STATUS.PENDING,
    index: true,
  },
  
  verified: {
    type: Boolean,
    default: false,
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  verifiedAt: Date,
  
  verificationHistory: [{
    status: String,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    notes: String,
    changes: mongoose.Schema.Types.Mixed,
  }],
  
  // Popularity and usage
  popularity: {
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
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
  
  source: {
    type: String,
    enum: ['native_speaker', 'elder', 'research', 'literature', 'community'],
  },
  
  sourceDetails: String,
  
  // Status
  isPublished: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  featured: {
    type: Boolean,
    default: false,
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1,
  },
  
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
  
  // Comments and feedback
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      createdAt: Date,
    }],
  }],
  
  feedback: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    helpful: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }],
  
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  
  // Flags for issues
  flags: [{
    type: {
      type: String,
      enum: ['inaccurate', 'offensive', 'duplicate', 'copyright'],
    },
    description: String,
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedAt: Date,
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolution: String,
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
proverbSchema.index({ izon: 'text', english: 'text', meaning: 'text', tags: 'text' });

// Compound indexes
proverbSchema.index({ category: 1, difficulty: 1 });
proverbSchema.index({ featured: 1, createdAt: -1 });
proverbSchema.index({ isPublished: 1, isActive: 1 });
proverbSchema.index({ 'popularity.views': -1 });
proverbSchema.index({ averageRating: -1 });
proverbSchema.index({ verificationStatus: 1, createdAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

proverbSchema.virtual('usageExamplesCount').get(function() {
  return this.usageExamples?.length || 0;
});

proverbSchema.virtual('relatedProverbsCount').get(function() {
  return this.relatedProverbs?.length || 0;
});

proverbSchema.virtual('vocabularyCount').get(function() {
  return this.vocabulary?.length || 0;
});

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================

proverbSchema.pre('save', function() {
  // Update timestamps
  this.updatedAt = new Date();
  
  // Update average rating
  if (this.feedback && this.feedback.length > 0) {
    const sum = this.feedback.reduce((acc, f) => acc + (f.rating || 0), 0);
    this.averageRating = sum / this.feedback.length;
  }
  // No next() call needed here
});


// ============================================================================
// METHODS
// ============================================================================

/**
 * Increment view count
 */
proverbSchema.methods.incrementViews = async function() {
  return this.constructor.updateOne(
    { _id: this._id },
    { $inc: { 'popularity.views': 1 } }
  );
};

/**
 * Add feedback
 */
proverbSchema.methods.addFeedback = async function(userId, feedbackData) {
  this.feedback.push({
    user: userId,
    ...feedbackData,
    createdAt: new Date(),
  });
  
  // Recalculate average
  const sum = this.feedback.reduce((acc, f) => acc + (f.rating || 0), 0);
  this.averageRating = sum / this.feedback.length;
  
  return this.save();
};

/**
 * Add comment
 */
proverbSchema.methods.addComment = async function(userId, text) {
  this.comments.push({
    user: userId,
    text,
    createdAt: new Date(),
  });
  
  return this.save();
};

/**
 * Get related proverbs
 */
proverbSchema.methods.getRelatedProverbs = async function() {
  if (!this.relatedProverbs || this.relatedProverbs.length === 0) {
    // Find by category and tags
    return await this.constructor.find({
      _id: { $ne: this._id },
      category: this.category,
      tags: { $in: this.tags || [] },
      isPublished: true,
      isActive: true,
    })
      .limit(5)
      .select('izon english meaning category');
  }
  
  // Populate related proverbs
  await this.populate('relatedProverbs.proverbId');
  return this.relatedProverbs.map(r => r.proverbId);
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get proverb of the day
 */
proverbSchema.statics.getProverbOfDay = async function() {
  const count = await this.countDocuments({ isPublished: true, isActive: true });
  
  const random = Math.floor(Math.random() * count);
  
  return this.findOne({ isPublished: true, isActive: true })
    .skip(random)
    .select('izon english meaning category culturalContext pronunciation');
};

/**
 * Get featured proverbs
 */
proverbSchema.statics.getFeatured = function(limit = 10) {
  return this.find({
    featured: true,
    isPublished: true,
    isActive: true,
  })
    .sort({ averageRating: -1, 'popularity.views': -1 })
    .limit(limit)
    .select('izon english meaning category');
};

/**
 * Get proverbs by category
 */
proverbSchema.statics.getByCategory = function(category, limit = 20) {
  return this.find({
    category,
    isPublished: true,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('izon english meaning');
};

/**
 * Search proverbs
 */
proverbSchema.statics.search = function(query, limit = 20) {
  return this.find(
    {
      $text: { $search: query },
      isPublished: true,
      isActive: true,
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .select('izon english meaning category');
};

/**
 * Get statistics
 */
proverbSchema.statics.getStats = async function() {
  const [total, byCategory, verified, pending] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    this.countDocuments({ verified: true, isActive: true }),
    this.countDocuments({ verificationStatus: 'pending', isActive: true }),
  ]);
  
  return {
    total,
    byCategory,
    verified,
    pending,
    featured: await this.countDocuments({ featured: true }),
  };
};

module.exports = mongoose.model('Proverb', proverbSchema);
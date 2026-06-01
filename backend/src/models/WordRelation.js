const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const RELATION_TYPES = {
  SYNONYM: 'synonym',
  ANTONYM: 'antonym',
  HYPONYM: 'hyponym',
  HYPERNYM: 'hypernym',
  MERONYM: 'meronym',
  HOLONYM: 'holonym',
  VARIANT: 'variant',
  DERIVED: 'derived',
  COMPOUND: 'compound',
  SEE_ALSO: 'see_also',
  RELATED: 'related',
  COGNATE: 'cognate',
  ETYMOLOGICAL: 'etymological',
  SEMANTIC: 'semantic',
  COLLOCATION: 'collocation',
};

const RELATION_STRENGTH = {
  WEAK: 0.25,
  MEDIUM: 0.5,
  STRONG: 0.75,
  VERY_STRONG: 1.0,
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REVIEWING: 'reviewing',
  REJECTED: 'rejected',
};

// ============================================================================
// WORD RELATION SCHEMA
// ============================================================================

const wordRelationSchema = new mongoose.Schema({
  // Source word
  sourceWord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
    required: true,
    index: true,
  },
  
  // Target word
  targetWord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
    required: true,
    index: true,
  },
  
  // Relation type
  relationType: {
    type: String,
    enum: Object.values(RELATION_TYPES),
    required: true,
    index: true,
  },
  
  // Relation strength
  strength: {
    type: Number,
    min: 0,
    max: 1,
    default: RELATION_STRENGTH.MEDIUM,
  },
  
  // Directionality
  bidirectional: {
    type: Boolean,
    default: true,
  },
  
  // Context
  context: {
    description: String,
    examples: [{
      izon: String,
      english: String,
    }],
    domain: String,
    register: {
      type: String,
      enum: ['formal', 'informal', 'neutral', 'literary', 'colloquial'],
      default: 'neutral',
    },
    region: {
      type: String,
      enum: ['Central', 'Western', 'Eastern', 'Kolokuma', 'Okrika', 'Nembe', 'Epie', 'Basan', 'All'],
      default: 'All',
    },
  },
  
  // Metadata
  frequency: {
    type: Number,
    min: 0,
    default: 0,
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  
  source: {
    type: String,
    enum: ['manual', 'algorithm', 'corpus', 'linguist', 'community'],
    default: 'manual',
  },
  
  notes: String,
  
  // Verification
  verificationStatus: {
    type: String,
    enum: Object.values(VERIFICATION_STATUS),
    default: VERIFICATION_STATUS.PENDING,
    index: true,
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
  }],
  
  // Usage statistics
  statistics: {
    timesUsed: { type: Number, default: 0 },
    timesCorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    lastUsed: Date,
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
  
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  tags: [{
    type: String,
    index: true,
  }],
  
}, {
  timestamps: true,
});

// ============================================================================
// INDEXES
// ============================================================================

wordRelationSchema.index({ sourceWord: 1, targetWord: 1, relationType: 1 }, { unique: true });
wordRelationSchema.index({ sourceWord: 1, relationType: 1 });
wordRelationSchema.index({ targetWord: 1, relationType: 1 });
wordRelationSchema.index({ verificationStatus: 1, createdAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

wordRelationSchema.virtual('isVerified').get(function() {
  return this.verificationStatus === VERIFICATION_STATUS.VERIFIED;
});

wordRelationSchema.virtual('isPending').get(function() {
  return this.verificationStatus === VERIFICATION_STATUS.PENDING;
});

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================

wordRelationSchema.pre('save', async function() {
  if (this.isNew) {
     // Update accuracy
     if (this.statistics.timesUsed > 0) {
      this.statistics.accuracy = (this.statistics.timesCorrect / this.statistics.timesUsed) * 100;
     }
  
    // Auto-verify if confidence is high
    if (this.confidence >= 0.9 && this.verificationStatus === VERIFICATION_STATUS.PENDING) {
      this.verificationStatus = VERIFICATION_STATUS.VERIFIED;
     }
  }
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Record usage
 */
wordRelationSchema.methods.recordUsage = async function(correct = true) {
  this.statistics.timesUsed += 1;
  if (correct) {
    this.statistics.timesCorrect += 1;
  }
  this.statistics.lastUsed = new Date();
  
  await this.save();
};

/**
 * Verify relation
 */
wordRelationSchema.methods.verify = async function(userId, status = VERIFICATION_STATUS.VERIFIED, notes = '') {
  this.verificationHistory.push({
    status: this.verificationStatus,
    verifiedBy: this.verifiedBy,
    verifiedAt: this.verifiedAt,
    notes: this.notes,
  });
  
  this.verificationStatus = status;
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  this.notes = notes;
  
  await this.save();
};

/**
 * Get related words
 */
wordRelationSchema.methods.getRelatedWords = async function() {
  const Vocabulary = mongoose.model('Vocabulary');
  
  const [source, target] = await Promise.all([
    Vocabulary.findById(this.sourceWord),
    Vocabulary.findById(this.targetWord),
  ]);
  
  return {
    source,
    target,
    relationType: this.relationType,
    strength: this.strength,
  };
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find relations for a word
 */
wordRelationSchema.statics.findForWord = function(wordId, relationType = null) {
  const query = {
    $or: [
      { sourceWord: wordId },
      { targetWord: wordId },
    ],
    isActive: true,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
  };
  
  if (relationType) {
    query.relationType = relationType;
  }
  
  return this.find(query).populate('sourceWord targetWord');
};

/**
 * Find bidirectional relations
 */
wordRelationSchema.statics.findBidirectional = function(wordId1, wordId2) {
  return this.findOne({
    $or: [
      { sourceWord: wordId1, targetWord: wordId2 },
      { sourceWord: wordId2, targetWord: wordId1 },
    ],
    bidirectional: true,
    isActive: true,
  });
};

/**
 * Create bidirectional relation
 */
wordRelationSchema.statics.createBidirectional = async function(data, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const relation1 = new this({
      ...data,
      sourceWord: data.sourceWord,
      targetWord: data.targetWord,
      createdBy: userId,
    });
    
    const relation2 = new this({
      ...data,
      sourceWord: data.targetWord,
      targetWord: data.sourceWord,
      relationType: data.relationType,
      strength: data.strength,
      bidirectional: true,
      createdBy: userId,
    });
    
    await relation1.save({ session });
    await relation2.save({ session });
    
    await session.commitTransaction();
    
    return [relation1, relation2];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get relation statistics
 */
wordRelationSchema.statics.getStats = async function() {
  const [
    total,
    byType,
    verified,
    pending,
    byStrength,
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$relationType', count: { $sum: 1 } } },
    ]),
    this.countDocuments({ verificationStatus: VERIFICATION_STATUS.VERIFIED }),
    this.countDocuments({ verificationStatus: VERIFICATION_STATUS.PENDING }),
    this.aggregate([
      { $match: { isActive: true } },
      {
        $bucket: {
          groupBy: '$strength',
          boundaries: [0, 0.25, 0.5, 0.75, 1.0],
          default: 'other',
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]),
  ]);
  
  return {
    total,
    byType,
    verified,
    pending,
    byStrength,
    verificationRate: total > 0 ? (verified / total) * 100 : 0,
  };
};

module.exports = mongoose.model('WordRelation', wordRelationSchema);
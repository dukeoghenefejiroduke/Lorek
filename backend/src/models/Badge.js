const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const BADGE_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  DIAMOND: 'diamond',
  MASTER: 'master',
  LEGENDARY: 'legendary',
};

const BADGE_CATEGORIES = {
  STREAK: 'streak',
  VOCABULARY: 'vocabulary',
  GRAMMAR: 'grammar',
  LESSONS: 'lessons',
  SOCIAL: 'social',
  CONTRIBUTION: 'contribution',
  CHALLENGE: 'challenge',
  MASTERY: 'mastery',
  SPECIAL: 'special',
  SEASONAL: 'seasonal',
  EVENT: 'event',
};

const BADGE_TYPES = {
  PROGRESS: 'progress',
  MILESTONE: 'milestone',
  COMPETITION: 'competition',
  ACHIEVEMENT: 'achievement',
  SPECIAL: 'special',
};

const AWARD_METHODS = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  CLAIM: 'claim',
  PURCHASE: 'purchase',
};

// ============================================================================
// BADGE SCHEMA
// ============================================================================

const badgeSchema = new mongoose.Schema({
  // Basic information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  
  description: {
    type: String,
    required: true,
  },
  
  shortDescription: {
    type: String,
    maxlength: 50,
  },
  
  category: {
    type: String,
    enum: Object.values(BADGE_CATEGORIES),
    required: true,
    index: true,
  },
  
  type: {
    type: String,
    enum: Object.values(BADGE_TYPES),
    default: BADGE_TYPES.ACHIEVEMENT,
  },
  
  tier: {
    type: String,
    enum: Object.values(BADGE_TIERS),
    required: true,
    index: true,
  },
  
  // Visual representation
  icon: {
    type: String,
    required: true,
  },
  
  iconLocked: String,
  
  image: {
    url: String,
    thumbnail: String,
    animated: Boolean,
  },
  
  color: {
    primary: { type: String, default: '#4CAF50' },
    secondary: { type: String, default: '#2E7D32' },
    accent: { type: String, default: '#FFD700' },
  },
  
  shape: {
    type: String,
    enum: ['circle', 'square', 'hexagon', 'star', 'shield', 'custom'],
    default: 'circle',
  },
  
  animation: {
    type: String,
    enum: ['none', 'pulse', 'glow', 'spin', 'bounce', 'shine'],
    default: 'none',
  },
  
  // Badge criteria
  criteria: {
    type: {
      type: String,
      enum: ['streak', 'words', 'lessons', 'points', 'time', 'social', 'custom'],
      required: true,
    },
    
    target: {
      type: Number,
      required: true,
      min: 1,
    },
    
    operator: {
      type: String,
      enum: ['gte', 'gt', 'eq'],
      default: 'gte',
    },
    
    scope: {
      type: String,
      enum: ['lifetime', 'session', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'lifetime',
    },
    
    conditions: [mongoose.Schema.Types.Mixed],
  },
  
  // Award information
  awardMethod: {
    type: String,
    enum: Object.values(AWARD_METHODS),
    default: AWARD_METHODS.AUTOMATIC,
  },
  
  maxAwards: {
    type: Number,
    default: null, // null = unlimited
  },
  
  unique: {
    type: Boolean,
    default: true, // Can user earn multiple times?
  },
  
  repeatable: {
    type: Boolean,
    default: false,
  },
  
  cooldown: Number, // days before can earn again
  
  // Points and rewards
  pointsValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  experienceValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  rewards: [{
    type: {
      type: String,
      enum: ['title', 'cosmetic', 'currency', 'feature', 'discount'],
    },
    value: mongoose.Schema.Types.Mixed,
    description: String,
  }],
  
  // Display information
  display: {
    order: {
      type: Number,
      default: 0,
    },
    
    group: String,
    
    hidden: {
      type: Boolean,
      default: false,
    },
    
    secret: {
      type: Boolean,
      default: false,
    },
    
    featured: {
      type: Boolean,
      default: false,
    },
    
    showProgress: {
      type: Boolean,
      default: true,
    },
    
    progressFormat: {
      type: String,
      default: '{current}/{target}',
    },
    
    badgeSize: {
      type: String,
      enum: ['small', 'medium', 'large', 'xl'],
      default: 'medium',
    },
  },
  
  // Unlock message
  unlockMessage: {
    title: String,
    body: String,
    shareText: String,
    notification: Boolean,
  },
  
  // Related badges
  prerequisites: [{
    badgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge',
    },
    required: Boolean,
  }],
  
  upgradesTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
  },
  
  upgradesFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
  },
  
  relatedBadges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
  }],
  
  // Statistics
  statistics: {
    awardedCount: {
      type: Number,
      default: 0,
    },
    
    uniqueRecipients: {
      type: Number,
      default: 0,
    },
    
    firstAwarded: Date,
    lastAwarded: Date,
    
    rarity: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
  },
  
  // Availability
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  isLimited: {
    type: Boolean,
    default: false,
  },
  
  limitedQuantity: Number,
  
  availableFrom: Date,
  availableTo: Date,
  
  seasonal: {
    season: String,
    year: Number,
    recurring: Boolean,
  },
  
  // Metadata
  version: {
    type: Number,
    default: 1,
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  tags: [{
    type: String,
    index: true,
  }],
  
  notes: String,
  
}, {
  timestamps: true,
});

// ============================================================================
// INDEXES
// ============================================================================

badgeSchema.index({ category: 1, tier: 1 });
badgeSchema.index({ 'statistics.awardedCount': -1 });
badgeSchema.index({ 'statistics.rarity': 1 });
badgeSchema.index({ isLimited: 1, availableTo: 1 });
// Wrap keys with dots in quotes
badgeSchema.index({ 'display.featured': 1, 'display.order': 1 });
badgeSchema.index({ tags: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

badgeSchema.virtual('isSecret').get(function() {
  return this.display?.secret || false;
});

badgeSchema.virtual('isHidden').get(function() {
  return this.display?.hidden || false;
});

badgeSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  
  if (!this.isActive) return false;
  
  if (this.availableFrom && now < this.availableFrom) return false;
  if (this.availableTo && now > this.availableTo) return false;
  
  if (this.isLimited && this.limitedQuantity && 
      this.statistics.awardedCount >= this.limitedQuantity) {
    return false;
  }
  
  return true;
});

badgeSchema.virtual('completionRate').get(function() {
  if (this.statistics?.uniqueRecipients && this.statistics?.awardedCount) {
    return Math.round((this.statistics.uniqueRecipients / this.statistics.awardedCount) * 100);
  }
  return 0;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Check if user meets criteria
 */
badgeSchema.methods.checkCriteria = async function(user) {
  const criteria = this.criteria;
  let currentValue = 0;
  
  switch (criteria.type) {
    case 'streak':
      currentValue = user.progress?.streak?.current || 0;
      break;
    case 'words':
      currentValue = user.vocabularyMastery?.length || 0;
      break;
    case 'lessons':
      currentValue = user.progress?.completedLessons?.length || 0;
      break;
    case 'points':
      currentValue = user.progress?.totalPoints || 0;
      break;
    case 'time':
      currentValue = user.analytics?.totalTimeSpent || 0;
      break;
    case 'social':
      currentValue = user.friends?.length || 0;
      break;
    case 'custom':
      // Custom logic would be implemented here
      return false;
  }
  
  switch (criteria.operator) {
    case 'gte':
      return currentValue >= criteria.target;
    case 'gt':
      return currentValue > criteria.target;
    case 'eq':
      return currentValue === criteria.target;
    default:
      return false;
  }
};

/**
 * Award badge to user
 */
badgeSchema.methods.awardToUser = async function(userId, metadata = {}) {
  const UserBadge = mongoose.model('UserBadge');
  
  // Check if user already has this badge
  if (this.unique) {
    const existing = await UserBadge.findOne({
      user: userId,
      badge: this._id,
    });
    
    if (existing) {
      return { success: false, message: 'User already has this badge' };
    }
  }
  
  // Create user badge
  const userBadge = new UserBadge({
    user: userId,
    badge: this._id,
    awardedAt: new Date(),
    metadata,
    tier: this.tier,
  });
  
  await userBadge.save();
  
  // Update statistics
  this.statistics.awardedCount += 1;
  
  const uniqueCheck = await UserBadge.distinct('user', { badge: this._id });
  this.statistics.uniqueRecipients = uniqueCheck.length;
  
  this.statistics.lastAwarded = new Date();
  if (!this.statistics.firstAwarded) {
    this.statistics.firstAwarded = new Date();
  }
  
  // Update rarity based on award rate
  const totalUsers = await mongoose.model('User').countDocuments({});
  if (totalUsers > 0) {
    this.statistics.rarity = Math.round((this.statistics.uniqueRecipients / totalUsers) * 100);
  }
  
  await this.save();
  
  return {
    success: true,
    userBadge,
    badge: this,
  };
};

/**
 * Update statistics
 */
badgeSchema.methods.updateStatistics = async function() {
  const UserBadge = mongoose.model('UserBadge');
  
  const [awardedCount, uniqueRecipients] = await Promise.all([
    UserBadge.countDocuments({ badge: this._id }),
    UserBadge.distinct('user', { badge: this._id }),
  ]);
  
  this.statistics.awardedCount = awardedCount;
  this.statistics.uniqueRecipients = uniqueRecipients.length;
  
  if (awardedCount > 0) {
    const first = await UserBadge.findOne({ badge: this._id }).sort({ awardedAt: 1 });
    const last = await UserBadge.findOne({ badge: this._id }).sort({ awardedAt: -1 });
    
    this.statistics.firstAwarded = first?.awardedAt;
    this.statistics.lastAwarded = last?.awardedAt;
  }
  
  // Update rarity
  const totalUsers = await mongoose.model('User').countDocuments({});
  if (totalUsers > 0) {
    this.statistics.rarity = Math.round((this.statistics.uniqueRecipients / totalUsers) * 100);
  }
  
  await this.save();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get badges by category
 */
badgeSchema.statics.getByCategory = function(category, includeHidden = false) {
  const query = { category, isActive: true };
  
  if (!includeHidden) {
    query['display.hidden'] = false;
  }
  
  return this.find(query).sort({ tier: 1, 'display.order': 1 });
};

/**
 * Get badges by tier
 */
badgeSchema.statics.getByTier = function(tier) {
  return this.find({
    tier,
    isActive: true,
    'display.hidden': false,
  }).sort({ 'display.order': 1 });
};

/**
 * Get featured badges
 */
badgeSchema.statics.getFeatured = function(limit = 5) {
  return this.find({
    'display.featured': true,
    isActive: true,
    'display.hidden': false,
  })
    .sort({ 'display.order': 1 })
    .limit(limit);
};

/**
 * Get seasonal badges
 */
badgeSchema.statics.getSeasonal = function(season, year) {
  return this.find({
    'seasonal.season': season,
    $or: [
      { 'seasonal.year': year },
      { 'seasonal.recurring': true },
    ],
    isActive: true,
  });
};
  /**
 * Get available badges
 */
badgeSchema.statics.getAvailable = async function() {
  const now = new Date();
  
  return this.find({
    isActive: true,
    'display.hidden': false,
    $or: [
      { availableFrom: { $lte: now } },
      { availableFrom: null },
    ],
    $or: [
      { availableTo: { $gte: now } },
      { availableTo: null },
    ],
  }).sort({ tier: 1, 'display.order': 1 });
};

/**
 * Get badge statistics
 */
badgeSchema.statics.getStats = async function() {
  const [
    total,
    byCategory,
    byTier,
    totalAwarded,
    rarest,
    mostCommon,
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$tier', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $group: { _id: null, total: { $sum: '$statistics.awardedCount' } } },
    ]),
    this.findOne({ isActive: true }).sort({ 'statistics.rarity': 1 }),
    this.findOne({ isActive: true }).sort({ 'statistics.rarity': -1 }),
  ]);
  
  return {
    total,
    byCategory,
    byTier,
    totalAwarded: totalAwarded[0]?.total || 0,
    rarest,
    mostCommon,
  };
};

module.exports = mongoose.model('Badge', badgeSchema);
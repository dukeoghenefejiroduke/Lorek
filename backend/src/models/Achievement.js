const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const ACHIEVEMENT_TYPES = {
  LESSON_COMPLETION: 'lesson_completion',
  STREAK_MILESTONE: 'streak_milestone',
  VOCABULARY_MILESTONE: 'vocabulary_milestone',
  PERFECT_SCORE: 'perfect_score',
  TIME_MILESTONE: 'time_milestone',
  SOCIAL_MILESTONE: 'social_milestone',
  CONTRIBUTION_MILESTONE: 'contribution_milestone',
  MASTERY_MILESTONE: 'mastery_milestone',
  CHALLENGE_COMPLETION: 'challenge_completion',
  SPECIAL_EVENT: 'special_event',
};

const ACHIEVEMENT_RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
  SECRET: 'secret',
};

const ACHIEVEMENT_CATEGORIES = {
  LEARNING: 'learning',
  STREAK: 'streak',
  VOCABULARY: 'vocabulary',
  GRAMMAR: 'grammar',
  CULTURE: 'culture',
  SOCIAL: 'social',
  CONTRIBUTION: 'contribution',
  SPECIAL: 'special',
};

const REWARD_TYPES = {
  POINTS: 'points',
  BADGE: 'badge',
  TITLE: 'title',
  COSMETIC: 'cosmetic',
  FEATURE: 'feature',
  CURRENCY: 'currency',
  CERTIFICATE: 'certificate',
};

// ============================================================================
// ACHIEVEMENT SCHEMA
// ============================================================================

const achievementSchema = new mongoose.Schema({
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
    maxlength: 100,
  },
  
  category: {
    type: String,
    enum: Object.values(ACHIEVEMENT_CATEGORIES),
    required: true,
    index: true,
  },
  
  type: {
    type: String,
    enum: Object.values(ACHIEVEMENT_TYPES),
    required: true,
    index: true,
  },
  
  rarity: {
    type: String,
    enum: Object.values(ACHIEVEMENT_RARITY),
    default: ACHIEVEMENT_RARITY.COMMON,
  },
  
  // Visual representation
  icon: {
    type: String,
    required: true,
  },
  
  iconLocked: String,
  
  badgeImage: {
    url: String,
    thumbnail: String,
  },
  
  color: {
    type: String,
    default: '#4CAF50',
  },
  
  animation: {
    type: String,
    enum: ['none', 'pulse', 'glow', 'spin', 'bounce'],
    default: 'none',
  },
  
  // Achievement criteria
  criteria: {
    type: {
      type: String,
      required: true,
    },
    
    target: {
      type: Number,
      required: true,
      min: 1,
    },
    
    operator: {
      type: String,
      enum: ['gte', 'gt', 'eq', 'lte', 'lt'],
      default: 'gte',
    },
    
    scope: {
      type: String,
      enum: ['lifetime', 'session', 'daily', 'weekly', 'monthly'],
      default: 'lifetime',
    },
    
    conditions: [{
      field: String,
      value: mongoose.Schema.Types.Mixed,
      operator: String,
    }],
    
    prerequisites: [{
      achievementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Achievement',
      },
      required: Boolean,
    }],
  },
  
  // Progression tracking
  progression: {
    steps: [{
      step: Number,
      target: Number,
      reward: mongoose.Schema.Types.Mixed,
      message: String,
    }],
    
    showProgress: {
      type: Boolean,
      default: true,
    },
    
    progressFormat: {
      type: String,
      default: '{current}/{target}',
    },
  },
  
  // Rewards
  rewards: [{
    type: {
      type: String,
      enum: Object.values(REWARD_TYPES),
      required: true,
    },
    
    value: mongoose.Schema.Types.Mixed,
    
    description: String,
    
    claimedAutomatically: {
      type: Boolean,
      default: true,
    },
    
    claimableOnce: {
      type: Boolean,
      default: true,
    },
    
    expiresIn: Number, // days
  }],
  
  // Experience points awarded
  experiencePoints: {
    type: Number,
    default: 50,
    min: 0,
  },
  
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
    
    revealCondition: String,
    
    featured: {
      type: Boolean,
      default: false,
    },
    
    badgeSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium',
    },
  },
  
  // Unlock message
  unlockMessage: {
    title: String,
    body: String,
    shareText: String,
  },
  
  // Statistics
  statistics: {
    timesAchieved: {
      type: Number,
      default: 0,
    },
    
    uniqueAchievers: {
      type: Number,
      default: 0,
    },
    
    firstAchieved: Date,
    lastAchieved: Date,
    
    averageTimeToAchieve: Number, // days
    
    achievementRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  
  // Related content
  relatedAchievements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
  }],
  
  relatedBadges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
  }],
  
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
  
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  isLimited: {
    type: Boolean,
    default: false,
  },
  
  limitedTo: Date,
  
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

achievementSchema.index({ category: 1, rarity: 1 });
achievementSchema.index({ 'statistics.timesAchieved': -1 });
achievementSchema.index({ 'display.featured': 1, 'display.order': 1 });
achievementSchema.index({ tags: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

achievementSchema.virtual('isSecret').get(function() {
  return this.display?.secret || false;
});

achievementSchema.virtual('isHidden').get(function() {
  return this.display?.hidden || false;
});

achievementSchema.virtual('completionRate').get(function() {
  if (this.statistics?.uniqueAchievers && this.statistics?.timesAchieved) {
    return Math.round((this.statistics.uniqueAchievers / this.statistics.timesAchieved) * 100);
  }
  return 0;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Check if user meets criteria
 */
achievementSchema.methods.checkCriteria = async function(user, currentValue) {
  const criteria = this.criteria;
  
  let met = false;
  
  switch (criteria.operator) {
    case 'gte':
      met = currentValue >= criteria.target;
      break;
    case 'gt':
      met = currentValue > criteria.target;
      break;
    case 'eq':
      met = currentValue === criteria.target;
      break;
    case 'lte':
      met = currentValue <= criteria.target;
      break;
    case 'lt':
      met = currentValue < criteria.target;
      break;
  }
  
  // Check additional conditions
  if (met && criteria.conditions && criteria.conditions.length > 0) {
    for (const condition of criteria.conditions) {
      const userValue = this.getUserFieldValue(user, condition.field);
      
      switch (condition.operator) {
        case 'eq':
          met = met && userValue === condition.value;
          break;
        case 'in':
          met = met && condition.value.includes(userValue);
          break;
        case 'contains':
          met = met && userValue.includes(condition.value);
          break;
      }
      
      if (!met) break;
    }
  }
  
  // Check prerequisites
  if (met && criteria.prerequisites && criteria.prerequisites.length > 0) {
    const AchievementProgress = mongoose.model('AchievementProgress');
    
    for (const prereq of criteria.prerequisites) {
      if (prereq.required) {
        const progress = await AchievementProgress.findOne({
          user: user._id,
          achievement: prereq.achievementId,
          completed: true,
        });
        
        if (!progress) {
          met = false;
          break;
        }
      }
    }
  }
  
  return met;
};

/**
 * Get user field value
 */
achievementSchema.methods.getUserFieldValue = function(user, field) {
  const fields = field.split('.');
  let value = user;
  
  for (const f of fields) {
    if (value && value[f] !== undefined) {
      value = value[f];
    } else {
      return null;
    }
  }
  
  return value;
};

/**
 * Get progress step
 */
achievementSchema.methods.getProgressStep = function(currentValue) {
  if (!this.progression || !this.progression.steps) {
    return null;
  }
  
  for (let i = this.progression.steps.length - 1; i >= 0; i--) {
    if (currentValue >= this.progression.steps[i].target) {
      return this.progression.steps[i];
    }
  }
  
  return null;
};

/**
 * Update statistics
 */
achievementSchema.methods.updateStatistics = async function() {
  const AchievementProgress = mongoose.model('AchievementProgress');
  
  const [timesAchieved, uniqueAchievers] = await Promise.all([
    AchievementProgress.countDocuments({
      achievement: this._id,
      completed: true,
    }),
    AchievementProgress.distinct('user', {
      achievement: this._id,
      completed: true,
    }),
  ]);
  
  this.statistics.timesAchieved = timesAchieved;
  this.statistics.uniqueAchievers = uniqueAchievers.length;
  
  if (timesAchieved > 0) {
    const first = await AchievementProgress.findOne({
      achievement: this._id,
      completed: true,
    }).sort({ completedAt: 1 });
    
    const last = await AchievementProgress.findOne({
      achievement: this._id,
      completed: true,
    }).sort({ completedAt: -1 });
    
    this.statistics.firstAchieved = first?.completedAt;
    this.statistics.lastAchieved = last?.completedAt;
  }
  
  await this.save();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get achievements by category
 */
achievementSchema.statics.getByCategory = function(category, includeHidden = false) {
  const query = { category, isActive: true };
  
  if (!includeHidden) {
    query['display.hidden'] = false;
  }
  
  return this.find(query).sort({ 'display.order': 1 });
};

/**
 * Get featured achievements
 */
achievementSchema.statics.getFeatured = function(limit = 5) {
  return this.find({
    'display.featured': true,
    isActive: true,
    'display.hidden': false,
  })
    .sort({ 'display.order': 1 })
    .limit(limit);
};

/**
 * Get secret achievements
 */
achievementSchema.statics.getSecret = function() {
  return this.find({
    'display.secret': true,
    isActive: true,
  });
};

/**
 * Get achievements by rarity
 */
achievementSchema.statics.getByRarity = function(rarity) {
  return this.find({
    rarity,
    isActive: true,
    'display.hidden': false,
  }).sort({ 'display.order': 1 });
};

/**
 * Get achievement statistics
 */
achievementSchema.statics.getStats = async function() {
  const [
    total,
    byCategory,
    byRarity,
    totalEarned,
  ] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$rarity', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $group: { _id: null, total: { $sum: '$statistics.timesAchieved' } } },
    ]),
  ]);
  
  return {
    total,
    byCategory,
    byRarity,
    totalEarned: totalEarned[0]?.total || 0,
  };
};

module.exports = mongoose.model('Achievement', achievementSchema);
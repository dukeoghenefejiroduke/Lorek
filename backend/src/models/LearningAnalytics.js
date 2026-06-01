const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const ANALYTICS_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

const ACTIVITY_TYPES = {
  LESSON: 'lesson',
  PRACTICE: 'practice',
  REVIEW: 'review',
  ASSESSMENT: 'assessment',
  VOCABULARY: 'vocabulary',
  SOCIAL: 'social',
};

const PERFORMANCE_METRICS = {
  ACCURACY: 'accuracy',
  SPEED: 'speed',
  RETENTION: 'retention',
  CONSISTENCY: 'consistency',
  MASTERY: 'mastery',
};

// ============================================================================
// LEARNING ANALYTICS SCHEMA
// ============================================================================

const learningAnalyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Time period
  period: {
    type: String,
    enum: Object.values(ANALYTICS_TYPES),
    required: true,
    index: true,
  },
  
  date: {
    type: Date,
    required: true,
    index: true,
  },
  
  // Activity summary
  activity: {
    totalSessions: {
      type: Number,
      default: 0,
    },
    
    totalTime: {
      type: Number, // minutes
      default: 0,
    },
    
    byType: {
      lesson: { type: Number, default: 0 },
      practice: { type: Number, default: 0 },
      review: { type: Number, default: 0 },
      assessment: { type: Number, default: 0 },
      vocabulary: { type: Number, default: 0 },
      social: { type: Number, default: 0 },
    },
    
    byHour: {
      type: Map,
      of: Number,
      default: {},
    },
    
    byDayOfWeek: {
      type: Map,
      of: Number,
      default: {},
    },
    
    peakTime: String,
    mostProductiveDay: String,
  },
  
  // Learning progress
  progress: {
    lessonsCompleted: {
      type: Number,
      default: 0,
    },
    
    wordsLearned: {
      type: Number,
      default: 0,
    },
    
    wordsReviewed: {
      type: Number,
      default: 0,
    },
    
    masteryGained: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    levelProgress: {
      from: Number,
      to: Number,
      gained: Number,
    },
    
    pointsEarned: {
      type: Number,
      default: 0,
    },
    
    streaks: {
      started: Number,
      continued: Number,
      broken: Number,
      longest: Number,
    },
  },
  
  // Performance metrics
  performance: {
    accuracy: {
      overall: { type: Number, default: 0, min: 0, max: 100 },
      byType: {
        type: Map,
        of: Number,
      },
      trend: [Number],
    },
    
    speed: {
      average: { type: Number, default: 0 }, // seconds per item
      byType: {
        type: Map,
        of: Number,
      },
      improvement: { type: Number, default: 0 }, // percentage
    },
    
    retention: {
      shortTerm: { type: Number, default: 0 }, // 1 day
      mediumTerm: { type: Number, default: 0 }, // 1 week
      longTerm: { type: Number, default: 0 }, // 1 month
      byCategory: {
        type: Map,
        of: Number,
      },
    },
    
    consistency: {
      daily: { type: Number, default: 0 }, // days active / total days
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      score: { type: Number, default: 0, min: 0, max: 100 },
    },
    
    mastery: {
      overall: { type: Number, default: 0, min: 0, max: 100 },
      byCategory: {
        type: Map,
        of: Number,
      },
      byDifficulty: {
        beginner: { type: Number, default: 0 },
        intermediate: { type: Number, default: 0 },
        advanced: { type: Number, default: 0 },
      },
    },
  },
  
  // Learning patterns
  patterns: {
    preferredTime: String,
    preferredDay: String,
    sessionDuration: {
      average: Number,
      optimal: Number,
      distribution: {
        type: Map,
        of: Number,
      },
    },
    
    learningStyle: {
      visual: { type: Number, default: 0 },
      auditory: { type: Number, default: 0 },
      kinesthetic: { type: Number, default: 0 },
      reading: { type: Number, default: 0 },
    },
    
    difficultyPreference: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
    
    mistakePatterns: [{
      type: String,
      frequency: Number,
      commonWords: [String],
    }],
    
    strengths: [{
      area: String,
      score: Number,
    }],
    
    weaknesses: [{
      area: String,
      score: Number,
      recommended: String,
    }],
  },
  
  // Engagement metrics
  engagement: {
    focusScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    returnRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    satisfaction: {
      average: { type: Number, default: 1, min: 1, max: 5 },
      trend: [Number],
    },
    
    churnRisk: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  
  // Comparative analytics
  comparison: {
    vsPrevious: {
      activity: { type: Number, default: 0 },
      progress: { type: Number, default: 0 },
      performance: { type: Number, default: 0 },
    },
    
    vsAverage: {
      activity: { type: Number, default: 0 },
      progress: { type: Number, default: 0 },
      performance: { type: Number, default: 0 },
    },
    
    vsTopPerformers: {
      activity: { type: Number, default: 0 },
      progress: { type: Number, default: 0 },
      performance: { type: Number, default: 0 },
    },
    
    percentile: {
      global: { type: Number, default: 50 },
      byLevel: { type: Number, default: 50 },
      byRegion: { type: Number, default: 50 },
    },
  },
  
  // Predictions
  predictions: {
    nextLevelDate: Date,
    masteryDate: Date,
    churnProbability: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    recommendedNext: {
      lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
      category: String,
      difficulty: String,
    },
    
    learningRate: {
      wordsPerDay: Number,
      lessonsPerWeek: Number,
      timePerDay: Number,
    },
    
    projectedMastery: {
      '30days': Number,
      '90days': Number,
      '365days': Number,
    },
  },
  
  // Metadata
  metadata: {
    version: { type: String, default: '1.0' },
    confidence: { type: Number, default: 0.8, min: 0, max: 1 },
    generatedAt: { type: Date, default: Date.now },
    dataPoints: Number,
  },
  
}, {
  timestamps: true,
});

// ============================================================================
// INDEXES
// ============================================================================

learningAnalyticsSchema.index({ user: 1, period: 1, date: -1 });
learningAnalyticsSchema.index({ user: 1, 'predictions.churnProbability': -1 });
learningAnalyticsSchema.index({ 'patterns.weaknesses.area': 1 });
learningAnalyticsSchema.index({ date: -1 });

// ============================================================================
// VIRTUALS
// ============================================================================

learningAnalyticsSchema.virtual('productivityScore').get(function() {
  const scores = [
    this.activity.totalTime / 60, // normalize to hours
    this.performance.accuracy.overall / 10,
    this.performance.mastery.overall / 10,
    this.engagement.focusScore / 10,
  ];
  
  return Math.min(100, Math.round(scores.reduce((a, b) => a + b, 0) * 2.5));
});

learningAnalyticsSchema.virtual('learningVelocity').get(function() {
  if (!this.progress.wordsLearned) return 0;
  const days = this.period === 'daily' ? 1 : 
               this.period === 'weekly' ? 7 : 
               this.period === 'monthly' ? 30 : 365;
  return Math.round((this.progress.wordsLearned / days) * 10) / 10;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Calculate risk factors
 */
learningAnalyticsSchema.methods.calculateChurnRisk = function() {
  let risk = 0;
  
  // Low activity
  if (this.activity.totalSessions < 3 && this.period === 'weekly') {
    risk += 30;
  }
  
  // Decreasing engagement
  if (this.engagement.focusScore < 50) {
    risk += 20;
  }
  
  // Poor performance
  if (this.performance.accuracy.overall < 60) {
    risk += 25;
  }
  
  // Low retention
  if (this.performance.retention.shortTerm < 50) {
    risk += 25;
  }
  
  this.engagement.churnRisk = Math.min(100, risk);
  return this.engagement.churnRisk;
};

/**
 * Generate insights
 */
learningAnalyticsSchema.methods.generateInsights = function() {
  const insights = [];
  
  // Positive insights
  if (this.progress.wordsLearned > this.progress.wordsLearned * 1.2) {
    insights.push({
      type: 'positive',
      message: `You're learning faster than last period! (+${Math.round((this.progress.wordsLearned / this.progress.wordsLearned - 1) * 100)}%)`,
    });
  }
  
  if (this.performance.accuracy.overall > 85) {
    insights.push({
      type: 'positive',
      message: 'Excellent accuracy! Your understanding is solid.',
    });
  }
  
  if (this.activity.streaks.continued > 5) {
    insights.push({
      type: 'positive',
      message: `Amazing! You've maintained a ${this.activity.streaks.continued}-day streak!`,
    });
  }
  
  // Improvement areas
  if (this.performance.accuracy.overall < 70) {
    insights.push({
      type: 'warning',
      message: 'Your accuracy could use improvement. Try more practice exercises.',
    });
  }
  
  if (this.activity.totalTime < 30 && this.period === 'weekly') {
    insights.push({
      type: 'warning',
      message: 'You might benefit from more study time this week.',
    });
  }
  
  if (this.performance.retention.shortTerm < 60) {
    insights.push({
      type: 'warning',
      message: 'Review older words more frequently to improve retention.',
    });
  }
  
  // Weakness insights
  this.patterns.weaknesses.slice(0, 3).forEach(weakness => {
    insights.push({
      type: 'action',
      message: `Focus on improving ${weakness.area}. ${weakness.recommended}`,
    });
  });
  
  return insights;
};

/**
 * Update with new data
 */
 learningAnalyticsSchema.methods.updateWithSession = function(sessionData) {
  // Fix Satisfaction Calculation
  if (sessionData.satisfaction) {
    const sessions = this.activity.totalSessions || 0;
    const currentTotal = (this.engagement.satisfaction.average || 1) * sessions;
    const updatedAverage = (currentTotal + sessionData.satisfaction) / (sessions + 1);
    this.engagement.satisfaction.average = Math.min(5, Math.max(1, updatedAverage));
  } else if (!this.engagement.satisfaction.average) {
    this.engagement.satisfaction.average = 1; // Default to satisfy min:1
  }

  // Activity Updates
  this.activity.totalSessions += 1;
  this.activity.totalTime += (sessionData.duration || 0);

  // Map Handling for FerretDB Compatibility
  const hour = new Date().getHours().toString();
  const day = new Date().getDay().toString();
  
  // Ensure Maps are initialized
  if (!this.activity.byHour) this.activity.byHour = new Map();
  if (!this.activity.byDayOfWeek) this.activity.byDayOfWeek = new Map();
  
  this.activity.byHour.set(hour, (this.activity.byHour.get(hour) || 0) + 1);
  this.activity.byDayOfWeek.set(day, (this.activity.byDayOfWeek.get(day) || 0) + 1);

  // Update by type
  if (sessionData.type) {
    this.activity.byType[sessionData.type] = (this.activity.byType[sessionData.type] || 0) + 1;
  }
  
  // Update progress
  if (sessionData.wordsLearned) {
    this.progress.wordsLearned += sessionData.wordsLearned;
  }
  
  if (sessionData.wordsReviewed) {
    this.progress.wordsReviewed += sessionData.wordsReviewed;
  }
  
  if (sessionData.lessonsCompleted) {
    this.progress.lessonsCompleted += sessionData.lessonsCompleted;
  }
  
  if (sessionData.pointsEarned) {
    this.progress.pointsEarned += sessionData.pointsEarned;
  }
  
  // Update performance
  if (sessionData.accuracy) {
    const oldTotal = this.performance.accuracy.overall * (this.activity.totalSessions - 1);
    this.performance.accuracy.overall = (oldTotal + sessionData.accuracy) / this.activity.totalSessions;
    
    if (!this.performance.accuracy.trend) {
      this.performance.accuracy.trend = [];
    }
    this.performance.accuracy.trend.push(sessionData.accuracy);
    if (this.performance.accuracy.trend.length > 10) {
      this.performance.accuracy.trend.shift();
    }
  }
  
  // Update patterns
  if (sessionData.mistakes) {
    sessionData.mistakes.forEach(mistake => {
      let pattern = this.patterns.mistakePatterns.find(p => p.type === mistake.type);
      if (!pattern) {
        pattern = { type: mistake.type, frequency: 0, commonWords: [] };
        this.patterns.mistakePatterns.push(pattern);
      }
      pattern.frequency += 1;
      
      if (mistake.word && !pattern.commonWords.includes(mistake.word)) {
        pattern.commonWords.push(mistake.word);
        if (pattern.commonWords.length > 5) {
          pattern.commonWords.shift();
        }
      }
    });
  }
  
  // Update engagement
  if (sessionData.focusScore) {
    const oldFocus = this.engagement.focusScore * (this.activity.totalSessions - 1);
    this.engagement.focusScore = (oldFocus + sessionData.focusScore) / this.activity.totalSessions;
  }
  
  this.metadata.dataPoints = this.activity.totalSessions;
  this.metadata.generatedAt = new Date();
  
  // Recalculate risk
  this.calculateChurnRisk();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get analytics for user over time
 */
learningAnalyticsSchema.statics.getUserTimeline = function(userId, period = ANALYTICS_TYPES.WEEKLY, limit = 12) {
  return this.find({ user: userId, period })
    .sort({ date: -1 })
    .limit(limit);
};

/**
 * Get aggregate statistics
 */
learningAnalyticsSchema.statics.getAggregates = async function(period = ANALYTICS_TYPES.WEEKLY) {
  const now = new Date();
  const startDate = new Date(now);
  
  switch (period) {
    case ANALYTICS_TYPES.DAILY:
      startDate.setDate(startDate.getDate() - 1);
      break;
    case ANALYTICS_TYPES.WEEKLY:
      startDate.setDate(startDate.getDate() - 7);
      break;
    case ANALYTICS_TYPES.MONTHLY:
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case ANALYTICS_TYPES.YEARLY:
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }
  
  const pipeline = [
    {
      $match: {
        period,
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalSessions: { $sum: '$activity.totalSessions' },
        totalTime: { $sum: '$activity.totalTime' },
        avgAccuracy: { $avg: '$performance.accuracy.overall' },
        avgFocus: { $avg: '$engagement.focusScore' },
        avgRetention: { $avg: '$performance.retention.shortTerm' },
        totalWordsLearned: { $sum: '$progress.wordsLearned' },
        avgChurnRisk: { $avg: '$engagement.churnRisk' },
      },
    },
  ];
  
  const results = await this.aggregate(pipeline);
  
  return results[0] || {
    totalUsers: 0,
    totalSessions: 0,
    totalTime: 0,
    avgAccuracy: 0,
    avgFocus: 0,
    avgRetention: 0,
    totalWordsLearned: 0,
    avgChurnRisk: 0,
  };
};

/**
 * Get users at risk
 */
learningAnalyticsSchema.statics.getAtRiskUsers = function(threshold = 70, limit = 50) {
  return this.find({
    'engagement.churnRisk': { $gte: threshold },
    period: ANALYTICS_TYPES.WEEKLY,
  })
    .sort({ 'engagement.churnRisk': -1 })
    .limit(limit)
    .populate('user', 'username email');
};

/**
 * Generate predictions
 */
learningAnalyticsSchema.statics.generatePredictions = async function(userId) {
  const analytics = await this.find({ user: userId, period: ANALYTICS_TYPES.WEEKLY })
    .sort({ date: -1 })
    .limit(8);
  
  if (analytics.length < 4) {
    return null;
  }
  
  const wordsLearned = analytics.map(a => a.progress.wordsLearned);
  const avgWordsPerWeek = wordsLearned.reduce((a, b) => a + b, 0) / wordsLearned.length;
  
  const accuracy = analytics.map(a => a.performance.accuracy.overall);
  const accuracyTrend = accuracy[accuracy.length - 1] - accuracy[0];
  
  const retention = analytics.map(a => a.performance.retention.shortTerm);
  const retentionTrend = retention[retention.length - 1] - retention[0];
  
  return {
    wordsPerDay: avgWordsPerWeek / 7,
    accuracyTrend,
    retentionTrend,
    confidence: analytics.length / 8,
  };
};

module.exports = mongoose.model('LearningAnalytics', learningAnalyticsSchema);
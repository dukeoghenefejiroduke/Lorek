const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const LEADERBOARD_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  ALL_TIME: 'all_time',
};

const LEADERBOARD_CATEGORIES = {
  POINTS: 'points',
  STREAK: 'streak',
  WORDS: 'words',
  LESSONS: 'lessons',
  ACCURACY: 'accuracy',
  CONTRIBUTIONS: 'contributions',
  SOCIAL: 'social',
};

// ============================================================================
// LEADERBOARD HISTORY SCHEMA
// ============================================================================

const leaderboardHistorySchema = new mongoose.Schema({
  // Period information
  period: {
    type: String,
    enum: Object.values(LEADERBOARD_PERIODS),
    required: true,
    index: true,
  },
  
  category: {
    type: String,
    enum: Object.values(LEADERBOARD_CATEGORIES),
    required: true,
    index: true,
  },
  
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  
  endDate: {
    type: Date,
    required: true,
    index: true,
  },
  
  // Snapshot of top users
  topUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    rank: {
      type: Number,
      required: true,
    },
    
    username: String,
    
    value: {
      type: Number,
      required: true,
    },
    
    previousRank: Number,
    rankChange: Number,
    
    metadata: {
      streak: Number,
      level: Number,
      badges: Number,
      avatar: String,
    },
    
    snapshot: {
      points: Number,
      wordsLearned: Number,
      lessonsCompleted: Number,
      timeSpent: Number,
    },
  }],
  
  // User's rank at this time (if requesting user)
  userRank: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rank: Number,
    value: Number,
    totalUsers: Number,
    percentile: Number,
  },
  
  // Statistics
  statistics: {
    totalParticipants: {
      type: Number,
      required: true,
    },
    
    averageValue: Number,
    medianValue: Number,
    highestValue: Number,
    lowestValue: Number,
    
    topScore: Number,
    bottomScore: Number,
    
    distribution: {
      top10Percent: Number,
      top25Percent: Number,
      top50Percent: Number,
    },
  },
  
  // Historical data for trends
  trends: {
    topGainers: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      gain: Number,
      percentage: Number,
    }],
    
    topLosers: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      loss: Number,
      percentage: Number,
    }],
    
    volatility: Number, // Measure of rank changes
    stability: Number, // Users in top 100 from previous period
  },
  
  // Metadata
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  generatedBy: {
    type: String,
    enum: ['system', 'manual', 'scheduled'],
    default: 'system',
  },
  
  version: {
    type: String,
    default: '1.0',
  },
  
  notes: String,
  
}, {
  timestamps: true,
});

// ============================================================================
// INDEXES
// ============================================================================

leaderboardHistorySchema.index({ period: 1, startDate: -1 });
leaderboardHistorySchema.index({ category: 1, period: 1, startDate: -1 });
leaderboardHistorySchema.index({ 'topUsers.userId': 1, period: 1, startDate: -1 });
leaderboardHistorySchema.index({ generatedAt: -1 });

// ============================================================================
// VIRTUALS
// ============================================================================

leaderboardHistorySchema.virtual('duration').get(function() {
  return (this.endDate - this.startDate) / (1000 * 60 * 60 * 24); // days
});

leaderboardHistorySchema.virtual('isCurrent').get(function() {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Get user's rank in this leaderboard
 */
leaderboardHistorySchema.methods.getUserRank = function(userId) {
  const userEntry = this.topUsers.find(u => 
    u.userId.toString() === userId.toString()
  );
  
  if (userEntry) {
    return {
      ...userEntry.toObject(),
      totalUsers: this.statistics.totalParticipants,
      percentile: ((this.statistics.totalParticipants - userEntry.rank) / this.statistics.totalParticipants) * 100,
    };
  }
  
  return null;
};

/**
 * Get rank changes compared to previous period
 */
leaderboardHistorySchema.methods.getRankChanges = async function() {
  const LeaderboardHistory = mongoose.model('LeaderboardHistory');
  
  const previous = await LeaderboardHistory.findOne({
    period: this.period,
    category: this.category,
    endDate: { $lt: this.startDate },
  }).sort({ endDate: -1 });
  
  if (!previous) {
    return this.topUsers.map(u => ({
      ...u.toObject(),
      rankChange: 0,
      previousRank: null,
    }));
  }
  
  const changes = this.topUsers.map(current => {
    const previousEntry = previous.topUsers.find(p => 
      p.userId.toString() === current.userId.toString()
    );
    
    const previousRank = previousEntry?.rank || null;
    const rankChange = previousRank ? previousRank - current.rank : 0;
    
    return {
      ...current.toObject(),
      previousRank,
      rankChange,
    };
  });
  
  return changes;
};

/**
 * Export to CSV format
 */
leaderboardHistorySchema.methods.toCSV = function() {
  const headers = ['Rank', 'Username', 'Value', 'Previous Rank', 'Change', 'Points', 'Words', 'Lessons'];
  
  const rows = this.topUsers.map(user => [
    user.rank,
    user.username,
    user.value,
    user.previousRank || '',
    user.rankChange || '',
    user.snapshot?.points || '',
    user.snapshot?.wordsLearned || '',
    user.snapshot?.lessonsCompleted || '',
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get leaderboard history for a period
 */
leaderboardHistorySchema.statics.getForPeriod = function(period, category = LEADERBOARD_CATEGORIES.POINTS, limit = 10) {
  return this.find({ period, category })
    .sort({ startDate: -1 })
    .limit(limit);
};

/**
 * Get user's history
 */
leaderboardHistorySchema.statics.getUserHistory = async function(userId, period = LEADERBOARD_PERIODS.WEEKLY, limit = 20) {
  return this.find({
    period,
    'topUsers.userId': userId,
  })
    .sort({ startDate: -1 })
    .limit(limit)
    .select('startDate endDate topUsers statistics');
};

/**
 * Get leaderboard trends
 */
leaderboardHistorySchema.statics.getTrends = async function(period = LEADERBOARD_PERIODS.WEEKLY, weeks = 12) {
  const histories = await this.find({ period })
    .sort({ startDate: -1 })
    .limit(weeks);
  
  const trends = {
    dates: histories.map(h => h.startDate),
    averageValues: histories.map(h => h.statistics.averageValue),
    topValues: histories.map(h => h.statistics.highestValue),
    participantCounts: histories.map(h => h.statistics.totalParticipants),
    volatility: histories.map(h => h.trends?.volatility || 0),
  };
  
  return trends;
};

/**
 * Create snapshot from current data
 */
leaderboardHistorySchema.statics.createSnapshot = async function(period, category, options = {}) {
  const User = mongoose.model('User');
  const now = new Date();
  
  let startDate, endDate;
  
  // Calculate date range based on period
  switch (period) {
    case LEADERBOARD_PERIODS.DAILY:
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case LEADERBOARD_PERIODS.WEEKLY:
      const firstDay = now.getDate() - now.getDay();
      startDate = new Date(now.setDate(firstDay));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.setDate(firstDay + 6));
      endDate.setHours(23, 59, 59, 999);
      break;
    case LEADERBOARD_PERIODS.MONTHLY:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case LEADERBOARD_PERIODS.YEARLY:
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }
  
  // Get top users based on category
  let sortField;
  switch (category) {
    case LEADERBOARD_CATEGORIES.POINTS:
      sortField = { 'progress.totalPoints': -1 };
      break;
    case LEADERBOARD_CATEGORIES.STREAK:
      sortField = { 'progress.streak.current': -1 };
      break;
    case LEADERBOARD_CATEGORIES.WORDS:
      sortField = { $expr: { $size: { $ifNull: ['$vocabularyMastery', []] } } };
      break;
    case LEADERBOARD_CATEGORIES.LESSONS:
      sortField = { 'progress.lessonStats.totalCompleted': -1 };
      break;
    default:
      sortField = { 'progress.totalPoints': -1 };
  }
  
  const users = await User.find({ status: 'active' })
    .select('username progress vocabularyMastery profile.avatar')
    .sort(sortField)
    .limit(100);
  
  // Get previous leaderboard for rank changes
  const previous = await this.findOne({ period, category })
    .sort({ endDate: -1 });
  
  // Build top users array
  const topUsers = users.map((user, index) => {
    let value = 0;
    switch (category) {
      case LEADERBOARD_CATEGORIES.POINTS:
        value = user.progress?.totalPoints || 0;
        break;
      case LEADERBOARD_CATEGORIES.STREAK:
        value = user.progress?.streak?.current || 0;
        break;
      case LEADERBOARD_CATEGORIES.WORDS:
        value = user.vocabularyMastery?.length || 0;
        break;
      case LEADERBOARD_CATEGORIES.LESSONS:
        value = user.progress?.lessonStats?.totalCompleted || 0;
        break;
    }
    
    const previousEntry = previous?.topUsers.find(p => 
      p.userId.toString() === user._id.toString()
    );
    
    const rank = index + 1;
    const previousRank = previousEntry?.rank || null;
    const rankChange = previousRank ? previousRank - rank : 0;
    
    return {
      userId: user._id,
      rank,
      username: user.username,
      value,
      previousRank,
      rankChange,
      metadata: {
        streak: user.progress?.streak?.current || 0,
        level: user.progress?.level || 1,
        badges: user.progress?.badges?.length || 0,
        avatar: user.profile?.avatar?.url,
      },
      snapshot: {
        points: user.progress?.totalPoints || 0,
        wordsLearned: user.vocabularyMastery?.length || 0,
        lessonsCompleted: user.progress?.lessonStats?.totalCompleted || 0,
        timeSpent: user.analytics?.totalTimeSpent || 0,
      },
    };
  });
  
  // Calculate statistics
  const values = topUsers.map(u => u.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  // Find top gainers and losers
  const changes = topUsers
    .filter(u => u.rankChange !== 0)
    .map(u => ({
      userId: u.userId,
      gain: u.rankChange,
      percentage: u.previousRank ? (u.rankChange / u.previousRank) * 100 : 0,
    }));
  
  const topGainers = changes
    .filter(c => c.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 5);
  
  const topLosers = changes
    .filter(c => c.gain < 0)
    .sort((a, b) => a.gain - b.gain)
    .slice(0, 5);
  
  // Calculate stability (users in top 100 from previous)
  const stability = previous ? topUsers.filter(u => 
    previous.topUsers.some(p => p.userId.toString() === u.userId.toString())
  ).length : 0;
  
  // Create and save snapshot
  const snapshot = new this({
    period,
    category,
    startDate,
    endDate,
    topUsers,
    statistics: {
      totalParticipants: users.length,
      averageValue: sum / users.length,
      medianValue: median,
      highestValue: Math.max(...values),
      lowestValue: Math.min(...values),
      topScore: values[0] || 0,
      bottomScore: values[values.length - 1] || 0,
      distribution: {
        top10Percent: values[Math.floor(values.length * 0.1)] || 0,
        top25Percent: values[Math.floor(values.length * 0.25)] || 0,
        top50Percent: values[Math.floor(values.length * 0.5)] || 0,
      },
    },
    trends: {
      topGainers,
      topLosers,
      volatility: changes.length / users.length,
      stability: (stability / users.length) * 100,
    },
    generatedAt: new Date(),
  });
  
  await snapshot.save();
  
  return snapshot;
};

module.exports = mongoose.model('LeaderboardHistory', leaderboardHistorySchema);
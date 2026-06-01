const mongoose = require('mongoose');

const learningProgressSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
       unique: true,
       index: true,
    },
    
   dailyStats: [{
     date: String,
     wordsReviewed: Number,
     newWordsLearned: Number,
     sessionTime: Number, // minutes
     averageQuality: Number,
  }],
  
  weeklyStats: {
    type: Map,
     of: Number,
     default: {},
  },
  monthlyStats: {
     type: Map,
     of: Number,
     default: {},
  },
  currentStreak: {
    type: Number,
    default: 0,
  },
  longestStreak: {
     type: Number,
     default: 0,
   },
   lastActive: Date,
   totalSessions: {
     type: Number,
     default: 0,
   },
  totalWordsReviewed: {
     type: Number,
     default: 0,
   },
   totalTimeSpent: {
     type: Number, // minutes
     default: 0,
   },
  averageAccuracy: {
    type: Number,
     default: 0,
   },
   peakPerformance: {
     date: Date,
     wordsPerHour: Number,
    accuracy: Number,
   },
   learningRate: {
     type: Number, // words per day
     default: 0,
   },
  projectedMastery: Date, // Estimated date to master all words
 }, {
   timestamps: true,
 });

module.exports = mongoose.model('LearningProgress', learningProgressSchema);
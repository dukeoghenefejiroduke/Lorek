const mongoose = require('mongoose');

const practiceSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  settings: {
    wordsPerSession: {
      type: Number,
      default: 20,
    },
    includeNew: {
      type: Boolean,
      default: true,
    },
    newWordsLimit: {
      type: Number,
      default: 5,
    },
    category: String,
    difficulty: String,
    mode: {
      type: String,
      enum: ['learning', 'review', 'test', 'cram'],
      default: 'review',
    },
  },
  words: [{
    wordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
    },
    presentedAt: Date,
    reviewedAt: Date,
    quality: Number,
    responseTime: Number, // in seconds
    confidence: Number, // 0-1
    mistakes: [String], // types of mistakes made
    srsStage: Number,
    nextReview: Date,
  }],
  completed: {
    type: Number,
    default: 0,
  },
  stats: {
    totalWords: Number,
    averageQuality: Number,
    averageResponseTime: Number,
    byQuality: mongoose.Schema.Types.Mixed,
    newWords: Number,
    reviewedWords: Number,
    masteredWords: Number,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
practiceSessionSchema.index({ userId: 1, startedAt: -1 });
practiceSessionSchema.index({ userId: 1, completedAt: 1 });

module.exports = mongoose.model('PracticeSession', practiceSessionSchema);
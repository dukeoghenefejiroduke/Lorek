const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  gameType: {
    type: String,
    enum: ['match', 'spelling', 'quiz', 'word_search', 'flashcards', 'hangman'],
    required: true,
    index: true,
  },
  
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  
  questions: [{
    questionId: mongoose.Schema.Types.ObjectId,
    questionData: mongoose.Schema.Types.Mixed,
    maxPoints: { type: Number, default: 10 },
  }],
  
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    userAnswer: mongoose.Schema.Types.Mixed,
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
  }],
  
  score: {
    type: Number,
    default: 0,
  },
  
  maxScore: {
    type: Number,
    default: 0,
  },
  
  percentage: {
    type: Number,
    default: 0,
  },
  
  timeLimit: {
    type: Number,
    default: 60,
  },
  
  timeSpent: {
    type: Number,
    default: 0,
  },
  
  gameData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  startedAt: {
    type: Date,
    default: Date.now,
  },
  
  completedAt: Date,
  
  completed: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  metadata: {
    deviceInfo: String,
    appVersion: String,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
gameSessionSchema.index({ user: 1, completedAt: -1 });
gameSessionSchema.index({ gameType: 1, completedAt: -1 });
gameSessionSchema.index({ user: 1, gameType: 1, completed: 1 });

module.exports = mongoose.model('GameSession', gameSessionSchema);
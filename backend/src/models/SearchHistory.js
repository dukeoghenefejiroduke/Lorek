const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    index: true,
  },
  
  query: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  
  count: {
    type: Number,
    default: 1,
  },
  
  types: [{
    type: String,
    enum: ['all', 'vocabulary', 'lessons', 'users'],
  }],
  
  lastSearched: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
searchHistorySchema.index({ user: 1, lastSearched: -1 });
searchHistorySchema.index({ user: 1, query: 1 }, { unique: true });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
const mongoose = require('mongoose');

const translationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sourceText: {
    type: String,
    required: true,
    trim: true,
  },
  targetText: {
    type: String,
    required: true,
    trim: true,
  },
  sourceLanguageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: true,
  },
  targetLanguageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: true,
  },
  translationType: {
    type: String,
    enum: ['exact_dictionary', 'word_by_word', 'llm_fallback', 'saved', 'manual'],
    default: 'saved',
  },
  confidence: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  pronunciation: {
    ipa: String,
    syllables: [String],
    audio: String,
  },
  isFavorite: {
    type: Boolean,
    default: false,
    index: true,
  },
  metadata: {
    context: mongoose.Schema.Types.Mixed,
    formality: String,
    provider: String,
    deviceInfo: String,
  },
  usageCount: {
    type: Number,
    default: 1,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  }
}, { 
  // Automatically handles createdAt and updatedAt
  timestamps: true 
});

// Indexes
translationSchema.index({ user: 1, createdAt: -1 });
translationSchema.index({ user: 1, isFavorite: 1 });
// Text index for search functionality
translationSchema.index({ sourceText: 'text', targetText: 'text' });
// Unique constraint to prevent duplicate history items for the same user/phrase
translationSchema.index({ user: 1, sourceText: 1, sourceLanguageId: 1 }, { unique: false });

module.exports = mongoose.model('Translation', translationSchema);

const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  nativeName: {
    type: String,
    required: true,
  },
  description: String,
  region: String,
  icon: String,
  color: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  totalWords: {
    type: Number,
    default: 0,
  },
  totalLessons: {
    type: Number,
    default: 0,
  },
  totalSpeakers: {
    type: Number,
    default: 0,
  },
  order: {
    type: Number,
    default: 0,
  },
  features: {
    hasAudio: { type: Boolean, default: false },
    hasPronunciation: { type: Boolean, default: false },
    hasGrammar: { type: Boolean, default: false },
    hasCulture: { type: Boolean, default: false },
  },
  metadata: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: String, default: '1.0' },
  },
}, {
  timestamps: true,
  collection: 'languages_bb953498'
});

module.exports = mongoose.model('Language', languageSchema);
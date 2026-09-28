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
  family: {
    type: String,
    default: 'unknown',
  },
  directionality: {
    type: String,
    enum: ['ltr', 'rtl'],
    default: 'ltr',
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
  features: {
    hasAudio: { type: Boolean, default: false },
    hasPronunciation: { type: Boolean, default: false },
    hasGrammar: { type: Boolean, default: false },
    hasCulture: { type: Boolean, default: false },
    hasMorphology: { type: Boolean, default: false },
    hasCorpus: { type: Boolean, default: false },
  },
  metadata: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: String, default: '1.0' },
  },
}, {
  timestamps: true,
  collection: 'languages_bb953498'
});

// Static helper to get registry for frontend
languageSchema.statics.getRegistry = function() {
  return this.find({ isActive: { $ne: false }, isPublished: { $ne: false } })
    .select('code name nativeName family directionality features description region icon color difficulty totalWords totalLessons')
    .sort({ order: 1 });
};

module.exports = mongoose.model('Language', languageSchema);
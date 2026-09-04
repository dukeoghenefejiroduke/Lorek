const mongoose = require('mongoose');

const sentenceSchema = new mongoose.Schema({
  izon: { type: String, required: true },
  english: { type: String, required: true },
  audioUrl: String,
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  tags: [String],
  deletedAt: Date, // Soft delete
}, { timestamps: true });

sentenceSchema.index({ izon: 'text', english: 'text' });

module.exports = mongoose.model('Sentence', sentenceSchema);

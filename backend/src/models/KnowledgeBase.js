const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  text: { type: String, required: true },
  category: { type: String, enum: ['grammar', 'vocabulary', 'proverb', 'cultural'], required: true },
  metadata: { type: Object, default: {} },
  // This is where MongoDB Atlas Vector Search will point
  embedding: { type: [Number], required: false }
}, { timestamps: true });

// Index for efficient filtering before vector search
knowledgeBaseSchema.index({ category: 1 });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);

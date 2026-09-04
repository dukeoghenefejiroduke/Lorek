const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  description: String,
  sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);

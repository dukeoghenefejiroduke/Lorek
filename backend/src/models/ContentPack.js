const mongoose = require('mongoose');

const contentPackSchema = new mongoose.Schema({
  packId: { type: String, required: true, unique: true },
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  version: { type: String, required: true },
  title: String,
  checksum: String,
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ContentPack', contentPackSchema);

const mongoose = require('mongoose');

const contentVersionSchema = new mongoose.Schema({
  packId: { type: String, required: true },
  version: { type: String, required: true },
  minAppVersion: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('ContentVersion', contentVersionSchema);

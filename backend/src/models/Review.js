const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  contributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contribution', required: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decision: { type: String, enum: ['approve', 'reject'], required: true },
  comment: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);

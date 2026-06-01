const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['translation', 'audio'], required: true },
  // For translation: stores the pair. For audio: stores the S3/Cloudinary URL
  data: { 
    text: { type: String }, // e.g., "Izon translation"
    url: { type: String },  // e.g., S3 URL
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vocabulary' } // Link to existing word
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Contribution', contributionSchema);

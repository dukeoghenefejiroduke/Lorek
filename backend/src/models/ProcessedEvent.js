const mongoose = require('mongoose');

const processedEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  processedAt: {
    type: Date,
    default: Date.now,
    expires: 86400 * 7, // Automatically remove after 7 days
  },
});

module.exports = mongoose.model('ProcessedEvent', processedEventSchema);

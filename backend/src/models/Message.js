const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: Date,
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
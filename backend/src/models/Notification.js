const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    index: true,
  },
  
  type: {
    type: String,
    required: true,
    index: true,
  },
  
  title: {
    type: String,
    required: true,
  },
  
  body: {
    type: String,
    required: true,
  },
  
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  priority: {
    type: Number,
    min: 1,
    max: 4,
    default: 2,
  },
  
  actionUrl: String,
  
  image: String,
  
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  readAt: Date,
  
  expiresAt: {
    type: Date,
    index: true,
  },
  
  externalIds: {
    push: String,
    email: String,
    sms: String,
  },
  
  metadata: {
    source: {
      type: String,
      enum: ['system', 'user', 'admin', 'automated'],
      default: 'system',
    },
    category: String,
    tags: [String],
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
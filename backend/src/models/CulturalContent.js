const mongoose = require('mongoose');

const culturalContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true,
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['traditions', 'festivals', 'food', 'music', 'history', 'attire', 'language_tips'],
    required: true,
    index: true,
  },
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    required: [true, 'Language ID is required'],
    index: true,
  },
  image: {
    url: String,
    thumbnail: String,
    caption: String,
  },
  details: String,
  duration: String,
  significance: String,
  ingredients: [String],
  preparation: String,
  instruments: [String],
  culturalContext: String,
  order: {
    type: Number,
    default: 0,
  },
  views: {
    type: Number,
    default: 0,
  },
  isPublished: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  tags: [String],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

culturalContentSchema.pre('save', function() {
  if (this.isNew) {
    if (this.title && !this.slug) {
      this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    };
  }
});

culturalContentSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('CulturalContent', culturalContentSchema);
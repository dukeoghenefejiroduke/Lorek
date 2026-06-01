const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  title: {
    izon: {
      type: String,
      required: true,
    },
    english: {
      type: String,
      required: true,
    },
  },
  
  description: {
    izon: String,
    english: String,
  },
  
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'master'],
    required: true,
    index: true,
  },
  
  order: {
    type: Number,
    required: true,
  },
  
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  }],
  
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
  }],
  
  thumbnail: {
    type: String,
  },
  
  icon: {
    type: String,
  },
  
  estimatedTime: {
    hours: Number,
    minutes: Number,
  },
  
  totalPoints: {
    type: Number,
    default: 0,
  },
  
  badges: [{
    name: String,
    description: String,
    icon: String,
  }],
  
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  publishedAt: Date,
  
  metadata: {
    views: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
  },
  
}, {
  timestamps: true,
});

// Calculate total points before save
moduleSchema.pre('save', async function() {
  if (this.isNew) {
    if (this.lessons && this.lessons.length > 0) {
      const Lesson = mongoose.model('Lesson');
      const lessons = await Lesson.find({ _id: { $in: this.lessons } });
      this.totalPoints = lessons.reduce((sum, lesson) => sum + (lesson.rewards?.basePoints || 50), 0);
    }
  }
});

module.exports = mongoose.model('Module', moduleSchema);
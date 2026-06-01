const mongoose = require('mongoose');

// ============================================================================
// CATEGORY SCHEMA
// ============================================================================

const categorySchema = new mongoose.Schema({
  // Basic information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  
  displayName: {
    izon: String,
    english: {
      type: String,
      required: true,
    },
  },
  
  description: {
    izon: String,
    english: String,
  },
  
  // Visual representation
  icon: {
    type: String,
    required: true,
  },
  
  iconFilled: String,
  
  color: {
    primary: { type: String, default: '#4CAF50' },
    secondary: { type: String, default: '#2E7D32' },
    accent: { type: String, default: '#FFD700' },
  },
  
  image: {
    url: String,
    thumbnail: String,
  },
  
  // Hierarchy
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true,
  },
  
  subcategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
  
  level: {
    type: Number,
    default: 1,
    min: 1,
  },
  
  path: String,
  
  // Statistics
  statistics: {
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    lessonCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    popularWords: [{
      wordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vocabulary' },
      count: Number,
    }],
    
    difficulty: {
      beginner: { type: Number, default: 0 },
      intermediate: { type: Number, default: 0 },
      advanced: { type: Number, default: 0 },
    },
    
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    averageMastery: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  
  // Metadata
  order: {
    type: Number,
    default: 0,
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  isFeatured: {
    type: Boolean,
    default: false,
  },
  
  tags: [{
    type: String,
    index: true,
  }],
  
  metadata: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
}, {
  timestamps: true,
});

// ============================================================================
// INDEXES
// ============================================================================

categorySchema.index({ parentCategory: 1, order: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ isFeatured: 1, order: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

categorySchema.virtual('hasSubcategories').get(function() {
  return this.subcategories && this.subcategories.length > 0;
});

categorySchema.virtual('fullPath').get(function() {
  return this.path || this.name;
});

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================

categorySchema.pre('save', async function() {
  if (this.parentCategory) {
    const parent = await this.constructor.findById(this.parentCategory);
    if (parent) {
      this.level = parent.level + 1;
      this.path = parent.path ? `${parent.path}.${this.name}` : this.name;
    }
  } else {
    this.level = 1;
    this.path = this.name;
  }
  
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Update statistics
 */
categorySchema.methods.updateStatistics = async function() {
  const Vocabulary = mongoose.model('Vocabulary');
  const Lesson = mongoose.model('Lesson');
  
  const [wordCount, lessonCount, difficulty, mastery] = await Promise.all([
    Vocabulary.countDocuments({ category: this.name, isActive: true }),
    Lesson.countDocuments({ category: this.name, isActive: true }),
    Vocabulary.aggregate([
      { $match: { category: this.name, isActive: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]),
    Vocabulary.aggregate([
      { $match: { category: this.name, isActive: true } },
      { $group: { _id: null, avg: { $avg: '$difficultyScore' } } },
    ]),
  ]);
  
  this.statistics.wordCount = wordCount;
  this.statistics.lessonCount = lessonCount;
  
  difficulty.forEach(d => {
    this.statistics.difficulty[d._id] = d.count;
  });
  
  if (mastery.length > 0) {
    this.statistics.averageMastery = mastery[0].avg * 10; // Convert to percentage
  }
  
  await this.save();
};

/**
 * Get popular words
 */
categorySchema.methods.getPopularWords = async function(limit = 10) {
  const Vocabulary = mongoose.model('Vocabulary');
  
  const words = await Vocabulary.find({
    category: this.name,
    isActive: true,
  })
    .sort({ 'usage.popularity.views': -1 })
    .limit(limit)
    .select('izonWord englishTranslation usage.popularity');
  
  return words;
};

/**
 * Get subcategory tree
 */
categorySchema.methods.getSubcategoryTree = async function() {
  const categories = await this.constructor.find({
    $or: [
      { _id: { $in: this.subcategories } },
      { parentCategory: this._id },
    ],
  });
  
  const buildTree = (parentId) => {
    return categories
      .filter(c => c.parentCategory?.toString() === parentId?.toString())
      .map(c => ({
        ...c.toObject(),
        children: buildTree(c._id),
      }));
  };
  
  return buildTree(this._id);
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get root categories
 */
categorySchema.statics.getRootCategories = function() {
  return this.find({ parentCategory: null, isActive: true })
    .sort({ order: 1 });
};

/**
 * Get category tree
 */
categorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ isActive: true }).sort({ order: 1 });
  
  const buildTree = (parentId = null) => {
    return categories
      .filter(c => (c.parentCategory?.toString() || null) === (parentId?.toString() || null))
      .map(c => ({
        ...c.toObject(),
        children: buildTree(c._id),
      }));
  };
  
  return buildTree();
};

/**
 * Get featured categories
 */
categorySchema.statics.getFeatured = function(limit = 6) {
  return this.find({
    isFeatured: true,
    isActive: true,
  })
    .sort({ order: 1 })
    .limit(limit);
};

/**
 * Search categories
 */
categorySchema.statics.search = function(query, limit = 10) {
  return this.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { 'displayName.english': { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } },
    ],
    isActive: true,
  })
    .limit(limit)
    .sort({ order: 1 });
};

module.exports = mongoose.model('Category', categorySchema);
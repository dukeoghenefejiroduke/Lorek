const mongoose = require('mongoose');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const PROGRESS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MASTERED: 'mastered',
  FAILED: 'failed',
  REVIEWING: 'reviewing',
};

const ENGAGEMENT_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EXCELLENT: 'excellent',
};

const DIFFICULTY_RATING = {
  TOO_EASY: 'too_easy',
  JUST_RIGHT: 'just_right',
  CHALLENGING: 'challenging',
  TOO_HARD: 'too_hard',
};

const LEARNING_PACE = {
  SLOW: 'slow',
  MODERATE: 'moderate',
  FAST: 'fast',
  ACCELERATED: 'accelerated',
};

const MASTERY_LEVEL = {
  EXPOSED: 1,    // First time seeing the material
  FAMILIAR: 2,   // Can recognize but not recall
  ACQUIRED: 3,   // Can recall with effort
  MASTERED: 4,   // Can use confidently
  NATIVE: 5,     // Automatic, native-like
};

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

/**
 * Detailed attempt tracking
 */
const attemptSchema = new mongoose.Schema({
  attemptNumber: {
    type: Number,
    required: true,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  completedAt: Date,
  timeSpent: Number, // seconds
  responses: Array,
  
  // Performance metrics
  score: {
    type: Number,
    min: 0,
    max: 100,
  },
  correctAnswers: Number,
  totalQuestions: Number,
  
  // Exercise-level tracking
  exerciseResults: [{
    exerciseId: String,
    question: String,
    userAnswer: String,
    correctAnswer: String,
    isCorrect: Boolean,
    timeSpent: Number, // seconds
    hintsUsed: Number,
    attempts: Number,
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    mistakes: [String], // Types of mistakes made
  }],
  
  // Learning insights
  strengths: [String],
  weaknesses: [String],
  improvement: Number, // percentage improvement from last attempt
  
  // Engagement metrics
  focusScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  fatigueLevel: {
    type: Number,
    min: 0,
    max: 100,
  },
  
  // Context
  deviceInfo: {
    platform: String,
    osVersion: String,
    appVersion: String,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: [Number],
  },
  
  // Feedback
  difficultyRating: {
    type: String,
    enum: Object.values(DIFFICULTY_RATING),
  },
  satisfactionScore: {
    type: Number,
    min: 1,
    max: 5,
  },
  notes: String,
});

/**
 * Vocabulary mastery tracking
 */
const vocabularyProgressSchema = new mongoose.Schema({
  wordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
    required: true,
  },
  
  // SRS data
  stage: {
    type: Number,
    min: 0,
    max: 7,
    default: 0,
  },
  interval: {
    type: Number,
    default: 0,
  },
  easeFactor: {
    type: Number,
    min: 1.3,
    max: 2.5,
    default: 2.5,
  },
  
  // Review history
  reviewCount: {
    type: Number,
    default: 0,
  },
  correctCount: {
    type: Number,
    default: 0,
  },
  incorrectCount: {
    type: Number,
    default: 0,
  },
  
  // Performance
  averageResponseTime: Number,
  fastestResponseTime: Number,
  slowestResponseTime: Number,
  
  // Mastery
  masteryLevel: {
    type: Number,
    enum: Object.values(MASTERY_LEVEL),
    default: MASTERY_LEVEL.EXPOSED,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  
  // Timeline
  firstSeen: Date,
  lastReviewed: Date,
  nextReview: Date,
  
  // History
  reviews: [{
    date: Date,
    quality: Number,
    responseTime: Number,
    context: String,
  }],
  
  // Mistakes
  commonMistakes: [{
    type: String,
    count: Number,
  }],
  
  // Notes
  personalNotes: String,
  mnemonics: String,
});

/**
 * Skill progress tracking
 */
const skillProgressSchema = new mongoose.Schema({
  skill: {
    type: String,
    enum: ['listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary', 'pronunciation', 'comprehension'],
    required: true,
  },
  
  level: {
    type: Number,
    min: 1,
    max: 10,
    default: 1,
  },
  
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  // Performance metrics
  accuracy: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  speed: {
    type: Number,
    min: 0,
    default: 0,
  },
  
  // History
  assessments: [{
    date: Date,
    score: Number,
    level: Number,
  }],
  
  // Strengths and weaknesses
  strengths: [String],
  weaknesses: [String],
  
  // Goals
  goals: [{
    description: String,
    target: Number,
    current: Number,
    deadline: Date,
    achieved: Boolean,
    achievedAt: Date,
  }],
});

/**
 * Time tracking
 */
const timeTrackSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  
  totalTime: {
    type: Number,
    default: 0, // minutes
  },
  
  sessions: [{
    startTime: Date,
    endTime: Date,
    duration: Number,
    activity: String,
    focusScore: Number,
  }],
  
  // Daily breakdown
  byHour: {
    type: Map,
    of: Number,
  },
  
  byActivity: {
    type: Map,
    of: Number,
  },
});

/**
 * Achievement tracking
 */
const achievementProgressSchema = new mongoose.Schema({
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
  },
  
  name: String,
  description: String,
  
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  currentValue: Number,
  targetValue: Number,
  
  milestones: [{
    value: Number,
    achieved: Boolean,
    achievedAt: Date,
    reward: String,
  }],
  
  achieved: {
    type: Boolean,
    default: false,
  },
  
  achievedAt: Date,
});

/**
 * Recommendation tracking
 */
const recommendationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['lesson', 'exercise', 'review', 'practice', 'cultural'],
  },
  
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'itemType',
  },
  
  itemType: {
    type: String,
    enum: ['Lesson', 'Exercise', 'Vocabulary', 'CulturalNote'],
  },
  
  reason: String,
  priority: {
    type: Number,
    min: 1,
    max: 10,
  },
  
  presentedAt: Date,
  actedUpon: Boolean,
  actedAt: Date,
  feedback: String,
});

// ============================================================================
// MAIN PROGRESS SCHEMA
// ============================================================================

const progressSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  practiceType: { type: String },
  // Lesson reference
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
    index: true,
  },
  
  // Status
  status: {
    type: String,
    enum: Object.values(PROGRESS_STATUS),
    default: PROGRESS_STATUS.NOT_STARTED,
    index: true,
  },
  
  // Basic progress
  completed: {
    type: Boolean,
    default: false,
  },
  
  completedAt: Date,
  
  // Scoring
  score: {
    type: Number,
    min: 0,
    max: 100,
  },
  
  highestScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  
  passingScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 70,
  },
  
  // Attempts
  attempts: {
    type: Number,
    default: 0,
  },
  
  maxAttempts: {
    type: Number,
    default: 3,
  },
  
  remainingAttempts: {
    type: Number,
    default: 3,
  },
  
  // Detailed attempt history
  attemptHistory: [attemptSchema],
  
  // Last attempt info
  lastAttempt: Date,
  lastAttemptScore: Number,
  
  // Time tracking
  timeSpent: {
    type: Number,
    default: 0, // total minutes spent
  },
  
  firstStartedAt: Date,
  lastActivityAt: Date,
  
  // Engagement metrics
  engagementLevel: {
    type: String,
    enum: Object.values(ENGAGEMENT_LEVEL),
    default: ENGAGEMENT_LEVEL.MEDIUM,
  },
  
  focusScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50,
  },
  
  // Learning metrics
  retentionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  
  learningPace: {
    type: String,
    enum: Object.values(LEARNING_PACE),
    default: LEARNING_PACE.MODERATE,
  },
  
  // Vocabulary mastery for this lesson
  vocabularyMastery: [vocabularyProgressSchema],
  
  // Skill progress
  skills: [skillProgressSchema],
  
  // Exercise-specific progress
  exerciseProgress: [{
    exerciseId: String,
    completed: Boolean,
    score: Number,
    attempts: Number,
    timeSpent: Number,
    lastAttempt: Date,
    mastered: Boolean,
    notes: String,
  }],
  
  // Assessment results
  assessment: {
    taken: Boolean,
    score: Number,
    passed: Boolean,
    certified: Boolean,
    certificateId: String,
    details: {
      totalQuestions: Number,
      correctAnswers: Number,
      timeSpent: Number,
      questions: [{
        id: String,
        correct: Boolean,
        timeSpent: Number,
      }],
    },
  },
  
  // Strengths and weaknesses analysis
  analysis: {
    strengths: [{
      area: String,
      score: Number,
      recommendation: String,
    }],
    
    weaknesses: [{
      area: String,
      score: Number,
      recommendation: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
      },
    }],
    
    recommendedActions: [{
      action: String,
      type: String,
      priority: Number,
      deadline: Date,
    }],
  },
  
  // Learning path progress
  learningPath: {
    position: Number,
    completedNodes: [String],
    currentNode: String,
    nextNodes: [String],
    branchingChoices: [{
      nodeId: String,
      choice: String,
      timestamp: Date,
    }],
  },
  
  // Achievement progress
  achievements: [achievementProgressSchema],
  
  // Recommendations
  recommendations: [recommendationSchema],
  
  // Personal notes
  notes: [{
    content: String,
    createdAt: Date,
    updatedAt: Date,
    tags: [String],
  }],
  
  // Feedback
  feedback: {
    difficultyRating: {
      type: String,
      enum: Object.values(DIFFICULTY_RATING),
    },
    satisfactionScore: {
      type: Number,
      min: 1,
      max: 5,
    },
    wouldRecommend: Boolean,
    comments: String,
    suggestions: String,
    reportedIssues: [{
      type: String,
      description: String,
      resolved: Boolean,
    }],
  },
  
  // Milestones
  milestones: [{
    type: {
      type: String,
      enum: ['first_completion', 'perfect_score', 'speed_run', 'streak', 'mastery'],
    },
    achievedAt: Date,
    description: String,
    reward: String,
  }],
  
  // Streak tracking
  streak: {
    current: {
      type: Number,
      default: 0,
    },
    longest: {
      type: Number,
      default: 0,
    },
    lastActivity: Date,
    frozen: {
      type: Boolean,
      default: false,
    },
    freezesUsed: {
      type: Number,
      default: 0,
    },
  },
  
  // Time-based tracking
  timeTracking: [timeTrackSchema],
  
  // Comparative performance
  percentiles: {
    global: Number,
    byLevel: Number,
    byRegion: Number,
  },
  
  // Adaptive learning data
  adaptiveProfile: {
    learningStyle: {
      type: String,
      enum: ['visual', 'auditory', 'kinesthetic', 'reading'],
    },
    preferredPace: String,
    challengePreference: {
      type: String,
      enum: ['easy', 'balanced', 'challenging'],
    },
    reviewFrequency: {
      type: String,
      enum: ['low', 'medium', 'high'],
    },
    customSettings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  
  // Prediction models
  predictions: {
    estimatedCompletionDate: Date,
    probabilityOfSuccess: {
      type: Number,
      min: 0,
      max: 100,
    },
    recommendedNextLesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
    },
    atRiskOfDropout: Boolean,
    dropoutRiskFactors: [String],
  },
  
  // Metadata
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    dataVersion: {
      type: String,
      default: '1.0',
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'conflict'],
      default: 'synced',
    },
    lastSync: Date,
  },
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes for efficient queries
progressSchema.index({ user: 1, lesson: 1 }, { unique: true });
progressSchema.index({ user: 1, status: 1 });
progressSchema.index({ user: 1, completed: 1, completedAt: -1 });
progressSchema.index({ 'streak.lastActivity': -1 });
progressSchema.index({ 'predictions.atRiskOfDropout': 1 });
progressSchema.index({ 'analysis.weaknesses.priority': 1 });
progressSchema.index({ createdAt: 1 });
progressSchema.index({ updatedAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
/**
 * Get completion percentage
 */
progressSchema.virtual('completionPercentage').get(function() {
  // Use optional chaining and default to empty array
  const exercises = this.exerciseProgress || [];
  if (exercises.length === 0) return 0;
  
  const completed = exercises.filter(e => e && e.completed).length;
  return Math.round((completed / exercises.length) * 100);
});


/**
 * Get average score across attempts
 */
progressSchema.virtual('averageScore').get(function() {
  const history = this.attemptHistory || [];
  if (history.length === 0) return 0;
  
  const sum = history.reduce((acc, attempt) => acc + (attempt.score || 0), 0);
  return Math.round(sum / history.length);
});

/**
 * Get improvement rate
 */
progressSchema.virtual('improvementRate').get(function() {
  const history = this.attemptHistory || [];
  if (history.length < 2) return 0;
  
  const firstScore = history[0].score || 0;
  const lastScore = history[history.length - 1].score || 0;
  
  return lastScore - firstScore;
});

/**
 * Get time efficiency
 */
progressSchema.virtual('timeEfficiency').get(function() {
  if (!this.timeSpent || !this.score) return 0;
  
  return Math.round((this.score / this.timeSpent) * 100) / 100;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Start a new attempt
 */
progressSchema.methods.startAttempt = function() {
  const attempt = {
    attemptNumber: this.attempts + 1,
    startedAt: new Date(),
  };
  
  this.attemptHistory.push(attempt);
  this.attempts += 1;
  this.remainingAttempts -= 1;
  this.status = PROGRESS_STATUS.IN_PROGRESS;
  this.lastActivityAt = new Date();
  
  if (!this.firstStartedAt) {
    this.firstStartedAt = new Date();
  }
  
  return attempt;
};

/**
 * Complete current attempt
 */
progressSchema.methods.completeAttempt = async function(result) {
  const currentAttempt = this.attemptHistory[this.attemptHistory.length - 1];
  
  // Update attempt data
  currentAttempt.completedAt = new Date();
  currentAttempt.timeSpent = result.timeSpent;
  currentAttempt.score = result.score;
  currentAttempt.correctAnswers = result.correctAnswers;
  currentAttempt.totalQuestions = result.totalQuestions;
  currentAttempt.exerciseResults = result.exerciseResults;
  
  // Update overall progress
  this.lastAttempt = new Date();
  this.lastAttemptScore = result.score;
  this.timeSpent += result.timeSpent;
  
  // Update highest score
  if (result.score > (this.highestScore || 0)) {
    this.highestScore = result.score;
  }
  
  // Check if passed
  if (result.score >= this.passingScore) {
    this.completed = true;
    this.completedAt = new Date();
    this.status = PROGRESS_STATUS.COMPLETED;
    
    // Check for mastery
    if (result.score >= 95) {
      this.status = PROGRESS_STATUS.MASTERED;
    }
  } else {
    this.status = PROGRESS_STATUS.FAILED;
  }
  
  // Update streak
  await this.updateStreak();
  
  // Analyze performance
  this.analyzePerformance(result);
  
  this.lastActivityAt = new Date();
};

/**
 * Update user streak
 */
progressSchema.methods.updateStreak = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  
  if (user) {
    const today = new Date().toDateString();
    const lastActive = user.lastActive ? new Date(user.lastActive).toDateString() : null;
    
    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastActive === yesterday.toDateString()) {
        user.progress.streak += 1;
      } else {
        user.progress.streak = 1;
      }
      
      if (user.progress.streak > user.progress.longestStreak) {
        user.progress.longestStreak = user.progress.streak;
      }
      
      user.lastActive = new Date();
      await user.save();
      
      this.streak.current = user.progress.streak;
      this.streak.longest = user.progress.longestStreak;
      this.streak.lastActivity = new Date();
    }
  }
};

/**
 * Analyze performance and update weaknesses/strengths
 */
progressSchema.methods.analyzePerformance = function(result) {
  const analysis = {
    strengths: [],
    weaknesses: [],
    recommendedActions: [],
  };
  
  // Analyze exercise results
  if (result.exerciseResults) {
    const exerciseTypes = {};
    
    result.exerciseResults.forEach(exercise => {
      const type = exercise.type || 'general';
      
      if (!exerciseTypes[type]) {
        exerciseTypes[type] = { correct: 0, total: 0, time: 0 };
      }
      
      exerciseTypes[type].total += 1;
      exerciseTypes[type].time += exercise.timeSpent || 0;
      
      if (exercise.isCorrect) {
        exerciseTypes[type].correct += 1;
      }
    });
    
    // Identify strengths and weaknesses
    Object.entries(exerciseTypes).forEach(([type, data]) => {
      const accuracy = (data.correct / data.total) * 100;
      
      if (accuracy >= 80) {
        analysis.strengths.push({
          area: type,
          score: accuracy,
          recommendation: `Great job with ${type}! Keep practicing to maintain this level.`,
        });
      } else if (accuracy <= 50) {
        analysis.weaknesses.push({
          area: type,
          score: accuracy,
          recommendation: `Focus on improving ${type} skills. Try extra practice exercises.`,
          priority: accuracy <= 30 ? 'critical' : 'high',
        });
        
        analysis.recommendedActions.push({
          action: `Practice ${type}`,
          type: 'exercise',
          priority: accuracy <= 30 ? 1 : 2,
        });
      }
    });
  }
  
  // Check time performance
  if (result.timeSpent > 0) {
    const expectedTime = this.lesson?.estimatedTime?.minutes * 60 || 900; // Default 15 minutes
    const timeRatio = result.timeSpent / expectedTime;
    
    if (timeRatio > 1.5) {
      analysis.weaknesses.push({
        area: 'speed',
        score: Math.round((1 / timeRatio) * 100),
        recommendation: 'Work on improving response speed. Try timed practice exercises.',
        priority: 'medium',
      });
    }
  }
  
  this.analysis = analysis;
};

/**
 * Add vocabulary progress
 */
progressSchema.methods.updateVocabularyMastery = function(wordId, reviewData) {
  let vocabProgress = this.vocabularyMastery.find(v => 
    v.wordId.toString() === wordId.toString()
  );
  
  if (!vocabProgress) {
    vocabProgress = {
      wordId,
      firstSeen: new Date(),
      reviews: [],
    };
    this.vocabularyMastery.push(vocabProgress);
  }
  
  // Add review
  vocabProgress.reviews.push({
    date: new Date(),
    quality: reviewData.quality,
    responseTime: reviewData.responseTime,
    context: reviewData.context,
  });
  
  // Update SRS data
  vocabProgress.reviewCount += 1;
  
  if (reviewData.quality >= 3) {
    vocabProgress.correctCount += 1;
  } else {
    vocabProgress.incorrectCount += 1;
  }
  
  vocabProgress.lastReviewed = new Date();
  vocabProgress.nextReview = reviewData.nextReview;
  
  // Update mastery level
  const accuracy = (vocabProgress.correctCount / vocabProgress.reviewCount) * 100;
  
  if (accuracy >= 90 && vocabProgress.reviewCount >= 10) {
    vocabProgress.masteryLevel = MASTERY_LEVEL.NATIVE;
    vocabProgress.confidence = 1;
  } else if (accuracy >= 80 && vocabProgress.reviewCount >= 7) {
    vocabProgress.masteryLevel = MASTERY_LEVEL.MASTERED;
    vocabProgress.confidence = 0.9;
  } else if (accuracy >= 70 && vocabProgress.reviewCount >= 5) {
    vocabProgress.masteryLevel = MASTERY_LEVEL.ACQUIRED;
    vocabProgress.confidence = 0.7;
  } else if (accuracy >= 60 && vocabProgress.reviewCount >= 3) {
    vocabProgress.masteryLevel = MASTERY_LEVEL.FAMILIAR;
    vocabProgress.confidence = 0.5;
  }
};

/**
 * Update skill progress
 */
progressSchema.methods.updateSkillProgress = function(skillName, assessmentData) {
  let skill = this.skills.find(s => s.skill === skillName);
  
  if (!skill) {
    skill = {
      skill: skillName,
      assessments: [],
    };
    this.skills.push(skill);
  }
  
  // Add assessment
  skill.assessments.push({
    date: new Date(),
    score: assessmentData.score,
    level: assessmentData.level,
  });
  
  // Update progress
  skill.progress = assessmentData.score;
  skill.level = assessmentData.level;
  skill.accuracy = assessmentData.score;
  
  // Update strengths/weaknesses
  if (assessmentData.strengths) {
    skill.strengths = [...new Set([...(skill.strengths || []), ...assessmentData.strengths])];
  }
  
  if (assessmentData.weaknesses) {
    skill.weaknesses = [...new Set([...(skill.weaknesses || []), ...assessmentData.weaknesses])];
  }
};

/**
 * Optimized Check Achievements logic to prevent duplicates
 */
progressSchema.methods.checkAchievements = async function() {
  const earned = [];
  const points = this.score || 0; // Or link to user.progress.totalPoints
  
  const potentialAchievements = [
    { 
      name: 'Point Collector', 
      target: 100, 
      current: points, 
      desc: 'Earned 100 points' 
    }
  ];

  potentialAchievements.forEach(item => {
    // 1. Correct way to check for existence in Mongoose arrays
    const existingIdx = this.achievements.findIndex(a => a.name === item.name);
    
    if (existingIdx === -1) {
      if (item.current >= item.target) {
        this.achievements.push({
          name: item.name,
          description: item.desc,
          currentValue: item.current,
          targetValue: item.target,
          achieved: true,
          achievedAt: new Date()
        });
        earned.push(item.name);
      }
    } else {
      // 2. Update existing progress instead of creating new ones
      const existing = this.achievements[existingIdx];
      if (!existing.achieved && item.current >= item.target) {
        existing.achieved = true;
        existing.achievedAt = new Date();
        existing.currentValue = item.current;
        earned.push(item.name);
      }
    }
  });

  return earned;
};


/**
 * Generate recommendations
 */
progressSchema.methods.generateRecommendations = async function() {
  const Lesson = mongoose.model('Lesson');
  
  this.recommendations = [];
  
  // Recommend based on weaknesses
  if (this.analysis?.weaknesses) {
    for (const weakness of this.analysis.weaknesses) {
      if (weakness.priority === 'critical' || weakness.priority === 'high') {
        // Find relevant practice lessons
        const practiceLessons = await Lesson.find({
          'content.exercises.type': weakness.area,
          level: this.lesson?.level,
        }).limit(3);
        
        practiceLessons.forEach(lesson => {
          this.recommendations.push({
            type: 'lesson',
            itemId: lesson._id,
            itemType: 'Lesson',
            reason: `Practice ${weakness.area} to improve your skills`,
            priority: weakness.priority === 'critical' ? 9 : 7,
            presentedAt: new Date(),
          });
        });
      }
    }
  }
  
  // Recommend review if retention is low
  if (this.retentionRate < 60) {
    this.recommendations.push({
      type: 'review',
      itemId: this.lesson._id,
      itemType: 'Lesson',
      reason: 'Review this lesson to improve retention',
      priority: 8,
      presentedAt: new Date(),
    });
  }
  
  // Recommend next lesson based on predictions
  if (this.predictions?.recommendedNextLesson) {
    this.recommendations.push({
      type: 'lesson',
      itemId: this.predictions.recommendedNextLesson,
      itemType: 'Lesson',
      reason: 'Continue your learning journey',
      priority: 6,
      presentedAt: new Date(),
    });
  }
};

/**
 * Track time
 */
progressSchema.methods.trackTime = function(duration, activity) {
  const today = new Date().toDateString();
  let timeTrack = this.timeTracking.find(t => 
    new Date(t.date).toDateString() === today
  );
  
  if (!timeTrack) {
    timeTrack = {
      date: new Date(),
      sessions: [],
      totalTime: 0,
      byHour: new Map(),
      byActivity: new Map(),
    };
    this.timeTracking.push(timeTrack);
  }
  
  // Add session
  const session = {
    startTime: new Date(Date.now() - duration * 60000),
    endTime: new Date(),
    duration,
    activity,
  };
  
  timeTrack.sessions.push(session);
  timeTrack.totalTime += duration;
  
  // Update by hour
  const hour = new Date().getHours();
  timeTrack.byHour.set(hour, (timeTrack.byHour.get(hour) || 0) + duration);
  
  // Update by activity
  timeTrack.byActivity.set(activity, (timeTrack.byActivity.get(activity) || 0) + duration);
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get user progress summary
 */
progressSchema.statics.getUserProgressSummary = async function(userId) {
  const progress = await this.find({ user: userId })
    .populate('lesson', 'title level category');
  
  const summary = {
    totalLessons: progress.length,
    completedLessons: progress.filter(p => p.completed).length,
    inProgressLessons: progress.filter(p => p.status === PROGRESS_STATUS.IN_PROGRESS).length,
    averageScore: 0,
    totalTimeSpent: 0,
    byLevel: {},
    byCategory: {},
    recentActivity: [],
    strengths: [],
    weaknesses: [],
  };
  
  if (progress.length > 0) {
    // Calculate averages
    const scores = progress.filter(p => p.highestScore).map(p => p.highestScore);
    summary.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Total time
    summary.totalTimeSpent = progress.reduce((acc, p) => acc + p.timeSpent, 0);
    
    // Group by level and category
    progress.forEach(p => {
      if (p.lesson) {
        // By level
        if (!summary.byLevel[p.lesson.level]) {
          summary.byLevel[p.lesson.level] = { total: 0, completed: 0 };
        }
        summary.byLevel[p.lesson.level].total += 1;
        if (p.completed) {
          summary.byLevel[p.lesson.level].completed += 1;
        }
        
        // By category
        if (p.lesson.category) {
          if (!summary.byCategory[p.lesson.category]) {
            summary.byCategory[p.lesson.category] = { total: 0, completed: 0 };
          }
          summary.byCategory[p.lesson.category].total += 1;
          if (p.completed) {
            summary.byCategory[p.lesson.category].completed += 1;
          }
        }
      }
    });
    
    // Recent activity
    summary.recentActivity = progress
      .filter(p => p.lastActivityAt)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .slice(0, 5)
      .map(p => ({
        lesson: p.lesson?.title?.english,
        status: p.status,
        score: p.lastAttemptScore,
        timeSpent: p.timeSpent,
        date: p.lastActivityAt,
      }));
    
    // Aggregate strengths and weaknesses
    const allStrengths = progress.flatMap(p => p.analysis?.strengths || []);
    const allWeaknesses = progress.flatMap(p => p.analysis?.weaknesses || []);
    
    // Count frequencies
    const strengthCounts = {};
    allStrengths.forEach(s => {
      strengthCounts[s.area] = (strengthCounts[s.area] || 0) + 1;
    });
    
    const weaknessCounts = {};
    allWeaknesses.forEach(w => {
      weaknessCounts[w.area] = (weaknessCounts[w.area] || 0) + 1;
    });
    
    // Get top 5
    summary.strengths = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area, count]) => ({ area, count }));
    
    summary.weaknesses = Object.entries(weaknessCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area, count]) => ({ area, count }));
  }
  
  return summary;
};

/**
 * Get at-risk students
 */
progressSchema.statics.getAtRiskStudents = async function(threshold = 70) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const atRisk = await this.aggregate([
    {
      $match: {
        'predictions.atRiskOfDropout': true,
        lastActivityAt: { $lt: sevenDaysAgo },
        completed: false,
      },
    },
    {
      $group: {
        _id: '$user',
        lastActive: { $max: '$lastActivityAt' },
        lessonsAttempted: { $sum: 1 },
        averageScore: { $avg: '$score' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo',
      },
    },
    {
      $project: {
        'userInfo.username': 1,
        'userInfo.email': 1,
        lastActive: 1,
        lessonsAttempted: 1,
        averageScore: 1,
      },
    },
  ]);
  
  return atRisk;
};

/**
 * Get learning analytics
 */
progressSchema.statics.getLearningAnalytics = async function(userId) {
  const progress = await this.find({ user: userId })
    .populate('lesson', 'level category');
  
  const analytics = {
    overview: {
      totalLessons: progress.length,
      completedLessons: progress.filter(p => p.completed).length,
      completionRate: 0,
      averageScore: 0,
      totalTimeSpent: 0,
      longestStreak: 0,
      currentStreak: 0,
    },
    progress: {
      daily: [],
      weekly: [],
      monthly: [],
    },
    performance: {
      byLevel: {},
      byCategory: {},
      byTimeOfDay: {},
    },
    vocabulary: {
      totalLearned: 0,
      mastered: 0,
      reviewing: 0,
      struggling: 0,
    },
    skills: {},
    predictions: {
      estimatedMasteryDate: null,
      projectedScore: 0,
    },
  };
  
  if (progress.length === 0) return analytics;
  
  // Basic stats
  analytics.overview.totalTimeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
  analytics.overview.completionRate = (analytics.overview.completedLessons / analytics.overview.totalLessons) * 100;
  
  const scores = progress.filter(p => p.highestScore).map(p => p.highestScore);
  analytics.overview.averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  
  // Get streak from user
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  if (user) {
    analytics.overview.currentStreak = user.progress?.streak || 0;
    analytics.overview.longestStreak = user.progress?.longestStreak || 0;
  }
  
  // Daily progress
  const last30Days = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last30Days[date.toDateString()] = 0;
  }
  
  progress.forEach(p => {
    if (p.lastActivityAt) {
      const dateStr = new Date(p.lastActivityAt).toDateString();
      if (last30Days[dateStr] !== undefined) {
        last30Days[dateStr] += p.timeSpent || 0;
      }
    }
  });
  
  analytics.progress.daily = Object.entries(last30Days)
    .map(([date, minutes]) => ({ date, minutes }))
    .reverse();
  
  // Performance by level
  progress.forEach(p => {
    if (p.lesson?.level && p.highestScore) {
      if (!analytics.performance.byLevel[p.lesson.level]) {
        analytics.performance.byLevel[p.lesson.level] = {
          total: 0,
          scores: [],
        };
      }
      analytics.performance.byLevel[p.lesson.level].total += 1;
      analytics.performance.byLevel[p.lesson.level].scores.push(p.highestScore);
    }
  });
  
  // Calculate averages by level
  Object.keys(analytics.performance.byLevel).forEach(level => {
    const scores = analytics.performance.byLevel[level].scores;
    analytics.performance.byLevel[level].averageScore = 
      scores.reduce((sum, s) => sum + s, 0) / scores.length;
    delete analytics.performance.byLevel[level].scores;
  });
  
  // Vocabulary stats
  progress.forEach(p => {
    p.vocabularyMastery?.forEach(v => {
      analytics.vocabulary.totalLearned += 1;
      
      if (v.masteryLevel >= MASTERY_LEVEL.MASTERED) {
        analytics.vocabulary.mastered += 1;
      } else if (v.masteryLevel >= MASTERY_LEVEL.FAMILIAR) {
        analytics.vocabulary.reviewing += 1;
      } else {
        analytics.vocabulary.struggling += 1;
      }
    });
  });
  
  // Predictions using simple linear regression
  const recentScores = progress
    .filter(p => p.highestScore && p.completedAt)
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-10)
    .map((p, i) => ({ x: i, y: p.highestScore }));
  
  if (recentScores.length >= 3) {
    const n = recentScores.length;
    const sumX = recentScores.reduce((sum, p) => sum + p.x, 0);
    const sumY = recentScores.reduce((sum, p) => sum + p.y, 0);
    const sumXY = recentScores.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = recentScores.reduce((sum, p) => sum + p.x * p.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    analytics.predictions.projectedScore = Math.min(100, intercept + slope * n);
    
    // Estimate mastery date (when score reaches 95)
    if (slope > 0) {
      const lessonsToMastery = Math.ceil((95 - intercept) / slope);
      const avgDaysBetween = 7 / (progress.length / 30); // Approximate
      analytics.predictions.estimatedMasteryDate = new Date(
        Date.now() + lessonsToMastery * avgDaysBetween * 24 * 60 * 60 * 1000
      );
    }
  }
  
  return analytics;
};

module.exports = mongoose.model('Progress', progressSchema);
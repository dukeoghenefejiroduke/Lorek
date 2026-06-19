const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const USER_ROLES = {
  USER: 'user',
  CONTRIBUTOR: 'contributor',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  DELETED: 'deleted',
  PENDING_VERIFICATION: 'pending_verification',
};

const ACCOUNT_TYPES = {
  FREE: 'free',
  PREMIUM: 'premium',
  LIFETIME: 'lifetime',
  EDUCATIONAL: 'educational',
  CORPORATE: 'corporate',
};

const GENDERS = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  PREFER_NOT_TO_SAY: 'prefer_not_to_say',
};

const LEARNING_STYLES = {
  VISUAL: 'visual',
  AUDITORY: 'auditory',
  KINESTHETIC: 'kinesthetic',
  READING: 'reading',
  MIXED: 'mixed',
};

const LANGUAGE_PROFICIENCY = {
  NATIVE: 'native',
  FLUENT: 'fluent',
  CONVERSATIONAL: 'conversational',
  BEGINNER: 'beginner',
  NONE: 'none',
};

const NOTIFICATION_PREFERENCES = {
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
  IN_APP: 'in_app',
  NONE: 'none',
};

const PRIVACY_LEVELS = {
  PUBLIC: 'public',
  FRIENDS_ONLY: 'friends_only',
  PRIVATE: 'private',
};

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

/**
 * Enhanced progress tracking
 */
const progressSchema = new mongoose.Schema({
  totalPoints: {
    type: Number,
    default: 0,
    min: 0,
  },
  dailyProgress: {
    type: Number,
    default: 0,
    min: 0
  },
  dailyGoal: {
    type: Number,
    default: 20,
    min: 0
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100,
  },
  
  experience: {
    current: { type: Number, default: 0 },
    nextLevel: { type: Number, default: 100 },
    totalEarned: { type: Number, default: 0 },
  },
  
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActive: Date,
    freezes: { type: Number, default: 0 },
    freezeUsed: { type: Number, default: 0 },
  },
  
  completedLessons: [{
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    language_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', index: true },
    completedAt: Date,
    score: Number,
    timeSpent: Number,
  }],
  
  lessonStats: {
    totalCompleted: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 }, // minutes
    averageScore: { type: Number, default: 0 },
    perfectScores: { type: Number, default: 0 },
     // ADD THIS: Ensure it's initialized for the leaderboard
    lastLessonDate: { type: Date } 
  },
  
  badges: [{
    name: { type: String, required: true },
    description: String,
    icon: String,
    category: String,
    language_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', index: true },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    },
    dateEarned: { type: Date, default: Date.now },
    progress: { type: Number, min: 0, max: 100 },
    metadata: mongoose.Schema.Types.Mixed,
  }],
  
  achievements: [{
    achievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' },
    name: String,
    description: String,
    progress: Number,
    completed: Boolean,
    completedAt: Date,
    rewards: mongoose.Schema.Types.Mixed,
  }],
  
  challenges: [{
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
    progress: Number,
    completed: Boolean,
    completedAt: Date,
    reward: mongoose.Schema.Types.Mixed,
  }],
  
  dailyGoals: {
    lastReset: Date,
    goals: [{
      type: String,
      target: Number,
      progress: Number,
      completed: Boolean,
    }],
    streak: { type: Number, default: 0 },
  },
  
  weeklyGoals: {
    week: Number,
    year: Number,
    goals: [{
      type: String,
      target: Number,
      progress: Number,
      completed: Boolean,
    }],
    completed: { type: Number, default: 0 },
  },
  
  monthlyGoals: {
    month: Number,
    year: Number,
    goal: {
      type: String,
      target: Number,
      progress: Number,
    },
  },
  
  // Leaderboard data
  leaderboard: {
    globalRank: Number,
    countryRank: Number,
    friendsRank: Number,
    weeklyRank: Number,
    monthlyRank: Number,
    lastUpdated: Date,
  },
  
  // Mastery tracking
  mastery: {
    overall: { type: Number, default: 0, min: 0, max: 100 },
    byCategory: {
      type: Map,
      of: Number,
    },
    bySkill: {
      listening: { type: Number, default: 0 },
      speaking: { type: Number, default: 0 },
      reading: { type: Number, default: 0 },
      writing: { type: Number, default: 0 },
      grammar: { type: Number, default: 0 },
      vocabulary: { type: Number, default: 0 },
    },
  },
});

/**
 * Enhanced vocabulary mastery with full SRS
 */
const vocabularyMasterySchema = new mongoose.Schema({
  wordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
    required: true,
  },
  language_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
    index: true,
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
  
  // Review tracking
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
  
  // Performance metrics
  averageResponseTime: Number,
  fastestResponseTime: Number,
  slowestResponseTime: Number,
  lastQuality: Number,
  
  // Mastery level
  masteryLevel: {
    type: String,
    enum: ['exposed', 'familiar', 'acquired', 'mastered', 'native'],
    default: 'exposed',
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
  
  // Review history
  reviewHistory: [{
    date: Date,
    quality: Number,
    responseTime: Number,
    context: String,
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeSession' },
  }],
  
  // Mistake tracking
  commonMistakes: [{
    type: String,
    count: Number,
  }],
  
  // Personal notes
  personalNotes: String,
  mnemonics: String,
  
  // Context examples where user encountered the word
  contexts: [{
    source: String,
    sentence: String,
    date: Date,
  }],
});

/**
 * Enhanced referral system
 */
const referralSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    sparse: true,
    unique: true,
    uppercase: true,
  },
  
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  
  referredUsers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive'],
    },
    rewards: [{
      type: String,
      amount: Number,
      claimed: Boolean,
      claimedAt: Date,
    }],
  }],
  
  stats: {
    totalReferrals: { type: Number, default: 0 },
    activeReferrals: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    rewardsClaimed: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
  },
  
  rewards: [{
    tier: {
      type: Number,
      min: 1,
      max: 10,
    },
    referralsNeeded: Number,
    reward: {
      type: String,
      description: String,
      value: mongoose.Schema.Types.Mixed,
    },
    achieved: Boolean,
    achievedAt: Date,
    claimed: Boolean,
    claimedAt: Date,
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
});

/**
 * Enhanced user profile
 */
const profileSchema = new mongoose.Schema({
  // Basic info
  firstName: String,
  lastName: String,
  displayName: String,
  
  avatar: {
    url: String,
    thumbnail: String,
    uploadedAt: Date,
  },
  
  coverPhoto: {
    url: String,
    uploadedAt: Date,
  },
  
  bio: {
    type: String,
    maxlength: 500,
  },
  
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: Object.values(GENDERS),
  },
  
  // Location
  country: String,
  city: String,
  timezone: String,
  language: {
    type: String,
    default: 'en',
  },
  
  // Language background
  nativeLanguage: String,
  otherLanguages: [{
    language: String,
    proficiency: {
      type: String,
      enum: Object.values(LANGUAGE_PROFICIENCY),
    },
  }],
  
  // Learning preferences
  learningStyle: {
    type: String,
    enum: Object.values(LEARNING_STYLES),
    default: LEARNING_STYLES.MIXED,
  },
  
  interests: [String],
  goals: [{
    description: String,
    targetDate: Date,
    achieved: Boolean,
    achievedAt: Date,
  }],
  
  // Social links
  socialLinks: {
    website: String,
    twitter: String,
    facebook: String,
    instagram: String,
    linkedin: String,
  },
  
  // Privacy settings
  privacy: {
    profileVisibility: {
      type: String,
      enum: Object.values(PRIVACY_LEVELS),
      default: PRIVACY_LEVELS.PUBLIC,
    },
    progressVisibility: {
      type: String,
      enum: Object.values(PRIVACY_LEVELS),
      default: PRIVACY_LEVELS.FRIENDS_ONLY,
    },
    showEmail: { type: Boolean, default: false },
    showLocation: { type: Boolean, default: true },
    showAge: { type: Boolean, default: false },
  },
  
  // Professional info
  occupation: String,
  education: String,
  
  // Customization
  theme: {
    type: String,
    default: 'light',
  },
  accentColor: {
    type: String,
    default: '#4CAF50',
  },
  fontSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium',
  },
});

/**
 * Enhanced security schema
 */
const securitySchema = new mongoose.Schema({
  // authentication
  refreshToken: {
    type: String,
    select: false, // Keep it hidden by default
    index: true
  },
  tokenVersion: {
    type: Number,
    default: 1
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: String,
  twoFactorBackupCodes: [String],
  
  // Sessions
  sessions: [{
    token: String,
    device: String,
    platform: String,
    browser: String,
    ip: String,
    location: String,
    lastActive: Date,
    expiresAt: Date,
    isCurrent: { type: Boolean, default: false },
  }],
  
  // Login history
  loginHistory: [{
    timestamp: Date,
    ip: String,
    device: String,
    location: String,
    successful: Boolean,
    failureReason: String,
  }],
  
  // Failed attempts
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: Date,
  
  // Password reset
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Email verification
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerifiedAt: Date,
  
  // Phone verification
  phone: String,
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerificationCode: String,
  phoneVerificationExpires: Date,
  
  // API keys
  apiKeys: [{
    key: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: String,
    permissions: [String],
    lastUsed: Date,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now },
  }],
  
  // Security questions
  securityQuestions: [{
    question: String,
    answer: String,
    updatedAt: Date,
  }],
  
  // Trusted devices
  trustedDevices: [{
    deviceId: String,
    name: String,
    lastUsed: Date,
  }],
});

/**
 * Enhanced notification preferences
 */
const notificationSchema = new mongoose.Schema({
  // Channels
  channels: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
  },
  
  // Types of notifications
  types: {
    lessonReminders: { type: Boolean, default: true },
    streakAlerts: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
    friendActivity: { type: Boolean, default: true },
    newContent: { type: Boolean, default: true },
    tipsAndTricks: { type: Boolean, default: true },
    newsletter: { type: Boolean, default: false },
    marketing: { type: Boolean, default: false },
    security: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
  },
  
  // Schedule
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: String, // HH:mm format
    end: String,
  },
  
  // Push notification tokens
  pushTokens: [{
    token: String,
    platform: String,
    deviceId: String,
    lastUsed: Date,
    createdAt: { type: Date, default: Date.now },
  }],
  
  // Email preferences
  emailFrequency: {
    type: String,
    enum: ['instant', 'daily', 'weekly', 'never'],
    default: 'instant',
  },
  
  // Last notification read
  lastRead: Date,
  unreadCount: { type: Number, default: 0 },
});

/**
 * Payment and subscription schema
 */
const paymentSchema = new mongoose.Schema({
  accountType: {
    type: String,
    enum: Object.values(ACCOUNT_TYPES),
    default: ACCOUNT_TYPES.FREE,
  },
  
  subscription: {
    plan: String,
    status: {
      type: String,
      enum: ['active', 'canceled', 'expired', 'trial'],
    },
    startDate: Date,
    endDate: Date,
    trialEnds: Date,
    autoRenew: { type: Boolean, default: true },
    paymentMethod: String,
    lastPayment: Date,
    nextPayment: Date,
  },
  
  paymentHistory: [{
    amount: Number,
    currency: { type: String, default: 'USD' },
    date: Date,
    method: String,
    status: String,
    transactionId: String,
    invoiceUrl: String,
  }],
  
  stripeCustomerId: String,
  paypalEmail: String,
  
  coupons: [{
    code: String,
    discount: Number,
    validUntil: Date,
    used: Boolean,
    usedAt: Date,
  }],
  
  lifetimeAccess: {
    enabled: { type: Boolean, default: false },
    grantedAt: Date,
    reason: String,
  },
});

// ============================================================================
// MAIN USER SCHEMA
// ============================================================================

const userSchema = new mongoose.Schema({
  
  // Add to userSchema
activeLanguage: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Language',
},
learningLanguages: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Language',
}],
  
  // Core authentication
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    lowercase: true,
    index: true,
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
  },
  
  password: {
    type: String,
    required: function() { return !this.googleId; }, // password is not required if googleId exists
    minlength: 8,
    select: false, // Don't return password by default
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  
  // Roles and permissions
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER,
    index: true,
  },
  
  permissions: [{
    type: String,
    enum: ['manage_users', 'manage_content', 'manage_system', 'view_analytics', 'export_data'],
  }],
  
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.PENDING_VERIFICATION,
    index: true,
  },
  
  statusReason: String,
  statusUpdatedAt: Date,
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Embedded schemas
  progress: {
    type: progressSchema,
    default: () => ({}),
  },
  
  vocabularyMastery: [vocabularyMasterySchema],
  
  referral: referralSchema,
  
  profile: {
    type: profileSchema,
    default: () => ({}),
  },
  
  security: {
    type: securitySchema,
    default: () => ({}),
  },
  
  notifications: {
    type: notificationSchema,
    default: () => ({}),
  },
  
  payments: {
    type: paymentSchema,
    default: () => ({}),
  },
  
  // Friends and community
  friends: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
    },
    since: Date,
  }],

  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary',
  }],
  
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentAt: Date,
    message: String,
  }],
  
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  
  // Groups and communities
  groups: [{
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
    },
    joinedAt: Date,
  }],
  
  // Content contributions
  contributions: {
    wordsAdded: [{
      wordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vocabulary' },
      addedAt: Date,
      status: String,
    }],
    translations: [{
      translationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Translation' },
      addedAt: Date,
    }],
    corrections: [{
      correctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Correction' },
      addedAt: Date,
      accepted: Boolean,
    }],
    totalContributions: { type: Number, default: 0 },
    contributionScore: { type: Number, default: 0 },
    verifiedContributions: { type: Number, default: 0 }, // ADD THIS
    contributorLevel: {
      type: String,
      enum: ['novice', 'contributor', 'expert', 'master'],
      default: 'novice',
    },
  },
  
  // Learning preferences
  preferences: {
    dailyGoal: { type: Number, default: 10 }, // minutes
    weeklyGoal: { type: Number, default: 60 }, // minutes
    preferredCategories: [String],
    preferredTimes: [String], // HH:mm format
    remindAt: String, // HH:mm format
    language: { type: String, default: 'en' },
    
    audioQuality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    downloadOverWifi: { type: Boolean, default: true },
    autoPlayAudio: { type: Boolean, default: true },
    showTranslations: { type: Boolean, default: true },
    showPhonetic: { type: Boolean, default: true },
    enableHaptics: { type: Boolean, default: true },
    reduceMotion: { type: Boolean, default: false },
  },
  
  // Gamification
  gamification: {
    points: {
      total: { type: Number, default: 0 },
      history: [{
        amount: Number,
        reason: String,
        timestamp: { type: Date, default: Date.now } // Ensure dates aren't null
      }],
    },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    nextLevelExp: { type: Number, default: 100 },
    titles: [{
      title: String,
      earnedAt: Date,
      equipped: Boolean,
    }],
    equippedTitle: String,
    cosmetics: {
      avatarFrame: String,
      badgeDisplay: [String],
      theme: String,
    },
  },
  
  // Analytics and tracking
  analytics: {
    firstVisit: { type: Date, default: Date.now },
    lastVisit: Date,
    visitCount: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 }, // minutes
    averageSessionLength: { type: Number, default: 0 },
    deviceStats: {
      type: Map,
      of: Number,
    },
    osStats: {
      type: Map,
      of: Number,
    },
    appVersion: String,
    lastAppVersion: String,
  },
  
  // Device information
  devices: [{
    deviceId: String,
    platform: String,
    model: String,
    osVersion: String,
    appVersion: String,
    lastActive: Date,
    firstSeen: Date,
    pushToken: String,
  }],
  
  // Metadata
  metadata: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdVia: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web',
    },
    dataVersion: { type: String, default: '1.0' },
    tags: [String],
    notes: String,
  },
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ============================================================================
// INDEXES
// ============================================================================

// Core indexes
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'progress.level': -1, 'progress.totalPoints': -1 });
userSchema.index({ 'progress.streak.current': -1 });

userSchema.index({ createdAt: -1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'profile.country': 1, 'progress.level': -1 });
userSchema.index({ 'security.emailVerified': 1 });
userSchema.index({ 'security.lockedUntil': 1 });

// Text search indexes
userSchema.index({
  username: 'text',
  email: 'text',
  'profile.firstName': 'text',
  'profile.lastName': 'text',
  'profile.displayName': 'text',
  'profile.bio': 'text',
});

// ============================================================================
// VIRTUALS
// ============================================================================

// Full name virtual
userSchema.virtual('fullName').get(function() {
  if (this.profile?.firstName || this.profile?.lastName) {
    return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
  }
  return this.username;
});

// Display name virtual
userSchema.virtual('displayName').get(function() {
  return this.profile?.displayName || this.fullName || this.username;
});

// Avatar URL virtual
userSchema.virtual('avatarUrl').get(function() {
  return this.profile?.avatar?.url || `https://ui-avatars.com/api/?name=${this.username}&background=4CAF50&color=fff&size=200`;
});

// Is online virtual
userSchema.virtual('isOnline').get(function() {
  if (!this.lastActive) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastActive > fiveMinutesAgo;
});

// Completion rate virtual
userSchema.virtual('completionRate').get(function() {
  if (!this.progress?.lessonStats?.totalCompleted) return 0;
  // This would need total available lessons from somewhere
  return 0;
});

// Mastery level virtual
userSchema.virtual('masteryLevel').get(function() {
  if (this.vocabularyMastery?.length > 0) {
    const mastered = this.vocabularyMastery.filter(v => v.masteryLevel === 'mastered').length;
    const total = this.vocabularyMastery.length;
    return Math.round((mastered / total) * 100);
  }
  return 0;
});

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================

// Hash password before saving
userSchema.pre('save', async function() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  // Update timestamps
  this.updatedAt = new Date();
  
  // Generate referral code if not exists
  if (!this.referral?.code) {
    this.referral = this.referral || {};
    this.referral.code = this.generateReferralCode();
  }
  
  // Update level based on experience
  if (this.isModified('gamification.experience')) {
    this.updateLevel();
  }
  
  // Update last active
  if (this.isModified()) {
    this.lastActive = new Date();
  }
  
});

// Post-save middleware
userSchema.post('save', function(doc) {
  // Could trigger events, notifications, etc.
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

/**
 * Compare password for login
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate JWT token
 */
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Generate refresh token
 */
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );
};

/**
 * Generate email verification token
 */
userSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.security.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.security.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

/**
 * Generate password reset token
 */
userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.security.resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.security.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

/**
 * Generate API key
 */
userSchema.methods.generateApiKey = function(name = 'Default') {
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  if (!this.security.apiKeys) {
    this.security.apiKeys = [];
  }
  
  this.security.apiKeys.push({
    key: apiKey,
    name,
    permissions: ['read'],
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  });
  
  return apiKey;
};

/**
 * Generate referral code
 */
userSchema.methods.generateReferralCode = function() {
  // Fallback to 'USER' if username isn't loaded or doesn't exist
  const namePart = this.username ? this.username.substring(0, 3) : 'USR';
  const prefix = namePart.toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
};

/**
 * Add experience points
 */
userSchema.methods.addExperience = function(amount) {
  this.gamification = this.gamification || {};
  this.gamification.experience = (this.gamification.experience || 0) + amount;
  this.gamification.totalExp = (this.gamification.totalExp || 0) + amount;
  
  this.updateLevel();
};

/**
 * Update level based on experience
 */
userSchema.methods.updateLevel = function() {
  const exp = this.gamification.experience || 0;
  const baseExp = 100;
  
  // Simple level formula
  let level = Math.floor(Math.sqrt(exp / baseExp)) + 1;
  level = Math.min(100, Math.max(1, level));
  
  this.gamification.level = level;
  // This ensures the NEXT target is always higher than current exp
  this.gamification.nextLevelExp = baseExp * Math.pow(level, 2); 
  
  if (this.progress) {
    this.progress.level = level;
  }
};


/**
 * Add points
 */
 userSchema.methods.addPoints = function(amount, reason) {
  // Ensure progress and gamification exist
  this.gamification = this.gamification || { points: { total: 0, history: [] } };
  this.progress = this.progress || { totalPoints: 0 };

  this.gamification.points.total += amount;
  this.gamification.points.history.push({
    amount,
    reason,
    timestamp: new Date(),
  });
  
  this.progress.totalPoints += amount;
};

/**
 * Check and award streak
 */
userSchema.methods.checkStreak = function() {
  const now = new Date();
  
  // Normalize dates to midnight to compare 'calendar days'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Handle empty lastActive (New User)
  if (!this.progress.streak.lastActive) {
    this.progress.streak.current = 1;
    this.progress.streak.lastActive = now;
    this.progress.streak.longest = 1;
    return;
  }

  const last = new Date(this.progress.streak.lastActive);
  const lastActiveDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());

  const diffTime = today - lastActiveDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // SCENARIO 1: Already active today. 
    // Just update the timestamp for accuracy, don't increment.
    this.progress.streak.lastActive = now;
  } 
  else if (diffDays === 1) {
    // SCENARIO 2: Perfect streak continuation.
    this.progress.streak.current += 1;
    this.progress.streak.lastActive = now;
  } 
  else if (diffDays > 1) {
    // SCENARIO 3: Streak broken. Check for Freezes.
    if (this.progress.streak.freezes > 0) {
      // Use a freeze: decrement freeze count, keep streak current
      this.progress.streak.freezes -= 1;
      this.progress.streak.freezeUsed += 1;
      this.progress.streak.lastActive = now;
      // We don't increment 'current' here, we just save it from reset
    } else {
      // No freezes left: Reset
      this.progress.streak.current = 1;
      this.progress.streak.lastActive = now;
    }
  }

  // Sync longest streak
  if (this.progress.streak.current > this.progress.streak.longest) {
    this.progress.streak.longest = this.progress.streak.current;
  }
};

/**
 * Update session time and check for daily goal/streak completion
 */
userSchema.methods.updateActivity = function(minutesSpent) {
  this.analytics.totalTimeSpent += minutesSpent;
  this.progress.dailyProgress += minutesSpent;

  // Check if they hit their daily goal (e.g., 10 mins)
  if (this.progress.dailyProgress >= this.preferences.dailyGoal) {
    this.checkStreak();
  }
};


/**
 * Update vocabulary mastery
 */
userSchema.methods.updateVocabularyMastery = function(wordId, reviewData) {
  let mastery = this.vocabularyMastery.find(v => 
    v.wordId.toString() === wordId.toString()
  );
  
  if (!mastery) {
    mastery = {
      wordId,
      firstSeen: new Date(),
      reviewHistory: [],
    };
    this.vocabularyMastery.push(mastery);
  }
  
  // Add review
  mastery.reviewHistory.push({
    date: new Date(),
    quality: reviewData.quality,
    responseTime: reviewData.responseTime,
    context: reviewData.context,
    sessionId: reviewData.sessionId,
  });
  
  // Update SRS data
  mastery.reviewCount += 1;
  
  if (reviewData.quality >= 3) {
    mastery.correctCount += 1;
  } else {
    mastery.incorrectCount += 1;
  }
  
  mastery.lastReviewed = new Date();
  mastery.nextReview = reviewData.nextReview;
  mastery.stage = reviewData.stage;
  mastery.interval = reviewData.interval;
  mastery.easeFactor = reviewData.easeFactor;
  mastery.lastQuality = reviewData.quality;
  
  // Update mastery level
  const accuracy = (mastery.correctCount / mastery.reviewCount) * 100;
  
  if (accuracy >= 90 && mastery.reviewCount >= 10) {
    mastery.masteryLevel = 'native';
    mastery.confidence = 1;
  } else if (accuracy >= 80 && mastery.reviewCount >= 7) {
    mastery.masteryLevel = 'mastered';
    mastery.confidence = 0.9;
  } else if (accuracy >= 70 && mastery.reviewCount >= 5) {
    mastery.masteryLevel = 'acquired';
    mastery.confidence = 0.7;
  } else if (accuracy >= 60 && mastery.reviewCount >= 3) {
    mastery.masteryLevel = 'familiar';
    mastery.confidence = 0.5;
  }
  
  // Update overall mastery
  this.updateOverallMastery();
};

/**
 * Update overall mastery percentage
 */
userSchema.methods.updateOverallMastery = function() {
  if (this.vocabularyMastery.length === 0) return;
  
  const mastered = this.vocabularyMastery.filter(v => 
    v.masteryLevel === 'mastered' || v.masteryLevel === 'native'
  ).length;
  
  this.progress.mastery.overall = Math.round((mastered / this.vocabularyMastery.length) * 100);
};

/**
 * Track login
 */
userSchema.methods.trackLogin = function(loginData) {
  if (!this.security.loginHistory) {
    this.security.loginHistory = [];
  }
  
  this.security.loginHistory.push({
    timestamp: new Date(),
    ip: loginData.ip,
    device: loginData.device,
    location: loginData.location,
    successful: true,
  });
  
  // Keep only last 50 login attempts
  if (this.security.loginHistory.length > 50) {
    this.security.loginHistory = this.security.loginHistory.slice(-50);
  }
  
  this.lastActive = new Date();
  this.analytics.visitCount += 1;
  this.analytics.lastVisit = new Date();
  
  // Reset failed attempts on successful login
  this.security.failedLoginAttempts = 0;
  this.security.lockedUntil = null;
};

/**
 * Track failed login
 */
userSchema.methods.trackFailedLogin = function(failureData) {
  if (!this.security.loginHistory) {
    this.security.loginHistory = [];
  }
  
  this.security.loginHistory.push({
    timestamp: new Date(),
    ip: failureData.ip,
    device: failureData.device,
    location: failureData.location,
    successful: false,
    failureReason: failureData.reason,
  });
  
  this.security.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.security.failedLoginAttempts >= 5) {
    this.security.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
};

/**
 * Add friend
 */
userSchema.methods.addFriend = function(friendId) {
  if (!this.friends) {
    this.friends = [];
  }
  
  this.friends.push({
    user: friendId,
    status: 'pending',
    since: new Date(),
  });
};

/**
 * Accept friend request
 */
userSchema.methods.acceptFriend = function(friendId) {
  const friendRequest = this.friendRequests?.find(
    req => req.from.toString() === friendId.toString()
  );
  
  if (friendRequest) {
    // Remove from requests
    this.friendRequests = this.friendRequests.filter(
      req => req.from.toString() !== friendId.toString()
    );
    
    // Add to friends
    if (!this.friends) {
      this.friends = [];
    }
    
    this.friends.push({
      user: friendId,
      status: 'accepted',
      since: new Date(),
    });
  }
};

/**
 * Check if user has permission
 */
userSchema.methods.hasPermission = function(permission) {
  return this.permissions?.includes(permission) || this.role === USER_ROLES.SUPER_ADMIN;
};

/**
 * Get public profile
 */
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    bio: this.profile?.bio,
    country: this.profile?.country,
    joinedAt: this.createdAt,
    level: this.progress?.level || 1,
    badges: this.progress?.badges?.slice(0, 5) || [],
    mastery: this.progress?.mastery?.overall || 0,
    streak: this.progress?.streak?.current || 0,
  };
};

/**
 * Get public JSON representation
 */
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    profile: {
      displayName: this.displayName,
      avatarUrl: this.avatarUrl,
      bio: this.profile?.bio,
    },
    gamification: {
      level: this.progress?.level || 1,
      points: this.gamification?.points?.total || 0,
      streak: this.progress?.streak?.current || 0,
    },
    createdAt: this.createdAt,
  };
};

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Find by email or username
 */
userSchema.statics.findByLogin = function(login) {
  return this.findOne({
    $or: [
      { email: login.toLowerCase() },
      { username: login.toLowerCase() },
    ],
  }).select('+password');
};

/**
 * Get leaderboard
 */
userSchema.statics.getLeaderboard = function(limit = 100, filter = {}) {
  return this.find(filter)
    .select('username profile.avatar progress.level progress.totalPoints progress.streak progress.badges')
    .sort({ 'progress.totalPoints': -1, 'progress.level': -1 })
    .limit(limit);
};

/**
 * Get top streaks
 */
userSchema.statics.getTopStreaks = function(limit = 50) {
  return this.find({ 'progress.streak.current': { $gt: 0 } })
    .select('username profile.avatar progress.streak')
    .sort({ 'progress.streak.current': -1 })
    .limit(limit);
};

/**
 * Search users
 */
userSchema.statics.search = function(query, limit = 20) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

/**
 * Get user statistics
 */
userSchema.statics.getStats = async function() {
  const [
    totalUsers,
    activeToday,
    activeThisWeek,
    newThisMonth,
    topCountries,
  ] = await Promise.all([
    this.countDocuments({ status: USER_STATUS.ACTIVE }),
    this.countDocuments({ lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    this.countDocuments({ lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    this.countDocuments({ createdAt: { $gte: new Date(new Date().setDate(1)) } }),
    this.aggregate([
      { $match: { 'profile.country': { $exists: true, $ne: null } } },
      { $group: { _id: '$profile.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);
  
  return {
    totalUsers,
    activeToday,
    activeThisWeek,
    newThisMonth,
    topCountries,
  };
};

module.exports = mongoose.model('User', userSchema);
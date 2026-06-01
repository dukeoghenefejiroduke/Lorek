const mongoose = require('mongoose');

const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PREMIUM_PLUS: 'premium_plus',
  FAMILY: 'family',
  LIFETIME: 'lifetime',
};

const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  TRIAL: 'trial',
  PAST_DUE: 'past_due',
};

const BILLING_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
};

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  plan: {
    type: String,
    enum: Object.values(SUBSCRIPTION_PLANS),
    default: SUBSCRIPTION_PLANS.FREE,
  },
  status: {
    type: String,
    enum: Object.values(SUBSCRIPTION_STATUS),
    default: SUBSCRIPTION_STATUS.ACTIVE,
  },
  billingPeriod: {
    type: String,
    enum: Object.values(BILLING_PERIODS),
    default: BILLING_PERIODS.MONTHLY,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
  trialEndsAt: Date,
  autoRenew: {
    type: Boolean,
    default: true,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  
  // Payment provider IDs
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  appleReceiptData: String,
  googlePlayPurchaseToken: String,
  
  // Features access
  features: {
    unlimitedLessons: { type: Boolean, default: false },
    offlineMode: { type: Boolean, default: false },
    noAds: { type: Boolean, default: false },
    aiConversations: { type: Boolean, default: false },
    pronunciationFeedback: { type: Boolean, default: false },
    grammarReview: { type: Boolean, default: false },
    vocabularyReview: { type: Boolean, default: false },
    certificates: { type: Boolean, default: false },
    skipLessons: { type: Boolean, default: false },
    streakProtection: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    allLanguages: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    exportData: { type: Boolean, default: false },
  },
  
  // Usage limits
  usage: {
    dailyLessonLimit: { type: Number, default: 5 },
    dailyFlashcardLimit: { type: Number, default: 20 },
    dailyQuizLimit: { type: Number, default: 3 },
    monthlyMinutesLimit: { type: Number, default: 300 },
  },
  
  // Payment history
  payments: [{
    amount: Number,
    currency: { type: String, default: 'USD' },
    date: Date,
    method: String,
    transactionId: String,
    invoiceUrl: String,
  }],
  
  // Metadata
  metadata: {
    couponCode: String,
    referralSource: String,
    platform: { type: String, enum: ['ios', 'android', 'web'] },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
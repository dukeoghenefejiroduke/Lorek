const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { logger } = require('../config/logger');

// Premium features definitions
const PREMIUM_FEATURES = {
  FREE: {
    name: 'Free',
    price: 0,
    features: {
      unlimitedLessons: false,
      offlineMode: false,
      noAds: true, // Basic ads, not premium
      aiConversations: false,
      pronunciationFeedback: false,
      grammarReview: false,
      vocabularyReview: false,
      certificates: false,
      skipLessons: false,
      streakProtection: false,
      prioritySupport: false,
      allLanguages: false,
      advancedAnalytics: false,
      exportData: false,
    },
    limits: {
      dailyLessonLimit: 1,
      dailyFlashcardLimit: 10,
      dailyQuizLimit: 1,
      monthlyMinutesLimit: 60,
    },
  },
  PREMIUM: {
    name: 'Premium',
    price: 9.99,
    priceYearly: 79.99,
    features: {
      unlimitedLessons: true,
      offlineMode: true,
      noAds: true,
      aiConversations: false,
      pronunciationFeedback: false,
      grammarReview: true,
      vocabularyReview: true,
      certificates: true,
      skipLessons: true,
      streakProtection: true,
      prioritySupport: false,
      allLanguages: true,
      advancedAnalytics: true,
      exportData: true,
    },
    limits: {
      dailyLessonLimit: -1, // unlimited
      dailyFlashcardLimit: -1,
      dailyQuizLimit: -1,
      monthlyMinutesLimit: -1,
    },
  },
  PREMIUM_PLUS: {
    name: 'Premium Plus',
    price: 14.99,
    priceYearly: 119.99,
    features: {
      unlimitedLessons: true,
      offlineMode: true,
      noAds: true,
      aiConversations: true,
      pronunciationFeedback: true,
      grammarReview: true,
      vocabularyReview: true,
      certificates: true,
      skipLessons: true,
      streakProtection: true,
      prioritySupport: true,
      allLanguages: true,
      advancedAnalytics: true,
      exportData: true,
    },
    limits: {
      dailyLessonLimit: -1,
      dailyFlashcardLimit: -1,
      dailyQuizLimit: -1,
      monthlyMinutesLimit: -1,
    },
  },
};

class PremiumService {
  /**
   * Check if user has access to a feature
   */
  async hasFeature(userId, featureName) {
    try {
      const subscription = await Subscription.findOne({ user: userId });
      
      if (!subscription || subscription.status !== 'active') {
        return PREMIUM_FEATURES.FREE.features[featureName] || false;
      }
      
      const planFeatures = PREMIUM_FEATURES[subscription.plan.toUpperCase()] || PREMIUM_FEATURES.FREE;
      return planFeatures.features[featureName] || false;
    } catch (error) {
      logger.error('Feature check error:', error);
      return false;
    }
  }
  
  /**
   * Get user's current plan and limits
   */
  async getUserPlan(userId) {
    try {
      const subscription = await Subscription.findOne({ user: userId });
      
      if (!subscription || subscription.status !== 'active') {
        return {
          plan: 'free',
          ...PREMIUM_FEATURES.FREE,
        };
      }
      
      const planData = PREMIUM_FEATURES[subscription.plan.toUpperCase()];
      return {
        plan: subscription.plan,
        status: subscription.status,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        ...planData,
      };
    } catch (error) {
      logger.error('Get user plan error:', error);
      return { plan: 'free', ...PREMIUM_FEATURES.FREE };
    }
  }
  
  /**
   * Check daily usage limits
   */
  async checkUsageLimit(userId, actionType) {
    const userPlan = await this.getUserPlan(userId);
    
    if (userPlan.plan !== 'free') {
      return { allowed: true, remaining: -1 };
    }
    
    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const usageKey = `usage:${userId}:${actionType}:${today}`;
    
    // This would need Redis or a daily usage collection
    // For now, return default limits
    const limits = {
      lesson: userPlan.limits.dailyLessonLimit,
      flashcard: userPlan.limits.dailyFlashcardLimit,
      quiz: userPlan.limits.dailyQuizLimit,
      minutes: userPlan.limits.monthlyMinutesLimit,
    };
    
    const currentUsage = 0; // Would fetch from Redis/database
    
    return {
      allowed: currentUsage < limits[actionType] || limits[actionType] === -1,
      remaining: limits[actionType] === -1 ? -1 : Math.max(0, limits[actionType] - currentUsage),
      limit: limits[actionType],
    };
  }
  
  /**
   * Track usage for free tier
   */
  async trackUsage(userId, actionType, amount = 1) {
    // Would increment Redis counter
    logger.debug(`Tracking usage: ${userId} - ${actionType} - ${amount}`);
    return true;
  }
  
  /**
   * Create/Update subscription
   */
  async updateSubscription(userId, plan, billingPeriod, paymentData = {}) {
    try {
      let subscription = await Subscription.findOne({ user: userId });
      
      const planConfig = PREMIUM_FEATURES[plan.toUpperCase()];
      const endDate = this.calculateEndDate(billingPeriod);
      
      if (!subscription) {
        subscription = new Subscription({
          user: userId,
          plan,
          billingPeriod,
          startDate: new Date(),
          endDate,
          features: planConfig.features,
          usage: planConfig.limits,
          ...paymentData,
        });
      } else {
        subscription.plan = plan;
        subscription.billingPeriod = billingPeriod;
        subscription.endDate = endDate;
        subscription.features = planConfig.features;
        subscription.usage = planConfig.limits;
        subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
        Object.assign(subscription, paymentData);
      }
      
      await subscription.save();
      
      // Update user's premium status
      await User.findByIdAndUpdate(userId, {
        isPremium: plan !== 'free',
        premiumSince: plan !== 'free' ? new Date() : null,
      });
      
      return subscription;
    } catch (error) {
      logger.error('Update subscription error:', error);
      throw error;
    }
  }
  
  calculateEndDate(billingPeriod) {
    const date = new Date();
    switch (billingPeriod) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    return date;
  }
  
  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, cancelImmediately = false) {
    const subscription = await Subscription.findOne({ user: userId });
    
    if (!subscription) {
      throw new Error('No active subscription found');
    }
    
    if (cancelImmediately) {
      subscription.status = SUBSCRIPTION_STATUS.CANCELED;
      await subscription.save();
      
      await User.findByIdAndUpdate(userId, { isPremium: false });
    } else {
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();
    }
    
    return subscription;
  }
  
  /**
   * Get pricing for display
   */
  getPricing() {
    return {
      premium: {
        monthly: 9.99,
        quarterly: 24.99,
        yearly: 79.99,
        yearlySavings: '33%',
      },
      premiumPlus: {
        monthly: 14.99,
        quarterly: 39.99,
        yearly: 119.99,
        yearlySavings: '33%',
      },
      family: {
        monthly: 19.99,
        yearly: 159.99,
        members: 5,
      },
      lifetime: {
        oneTime: 299.99,
      },
    };
  }
}

module.exports = new PremiumService();
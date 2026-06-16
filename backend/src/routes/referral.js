const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { socialLimiter } = require('../middleware/rateLimit');
const crypto = require('crypto');

const { auth } = require('../middleware/auth');
const User = require('../models/User');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(socialLimiter);
router.use(auth);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique referral code
 */
function generateReferralCode(username) {
  const prefix = username.substring(0, 3).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Calculate referral tier
 */
function getReferralTier(count) {
  if (count >= 50) return { name: 'Diamond Ambassador', color: '#00BCD4', min: 50 };
  if (count >= 30) return { name: 'Platinum Ambassador', color: '#9C27B0', min: 30 };
  if (count >= 15) return { name: 'Gold Ambassador', color: '#FFD700', min: 15 };
  if (count >= 5) return { name: 'Silver Ambassador', color: '#C0C0C0', min: 5 };
  return { name: 'Bronze Ambassador', color: '#CD7F32', min: 0 };
}

/**
 * Get reward for milestone
 */
function getMilestoneReward(referralCount) {
  const milestones = [
    { count: 1, points: 500, badge: 'First Referral' },
    { count: 5, points: 1000, badge: 'Silver Ambassador' },
    { count: 15, points: 2000, badge: 'Gold Ambassador' },
    { count: 30, points: 5000, badge: 'Platinum Ambassador' },
    { count: 50, points: 10000, badge: 'Diamond Ambassador' },
  ];
  return milestones.find(m => m.count === referralCount);
}

// ============================================================================
// GET REFERRAL STATS
// ============================================================================

/**
 * Get user's referral statistics
 * GET /api/user/referral-stats
 */
router.get('/referral-stats', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('referral')
      .populate('referral.referredUsers.user', 'username email createdAt progress.totalPoints');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const referral = user.referral || {};
    const stats = referral.stats || {
      totalReferrals: 0,
      activeReferrals: 0,
      pointsEarned: 0,
    };

    // Get active referrals count (users who have completed at least one lesson)
    let activeCount = 0;
    if (referral.referredUsers && referral.referredUsers.length > 0) {
      const activeUsers = await User.find({
        _id: { $in: referral.referredUsers.map(r => r.user) },
        'progress.lessonStats.totalCompleted': { $gt: 0 },
      });
      activeCount = activeUsers.length;
    }

    const tier = getReferralTier(stats.totalReferrals || 0);
    const nextMilestone = getMilestoneReward(stats.totalReferrals + 1) || { count: stats.totalReferrals + 1, points: 500 };

    res.json({
      success: true,
      data: {
        totalReferrals: stats.totalReferrals || 0,
        activeReferrals: activeCount,
        pendingReferrals: (stats.totalReferrals || 0) - activeCount,
        totalEarned: stats.pointsEarned || 0,
        rank: tier.name,
        rankColor: tier.color,
        nextMilestone: nextMilestone.count,
        nextReward: nextMilestone.points,
        progressToNext: ((stats.totalReferrals || 0) / nextMilestone.count) * 100,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET REFERRAL CODE
// ============================================================================

/**
 * Get user's referral code
 * GET /api/user/referral-code
 */
router.get('/referral-code', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referral');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    let referralCode = user.referral?.code;

    if (!referralCode) {
      // Generate new code if not exists
      referralCode = generateReferralCode(user.username);
      if (!user.referral) user.referral = {};
      user.referral.code = referralCode;
      await user.save();
    }

    res.json({
      success: true,
      data: {
        code: referralCode,
        link: `https://izonapp.com/join?ref=${referralCode}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GENERATE NEW REFERRAL CODE
// ============================================================================

/**
 * Generate new referral code
 * POST /api/user/referral-code/generate
 */
router.post('/referral-code/generate', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Generate new unique code
    let newCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!isUnique && attempts < maxAttempts) {
      newCode = generateReferralCode(user.username);
      const existing = await User.findOne({ 'referral.code': newCode });
      if (!existing) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      throw new AppError('Unable to generate unique code. Please try again.', 500);
    }

    if (!user.referral) user.referral = {};
    user.referral.code = newCode;
    await user.save();

    logger.info(`User ${user._id} generated new referral code: ${newCode}`);

    res.json({
      success: true,
      data: {
        code: newCode,
        link: `https://izonapp.com/join?ref=${newCode}`,
      },
      message: 'New referral code generated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET REFERRALS LIST
// ============================================================================

/**
 * Get list of users referred by current user
 * GET /api/referral/referrals
 */
router.get('/referrals', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.user._id)
      .select('referral')
      .populate({
        path: 'referral.referredUsers.user',
        select: 'username email createdAt progress.totalPoints progress.lessonStats.totalCompleted profile.avatar',
      });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    let referredUsers = user.referral?.referredUsers || [];

    // Filter by status if specified
    if (status) {
      referredUsers = referredUsers.filter(r => r.status === status);
    }

    const total = referredUsers.length;
    const paginated = referredUsers.slice(skip, skip + parseInt(limit));

    // Enhance referral data with user progress
    const enhancedReferrals = await Promise.all(
      paginated.map(async (ref) => {
        const referredUser = ref.user;
        const isActive = referredUser?.progress?.lessonStats?.totalCompleted > 0;
        
        return {
          id: referredUser?._id,
          name: referredUser?.username || 'Anonymous',
          date: ref.joinedAt,
          status: isActive ? 'active' : 'pending',
          earned: isActive ? 500 : 0,
          avatar: referredUser?.profile?.avatar?.url || null,
          initials: referredUser?.username?.substring(0, 2).toUpperCase() || '??',
          totalPoints: referredUser?.progress?.totalPoints || 0,
          lessonsCompleted: referredUser?.progress?.lessonStats?.totalCompleted || 0,
        };
      })
    );

    res.json({
      success: true,
      data: enhancedReferrals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CLAIM REWARDS
// ============================================================================

/**
 * Claim referral rewards
 * POST /api/user/referral-rewards/claim
 */
router.post('/referral-rewards/claim', async (req, res, next) => {
  try {
    const { rewardId } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const totalReferrals = user.referral?.stats?.totalReferrals || 0;
    const claimedRewards = user.referral?.claimedRewards || [];

    // Define available rewards
    const availableRewards = [
      { id: '5_referrals', name: 'Silver Ambassador Badge', points: 1000, required: 5 },
      { id: '15_referrals', name: 'Gold Ambassador Badge', points: 2000, required: 15 },
      { id: '30_referrals', name: 'Platinum Ambassador Badge', points: 5000, required: 30 },
      { id: '50_referrals', name: 'Diamond Ambassador Badge', points: 10000, required: 50 },
    ];

    const reward = availableRewards.find(r => r.id === rewardId);
    if (!reward) {
      throw new AppError('Invalid reward', 400);
    }

    if (totalReferrals < reward.required) {
      throw new AppError(`Need ${reward.required} referrals to claim this reward`, 400);
    }

    if (claimedRewards.includes(rewardId)) {
      throw new AppError('Reward already claimed', 400);
    }

    // Award the reward
    user.progress.totalPoints += reward.points;
    user.gamification.points.total += reward.points;
    user.gamification.points.history.push({
      amount: reward.points,
      reason: `referral_reward_${rewardId}`,
      timestamp: new Date(),
    });

    // Add badge
    user.progress.badges.push({
      name: reward.name,
      description: `Referred ${reward.required} friends to Izon Language App`,
      icon: getBadgeIcon(reward.required),
      tier: getBadgeTier(reward.required),
      dateEarned: new Date(),
    });

    // Mark as claimed
    if (!user.referral) user.referral = {};
    if (!user.referral.claimedRewards) user.referral.claimedRewards = [];
    user.referral.claimedRewards.push(rewardId);

    await user.save();

    // Send notification
    await notificationService.sendAchievementUnlocked(user._id, {
      name: reward.name,
      description: `You've earned the ${reward.name} badge for referring ${reward.required} friends!`,
      icon: getBadgeIcon(reward.required),
    });

    res.json({
      success: true,
      data: {
        reward: reward.name,
        points: reward.points,
        claimedRewards: user.referral.claimedRewards,
      },
      message: `Successfully claimed ${reward.name} badge and ${reward.points} points!`,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET AVAILABLE REWARDS
// ============================================================================

/**
 * Get available rewards for user
 * GET /api/user/referral-rewards
 */
router.get('/referral-rewards', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referral');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const totalReferrals = user.referral?.stats?.totalReferrals || 0;
    const claimedRewards = user.referral?.claimedRewards || [];

    const availableRewards = [
      { id: '5_referrals', name: 'Silver Ambassador Badge', points: 1000, required: 5, icon: '🥈', description: 'Refer 5 friends' },
      { id: '15_referrals', name: 'Gold Ambassador Badge', points: 2000, required: 15, icon: '🥇', description: 'Refer 15 friends' },
      { id: '30_referrals', name: 'Platinum Ambassador Badge', points: 5000, required: 30, icon: '💎', description: 'Refer 30 friends' },
      { id: '50_referrals', name: 'Diamond Ambassador Badge', points: 10000, required: 50, icon: '🔷', description: 'Refer 50 friends' },
    ];

    const rewardsWithStatus = availableRewards.map(reward => ({
      ...reward,
      unlocked: totalReferrals >= reward.required,
      claimed: claimedRewards.includes(reward.id),
      progress: Math.min(100, (totalReferrals / reward.required) * 100),
      remaining: Math.max(0, reward.required - totalReferrals),
    }));

    res.json({
      success: true,
      data: rewardsWithStatus,
    });
  } catch (err) {
    next(err);
  }
});


// ============================================================================
// PROCESS REFERRAL ON SIGNUP
// ============================================================================

/**
 * Process referral when a new user signs up
 * POST /api/user/referral/process
 */
router.post('/referral/process', [
  body('referralCode').notEmpty().withMessage('Referral code is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { referralCode, newUserId } = req.body;

    // Find referrer
    const referrer = await User.findOne({ 'referral.code': referralCode.toUpperCase() });

    if (!referrer) {
      return res.status(404).json({
        success: false,
        error: 'Invalid referral code',
      });
    }

    // Don't allow self-referral
    if (referrer._id.toString() === newUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot refer yourself',
      });
    }

    // Update referrer's stats
    if (!referrer.referral) {
      referrer.referral = {};
    }
    if (!referrer.referral.stats) {
      referrer.referral.stats = {
        totalReferrals: 0,
        activeReferrals: 0,
        pointsEarned: 0,
      };
    }
    if (!referrer.referral.referredUsers) {
      referrer.referral.referredUsers = [];
    }

    // Add referred user
    referrer.referral.referredUsers.push({
      user: newUserId,
      joinedAt: new Date(),
      status: 'pending',
    });
    referrer.referral.stats.totalReferrals += 1;

    // Award points to referrer
    const bonusPoints = 500;
    referrer.progress.totalPoints += bonusPoints;
    referrer.gamification.points.total += bonusPoints;
    referrer.gamification.points.history.push({
      amount: bonusPoints,
      reason: 'referral_bonus',
      timestamp: new Date(),
    });
    referrer.referral.stats.pointsEarned += bonusPoints;

    // Check for referral milestones
    const milestone = getMilestoneReward(referrer.referral.stats.totalReferrals);
    if (milestone && !referrer.referral.claimedRewards?.includes(`${milestone.count}_referrals`)) {
      // Award milestone badge
      referrer.progress.badges.push({
        name: getBadgeName(milestone.count),
        description: `Referred ${milestone.count} friends to Izon Language App`,
        icon: getBadgeIcon(milestone.count),
        tier: getBadgeTier(milestone.count),
        dateEarned: new Date(),
      });
    }

    await referrer.save();

    logger.info(`Referral processed: ${referrer.username} referred new user ${newUserId}`);

    res.json({
      success: true,
      message: 'Referral processed successfully',
      data: {
        referrerId: referrer._id,
        bonusPoints,
      },
    });
  } catch (err) {
    next(err);
  }
});

function getBadgeName(referrals) {
  if (referrals >= 50) return 'Diamond Ambassador';
  if (referrals >= 30) return 'Platinum Ambassador';
  if (referrals >= 15) return 'Gold Ambassador';
  if (referrals >= 5) return 'Silver Ambassador';
  return 'Bronze Ambassador';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getBadgeIcon(referrals) {
  if (referrals >= 50) return '🔷';
  if (referrals >= 30) return '💎';
  if (referrals >= 15) return '🥇';
  if (referrals >= 5) return '🥈';
  return '🥉';
}

function getBadgeTier(referrals) {
  if (referrals >= 50) return 'diamond';
  if (referrals >= 30) return 'platinum';
  if (referrals >= 15) return 'gold';
  if (referrals >= 5) return 'silver';
  return 'bronze';
}

module.exports = router;
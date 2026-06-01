const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Progress = require('../models/Progress');
const Achievement = require('../models/Achievement');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');
const notificationService = require('../services/notificationService');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/avatars';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Rate limiting
const profileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many profile update requests. Please slow down.',
  },
});

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validateProfileUpdate = [
  body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email').optional().trim().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().trim().matches(/^\+?[\d\s-]{10,}$/).withMessage('Please enter a valid phone number'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
];

// ============================================================================
// GET USER PROFILE
// ============================================================================

/**
 * Get current user profile with full details
 * GET /api/user/profile
 */
router.get('/profile', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -security.refreshToken -security.apiKeys.key')
      .populate('progress.completedLessons.lessonId', 'title.english level category')
      .populate('progress.badges');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get user statistics
    const stats = await getUserStatistics(req.user._id);

    // Get recent achievements
    const recentAchievements = user.progress?.badges?.slice(-5) || [];

    res.json({
      success: true,
      data: {
        user,
        stats,
        recentAchievements,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// UPDATE USER PROFILE
// ============================================================================

/**
 * Update user profile
 * PUT /api/user/profile
 */
router.put('/profile', auth, profileLimiter, validateProfileUpdate, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      username,
      email,
      fullName,
      phone,
      bio,
      location,
      birthDate,
      preferences,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check username uniqueness if changed
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        throw new AppError('Username already taken', 400);
      }
      user.username = username;
    }

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AppError('Email already in use', 400);
      }
      user.email = email;
      // Mark email as unverified until confirmed
      if (user.security) {
        user.security.emailVerified = false;
      }
    }

    // Update profile fields
    if (fullName !== undefined) {
      if (!user.profile) user.profile = {};
      user.profile.fullName = fullName;
      user.profile.displayName = fullName || user.username;
    }

    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) {
      if (!user.profile) user.profile = {};
      user.profile.bio = bio;
    }
    if (location !== undefined) user.location = location;
    if (birthDate !== undefined) user.birthDate = new Date(birthDate);

    // Update preferences
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };
    }

    await user.save();

    logger.info(`User profile updated: ${user._id}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
          phone: user.phone,
          location: user.location,
          birthDate: user.birthDate,
          preferences: user.preferences,
        },
      },
      message: 'Profile updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// UPLOAD AVATAR
// ============================================================================

/**
 * Upload user avatar
 * POST /api/user/avatar
 */
router.post('/avatar', auth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete old avatar if exists
    if (user.profile?.avatar?.url) {
      try {
        await deleteFromCloudinary(user.profile.avatar.url);
      } catch (err) {
        logger.warn('Failed to delete old avatar:', err);
      }
    }

    // Upload to cloud storage
    const uploadResult = await uploadToCloudinary(req.file.path, {
      folder: 'avatars',
      transformation: [
        { width: 400, height: 400, crop: 'fill' },
        { quality: 'auto' }
      ]
    });

    // Update user profile
    if (!user.profile) user.profile = {};
    user.profile.avatar = {
      url: uploadResult.secure_url,
      thumbnail: uploadResult.secure_url.replace('/upload/', '/upload/w_100,h_100,c_fill/'),
      uploadedAt: new Date(),
    };

    await user.save();

    // Clean up local file
    fs.unlink(req.file.path, (err) => {
      if (err) logger.warn('Failed to delete temp file:', err);
    });

    res.json({
      success: true,
      data: {
        avatar: user.profile.avatar,
      },
      message: 'Avatar updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// REMOVE AVATAR
// ============================================================================

/**
 * Remove user avatar
 * DELETE /api/user/avatar
 */
router.delete('/avatar', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.profile?.avatar?.url) {
      await deleteFromCloudinary(user.profile.avatar.url);
      user.profile.avatar = null;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET USER STATISTICS
// ============================================================================

/**
 * Get user statistics
 * GET /api/user/stats
 */
router.get('/stats', auth, async (req, res, next) => {
  try {
    const stats = await getUserStatistics(req.user._id);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CHANGE PASSWORD
// ============================================================================

/**
 * Change user password
 * POST /api/user/change-password
 */
router.post('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update password
    user.password = newPassword;
    user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
    await user.save();

    // Send notification
    await notificationService.sendSecurityAlert(user._id, {
      type: 'password_changed',
      message: 'Your password was changed successfully. If you did not make this change, please contact support immediately.',
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE ACCOUNT
// ============================================================================

/**
 * Delete user account (soft delete)
 * DELETE /api/user/account
 */
router.delete('/account', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Soft delete - mark as deleted
    user.status = 'deleted';
    user.deletedAt = new Date();
    user.username = `deleted_${user._id}`;
    user.email = `deleted_${user._id}@deleted.com`;
    
    // Clear sensitive data
    user.password = undefined;
    user.security = {};
    user.apiKey = null;
    
    await user.save();

    logger.info(`User account deleted: ${user._id}`);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});


/**
 * Get user profile by ID
 * GET /api/user/profile/:userId
 */
router.get('/profile/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('username email profile phone location birthDate createdAt');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        fullName: user.profile?.fullName,
        bio: user.profile?.bio,
        avatar: user.profile?.avatar?.thumbnail,
        location: user.location,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get user stats by ID
 * GET /api/user/stats/:userId
 */
router.get('/stats/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    const progress = await Progress.find({ user: userId });
    
    const completedLessons = progress.filter(p => p.completed);
    const totalTimeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    
    res.json({
      success: true,
      data: {
        totalPoints: user.progress?.totalPoints || 0,
        streak: user.progress?.streak?.current || 0,
        longestStreak: user.progress?.streak?.longest || 0,
        wordsLearned: user.vocabularyMastery?.length || 0,
        lessonsCompleted: completedLessons.length,
        totalTimeSpent: Math.round(totalTimeSpent),
        level: user.progress?.level || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get user badges by ID
 * GET /api/user/badges/:userId
 */
router.get('/badges/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    res.json({
      success: true,
      data: user.progress?.badges || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get user recent activity
 * GET /api/user/activity/:userId
 */
router.get('/activity/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    // Get recent progress
    const progress = await Progress.find({ user: userId })
      .sort({ lastAttempt: -1 })
      .limit(parseInt(limit))
      .populate('lesson', 'title.english');
    
    const activity = progress.map(p => ({
      type: 'lesson',
      description: `Completed lesson "${p.lesson?.title?.english}" with score ${p.score}%`,
      timestamp: p.lastAttempt,
    }));
    
    // Add badge earned activities
    const user = await User.findById(userId);
    const badgeActivities = (user.progress?.badges || [])
      .slice(-5)
      .map(b => ({
        type: 'badge',
        description: `Earned "${b.name}" badge`,
        timestamp: b.dateEarned,
      }));
    
    const allActivity = [...badgeActivities, ...activity]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: allActivity,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserStatistics(userId) {
  const user = await User.findById(userId);
  
  // Get progress records
  const progress = await Progress.find({ user: userId });
  
  const completedLessons = progress.filter(p => p.completed);
  const totalTimeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
  const averageScore = progress.length > 0 
    ? progress.reduce((sum, p) => sum + (p.score || 0), 0) / progress.length 
    : 0;
  
  // Get vocabulary stats
  const vocabularyMastered = user.vocabularyMastery?.filter(v => v.stage >= 4).length || 0;
  const vocabularyLearning = user.vocabularyMastery?.filter(v => v.stage > 0 && v.stage < 4).length || 0;
  
  // Get streak info
  const streak = user.progress?.streak?.current || 0;
  const longestStreak = user.progress?.streak?.longest || 0;
  
  // Get badge count
  const badgeCount = user.progress?.badges?.length || 0;
  
  // Calculate accuracy from vocabulary reviews
  let accuracy = 0;
  if (user.vocabularyMastery && user.vocabularyMastery.length > 0) {
    const totalReviews = user.vocabularyMastery.reduce((sum, v) => sum + (v.reviewCount || 0), 0);
    const correctReviews = user.vocabularyMastery.reduce((sum, v) => sum + (v.correctCount || 0), 0);
    accuracy = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;
  }
  
  // Get referral count
  const referralCount = user.referral?.stats?.totalReferrals || 0;
  
  return {
    overview: {
      wordsLearned: vocabularyMastered,
      wordsLearning: vocabularyLearning,
      lessonsCompleted: completedLessons.length,
      totalTimeSpent: Math.round(totalTimeSpent),
      averageScore: Math.round(averageScore),
      accuracy: Math.round(accuracy),
    },
    streaks: {
      current: streak,
      longest: longestStreak,
    },
    achievements: {
      total: badgeCount,
      recent: user.progress?.badges?.slice(-5) || [],
    },
    referrals: {
      total: referralCount,
    },
    level: {
      current: user.progress?.level || 1,
      points: user.progress?.totalPoints || 0,
      nextLevelPoints: (user.progress?.level || 1) * 100,
    },
  };
}

module.exports = router;
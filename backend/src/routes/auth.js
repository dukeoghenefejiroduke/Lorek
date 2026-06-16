const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { logger } = require('../config/logger');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const redis = require('../config/redis');
const { authLimiter } = require('../middleware/rateLimit');

// ============================================================================
// RATE LIMITING
// ============================================================================

// Apply rate limiting to all auth routes
router.use(authLimiter);

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
    .custom(async (username) => {
      const exists = await User.findOne({ username });
      if (exists) throw new Error('Username already taken');
      return true;
    }),
  
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .custom(async (email) => {
      const exists = await User.findOne({ email });
      if (exists) throw new Error('Email already in use');
      return true;
    }),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

const validateLogin = [
  body('email').trim().isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const validateResetPassword = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

const validateChangePassword = [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', validateRegistration, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password, referralCode } = req.body;

    // Create user
    const user = new User({
      username,
      email,
      password,
      'gamification.level': 1,
      'gamification.experience': 0,
      'gamification.points.total': 0,
    });

    // Handle referral if provided
    if (referralCode) {
      const referrer = await User.findOne({ 'referral.code': referralCode });
      if (referrer) {
        user.referral.referredBy = referrer._id;
        // Award points to referrer (optional, could be handled in service)
      }
    }

    await user.save();

    // Generate token
    const token = user.generateAuthToken();

    // Send welcome notification
    await notificationService.sendWelcomeNotification(user._id);

    // Send welcome email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to Learn Izon!',
        template: 'welcome',
        context: { username: user.username },
      });
    } catch (emailErr) {
      logger.error('Failed to send welcome email:', emailErr);
    }

    res.status(201).json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Track failed attempt
      user.security.failedLoginAttempts += 1;
      if (user.security.failedLoginAttempts >= 5) {
        user.security.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 mins
      }
      await user.save();
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.security.lockUntil && user.security.lockUntil > Date.now()) {
      throw new AppError('Account is temporarily locked. Please try again later.', 403);
    }

    // Reset failed attempts and update last active
    user.security.failedLoginAttempts = 0;
    user.security.lockUntil = undefined;
    user.lastActive = new Date();
    user.security.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = user.generateAuthToken();

    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Forgot password - send reset email
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Invalid email address'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // For security, don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.security.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    user.security.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        template: 'passwordReset',
        context: {
          username: user.username,
          resetUrl,
        },
      });
    } catch (emailErr) {
      logger.error('Failed to send reset email:', emailErr);
      throw new AppError('Failed to send email. Please try again later.', 500);
    }

    res.json({
      success: true,
      message: 'Password reset link sent to email',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Reset password using token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  ...validateResetPassword,
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token, password } = req.body;

    // Hash token to match stored version
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      'security.resetPasswordToken': hashedToken,
      'security.resetPasswordExpire': { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Set new password
    user.password = password;
    user.security.resetPasswordToken = undefined;
    user.security.resetPasswordExpire = undefined;
    user.security.failedLoginAttempts = 0;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

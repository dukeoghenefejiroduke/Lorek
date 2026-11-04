const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { logger } = require('../config/logger');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const redis = require('../config/redis');
const { authLimiter } = require('../middleware/rateLimit');
const { auth } = require('../middleware/auth');

// ... (existing code)

/**
 * Refresh access token
 * POST /api/auth/refresh-token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }
    
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('+security.refreshToken');
    
    if (!user || user.security.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }
    
    const token = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();
    
    user.security.refreshToken = newRefreshToken;
    await user.save();
    
    res.json({
      success: true,
      token,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired refresh token', 401));
    }
    next(err);
  }
});

/**
 * Logout user
 * POST /api/auth/logout
 */
router.post('/logout', auth, async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];

    // Blacklist token in Redis
    await redis.set(`blacklist:${token}`, 'true', 'EX', 3600); // Expires in 1 hour

    // Remove refresh token from user
    const user = await User.findById(req.userId).select('+security.refreshToken');
    if (user) {
        user.security.refreshToken = undefined;
        await user.save();
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ROUTES
// ============================================================================


// Apply rate limiting to all auth routes
router.use(authLimiter);

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Please pick a username between 3 and 30 characters.')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Your username can only have letters, numbers, and underscores.')
    .custom(async (username) => {
      const exists = await User.findOne({ username });
      if (exists) throw new Error('This username is already taken. Try another one.');
      return true;
    }),
  
  body('email')
    .trim()
    .isEmail().withMessage('That email address doesn\'t look right.')
    .normalizeEmail()
    .custom(async (email) => {
      const exists = await User.findOne({ email });
      if (exists) throw new Error('This email is already registered. Try logging in.');
      return true;
    }),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Your password needs at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Your password needs to be stronger. Use a mix of uppercase letters, lowercase letters, and numbers.'),
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
      logger.error('Registration validation errors:', errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password, referralCode } = req.body;

    // Create user
    const user = new User({
      username,
      email,
      password,
      status: 'pending_verification',
      'gamification.level': 1,
      'gamification.experience': 0,
      'gamification.points.total': 0,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();

    // Handle referral if provided
    if (referralCode) {
      const referrer = await User.findOne({ 'referral.code': referralCode });
      if (referrer) {
        user.referral.referredBy = referrer._id;
        // Award points to referrer (optional, could be handled in service)
      }
    }

    await user.save();

    // Send welcome notification
    await notificationService.sendWelcome(user._id);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, user.username, verificationToken);
    } catch (emailErr) {
      logger.error('Failed to send verification email:', emailErr);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account before logging in.',
      data: {
        user: user.toPublicJSON(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Verify user email
 * POST /api/auth/verify-email
 */
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Token is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token } = req.body;

    // Hash token to match stored version
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      'security.emailVerificationToken': hashedToken,
      'security.emailVerificationExpires': { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    // Activate account
    user.status = 'active';
    user.security.emailVerificationToken = undefined;
    user.security.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully. Your account is now active.',
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

    // Check if account is verified
    if (user.status === 'pending_verification') {
      throw new AppError('Account not verified. Please check your email.', 403);
    }

    // Reset failed attempts and update last active
    user.security.failedLoginAttempts = 0;
    user.security.lockUntil = undefined;
    user.lastActive = new Date();
    user.security.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    user.security.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token,
        refreshToken,
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
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send email
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const resetUrl = `${webUrl}/reset-password.html#token=${resetToken}`;
    
    console.log('--- DEVELOPMENT: Reset URL ---');
    console.log(resetUrl);
    console.log('------------------------------');
    
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        template: 'passwordReset',
        data: {
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

/**
 * Google authentication (Login or Register)
 * POST /api/auth/google
 */
router.post('/google', [
  body('token').optional().isString().withMessage('Token must be a string'),
  body('profile').optional().isObject().withMessage('Profile must be an object'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token, profile } = req.body;

    if (!profile || !profile.email) {
      throw new AppError('Google profile with email is required', 400);
    }

    const googleId = profile.id || profile.sub || profile.googleId;
    const email = profile.email.toLowerCase();
    const displayName = profile.name || profile.displayName || email.split('@')[0];
    const avatarUrl = profile.picture || profile.avatarUrl;

    if (!googleId) {
      throw new AppError('Google ID is missing from profile', 400);
    }

    // 1. Check if user exists by googleId
    let user = await User.findOne({ googleId });

    if (!user) {
      // 2. Check if user exists by email
      user = await User.findOne({ email });

      if (user) {
        // Link googleId to existing user
        user.googleId = googleId;
        if (!user.profile) user.profile = {};
        if (!user.profile.avatar) user.profile.avatar = {};
        if (avatarUrl && !user.profile.avatar.url) {
          user.profile.avatar.url = avatarUrl;
        }
        if (displayName && !user.profile.displayName) {
          user.profile.displayName = displayName;
        }
        if (user.status === 'pending_verification') {
          user.status = 'active';
        }
        await user.save();
      } else {
        // Create new user
        let baseUsername = (profile.given_name || email.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '');
        if (baseUsername.length < 3) {
          baseUsername = baseUsername + 'user';
        }
        if (baseUsername.length > 30) {
          baseUsername = baseUsername.substring(0, 30);
        }

        let username = baseUsername;
        let counter = 1;
        while (await User.findOne({ username })) {
          const suffix = String(counter++);
          username = baseUsername.substring(0, 30 - suffix.length) + suffix;
        }

        user = new User({
          username,
          email,
          googleId,
          status: 'active',
          profile: {
            displayName,
            avatar: avatarUrl ? { url: avatarUrl } : undefined,
          },
          'gamification.level': 1,
          'gamification.experience': 0,
          'gamification.points.total': 0,
        });

        await user.save();

        try {
          await notificationService.sendWelcome(user._id);
        } catch (notifErr) {
          logger.error('Failed to send welcome notification for Google user:', notifErr);
        }
      }
    }

    if (user.security?.lockUntil && user.security.lockUntil > Date.now()) {
      throw new AppError('Account is temporarily locked. Please try again later.', 403);
    }

    user.lastActive = new Date();
    if (!user.security) user.security = {};
    user.security.lastLogin = new Date();

    const authToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    user.security.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token: authToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { logger } = require('../config/logger');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const redis = require('../config/redis');

// ============================================================================
// RATE LIMITING
// ============================================================================

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per window
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(async (email) => {
      const exists = await User.findOne({ email });
      if (exists) throw new Error('Email already registered');
      return true;
    }),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character'),
  
  body('referredByCode')
    .optional()
    .trim()
    .custom(async (code) => {
      if (code) {
        const referrer = await User.findOne({ 'referral.code': code });
        if (!referrer) throw new Error('Invalid referral code');
      }
      return true;
    }),
  
  body('acceptTerms')
    .isBoolean().withMessage('Must accept terms')
    .custom(value => value === true).withMessage('You must accept the terms of service'),
];

const validateLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
];

const validatePasswordReset = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const validateNewPassword = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character'),
];

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware with token refresh capability
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user to ensure they still exist and are active
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      if (user.status === 'suspended' || user.status === 'banned') {
        return res.status(403).json({ 
          success: false, 
          error: 'Account has been suspended',
          code: 'ACCOUNT_SUSPENDED'
        });
      }
      
      if (user.status === 'deleted') {
        return res.status(401).json({ 
          success: false, 
          error: 'Account has been deleted',
          code: 'ACCOUNT_DELETED'
        });
      }
      
      // Check token version for invalidation on password change
      if (user.security?.tokenVersion && decoded.version !== user.security.tokenVersion) {
        return res.status(401).json({ 
          success: false, 
          error: 'Token is outdated. Please login again.',
          code: 'TOKEN_OUTDATED'
        });
      }
      
      req.user = {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tokenVersion: user.security?.tokenVersion,
      };
      
      // Track last active
      user.lastActive = new Date();
      await user.save();
      
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        // Try to refresh token
        const refreshToken = req.header('X-Refresh-Token');
        
        if (refreshToken) {
          try {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            const user = await User.findById(decoded.id);
            
            if (user && user.security?.refreshToken === refreshToken) {
              // Generate new tokens
              const newToken = jwt.sign(
                { id: user._id, version: user.security?.tokenVersion || 1 },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
              );
              
              const newRefreshToken = jwt.sign(
                { id: user._id },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
              );
              
              // Update refresh token in database
              user.security.refreshToken = newRefreshToken;
              await user.save();
              
              return res.json({
                success: true,
                token: newToken,
                refreshToken: newRefreshToken,
                message: 'Token refreshed successfully',
              });
            }
          } catch (refreshErr) {
            // Refresh token invalid, continue to error
          }
        }
        
        return res.status(401).json({ 
          success: false, 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// ============================================================================
// GOOGLE AUTHENTICATION
// ============================================================================

/**
 * Google Sign-In
 * POST /api/auth/google
 */
router.post('/google', async (req, res, next) => {
  try {
    const { token, profile } = req.body;

    if (!token || !profile) {
      return next(new AppError('Token and profile required', 400));
    }

    // In a real production app, you should verify the Google token here 
    // using google-auth-library:
    // const {OAuth2Client} = require('google-auth-library');
    // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    // const ticket = await client.verifyIdToken({idToken: token, audience: process.env.GOOGLE_CLIENT_ID});
    // const payload = ticket.getPayload();
    // const googleId = payload['sub'];

    const { email, id: googleId, name, picture } = profile;

    let user = await User.findOne({ 
      $or: [
        { googleId },
        { email }
      ]
    });

    if (user) {
      // Link Google ID if user exists by email but hasn't linked it
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        username: email.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
        email,
        googleId,
        password: crypto.randomBytes(16).toString('hex'), // Placeholder password
        profile: {
          displayName: name,
          avatar: { url: picture },
        },
        status: 'active',
      });
      await user.save();
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user._id, version: user.security?.tokenVersion || 1 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    user.security.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: {
          displayName: user.profile?.displayName,
          avatar: user.avatarUrl,
        },
      },
    });

  } catch (err) {
    logger.error('Google auth error:', err);
    next(err);
  }
});

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', validateRegistration, async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        code: 'VALIDATION_ERROR'
      });
    }

    const { 
      username, 
      email, 
      password, 
      referredByCode,
      firstName,
      lastName,
      acceptTerms,
      preferences = {},
    } = req.body;

    // Generate unique referral code for new user
    const referralCode = generateReferralCode(username);

    // Create user object
    const userData = {
      username,
      email,
      password,
      referral: {
        code: referralCode,
        referredBy: null,
        stats: {
          totalReferrals: 0,
          activeReferrals: 0,
          pointsEarned: 0,
        },
      },
      profile: {
        firstName: firstName || '',
        lastName: lastName || '',
        displayName: firstName ? `${firstName} ${lastName || ''}`.trim() : username,
        privacy: {
          profileVisibility: 'public',
          progressVisibility: 'friends_only',
          showEmail: false,
        },
      },
      preferences: {
        dailyGoal: preferences.dailyGoal || 10,
        weeklyGoal: preferences.weeklyGoal || 60,
        preferredCategories: preferences.preferredCategories || [],
        language: preferences.language || 'en',
        ...preferences,
      },
      analytics: {
        firstVisit: new Date(),
        visitCount: 0,
      },
      status: 'active',
    };

    // Handle referral
    if (referredByCode) {
      const referrer = await User.findOne({ 'referral.code': referredByCode.toUpperCase() });
      
      if (referrer) {
        userData.referral.referredBy = referrer._id;
        
        // Update referrer's stats
        referrer.referral.stats.totalReferrals += 1;
        referrer.referral.referredUsers.push({
          user: null, // Will be updated after user creation
          joinedAt: new Date(),
          status: 'pending',
        });
        
        // Reward referrer with points
        referrer.progress.totalPoints += 500;
        referrer.gamification.points.total += 500;
        referrer.gamification.points.history.push({
          amount: 500,
          reason: 'referral_bonus',
          timestamp: new Date(),
        });
        
        // Check for referral milestones
        if (referrer.referral.stats.totalReferrals === 1) {
          referrer.progress.badges.push({
            name: 'First Referral',
            description: 'Referred your first friend!',
            icon: '🤝',
            tier: 'bronze',
            dateEarned: new Date(),
          });
        }
        
        if (referrer.referral.stats.totalReferrals === 5) {
          referrer.progress.badges.push({
            name: 'Izon Ambassador',
            description: 'Referred 5 friends to learn Izon',
            icon: '📢',
            tier: 'silver',
            dateEarned: new Date(),
          });
          
          // Send notification
          await notificationService.sendBadgeEarned(referrer._id, {
            name: 'Izon Ambassador',
            description: 'Referred 5 friends to learn Izon',
            tier: 'silver',
            icon: '📢',
          });
        }
        
        await referrer.save();
      }
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Update referrer's pending user reference
    if (referredByCode) {
      await User.updateOne(
        { 'referral.code': referredByCode.toUpperCase() },
        { $set: { 'referral.referredUsers.$[elem].user': user._id } },
        { arrayFilters: [{ 'elem.user': null }] }
      );
    }

    // Generate tokens
    const token = jwt.sign(
      { 
        id: user._id,
        version: user.security?.tokenVersion || 1,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
    );

    // Save refresh token
    user.security = user.security || {};
    user.security.refreshToken = refreshToken;
    await user.save();

    // Send welcome email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to Izon Language App!',
        template: 'welcome',
        data: {
          username: user.username,
          referralCode: user.referral.code,
        },
      });
    } catch (emailErr) {
      logger.error('Failed to send welcome email:', emailErr);
    }

    // Send in-app welcome notification
    await notificationService.sendWelcome(user._id);

    // Log registration
    logger.info(`New user registered: ${user.username} (${user._id})`);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to Izon Language App.',
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        referralCode: user.referral.code,
        profile: {
          displayName: user.profile?.displayName,
          avatar: user.avatarUrl,
        },
        progress: {
          level: user.progress?.level || 1,
          points: user.progress?.totalPoints || 0,
          streak: user.progress?.streak?.current || 0,
        },
      },
    });

  } catch (err) {
    logger.error('Registration error:', err);
    next(err);
  }
});

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password, rememberMe } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Use generic message to prevent user enumeration
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.security?.lockedUntil && user.security.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.security.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        error: `Account locked. Try again in ${remainingMinutes} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.security.lockedUntil,
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Track failed login
      user.security = user.security || {};
      user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
      
      // Lock account after 5 failed attempts
      if (user.security.failedLoginAttempts >= 5) {
        user.security.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }
      
      await user.save();

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        attempts: user.security.failedLoginAttempts,
        maxAttempts: 5,
      });
    }

    // Reset failed login attempts on successful login
    user.security.failedLoginAttempts = 0;
    user.security.lockedUntil = null;
    
// 1. Generate tokens
const tokenExpiry = rememberMe ? '30d' : '7d';
const token = jwt.sign(
  { id: user._id, version: user.security?.tokenVersion || 1 },
  process.env.JWT_SECRET,
  { expiresIn: tokenExpiry }
);

const refreshToken = jwt.sign(
  { id: user._id },
  process.env.REFRESH_TOKEN_SECRET,
  { expiresIn: '30d' }
);

// 2. Update the User Object (Document Instance)
user.security = user.security || {};
user.security.refreshToken = refreshToken; // Now works because it's in the Schema!
user.markModified('security'); // Force Mongoose to see the nested change

// 3. Track Login History & Analytics
user.security.loginHistory = user.security.loginHistory || [];
user.security.loginHistory.push({
  timestamp: new Date(),
  ip: req.ip,
  device: req.headers['user-agent'],
  successful: true,
});

if (user.security.loginHistory.length > 20) {
  user.security.loginHistory = user.security.loginHistory.slice(-20);
}

user.lastActive = new Date();
user.analytics.lastVisit = new Date();
user.analytics.visitCount = (user.analytics.visitCount || 0) + 1;

// 4. Check achievements BEFORE saving
await checkLoginAchievements(user);

// 5. Save everything in ONE single database hit
await user.save();

logger.info(`User logged in: ${user.username} (${user._id})`);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        referralCode: user.referral?.code,
        role: user.role,
        profile: {
          displayName: user.profile?.displayName,
          avatar: user.avatarUrl,
          bio: user.profile?.bio,
        },
        progress: {
          level: user.progress?.level || 1,
          points: user.progress?.totalPoints || 0,
          streak: user.progress?.streak?.current || 0,
          longestStreak: user.progress?.streak?.longest || 0,
          nextLevelExp: user.gamification?.nextLevelExp || 100,
        },
        preferences: user.preferences,
        createdAt: user.createdAt,
      },
    });

  } catch (err) {
    logger.error('Login error:', err);
    next(err);
  }
});

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Logout user
 * POST /api/auth/logout
 */

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    
    // Blacklist the token using v4 syntax
    // EX: expiration in seconds
    await redis.set(`blacklist:${token}`, 'true', {
      EX: 7 * 24 * 60 * 60 // 7 days
    });

    // Clear refresh token
    const user = await User.findById(req.user.id);
    if (user) {
      user.security.refreshToken = null;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    logger.error('Logout error:', err);
    next(err);
  }
});


// ============================================================================
// REFRESH TOKEN
// ============================================================================

/**
 * Refresh access token
 * POST /api/auth/refresh-token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token required', 400));
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Use the explicit path to the hidden field
    const user = await User.findById(decoded.id).select('+security.refreshToken +security.tokenVersion');

    if (!user || user.security?.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Generate new Access Token
    const token = jwt.sign(
      { id: user._id, version: user.security?.tokenVersion || 1 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Optional: Rotate the Refresh Token (security best practice)
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    user.security.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      token,
      refreshToken: newRefreshToken,
    });

  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token expired or invalid' });
  }
});

// ============================================================================
// FORGOT PASSWORD
// ============================================================================

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', validatePasswordReset, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, you will receive password reset instructions.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save reset token
    user.security.resetPasswordToken = hashedToken;
    user.security.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send reset email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - Izon Language App',
        template: 'password-reset',
        data: {
          username: user.username,
          resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
          expiresIn: '1 hour',
        },
      });
    } catch (emailErr) {
      logger.error('Failed to send password reset email:', emailErr);
    }

    res.json({
      success: true,
      message: 'If an account exists with that email, you will receive password reset instructions.',
    });

  } catch (err) {
    logger.error('Forgot password error:', err);
    next(err);
  }
});

// ============================================================================
// RESET PASSWORD
// ============================================================================

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', validateNewPassword, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { token, password } = req.body;

    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      'security.resetPasswordToken': hashedToken,
      'security.resetPasswordExpires': { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    // Update password
    user.password = password;
    user.security.resetPasswordToken = null;
    user.security.resetPasswordExpires = null;
    
    // Increment token version to invalidate all existing tokens
    user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
    
    await user.save();

    // Send confirmation email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Changed - Izon Language App',
        template: 'password-changed',
        data: {
          username: user.username,
        },
      });
    } catch (emailErr) {
      logger.error('Failed to send password changed email:', emailErr);
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });

  } catch (err) {
    logger.error('Reset password error:', err);
    next(err);
  }
});

// ============================================================================
// CHANGE PASSWORD (Authenticated)
// ============================================================================

/**
 * Change password (requires authentication)
 * POST /api/auth/change-password
 */
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('New password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('New password must contain at least one special character'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Update password
    user.password = newPassword;
    
    // Increment token version to invalidate all existing tokens
    user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
    
    await user.save();

    // Send notification
    await notificationService.sendSecurityAlert(user._id, {
      type: 'password_changed',
      message: 'Your password was changed successfully. If you did not make this change, please contact support immediately.',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: 'Password changed successfully. You will need to login again on all devices.',
    });

  } catch (err) {
    logger.error('Change password error:', err);
    next(err);
  }
});

// ============================================================================
// GENERATE API KEY (Authenticated)
// ============================================================================

/**
 * Generate API key for a user
 * POST /api/auth/generate-api-key
 */
router.post('/generate-api-key', authMiddleware, async (req, res, next) => {
  try {
   
    // FIX: Provide a fallback if req.body or req.body.name is missing
    const name = req.body && req.body.name ? req.body.name : 'Default';


    const user = await User.findById(req.user.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Generate API key
    const apiKey = 'izon_' + crypto.randomBytes(24).toString('hex');
    
    // Hash the API key for storage (don't store raw keys)
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    // Store hashed key with metadata
    user.security.apiKeys = user.security.apiKeys || [];
    user.security.apiKeys.push({
      key: hashedKey,
      name,
      permissions: ['read'],
      lastUsed: null,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      createdAt: new Date(),
    });

    await user.save();

    logger.info(`API key generated for user: ${user.username}`);

    res.json({
      success: true,
      apiKey, // Only shown once!
      message: 'API key generated successfully. Store it securely – it won’t be shown again.',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

  } catch (err) {
    logger.error('API key generation error:', err);
    next(err);
  }
});

// ============================================================================
// REVOKE API KEY (Authenticated)
// ============================================================================

/**
 * Revoke an API key
 * POST /api/auth/revoke-api-key
 */
router.post('/revoke-api-key', authMiddleware, async (req, res, next) => {
  try {
    const { keyId } = req.body;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: 'Key ID is required',
        code: 'KEY_ID_REQUIRED'
      });
    }

    const user = await User.findById(req.user.id);

    // Remove the key
    user.security.apiKeys = user.security.apiKeys.filter(
      key => key._id.toString() !== keyId
    );

    await user.save();

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });

  } catch (err) {
    logger.error('Revoke API key error:', err);
    next(err);
  }
});

// ============================================================================
// VERIFY EMAIL
// ============================================================================

/**
 * Send email verification
 * POST /api/auth/send-verification
 */
router.post('/send-verification', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.security.emailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    user.security.emailVerificationToken = hashedToken;
    user.security.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - Izon Language App',
        template: 'verify-email',
        data: {
          username: user.username,
          verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
          expiresIn: '24 hours',
        },
      });
    } catch (emailErr) {
      logger.error('Failed to send verification email:', emailErr);
    }

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });

  } catch (err) {
    logger.error('Send verification error:', err);
    next(err);
  }
});

/**
 * Verify email with token
 * POST /api/auth/verify-email
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      'security.emailVerificationToken': hashedToken,
      'security.emailVerificationExpires': { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    user.security.emailVerified = true;
    user.security.emailVerifiedAt = new Date();
    user.security.emailVerificationToken = null;
    user.security.emailVerificationExpires = null;
    await user.save();

    // Award verification badge
    user.progress.badges.push({
      name: 'Verified Member',
      description: 'Verified email address',
      icon: '✅',
      tier: 'bronze',
      dateEarned: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully!',
    });

  } catch (err) {
    logger.error('Verify email error:', err);
    next(err);
  }
});

// ============================================================================
// GET PROFILE (Authenticated)
// ============================================================================

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -security.refreshToken -security.apiKeys.key -security.twoFactorSecret');

    res.json({
      success: true,
      data: user,
    });

  } catch (err) {
    logger.error('Get profile error:', err);
    next(err);
  }
});

// ============================================================================
// UPDATE PROFILE (Authenticated)
// ============================================================================

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authMiddleware, [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email').optional().trim().isEmail().withMessage('Please provide a valid email'),
  body('profile.firstName').optional().trim(),
  body('profile.lastName').optional().trim(),
  body('profile.bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const updates = req.body;
    const user = await User.findById(req.user.id);

    // Handle email change (requires verification)
    if (updates.email && updates.email !== user.email) {
      // Check if email already exists
      const existingUser = await User.findOne({ email: updates.email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use',
          code: 'EMAIL_EXISTS'
        });
      }

      // Set new email as unverified
      user.email = updates.email;
      user.security.emailVerified = false;
      
      // Send verification email
      // ... (verification logic)
    }

    // Update username if changed
    if (updates.username && updates.username !== user.username) {
      const existingUser = await User.findOne({ username: updates.username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken',
          code: 'USERNAME_EXISTS'
        });
      }
      user.username = updates.username;
    }

    // Update profile fields
    if (updates.profile) {
      user.profile = {
        ...user.profile,
        ...updates.profile,
      };
    }

    // Update preferences
    if (updates.preferences) {
      user.preferences = {
        ...user.preferences,
        ...updates.preferences,
      };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        username: user.username,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
      },
    });

  } catch (err) {
    logger.error('Update profile error:', err);
    next(err);
  }
});

// ============================================================================
// DELETE ACCOUNT (Authenticated)
// ============================================================================

/**
 * Delete user account
 * DELETE /api/auth/account
 */
router.delete('/account', authMiddleware, async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password required to delete account',
        code: 'PASSWORD_REQUIRED'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Soft delete - mark as deleted
    user.status = 'deleted';
    user.username = `deleted_${user._id}`;
    user.email = `deleted_${user._id}@deleted.com`;
    user.deletedAt = new Date();
    
    await user.save();

    // Blacklist current token
    const token = req.header('Authorization').replace('Bearer ', '');
    await redis.set(`blacklist:${token}`, 'true', {
       EX: 30 * 24 * 60 * 60 // 30 days
    });

    logger.info(`User account deleted: ${user._id}`);

    res.json({
      success: true,
      message: 'Account deleted successfully. We\'re sorry to see you go.',
    });

  } catch (err) {
    logger.error('Delete account error:', err);
    next(err);
  }
});

/**
 * Validate a referral code (Public)
 * GET /api/auth/verify-referral/:code
 */
router.get('/verify-referral/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const referrer = await User.findOne({ 'referral.code': code.toUpperCase() })
      .select('username profile.displayName profile.avatar');

    if (!referrer) {
      return next(new AppError('Invalid referral code', 404));
    }

    res.json({
      success: true,
      referrer: {
        username: referrer.username,
        displayName: referrer.profile?.displayName,
        avatar: referrer.profile?.avatar
      }
    });
  } catch (err) {
    next(new AppError('Server error', 500));
  }
});


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
 * Check and award login-related achievements
 */
async function checkLoginAchievements(user) {
  const achievements = [];

  // First login of the day
  const today = new Date().toDateString();
  const lastLogin = user.lastActive ? new Date(user.lastActive).toDateString() : null;

  if (lastLogin !== today) {
    // New day login
    user.progress.streak.current += 1;
    
    if (user.progress.streak.current > user.progress.streak.longest) {
      user.progress.streak.longest = user.progress.streak.current;
    }

    // Check streak milestones
    if (user.progress.streak.current === 7) {
      achievements.push({
        name: 'Week Warrior',
        description: '7-day learning streak!',
        icon: '🔥',
        tier: 'silver',
      });
    }

    if (user.progress.streak.current === 30) {
      achievements.push({
        name: 'Monthly Master',
        description: '30-day learning streak!',
        icon: '🌙',
        tier: 'gold',
      });
    }

    if (user.progress.streak.current === 100) {
      achievements.push({
        name: 'Century Club',
        description: '100-day learning streak!',
        icon: '💯',
        tier: 'platinum',
      });
    }
  }

  // Add achievements to user
  achievements.forEach(achievement => {
    user.progress.badges.push({
      ...achievement,
      dateEarned: new Date(),
    });
  });
  
  // Send notifications for new achievements
  for (const achievement of achievements) {
    await notificationService.sendBadgeEarned(user._id, achievement);
  }
}

module.exports = router;

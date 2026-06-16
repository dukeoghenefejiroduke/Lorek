const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, param, validationResult } = require('express-validator');
const { socialLimiter } = require('../middleware/rateLimit');

const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const redis = require('../config/redis');

// ============================================================================
// RATE LIMITING
// ============================================================================

router.use(socialLimiter);
router.use(auth);

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validateNotificationId = [
  param('id').custom(value => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid notification ID format');
    }
    return true;
  }),
];

// ============================================================================
// GET ALL NOTIFICATIONS
// ============================================================================

/**
 * Get user's notifications with pagination and filtering
 * GET /api/notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type,
      category,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { 
      user: req.user._id,
      $or: [
        { language_id: req.languageId },
        { language_id: { $exists: false } },
        { language_id: null }
      ]
    };

    if (unreadOnly === 'true') {
      query.read = false;
    }
    if (type) {
      query.type = type;
    }
    if (category) {
      query['metadata.category'] = category;
    }

    // Don't show expired notifications
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ];

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1, priority: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
    ]);

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// MARK NOTIFICATION AS READ
// ============================================================================

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', validateNotificationId, async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    // Update user's unread count in Redis cache
    await redis.set(`user:${req.user._id}:unread_count`);

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================================

/**
 * Mark all user notifications as read
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    // Reset unread count in Redis
    await redis.set(`user:${req.user._id}:unread_count`, 0);

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
      },
      message: `Marked ${result.modifiedCount} notifications as read`,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE NOTIFICATION
// ============================================================================

/**
 * Delete a single notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', validateNotificationId, async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    // Update unread count if it was unread
    if (!notification.read) {
      await redis.decr(`user:${req.user._id}:unread_count`);
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE ALL NOTIFICATIONS
// ============================================================================

/**
 * Delete all user notifications
 * DELETE /api/notifications
 */
router.delete('/', async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({ user: req.user._id });

    // Reset unread count
    await redis.set(`user:${req.user._id}:unread_count`, 0);

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
      },
      message: `Deleted ${result.deletedCount} notifications`,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET NOTIFICATION SETTINGS
// ============================================================================

/**
 * Get user's notification preferences
 * GET /api/notifications/settings
 */
router.get('/settings', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');

    const settings = user?.notifications || {
      channels: {
        push: true,
        email: true,
        sms: false,
        inApp: true,
      },
      types: {
        lessonReminders: true,
        streakAlerts: true,
        achievements: true,
        friendActivity: true,
        newContent: true,
        tipsAndTricks: true,
        newsletter: false,
        marketing: false,
        security: true,
        system: true,
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
      emailFrequency: 'instant',
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// UPDATE NOTIFICATION SETTINGS
// ============================================================================

/**
 * Update user's notification preferences
 * PUT /api/notifications/settings
 */
router.put('/settings', [
  body('channels').optional().isObject(),
  body('types').optional().isObject(),
  body('quietHours').optional().isObject(),
  body('emailFrequency').optional().isIn(['instant', 'daily', 'weekly', 'never']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { channels, types, quietHours, emailFrequency } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Initialize notifications object if not exists
    if (!user.notifications) {
      user.notifications = {};
    }

    // Update settings
    if (channels) {
      user.notifications.channels = {
        ...user.notifications.channels,
        ...channels,
      };
    }

    if (types) {
      user.notifications.types = {
        ...user.notifications.types,
        ...types,
      };
    }

    if (quietHours) {
      user.notifications.quietHours = {
        ...user.notifications.quietHours,
        ...quietHours,
      };
    }

    if (emailFrequency) {
      user.notifications.emailFrequency = emailFrequency;
    }

    await user.save();

    res.json({
      success: true,
      data: user.notifications,
      message: 'Notification settings updated',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// REGISTER PUSH TOKEN
// ============================================================================

/**
 * Register device push token for notifications
 * POST /api/notifications/register-token
 */
router.post('/register-token', [
  body('token').notEmpty().withMessage('Push token is required'),
  body('platform').optional().isIn(['ios', 'android', 'web']),
  body('deviceId').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { token, platform, deviceId } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Initialize notifications if not exists
    if (!user.notifications) {
      user.notifications = {};
    }
    if (!user.notifications.pushTokens) {
      user.notifications.pushTokens = [];
    }

    // Check if token already exists
    const existingIndex = user.notifications.pushTokens.findIndex(
      t => t.token === token
    );

    if (existingIndex >= 0) {
      // Update existing token
      user.notifications.pushTokens[existingIndex].lastUsed = new Date();
      if (platform) user.notifications.pushTokens[existingIndex].platform = platform;
      if (deviceId) user.notifications.pushTokens[existingIndex].deviceId = deviceId;
    } else {
      // Add new token
      user.notifications.pushTokens.push({
        token,
        platform: platform || Platform.OS,
        deviceId: deviceId || null,
        lastUsed: new Date(),
        createdAt: new Date(),
      });
    }

    // Limit to 5 tokens per user
    if (user.notifications.pushTokens.length > 5) {
      user.notifications.pushTokens = user.notifications.pushTokens.slice(-5);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// UNREGISTER PUSH TOKEN
// ============================================================================

/**
 * Remove push token
 * DELETE /api/notifications/register-token
 */
router.delete('/register-token', [
  body('token').notEmpty().withMessage('Push token is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { token } = req.body;

    const user = await User.findById(req.user._id);

    if (user && user.notifications?.pushTokens) {
      user.notifications.pushTokens = user.notifications.pushTokens.filter(
        t => t.token !== token
      );
      await user.save();
    }

    res.json({
      success: true,
      message: 'Push token unregistered successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
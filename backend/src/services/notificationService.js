const nodemailer = require('nodemailer');
const twilio = require('twilio');
const webpush = require('web-push');
const Expo = require('expo-server-sdk').default;
const { logger } = require('../config/logger');
const User = require('../models/User');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize Expo SDK for push notifications
const expo = new Expo();

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Configure SMS client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Configure web push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

const NOTIFICATION_TYPES = {
  // Learning
  LESSON_REMINDER: 'lesson_reminder',
  PRACTICE_REMINDER: 'practice_reminder',
  STREAK_ALERT: 'streak_alert',
  STREAK_SAVED: 'streak_saved',
  NEW_LESSON: 'new_lesson',
  LESSON_COMPLETED: 'lesson_completed',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  BADGE_EARNED: 'badge_earned',
  MILESTONE_REACHED: 'milestone_reached',
  
  // Social
  FRIEND_REQUEST: 'friend_request',
  FRIEND_ACCEPTED: 'friend_accepted',
  FRIEND_ACTIVITY: 'friend_activity',
  GROUP_INVITE: 'group_invite',
  MESSAGE_RECEIVED: 'message_received',
  
  // Gamification
  LEADERBOARD_UPDATE: 'leaderboard_update',
  CHALLENGE_STARTED: 'challenge_started',
  CHALLENGE_COMPLETED: 'challenge_completed',
  REWARD_CLAIMED: 'reward_claimed',
  
  // System
  WELCOME: 'welcome',
  ACCOUNT_VERIFIED: 'account_verified',
  PASSWORD_CHANGED: 'password_changed',
  SECURITY_ALERT: 'security_alert',
  MAINTENANCE: 'maintenance',
  UPDATE_AVAILABLE: 'update_available',
  
  // Promotional
  FEATURE_ANNOUNCEMENT: 'feature_announcement',
  TIP_OF_DAY: 'tip_of_day',
  SPECIAL_OFFER: 'special_offer',
  EVENT_REMINDER: 'event_reminder',
};

// ============================================================================
// NOTIFICATION PRIORITIES
// ============================================================================

const PRIORITIES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// ============================================================================
// NOTIFICATION SERVICE CLASS
// ============================================================================

class NotificationService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.stats = {
      sent: 0,
      failed: 0,
      byType: {},
    };
  }

  /**
   * Send notification to user
   */
  async sendToUser(userId, notification, options = {}) {
    try {
      
   // Safety check: if userId is an object containing userId, extract it
    const actualId = (typeof userId === 'object' && userId.userId) ? userId.userId : userId;
    
      const user = await User.findById(actualId)
        .select('notifications email phone profile pushTokens');
      
      if (!user) {
        throw new Error(`User ${actualId} not found`);
      }
      
      const { channels = ['in_app'], priority = PRIORITIES.MEDIUM } = options;
      
      const results = [];
      let savedNotification = null;
      
      // Always save in-app notification first
      if (channels.includes('in_app') || channels.length === 0) {
        savedNotification = await this.saveInAppNotification(user, notification, priority);
        results.push({
          channel: 'in_app',
          success: true,
          notificationId: savedNotification._id,
        });
      }
      
      // Send to other channels based on user preferences
      for (const channel of channels.filter(c => c !== 'in_app')) {
        if (!this.shouldSendToChannel(user, channel, notification.type)) {
          results.push({
            channel,
            success: false,
            error: 'User preferences disabled this channel',
          });
          continue;
        }
        
        let result;
        switch (channel) {
          case 'push':
            result = await this.sendPush(user, notification, savedNotification);
            break;
          case 'email':
            result = await this.sendEmail(user, notification);
            break;
          case 'sms':
            result = await this.sendSMS(user, notification);
            break;
        }
        
        results.push({
          channel,
          ...result,
        });
        
        // Update notification with external IDs
        if (savedNotification && result.success && result.externalId) {
          savedNotification.externalIds = savedNotification.externalIds || {};
          savedNotification.externalIds[channel] = result.externalId;
          await savedNotification.save();
        }
      }
      
      // Update stats
      this.stats.sent += results.filter(r => r.success).length;
      this.stats.failed += results.filter(r => !r.success).length;
      this.stats.byType[notification.type] = (this.stats.byType[notification.type] || 0) + 1;
      
      return {
        success: true,
        results,
        notification: savedNotification,
      };
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }


  /**
   * Alias for sendToUser to match route usage
   */
  async sendNotification(userId, notification, options = {}) {
    return this.sendToUser(userId, notification, options);
  }
  

  /**
   * Send notification to multiple users
   */
  async sendToMany(userIds, notification, options = {}) {
    const results = [];
    
    for (const userId of userIds) {
      results.push({
        userId,
        result: await this.sendToUser(userId, notification, options),
      });
    }
    
    return {
      success: true,
      total: userIds.length,
      successful: results.filter(r => r.result.success).length,
      failed: results.filter(r => !r.result.success).length,
      results,
    };
  }

  /**
   * Save in-app notification to database
   */
  
  async saveInAppNotification(user, notification, priority) {
    const NotificationModel = mongoose.model('Notification');

    const inAppNotification = new NotificationModel({
      user: user._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority,
      actionUrl: notification.actionUrl,
      image: notification.image,
      expiresAt: notification.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: {
        source: notification.source || 'system',
        category: notification.category,
      },
      read: false,
    });

    await inAppNotification.save();

    // FerretDB Compatibility Fix: 
    // Use simple updates instead of complex findOneAndUpdate with options
    await User.updateOne(
      { _id: user._id },
      { 
        $inc: { 'notifications.unreadCount': 1 },
        $push: {
          'notifications.recent': {
            $each: [{
              notificationId: inAppNotification._id,
              sentAt: new Date(),
            }],
            $slice: -20 // Keeps the list at 20 items
          }
        }
      }
    );

    return inAppNotification;
  }

  /**
   * Send push notification
   */
  async sendPush(user, notification, savedNotification) {
    if (!user.notifications?.pushTokens || user.notifications.pushTokens.length === 0) {
      return { success: false, error: 'No push tokens' };
    }
    
    try {
      const messages = [];
      
      for (const tokenInfo of user.notifications.pushTokens) {
        if (!Expo.isExpoPushToken(tokenInfo.token)) {
          logger.warn(`Invalid Expo push token: ${tokenInfo.token}`);
          continue;
        }
        
        messages.push({
          to: tokenInfo.token,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: {
            type: notification.type,
            notificationId: savedNotification?._id.toString(),
            actionUrl: notification.actionUrl,
            ...notification.data,
          },
          badge: user.notifications.unreadCount,
          priority: notification.priority === PRIORITIES.HIGH ? 'high' : 'normal',
          channelId: 'default',
        });
      }
      
      if (messages.length === 0) {
        return { success: false, error: 'No valid push tokens' };
      }
      
      const chunks = expo.chunkPushNotifications(messages);
      const receipts = [];
      
      for (const chunk of chunks) {
        try {
          const receiptChunk = await expo.sendPushNotificationsAsync(chunk);
          receipts.push(...receiptChunk);
        } catch (error) {
          logger.error('Error sending push chunk:', error);
        }
      }
      
      // Handle invalid tokens
      const invalidTokens = [];
      for (let i = 0; i < receipts.length; i++) {
        if (receipts[i].status === 'error') {
          if (receipts[i].details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(messages[i].to);
          }
        }
      }
      
      if (invalidTokens.length > 0) {
        user.notifications.pushTokens = user.notifications.pushTokens.filter(
          t => !invalidTokens.includes(t.token)
        );
        await user.save();
      }
      
      return {
        success: true,
        sent: messages.length,
        receipts,
        externalId: receipts[0]?.id,
      };
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(user, notification) {
    if (!user.email) {
      return { success: false, error: 'No email address' };
    }
    
    try {
      const mailOptions = {
        from: `"Izon Language App" <${process.env.EMAIL_FROM}>`,
        to: user.email,
        subject: notification.title,
        html: this.buildEmailTemplate(notification),
        text: notification.body,
      };
      
      if (notification.attachments) {
        mailOptions.attachments = notification.attachments;
      }
      
      const info = await emailTransporter.sendMail(mailOptions);
      
      return {
        success: true,
        externalId: info.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(user, notification) {
    if (!twilioClient) {
      return { success: false, error: 'SMS not configured' };
    }
    
    if (!user.phone) {
      return { success: false, error: 'No phone number' };
    }
    
    try {
      const message = await twilioClient.messages.create({
        body: `${notification.title}: ${notification.body}`,
        to: user.phone,
        from: process.env.TWILIO_PHONE_NUMBER,
      });
      
      return {
        success: true,
        externalId: message.sid,
      };
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome notification to new user
   */
  async sendWelcome(userId) {
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.WELCOME,
      title: 'Welcome to Izon Language App! 🎉',
      body: 'Start your journey to learn Izon today. Complete your first lesson to earn your first badge!',
      data: {
        action: 'start_lesson',
        lessonId: 'first_lesson',
      },
      priority: PRIORITIES.HIGH,
      actionUrl: '/lessons/first',
      image: 'https://your-app.com/images/welcome.png',
      category: 'onboarding',
    }, {
      channels: ['in_app', 'push', 'email'],
    });
  }

  /**
   * Send streak alert
   */
  async sendStreakAlert(userId, streak) {
    const user = await User.findById(userId);
    
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.STREAK_ALERT,
      title: '🔥 Don\'t Break Your Streak!',
      body: `You have a ${streak}-day streak! Practice today to keep it going.`,
      data: {
        streak,
        action: 'practice',
      },
      priority: PRIORITIES.HIGH,
      actionUrl: '/practice',
      category: 'streak',
    }, {
      channels: user.notifications?.channels?.streakAlerts || ['in_app', 'push'],
    });
  }

  /**
   * Send achievement unlocked notification
   */
  async sendAchievementUnlocked(userId, achievement) {
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
      title: `🏆 Achievement Unlocked: ${achievement.name}`,
      body: achievement.description,
      data: {
        achievementId: achievement._id,
        achievement,
      },
      priority: PRIORITIES.HIGH,
      actionUrl: `/achievements/${achievement._id}`,
      image: achievement.badgeImage,
      category: 'achievement',
    }, {
      channels: ['in_app', 'push', 'email'],
    });
  }

  /**
   * Send badge earned notification
   */
  async sendBadgeEarned(userId, badge) {
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.BADGE_EARNED,
      title: `🎖️ New Badge: ${badge.name}`,
      body: `You've earned the ${badge.tier} ${badge.name} badge!`,
      data: {
        badgeId: badge._id,
        badge,
      },
      priority: PRIORITIES.HIGH,
      actionUrl: `/badges/${badge._id}`,
      image: badge.image?.url,
      category: 'badge',
    });
  }

  /**
   * Send lesson reminder
   */
  async sendLessonReminder(userId, lesson) {
    const user = await User.findById(userId);
    
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.LESSON_REMINDER,
      title: '📚 Continue Your Lesson',
      body: `Your next lesson "${lesson.title}" is waiting for you.`,
      data: {
        lessonId: lesson._id,
        lesson,
      },
      priority: PRIORITIES.MEDIUM,
      actionUrl: `/lessons/${lesson._id}`,
      category: 'learning',
    }, {
      channels: user.notifications?.channels?.lessonReminders || ['in_app', 'push'],
    });
  }

  /**
   * Send friend request notification
   */
  async sendFriendRequest(userId, fromUser) {
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.FRIEND_REQUEST,
      title: '👥 New Friend Request',
      body: `${fromUser.username} wants to be your friend!`,
      data: {
        fromUserId: fromUser._id,
        fromUsername: fromUser.username,
      },
      priority: PRIORITIES.MEDIUM,
      actionUrl: '/friends/requests',
      image: fromUser.profile?.avatar?.url,
      category: 'social',
    });
  }

  /**
   * Send leaderboard update
   */
  async sendLeaderboardUpdate(userId, rank, category) {
    const user = await User.findById(userId);
    
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.LEADERBOARD_UPDATE,
      title: '📊 Leaderboard Update',
      body: `You're now ranked #${rank} in ${category}!`,
      data: {
        rank,
        category,
      },
      priority: PRIORITIES.MEDIUM,
      actionUrl: '/leaderboard',
      category: 'gamification',
    }, {
      channels: user.notifications?.channels?.leaderboardUpdates || ['in_app', 'push'],
    });
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(userId, alert) {
    const user = await User.findById(userId);
    
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.SECURITY_ALERT,
      title: '🔒 Security Alert',
      body: alert.message,
      data: alert,
      priority: PRIORITIES.CRITICAL,
      actionUrl: '/settings/security',
      category: 'security',
    }, {
      channels: ['in_app', 'push', 'email', 'sms'].filter(c => 
        user.notifications?.channels?.securityAlerts?.includes(c) ?? true
      ),
    });
  }

  /**
   * Send daily tip
   */
  async sendDailyTip(userId, tip) {
    const user = await User.findById(userId);
    
    return this.sendToUser(userId, {
      type: NOTIFICATION_TYPES.TIP_OF_DAY,
      title: '💡 Tip of the Day',
      body: tip,
      priority: PRIORITIES.LOW,
      category: 'tips',
    }, {
      channels: user.notifications?.channels?.dailyTips || ['in_app'],
    });
  }

  /**
   * Send maintenance notification
   */
  async sendMaintenanceNotification(maintenanceInfo) {
    const users = await User.find({
      'notifications.channels.system': { $ne: false },
    }).select('_id notifications');
    
    return this.sendToMany(users.map(u => u._id), {
      type: NOTIFICATION_TYPES.MAINTENANCE,
      title: '🛠️ Scheduled Maintenance',
      body: `The app will be under maintenance on ${maintenanceInfo.date} from ${maintenanceInfo.startTime} to ${maintenanceInfo.endTime}.`,
      data: maintenanceInfo,
      priority: PRIORITIES.HIGH,
      actionUrl: '/maintenance',
      category: 'system',
    }, {
      channels: ['in_app', 'push', 'email'],
    });
  }

  /**
   * Check if notification should be sent to channel based on user preferences
   */
  shouldSendToChannel(user, channel, type) {
    const preferences = user.notifications;
    
    if (!preferences) return true;
    
    // Check global channel preferences
    if (preferences.channels) {
      // Map notification types to channel categories
      const typeToChannelMap = {
        [NOTIFICATION_TYPES.LESSON_REMINDER]: 'lessonReminders',
        [NOTIFICATION_TYPES.STREAK_ALERT]: 'streakAlerts',
        [NOTIFICATION_TYPES.LEADERBOARD_UPDATE]: 'leaderboardUpdates',
        [NOTIFICATION_TYPES.TIP_OF_DAY]: 'dailyTips',
        [NOTIFICATION_TYPES.SECURITY_ALERT]: 'securityAlerts',
        [NOTIFICATION_TYPES.MAINTENANCE]: 'system',
      };
      
      const channelKey = typeToChannelMap[type];
      if (channelKey && preferences.channels[channelKey] === false) {
        return false;
      }
    }
    
    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;
      
      const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number);
      const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;
      
      if (currentTime >= startTime && currentTime <= endTime) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Build email HTML template
   */
  buildEmailTemplate(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #fff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #1a4c2e 0%, #2e7d32 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #FFD700;
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 30px;
          }
          .notification-title {
            font-size: 20px;
            font-weight: bold;
            color: #1a4c2e;
            margin-bottom: 15px;
          }
          .notification-body {
            font-size: 16px;
            color: #555;
            margin-bottom: 25px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            color: #fff;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
          }
          @media only screen and (max-width: 600px) {
            .container {
              margin: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Izon Language App</h1>
          </div>
          <div class="content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-body">${notification.body}</div>
            ${notification.actionUrl ? `
              <a href="${process.env.APP_URL}${notification.actionUrl}" class="button">
                View Details
              </a>
            ` : ''}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Izon Language App. All rights reserved.</p>
            <p>
              <a href="${process.env.APP_URL}/settings/notifications">Notification Settings</a> |
              <a href="${process.env.APP_URL}/unsubscribe">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Queue notification for later sending
   */
  async queueNotification(userId, notification, options = {}, sendAt = null) {
    this.queue.push({
      userId,
      notification,
      options,
      sendAt: sendAt || new Date(),
      queuedAt: new Date(),
    });
    
    if (!this.processing) {
      this.processQueue();
    }
    
    return {
      success: true,
      queuedAt: new Date(),
      position: this.queue.length,
    };
  }

  /**
   * Process notification queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    const now = new Date();
    const toSend = this.queue.filter(item => item.sendAt <= now);
    
    this.queue = this.queue.filter(item => item.sendAt > now);
    
    for (const item of toSend) {
      try {
        await this.sendToUser(item.userId, item.notification, item.options);
      } catch (error) {
        logger.error('Failed to send queued notification:', error);
      }
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
    
    // Schedule next processing
    if (this.queue.length > 0) {
      const nextSend = Math.min(...this.queue.map(i => i.sendAt.getTime()));
      const delay = Math.max(0, nextSend - Date.now());
      
      setTimeout(() => this.processQueue(), delay);
    }
  }


  /**
   * Mark notification as read
   */
  async markAsRead(userId, notificationId) {
    const NotificationModel = mongoose.model('Notification');

    // FerretDB Compatibility Fix:
    // Split find and update to avoid findAndModify projection issues
    const notification = await NotificationModel.findOne({ 
      _id: notificationId, 
      user: userId 
    });

    if (notification && !notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();

      await User.updateOne(
        { _id: userId },
        { $inc: { 'notifications.unreadCount': -1 } }
      );
    }

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const NotificationModel = mongoose.model('Notification');

    const result = await NotificationModel.updateMany(
      { user: userId, read: false },
      { read: true, readAt: new Date() }
    );

    if (result.modifiedCount > 0) {
      await User.findByIdAndUpdate(
        userId,
        { $set: { 'notifications.unreadCount': 0 } },
        { new: true }
      );
    }

    return result;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      unreadOnly = false,
      type = null,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = options;
    
    const query = { user: userId };
    
    if (unreadOnly) {
      query.read = false;
    }
    
    if (type) {
      query.type = type;
    }
    
    const sort = {};
    sort[sortBy] = sortOrder;
    
    const Notification = mongoose.model('Notification');
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, read: false }),
    ]);
    
    return {
      notifications,
      total,
      unreadCount,
      limit,
      skip,
    };
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId, notificationId) {
    const NotificationModel = mongoose.model('Notification');

    const notification = await NotificationModel.findOneAndDelete({
      _id: notificationId,
      user: userId,
    });

    if (notification && !notification.read) {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { 'notifications.unreadCount': -1 } },
        { new: true }
      );
    }

    return notification;
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(userId) {
    const Notification = mongoose.model('Notification');
    
    const result = await Notification.deleteMany({ user: userId });
    
    // Reset unread count
    await User.findByIdAndUpdate(userId, {
      $set: { 'notifications.unreadCount': 0 },
    });
    
    return result;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      sent: 0,
      failed: 0,
      byType: {},
    };
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();

// Add this to bind the main methods specifically
notificationService.sendNotification = notificationService.sendNotification.bind(notificationService);
notificationService.sendToUser = notificationService.sendToUser.bind(notificationService);

module.exports = notificationService;
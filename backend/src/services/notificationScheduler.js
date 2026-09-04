const cron = require('node-cron');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { logger } = require('../config/logger');

const scheduleNotificationTasks = () => {
    // 🔥 Daily Streak/Goal Reminder: Triggered daily at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
        logger.info('⏰ Scheduled Task: Triggering Daily Reminders...');
        try {
            const users = await User.find({ 
                'progress.notificationPreferences.types.streakAlerts': true,
                'progress.streak.current': { $gt: 0 }
            });

            for (const user of users) {
                const streak = user.progress.streak.current;
                await notificationService.sendNotification(user._id, {
                    type: 'streak',
                    title: '🔥 Keep your streak alive!',
                    body: `Your ${streak}-day streak is waiting! Come learn some Izon.`
                });
            }
        } catch (err) {
            logger.error('❌ Streak Reminder Error:', err);
        }
    }, { scheduled: true, timezone: "Africa/Lagos" });

    // 📚 Lesson Reminder: Triggered daily at 6:00 PM
    cron.schedule('0 18 * * *', async () => {
        logger.info('⏰ Scheduled Task: Triggering Lesson Reminders...');
        try {
            const users = await User.find({ 
                'progress.notificationPreferences.types.lessonReminders': true
            });

            for (const user of users) {
                await notificationService.sendNotification(user._id, {
                    type: 'lesson',
                    title: '📚 Time to learn!',
                    body: 'Continue your Izon lesson and master new words.'
                });
            }
        } catch (err) {
            logger.error('❌ Lesson Reminder Error:', err);
        }
    }, { scheduled: true, timezone: "Africa/Lagos" });
};

module.exports = { scheduleNotificationTasks };

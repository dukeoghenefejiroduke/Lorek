const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const { logger } = require('../config/logger');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Template cache
const templateCache = new Map();

// ============================================================================
// EMAIL SERVICE CLASS
// ============================================================================

class EmailService {
  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@izonapp.com';
    this.templateDir = path.join(__dirname, '../templates/emails');
  }

  /**
   * Send an email using SendGrid API
   */
  sendEmail = async (options) => {
    try {
      const {
        to, subject, text, html, template, data = {}, 
        attachments = [], from = this.defaultFrom
      } = options;
      
      let finalHtml = html;
      let finalText = text;

      if (template) {
        const templateContent = await this.loadTemplate(template);
        const compiledTemplate = handlebars.compile(templateContent);
        finalHtml = compiledTemplate(data);
        if (!finalText) finalText = this.htmlToText(finalHtml);
      }

      const msg = {
        to,
        from,
        subject,
        text: finalText,
        html: finalHtml,
        attachments,
      };

      // Send via SendGrid API
      const result = await sgMail.send(msg);
      logger.info(`Email sent via SendGrid to ${to}`);
      return { success: true, messageId: result[0].headers['x-message-id'] };
    } catch (error) {
      logger.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Wrapper methods
  sendWelcomeEmail = async (to, username, referralCode) => {
    return this.sendEmail({
      to,
      subject: 'Welcome to Izon Language App',
      template: 'welcome',
      data: { username, referralCode },
    });
  };

  sendVerificationEmail = async (to, username, verificationToken) => {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const verifyUrl = `${webUrl}/verify-email.html#token=${verificationToken}`;
    
    return this.sendEmail({
      to,
      subject: 'Verify Your Email - Izon Language App',
      template: 'verify-email',
      data: {
        username,
        verifyUrl,
        expiresIn: '24 hours',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@izonapp.com',
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendPasswordResetEmail = async (to, username, resetToken) => {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const resetUrl = `${webUrl}/reset-password.html#token=${resetToken}`;

    return this.sendEmail({
      to,
      subject: 'Reset Your Password - Izon Language App',
      template: 'password-reset',
      data: {
        username,
        resetUrl,
        expiresIn: '1 hour',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@izonapp.com',
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendPasswordChangedEmail = async (to, username) => {
    return this.sendEmail({
      to,
      subject: 'Password Changed - Izon Language App',
      template: 'password-changed',
      data: {
        username,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@izonapp.com',
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendAchievementEmail = async (to, username, achievement) => {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const name = encodeURIComponent(achievement.name || 'Milestone Reached');
    const desc = encodeURIComponent(achievement.description || 'Great job mastering Izon vocabulary!');
    const icon = encodeURIComponent(achievement.icon || '🏆');
    return this.sendEmail({
      to,
      subject: `Achievement Unlocked: ${achievement.name}`,
      template: 'achievement',
      data: {
        username,
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        achievementIcon: achievement.icon,
        badgeImage: achievement.badgeImage,
        shareUrl: `${webUrl}/achievements.html#name=${name}&desc=${desc}&icon=${icon}`,
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendWeeklyReport = async (to, username, stats) => {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const lessons = stats?.lessonsCompleted || 0;
    const words = stats?.wordsLearned || 0;
    const points = stats?.pointsEarned || 0;
    return this.sendEmail({
      to,
      subject: 'Your Weekly Learning Progress - Izon Language App',
      template: 'weekly-report',
      data: {
        username,
        stats,
        dashboardUrl: `${webUrl}/weekly-report.html#lessons=${lessons}&words=${words}&points=${points}`,
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendStreakReminder = async (to, username, streak) => {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to,
      subject: `${streak}-Day Streak - Keep it up`,
      template: 'streak-reminder',
      data: {
        username,
        streak,
        practiceUrl: `${webUrl}/streak-reminder.html#streak=${streak}`,
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendFeedbackResponse = async (to, username, feedback) => {
    return this.sendEmail({
      to,
      subject: 'Thank You for Your Feedback - Izon Language App',
      template: 'feedback-response',
      data: {
        username,
        feedback,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@izonapp.com',
        currentYear: new Date().getFullYear(),
      },
    });
  };

  sendBulkEmails = async (recipients, template, data, options = {}) => {
    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail({
          to: recipient.email,
          subject: options.subject || 'Izon Language App',
          template,
          data: {
            ...data,
            username: recipient.username,
          },
        });

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({ email: recipient.email, error: result.error });
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({ email: recipient.email, error: error.message });
      }
    }

    logger.info(`Bulk email sent: ${results.sent} successful, ${results.failed} failed`);
    return results;
  };

  /**
   * Load email template
   */
  async loadTemplate(templateName) {
    if (templateCache.has(templateName)) return templateCache.get(templateName);

    try {
      const templatePath = path.join(this.templateDir, `${templateName}.html`);
      const template = await fs.readFile(templatePath, 'utf-8');
      templateCache.set(templateName, template);
      return template;
    } catch (error) {
      logger.error(`Missing template: ${templateName}`);
      return `<html><body><h1>Hello!</h1><p>This is a notification from Izon App.</p></body></html>`;
    }
  }

  htmlToText(html) {
    return html
      .replace(/<style[^>]*>.*<\/style>/gs, '')
      .replace(/<script[^>]*>.*<\/script>/gs, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async verifyConnection() {
    // API key check
    if (!process.env.SENDGRID_API_KEY) return false;
    return true;
  }
}

const emailService = new EmailService();
module.exports = emailService;
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const { logger } = require('../config/logger');

// ============================================================================
// EMAIL SERVICE CONFIGURATION
// ============================================================================

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true, // Use pooled connections
  maxConnections: 5,
  maxMessages: 100,
});

// Template cache
const templateCache = new Map();

// ============================================================================
// EMAIL SERVICE CLASS
// ============================================================================

class EmailService {
  constructor() {
    // Ensure these variables exist in your .env file
    this.defaultFrom = `"Izon Language App" <${process.env.EMAIL_FROM || 'noreply@izonapp.com'}>`;
    this.templateDir = path.join(__dirname, '../templates/emails');
  }

  /**
   * Send an email - Converted to arrow function to preserve 'this'
   */
  sendEmail = async (options) => {
    try {
      const {
        to, subject, text, html, template, data = {}, 
        attachments = [], from = this.defaultFrom
      } = options;
      
      // 1. Skip sending if in development and no host is configured
      if (process.env.NODE_ENV === 'development' && (!process.env.EMAIL_HOST || process.env.EMAIL_HOST === 'localhost')) {
        logger.info(`📧 [DEV MODE] Email skipped to: ${to} (Subject: ${subject})`);
        return { success: true, messageId: 'dev-mode-skip' };
      }

      let finalHtml = html;
      let finalText = text;

      if (template) {
        const templateContent = await this.loadTemplate(template);
        const compiledTemplate = handlebars.compile(templateContent);
        finalHtml = compiledTemplate(data);
        if (!finalText) finalText = this.htmlToText(finalHtml);
      }

      const mailOptions = { from, to, subject, text: finalText, html: finalHtml, attachments };

      // 2. IMPORTANT: Fire and forget the sendMail for non-critical emails
      // This stops the "Slow Request" warnings by not making the user wait
      transporter.sendMail(mailOptions)
        .then(info => logger.info(`Email sent: ${info.messageId} to ${to}`))
        .catch(err => logger.error(`Deferred Email Error: ${err.message}`));

      return { success: true, note: 'Email queued' };
    } catch (error) {
      logger.error('Email preparation failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Convert these wrapper methods to arrow functions as well
  sendWelcomeEmail = async (to, username, referralCode) => {
    return this.sendEmail({
      to,
      subject: 'Welcome to Izon Language App! 🎉',
      template: 'welcome',
      data: { username, referralCode, /* ... */ },
    });
  };

  /**
   * Load email template - Arrow function prevents 'this' errors when called from sendEmail
   */
  loadTemplate = async (templateName) => {
  if (templateCache.has(templateName)) return templateCache.get(templateName);

  try {
    const templatePath = path.join(this.templateDir, `${templateName}.html`);
    const template = await fs.readFile(templatePath, 'utf-8');
    templateCache.set(templateName, template);
    return template;
  } catch (error) {
    logger.error(`Missing template: ${templateName}. Falling back to default.`);
    // Return a very basic fallback string so the app doesn't break
    return `<html><body><h1>Hello!</h1><p>This is a notification from Izon App.</p></body></html>`;
  }
};

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to, username, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    return this.sendEmail({
      to,
      subject: 'Reset Your Password - Izon Language App',
      template: 'password-reset',
      data: {
        username,
        resetUrl,
        expiresIn: '1 hour',
        supportEmail: process.env.SUPPORT_EMAIL,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(to, username, verificationToken) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    return this.sendEmail({
      to,
      subject: 'Verify Your Email - Izon Language App',
      template: 'verify-email',
      data: {
        username,
        verifyUrl,
        expiresIn: '24 hours',
        supportEmail: process.env.SUPPORT_EMAIL,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChangedEmail(to, username) {
    return this.sendEmail({
      to,
      subject: 'Password Changed - Izon Language App',
      template: 'password-changed',
      data: {
        username,
        supportEmail: process.env.SUPPORT_EMAIL,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send achievement unlocked email
   */
  async sendAchievementEmail(to, username, achievement) {
    return this.sendEmail({
      to,
      subject: `🏆 Achievement Unlocked: ${achievement.name}`,
      template: 'achievement',
      data: {
        username,
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        achievementIcon: achievement.icon,
        badgeImage: achievement.badgeImage,
        shareUrl: `${process.env.FRONTEND_URL}/achievements/${achievement.id}`,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send weekly progress report
   */
  async sendWeeklyReport(to, username, stats) {
    return this.sendEmail({
      to,
      subject: 'Your Weekly Learning Progress - Izon Language App',
      template: 'weekly-report',
      data: {
        username,
        stats,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send streak reminder
   */
  async sendStreakReminder(to, username, streak) {
    return this.sendEmail({
      to,
      subject: `🔥 ${streak}-Day Streak! Keep it up!`,
      template: 'streak-reminder',
      data: {
        username,
        streak,
        practiceUrl: `${process.env.FRONTEND_URL}/practice`,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send feedback response
   */
  async sendFeedbackResponse(to, username, feedback) {
    return this.sendEmail({
      to,
      subject: 'Thank You for Your Feedback - Izon Language App',
      template: 'feedback-response',
      data: {
        username,
        feedback,
        supportEmail: process.env.SUPPORT_EMAIL,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send bulk emails (for admins)
   */
  async sendBulkEmails(recipients, template, data, options = {}) {
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
  }

  /**
   * Load email template
   */
  async loadTemplate(templateName) {
    // Check cache first
    if (templateCache.has(templateName)) {
      return templateCache.get(templateName);
    }

    try {
      const templatePath = path.join(this.templateDir, `${templateName}.html`);
      const template = await fs.readFile(templatePath, 'utf-8');

      // Cache template (limit cache size)
      if (templateCache.size > 50) {
        // Clear oldest entry
        const firstKey = templateCache.keys().next().value;
        templateCache.delete(firstKey);
      }
      templateCache.set(templateName, template);

      return template;
    } catch (error) {
      logger.error(`Failed to load template ${templateName}:`, error);
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  /**
   * Simple HTML to text conversion
   */
  htmlToText(html) {
    return html
      .replace(/<style[^>]*>.*<\/style>/gs, '')
      .replace(/<script[^>]*>.*<\/script>/gs, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Verify email configuration
   */
  async verifyConnection() {
    try {
      await transporter.verify();
      logger.info('Email service connected successfully');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }

  /**
   * Get email statistics
   */
  getStats() {
    return {
      transporter: transporter.isIdle() ? 'idle' : 'active',
      templateCacheSize: templateCache.size,
    };
  }
}

// Create and export singleton instance
const emailService = new EmailService();

module.exports = emailService;
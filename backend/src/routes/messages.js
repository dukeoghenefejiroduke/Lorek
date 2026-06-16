const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { socialLimiter } = require('../middleware/rateLimit');
const { body, param, query, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
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
// VALIDATION RULES
// ============================================================================

const validateMessage = [
  body('content').trim().notEmpty().withMessage('Message content is required').isLength({ max: 1000 }),
];

const validateConversationId = [
  param('conversationId').isMongoId().withMessage('Invalid conversation ID'),
];

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Get or create a conversation with another user
 * POST /api/messages/conversation
 */
router.post('/conversation', [
  body('userId').isMongoId().withMessage('Invalid user ID'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.body;
    
    if (userId === req.userId) {
      throw new AppError('Cannot start conversation with yourself', 400);
    }

    // Check if user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      throw new AppError('User not found', 404);
    }

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, userId], $size: 2 },
    }).populate('participants', 'username profile.avatar');

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [req.userId, userId],
        lastMessage: null,
        lastMessageAt: new Date(),
      });
      await conversation.save();
      await conversation.populate('participants', 'username profile.avatar');
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get a single conversation by ID
 * GET /api/messages/conversation/:conversationId
 */
router.get('/conversation/:conversationId', validateConversationId, async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId,
    }).populate('participants', 'username profile.avatar');

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get user's conversations
 * GET /api/messages/conversations
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conversations = await Conversation.find({
      participants: req.userId,
    })
      .populate('participants', 'username profile.avatar')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: req.userId },
          read: false,
        });
        
        // Get last message
        const lastMessage = await Message.findOne({ conversation: conv._id })
          .sort({ createdAt: -1 })
          .select('content createdAt sender');

        return {
          ...conv.toObject(),
          unreadCount,
          lastMessage: lastMessage?.content || 'No messages yet',
          lastMessageTime: lastMessage?.createdAt,
          lastMessageSender: lastMessage?.sender,
        };
      })
    );

    const total = await Conversation.countDocuments({ participants: req.userId });

    res.json({
      success: true,
      data: conversationsWithUnread,
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

/**
 * Get conversation messages
 * GET /api/messages/conversations/:conversationId/messages
 */
router.get('/conversations/:conversationId/messages', validateConversationId, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId,
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username profile.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.userId },
        read: false,
      },
      { read: true, readAt: new Date() }
    );

    res.json({
      success: true,
      data: messages.reverse(),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(await Message.countDocuments({ conversation: conversationId }) / limit),
        totalItems: await Message.countDocuments({ conversation: conversationId }),
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Send a message
 * POST /api/messages
 */
router.post('/', validateMessage, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { conversationId, recipientId, content } = req.body;

    let conversation;
    
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        participants: req.userId,
      });
      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }
    } else if (recipientId) {
      // Create new conversation
      conversation = await Conversation.findOne({
        participants: { $all: [req.userId, recipientId], $size: 2 },
      });
      
      if (!conversation) {
        conversation = new Conversation({
          participants: [req.userId, recipientId],
          lastMessageAt: new Date(),
        });
        await conversation.save();
      }
    } else {
      throw new AppError('Either conversationId or recipientId is required', 400);
    }

    const message = new Message({
      conversation: conversation._id,
      sender: req.userId,
      content: content.trim(),
    });

    await message.save();
    await message.populate('sender', 'username profile.avatar');

    // Update conversation last message
    conversation.lastMessage = message.content;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    // Send notification to recipient
    const targetRecipientId = recipientId || conversation.participants.find(p => p.toString() !== req.userId.toString());
    await notificationService.sendNotification(targetRecipientId, {
      type: 'new_message',
      title: 'New Message',
      body: `${req.user.username} sent you a message`,
      data: {
        conversationId: conversation._id,
        messageId: message._id,
      },
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a message (for everyone)
 * DELETE /api/messages/:messageId
 */
router.delete('/:messageId', param('messageId').isMongoId(), async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, sender: req.userId });
    if (!message) {
      throw new AppError('Message not found or unauthorized', 404);
    }

    // Soft delete - mark as deleted
    message.deleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete conversation (for user)
 * DELETE /api/messages/conversations/:conversationId
 */
router.delete('/conversations/:conversationId', validateConversationId, async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId,
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Soft delete - remove user from conversation
    conversation.participants = conversation.participants.filter(p => p.toString() !== req.userId);
    
    if (conversation.participants.length === 0) {
      await Conversation.deleteOne({ _id: conversationId });
    } else {
      await conversation.save();
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get unread message count
 * GET /api/messages/unread/count
 */
router.get('/unread/count', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId });
    const conversationIds = conversations.map(c => c._id);

    const unreadCount = await Message.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: req.userId },
      read: false,
    });

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
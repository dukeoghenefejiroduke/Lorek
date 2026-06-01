const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const FriendRequest = require('../models/FriendRequest');
const Discussion = require('../models/Discussion');
const { logger } = require('../config/logger');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const redis = require('../config/redis');
const multer = require('multer');
const Contribution = require('../models/Contribution');
const Review = require('../models/Review');

const upload = multer({ storage: multer.memoryStorage() });

// ============================================================================
// RATE LIMITING
// ============================================================================

const communityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

router.use(communityLimiter);
router.use(auth);

// ============================================================================
// COMMUNITY CONTRIBUTIONS & REVIEWS
// ============================================================================

/**
 * Get pending contributions (Admin/Moderator only)
 * GET /api/community/contributions/pending
 */
router.get('/contributions/pending', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new AppError('Unauthorized', 403);
    }
    const contributions = await Contribution.find({ status: 'pending' })
      .populate('userId', 'username')
      .sort({ createdAt: 1 });
    res.json({ success: true, data: contributions });
  } catch (err) {
    next(err);
  }
});

/**
 * Submit a review decision
 * POST /api/community/contributions/:contributionId/review
 */
router.post('/contributions/:contributionId/review', [
  body('decision').isIn(['approve', 'reject']),
  body('comment').optional().isString()
], async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new AppError('Unauthorized', 403);
    }

    const { contributionId } = req.params;
    const { decision, comment } = req.body;

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) throw new AppError('Contribution not found', 404);

    contribution.status = decision === 'approve' ? 'approved' : 'rejected';
    await contribution.save();

    const review = new Review({
      contributionId,
      reviewerId: req.user._id,
      decision,
      comment
    });
    await review.save();

    res.json({ success: true, message: 'Review submitted successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// VALIDATION RULES
// ============================================================================

const validatePost = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 1000 }),
  
  // FIX: Allow null or empty strings by adding .optional({ nullable: true })
  // or checking if it's a valid MongoId only when it actually exists.
  body('lessonId')
    .optional({ checkFalsy: true }) // This will skip validation if lessonId is null, "", or undefined
    .isMongoId()
    .withMessage('Invalid lesson ID format'),
];


const validateComment = [
  body('content').trim().notEmpty().withMessage('Comment is required').isLength({ max: 500 }),
];

// ============================================================================
// POSTS
// ============================================================================

/**
 * Get feed posts
 * GET /api/community/feed
 */
router.get('/feed', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.user._id).lean();
    if (!user) throw new AppError('User not found', 404);

   // Use a Set to ensure unique IDs and prevent duplicate posts in the feed
const friendIds = [...new Set(
  (user.friends || [])
    .filter(f => f && f.status === 'accepted' && f.user)
    .map(f => f.user.toString())
)];

    const query = {
      $or: [
        { user: req.user._id },
        { user: { $in: friendIds } },
        { isPublic: true },
      ],
      parentPost: null,
    };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('user', 'username profile.avatar progress.level')
        .populate('lesson', 'title.english')
        .populate('likes', 'username')
        .populate({
          path: 'comments',
          options: { limit: 3, sort: { createdAt: -1 } },
          populate: { path: 'user', select: 'username profile.avatar' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Post.countDocuments(query),
    ]);

    // Enhance posts with user interaction data
    const enhancedPosts = posts.map(post => ({
      ...post.toObject(),
      likedByUser: post.likes?.some(like => like._id.toString() === req.user._id),
      likeCount: post.likes?.length || 0,
      commentCount: post.comments?.length || 0,
    }));

    res.json({
      success: true,
      data: enhancedPosts,
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
 * Create a post
 * POST /api/community/posts
 */
router.post('/posts', validatePost, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { content, lessonId, isPublic = true } = req.body;

    const post = new Post({
      user: req.user._id,
      content,
      lesson: lessonId || undefined, 
      isPublic,
      createdAt: new Date(),
    });

    await post.save();
    await post.populate('user', 'username profile.avatar progress.level');

    logger.info(`New post created by user ${req.user._id}`);

    res.status(201).json({
      success: true,
      data: post,
      message: 'Post created successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Like/Unlike a post
 * POST /api/community/posts/:postId/like
 */
router.post('/posts/:postId/like', param('postId').isMongoId(), async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      throw new AppError('Post not found', 404);
    }

    const hasLiked = post.likes.includes(userId);
    
    if (hasLiked) {
      // Unlike
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
      await post.save();

      res.json({ 
        success: true, 
        liked: false, 
        likeCount: post.likes.length 
      });
    } else {
      // Like
      post.likes.push(userId);
      await post.save();
      
      // Send notification to post owner (only if it's not self-like)
      if (post.user.toString() !== userId.toString()) {
        await notificationService.sendNotification(post.user, {
          type: 'like',
          title: 'Someone liked your post',
          body: `${req.user.username} liked your post`,
          data: { 
            postId, 
            userId: req.user._id 
          },
        });
      }
      
      res.json({ 
        success: true, 
        liked: true, 
        likeCount: post.likes.length 
      });
    }
  } catch (err) {
    next(err);
  }
});


/**
 * Delete a post
 * DELETE /api/community/posts/:postId
 */
router.delete('/posts/:postId', param('postId').isMongoId(), async (req, res, next) => {
  try {
    const { postId } = req.params;

    const post = await Post.findOne({ _id: postId, user: req.user._id });
    if (!post) {
      throw new AppError('Post not found or unauthorized', 404);
    }

    await Post.deleteMany({ parentPost: postId });
    await post.deleteOne();

    logger.info(`Post deleted by user ${req.user._id}`);

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Get comments for a post
 * GET /api/community/posts/:postId/comments
 */
router.get('/posts/:postId/comments', param('postId').isMongoId(), async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const post = await Post.findById(postId);
    if (!post) {
      throw new AppError('Post not found', 404);
    }

    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'username profile.avatar');

    const total = await Comment.countDocuments({ post: postId });

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Add a comment to a post
 * POST /api/community/posts/:postId/comments
 */
router.post('/posts/:postId/comments', param('postId').isMongoId(), validateComment, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { postId } = req.params;
    const { content } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      throw new AppError('Post not found', 404);
    }

    const comment = new Comment({
      user: req.user._id,
      post: postId,
      content,
    });

    await comment.save();
    await comment.populate('user', 'username profile.avatar');

    post.comments.push(comment._id);
    await post.save();

    // Send notification to post owner
    if (post.user.toString() !== req.user._id.toString()) {
      await notificationService.sendNotification(post.user, {
        type: 'comment',
        title: 'New comment on your post',
        body: `${req.user.username} commented: ${content.substring(0, 50)}...`,
        data: { postId, commentId: comment._id },
      });
    }

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// FRIENDS
// ============================================================================

/**
 * Send friend request
 * POST /api/community/friends/request/:userId
 */
router.post('/friends/request/:userId', param('userId').isMongoId(), async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user._id) {
      throw new AppError('Cannot send friend request to yourself', 400);
    }

const existing = await FriendRequest.findOne({
  $or: [
    { from: req.user._id, to: userId },
    { from: userId, to: req.user._id },
  ],
  status: { $in: ['pending', 'accepted'] } // Allow re-requesting if previously 'rejected'
});

    if (existing) {
      throw new AppError('Friend request already exists', 400);
    }

    const friendRequest = new FriendRequest({
      from: req.user._id,
      to: userId,
      status: 'pending',
    });

    await friendRequest.save();

    // Send notification
    await notificationService.sendNotification(userId, {
      type: 'friend_request',
      title: 'Friend Request',
      body: `${req.user.username} sent you a friend request`,
      data: { requestId: friendRequest._id },
    });

    res.json({
      success: true,
      message: 'Friend request sent',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Accept friend request - FERRETDB COMPATIBLE & DUP-SAFE
 * POST /api/community/friends/accept/:requestId
 */
router.post('/friends/accept/:requestId', param('requestId').isMongoId(), async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const friendRequest = await FriendRequest.findOne({ 
      _id: requestId, 
      to: req.user._id, 
      status: 'pending' 
    });

    if (!friendRequest) {
      throw new AppError('Friend request not found or already accepted', 404);
    }

    const sender = await User.findById(friendRequest.from);
    const receiver = await User.findById(req.user._id);

    if (!sender || !receiver) throw new AppError('User not found', 404);

    // DUP-SAFE: Filter out the ID if it accidentally exists already
    sender.friends = sender.friends.filter(f => f.user && f.user.toString() !== receiver._id.toString());
    receiver.friends = receiver.friends.filter(f => f.user && f.user.toString() !== sender._id.toString());

    // Add them fresh
    const now = new Date();
    sender.friends.push({ user: receiver._id, status: 'accepted', since: now });
    receiver.friends.push({ user: sender._id, status: 'accepted', since: now });

    // Use .save() to avoid FerretDB findAndModify errors
    await sender.save();
    await receiver.save();

    friendRequest.status = 'accepted';
    await friendRequest.save();

    await notificationService.sendNotification(friendRequest.from, {
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      body: `${req.user.username} accepted your friend request`,
    });

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (err) {
    next(err);
  }
});

/**
 * Get friends list
 * GET /api/community/friends
 */
router.get('/friends', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends.user', 'username profile.avatar progress.streak.current progress.level progress.totalPoints')
      .lean();

    if (!user || !user.friends) {
      return res.json({ success: true, data: [] });
    }

    // Filter accepted friends and ensure the populated user exists
    const friends = user.friends
      .filter(f => f.status === 'accepted' && f.user) 
      .map(f => ({
        id: f.user._id,
        name: f.user.username,
        username: f.user.username,
        avatar: f.user.profile?.avatar?.thumbnail,
        streak: f.user.progress?.streak?.current || 0,
        level: f.user.progress?.level || 1,
        points: f.user.progress?.totalPoints || 0,
        since: f.since,
      }));

    res.json({ success: true, data: friends });
  } catch (err) {
    next(err);
  }
});


/**
 * Get friend requests
 * GET /api/community/friends/requests
 */
router.get('/friends/requests', async (req, res, next) => {
  try {
    const requests = await FriendRequest.find({ to: req.user._id, status: 'pending' })
      .populate('from', 'username profile.avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests.map(r => ({
        id: r._id,
        from: {
          id: r.from._id,
          username: r.from.username,
          avatar: r.from.profile?.avatar?.thumbnail,
        },
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DISCUSSIONS
// ============================================================================

/**
 * Get discussions
 * GET /api/community/discussions
 */
router.get('/discussions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { isActive: true };
    if (category) query.category = category;

    const [discussions, total] = await Promise.all([
      Discussion.find(query)
        .populate('author', 'username profile.avatar')
        .populate('lastReplyBy', 'username')
        .sort({ lastActive: -1, pinned: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Discussion.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: discussions,
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
 * Create discussion
 * POST /api/community/discussions
 */
router.post('/discussions', [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('category').optional(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, content, category } = req.body;

    const discussion = new Discussion({
      title,
      content,
      author: req.user._id,
      category: category || 'general',
      createdAt: new Date(),
      lastActive: new Date(),
    });

    await discussion.save();
    await discussion.populate('author', 'username profile.avatar');

    res.status(201).json({
      success: true,
      data: discussion,
      message: 'Discussion created successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get discussion by ID
 * GET /api/community/discussions/:discussionId
 */
router.get('/discussions/:discussionId', param('discussionId').isMongoId(), async (req, res, next) => {
  try {
    const { discussionId } = req.params;

    const discussion = await Discussion.findById(discussionId)
      .populate('author', 'username profile.avatar progress.level')
      .populate('replies.user', 'username profile.avatar');

    if (!discussion) {
      throw new AppError('Discussion not found', 404);
    }

    // Increment view count
    discussion.views += 1;
    await discussion.save();

    res.json({ success: true, data: discussion });
  } catch (err) {
    next(err);
  }
});

/**
 * Reply to discussion
 * POST /api/community/discussions/:discussionId/reply
 */
router.post('/discussions/:discussionId/reply', param('discussionId').isMongoId(), [
  body('content').trim().notEmpty().withMessage('Reply content is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { discussionId } = req.params;
    const { content } = req.body;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      throw new AppError('Discussion not found', 404);
    }

    discussion.replies.push({
      user: req.user._id,
      content,
      createdAt: new Date(),
    });
    discussion.replyCount += 1;
    discussion.lastActive = new Date();
    discussion.lastReplyBy = req.user._id;

    await discussion.save();

    // Send notification to discussion author
    if (discussion.author.toString() !== req.user._id) {
      await notificationService.sendNotification(discussion.author, {
        type: 'discussion_reply',
        title: 'New reply to your discussion',
        body: `${req.user.username} replied to "${discussion.title.substring(0, 50)}"`,
        data: { discussionId },
      });
    }

    res.status(201).json({
      success: true,
      data: discussion.replies[discussion.replies.length - 1],
      message: 'Reply added successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Like a reply
 * POST /api/community/discussions/:discussionId/replies/:replyId/like
 */
router.post('/discussions/:discussionId/replies/:replyId/like', auth, async (req, res, next) => {
  try {
    const { discussionId, replyId } = req.params;
    // FIX: Use req.user._id to stay consistent with your other routes
    const userId = req.user?._id; 

    if (!userId) throw new AppError('Authentication required', 401);

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) throw new AppError('Discussion not found', 404);
    
    const reply = discussion.replies.id(replyId);
    if (!reply) throw new AppError('Reply not found', 404);
    
    // Use .some() with a null check for safer comparison
    const hasLiked = reply.likes?.some(id => id && id.toString() === userId.toString());
    
    if (hasLiked) {
      // Guard: Ensure 'id' exists before calling .toString()
      reply.likes = reply.likes.filter(id => id && id.toString() !== userId.toString());
    } else {
      if (!reply.likes) reply.likes = [];
      reply.likes.push(userId);
    }
    
    await discussion.save();
    
    res.json({
      success: true,
      data: { liked: !hasLiked, likeCount: reply.likes?.length || 0 },
    });
  } catch (err) {
    next(err);
  }
});


/**
 * Report a discussion
 * POST /api/community/discussions/:discussionId/report
 */
router.post('/discussions/:discussionId/report', auth, [
  body('reason').notEmpty().withMessage('Report reason is required'),
], async (req, res, next) => {
  try {
    const { discussionId } = req.params;
    const { reason } = req.body;
    
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      throw new AppError('Discussion not found', 404);
    }
    
    if (!discussion.reports) discussion.reports = [];
    discussion.reports.push({
      user: req.user._id,
      reason,
      reportedAt: new Date(),
    });
    
    await discussion.save();
    
    // Notify admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    await notificationService.sendToMany(admins.map(a => a._id), {
      type: 'report',
      title: 'Discussion Reported',
      body: `"${discussion.title}" was reported by ${req.user.username}`,
      data: { discussionId, reason },
    }, { channels: ['in_app', 'email'] });
    
    res.json({ success: true, message: 'Report submitted' });
  } catch (err) {
    next(err);
  }
});

/**
 * Pin/unpin discussion (admin only)
 * POST /api/community/discussions/:discussionId/pin
 */
router.post('/discussions/:discussionId/pin', auth, async (req, res, next) => {
  try {
    const { discussionId } = req.params;
    const { pinned } = req.body;
    
    const user = await User.findById(req.user._id);
    if (user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }
    
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      throw new AppError('Discussion not found', 404);
    }
    
    discussion.pinned = pinned;
    await discussion.save();
    
    res.json({ success: true, data: { pinned } });
  } catch (err) {
    next(err);
  }
});

// Add this to your backend community.js to support the Leaderboard tab
router.get('/leaderboard', async (req, res, next) => {
  try {
    const leaderboard = await User.find({})
      .sort({ 'progress.totalPoints': -1 })
      .limit(10)
      .select('username profile.avatar progress.totalPoints progress.level');
      
    res.json({
      success: true,
      data: leaderboard.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        avatar: u.profile?.avatar?.thumbnail,
        points: u.progress?.totalPoints || 0,
        level: u.progress?.level || 1
      }))
    });
  } catch (err) { next(err); }
});

/**
 * Get SENT friend requests
 * GET /api/community/friends/requests/sent
 */
router.get('/friends/requests/sent', async (req, res, next) => {
  try {
    const sentRequests = await FriendRequest.find({ 
      from: req.user._id, 
      status: 'pending' 
    }).select('to');

    res.json({
      success: true,
      // We just need the IDs of the people we sent requests to
      data: sentRequests.map(r => r.to) 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
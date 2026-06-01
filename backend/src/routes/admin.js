const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const Vocabulary = require('../models/Vocabulary');
const KnowledgeBase = require('../models/KnowledgeBase');
const Contribution = require('../models/Contribution');
const Review = require('../models/Review');
const Progress = require('../models/Progress');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// All admin routes require authentication and admin role
router.use(auth);
router.use(authorize('admin'));

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalLessons,
      totalVocabulary,
      totalCompletions,
      recentUsers,
      recentLessons,
      usersByStatus,
      lessonsByLevel
    ] = await Promise.all([
      User.countDocuments(),
      Lesson.countDocuments(),
      Vocabulary.countDocuments(),
      Progress.countDocuments({ completed: true }),
      User.find().sort({ createdAt: -1 }).limit(5).select('username email createdAt status'),
      Lesson.find().sort({ createdAt: -1 }).limit(5).select('title.english level status'),
      User.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Lesson.aggregate([
        { $group: { _id: '$level', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalLessons,
          totalVocabulary,
          totalCompletions,
        },
        recent: {
          users: recentUsers,
          lessons: recentLessons,
        },
        charts: {
          usersByStatus,
          lessonsByLevel,
        },
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    next(err);
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// Get all users with pagination
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -security.refreshToken -security.apiKeys.key')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    next(err);
  }
});

// Get single user
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -security.refreshToken -security.apiKeys.key')
      .populate('progress.completedLessons.lessonId', 'title.english level');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Get user's progress stats
    const progress = await Progress.find({ user: user._id })
      .populate('lesson', 'title.english level category');

    res.json({
      success: true,
      data: {
        user,
        progress,
        stats: {
          totalLessonsCompleted: progress.filter(p => p.completed).length,
          averageScore: progress.reduce((sum, p) => sum + (p.score || 0), 0) / (progress.length || 1),
          totalTimeSpent: progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
        },
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    next(err);
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['username', 'email', 'role', 'status', 'profile', 'preferences'];
    
    // Filter out disallowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    ).select('-password -security.refreshToken -security.apiKeys.key');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully',
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.status = 'deleted';
    user.deletedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err) {
    console.error('Delete user error:', err);
    next(err);
  }
});

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================

// Get content statistics
router.get('/content/stats', async (req, res) => {
  try {
    const [vocabByCategory, vocabByDifficulty, lessonsByLevel, lessonsByStatus] = await Promise.all([
      Vocabulary.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Vocabulary.aggregate([{ $group: { _id: '$difficulty', count: { $sum: 1 } } }]),
      Lesson.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }]),
      Lesson.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    res.json({
      success: true,
      data: {
        vocabulary: {
          byCategory: vocabByCategory,
          byDifficulty: vocabByDifficulty,
          total: await Vocabulary.countDocuments(),
        },
        lessons: {
          byLevel: lessonsByLevel,
          byStatus: lessonsByStatus,
          total: await Lesson.countDocuments(),
        },
      },
    });
  } catch (err) {
    console.error('Content stats error:', err);
    next(err);
  }
});

// Moderate content
router.post('/content/moderate/:id', async (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approve' or 'reject'
    const contributionId = req.params.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found' });
    }

    // 1. Update contribution status
    contribution.status = action === 'approve' ? 'approved' : 'rejected';
    await contribution.save();

    // 2. Create review record
    await Review.create({
      contributionId,
      reviewerId: req.user._id,
      decision: action,
      comment
    });

    // 3. If approved, optionally push to production (Vocabulary/etc)
    if (action === 'approve') {
      // Award points/stats to contributor
      await User.findByIdAndUpdate(contribution.userId, {
        $inc: { 
          'contributions.contributionScore': 10,
          'contributions.verifiedContributions': 1
        }
      });

      if (contribution.type === 'translation') {
        await Vocabulary.create({
          izonWord: contribution.data.text,
          englishTranslation: "Pending verification...", // Or map fields correctly
          category: 'general',
          verificationStatus: 'verified'
        });
      }
    }

    res.json({ success: true, message: `Contribution ${action}ed successfully` });
  } catch (err) {
    console.error('Moderation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get pending contributions
router.get('/contributions/pending', async (req, res) => {
  try {
    const pending = await Contribution.find({ status: 'pending' })
      .populate('userId', 'username')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pending });
  } catch (err) {
    console.error('Fetch pending error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get top contributors
router.get('/users/contributors/top', async (req, res) => {
  try {
    const top = await User.find({ 'contributions.verifiedContributions': { $gt: 0 } })
      .sort({ 'contributions.contributionScore': -1 })
      .limit(10)
      .select('username contributions.contributionScore contributions.contributorLevel');
    res.json({ success: true, data: top });
  } catch (err) {
    console.error('Fetch top contributors error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get pending content for moderation
router.get('/content/pending', async (req, res) => {
  try {
    const [pendingVocab, pendingLessons] = await Promise.all([
      Vocabulary.find({ verificationStatus: 'pending' }).lean(),
      Lesson.find({ status: 'review' }).lean(),
    ]);

    res.json({
      success: true,
      data: {
        vocabulary: pendingVocab,
        lessons: pendingLessons,
      },
    });
  } catch (err) {
    console.error('Get pending content error:', err);
    next(err);
  }
});

// KnowledgeBase CRUD
router.get('/knowledge', async (req, res) => {
  try {
    const entries = await KnowledgeBase.find().sort({ createdAt: -1 });
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
});

router.post('/knowledge', async (req, res) => {
  try {
    const entry = await KnowledgeBase.create(req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.put('/knowledge/:id', async (req, res) => {
  try {
    const entry = await KnowledgeBase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.delete('/knowledge/:id', async (req, res) => {
  try {
    await KnowledgeBase.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});


// ============================================================================
// ANALYTICS (FerretDB/SQLite Compatible)
// ============================================================================

router.get('/analytics', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const totalUsersCount = await User.countDocuments();

    // Calculate start date
    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Helper: Group by date in JavaScript (no $year, $month, etc.)
    const getGroupedByDate = async (model, dateField, matchQuery = {}) => {
      const docs = await model.find(matchQuery)
        .select(`${dateField} _id`)   // only need the date field
        .lean();

      const grouped = {};

      for (const doc of docs) {
        const date = new Date(doc[dateField]);
        const key = date.toISOString().split('T')[0]; // YYYY-MM-DD

        if (!grouped[key]) grouped[key] = 0;
        grouped[key]++;
      }

      // Convert to array and sort by date
      return Object.entries(grouped)
        .map(([date, count]) => ({ _id: date, count }))
        .sort((a, b) => a._id.localeCompare(b._id));
    };

    // Run all queries in parallel
    const [
      newUsers,
      activeUsers,
      completedLessons,
      newVocabulary,
      rawUserGrowth,
      rawLessonCompletions,
    ] = await Promise.all([
      // Simple counts
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ lastActive: { $gte: startDate } }),
      Progress.countDocuments({ 
        completed: true, 
        lastAttempt: { $gte: startDate } 
      }),
      Vocabulary.countDocuments({ createdAt: { $gte: startDate } }),

      // Date-grouped data (FerretDB safe)
      getGroupedByDate(User, 'createdAt', { createdAt: { $gte: startDate } }),
      getGroupedByDate(Progress, 'lastAttempt', { 
        completed: true, 
        lastAttempt: { $gte: startDate } 
      }),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          newUsers,
          activeUsers,
          completedLessons,
          newVocabulary,
          engagementRate: totalUsersCount > 0 
            ? Math.round((activeUsers / totalUsersCount) * 100) 
            : 0,
        },
        charts: {
          userGrowth: rawUserGrowth,
          lessonCompletions: rawLessonCompletions,
        },
        period,
      },
    });

  } catch (err) {
    console.error('Admin analytics error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load analytics. Please try again later.' 
    });
  }
});


// ============================================================================
// EXPORT DATA
// ============================================================================

router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json' } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'users':
        data = await User.find().select('-password -security').lean();
        filename = 'users_export';
        break;
      case 'lessons':
        data = await Lesson.find().lean();
        filename = 'lessons_export';
        break;
      case 'vocabulary':
        data = await Vocabulary.find().lean();
        filename = 'vocabulary_export';
        break;
      case 'progress':
        data = await Progress.find().populate('user lesson').lean();
        filename = 'progress_export';
        break;
      default:
        return next(new AppError('Invalid export type', 400));
    }

    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(item => Object.values(item).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data,
        count: data.length,
      });
    }
  } catch (err) {
    console.error('Export error:', err);
    next(err);
  }
});

module.exports = router;
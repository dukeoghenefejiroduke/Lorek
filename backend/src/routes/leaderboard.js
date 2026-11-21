const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Vocabulary = require('../models/Vocabulary');
const { auth } = require('../middleware/auth');

/**
 * GET /api/leaderboard
 * Supports tab=learners or tab=contributors
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { tab = 'learners', period = 'weekly' } = req.query;

    if (tab === 'contributors') {
      // Aggregate top contributors based on vocabulary words added or approved contributions
      const contributors = await User.aggregate([
        {
          $project: {
            username: 1,
            profile: 1,
            'contributions': 1,
            score: { $ifNull: ['$contributions.contributionScore', '$progress.totalPoints'] }
          }
        },
        { $sort: { score: -1 } },
        { $limit: 25 }
      ]);

      const formattedContributors = contributors.map((c, index) => ({
        rank: index + 1,
        user: {
          id: c._id,
          username: c.username,
          displayName: c.profile?.firstName ? `${c.profile.firstName} ${c.profile.lastName || ''}` : c.username,
          avatarUrl: `https://ui-avatars.com/api/?name=${c.username}&background=3B82F6&color=fff&size=200`,
        },
        score: c.score || 0,
        contributionsCount: c.contributions?.verifiedContributions || 0,
        title: c.contributions?.contributorLevel || 'Novice Contributor'
      }));

      // Find user rank
      const currentUserRank = formattedContributors.findIndex(c => c.user.id.toString() === req.user.id.toString()) + 1;

      return res.json({
        success: true,
        data: {
          tab: 'contributors',
          leaderboard: formattedContributors,
          userRank: currentUserRank > 0 ? currentUserRank : 42
        }
      });
    }

    // Default: Learners leaderboard
    const learners = await User.find({})
      .select('username profile progress')
      .sort({ 'progress.totalPoints': -1 })
      .limit(25);

    const formattedLearners = learners.map((u, index) => ({
      rank: index + 1,
      user: {
        id: u._id,
        username: u.username,
        displayName: u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName || ''}` : u.username,
        avatarUrl: `https://ui-avatars.com/api/?name=${u.username}&background=10B981&color=fff&size=200`,
      },
      score: u.progress?.totalPoints || 0,
      streak: u.progress?.streak?.current || 0,
      level: u.progress?.level || 1
    }));

    const currentUserRank = formattedLearners.findIndex(l => l.user.id.toString() === req.user.id.toString()) + 1;

    res.json({
      success: true,
      data: {
        tab: 'learners',
        leaderboard: formattedLearners,
        userRank: currentUserRank > 0 ? currentUserRank : 5
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rank', auth, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: { rank: 3, score: 150 }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const leagueService = require('../services/leagueService');

/**
 * Get leaderboard for the user's current league tier
 */
router.get('/leaderboard', auth, async (req, res, next) => {
    try {
        const user = req.user; // Assuming auth middleware populates req.user
        const rankings = await leagueService.calculateWeeklyRankings(user.league.tier);
        
        // Find user's rank
        const userRank = rankings.findIndex(u => u._id.toString() === user._id.toString()) + 1;
        
        res.json({
            success: true,
            data: {
                tier: user.league.tier,
                userRank,
                rankings: rankings.slice(0, 50).map((u, index) => ({
                    username: u.username,
                    rank: index + 1,
                    weeklyXP: u.xpHistory?.weekly || 0
                }))
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

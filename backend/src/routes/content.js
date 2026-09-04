const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Section = require('../models/Section');
const Unit = require('../models/Unit');
const { auth } = require('../middleware/auth');

router.use(auth);

// Get full course hierarchy
router.get('/hierarchy', async (req, res, next) => {
    try {
        const courses = await Course.find()
            .populate({
                path: 'sections',
                populate: {
                    path: 'units',
                    populate: { path: 'lessons' }
                }
            });
        res.json({ success: true, data: courses });
    } catch (err) { next(err); }
});

module.exports = router;

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
        let query = {};
        if (req.user && req.user.enrolledCourses && req.user.enrolledCourses.length > 0) {
            query = { _id: { $in: req.user.enrolledCourses } };
        }
        let courses = await Course.find(query)
            .populate({
                path: 'sections',
                populate: {
                    path: 'units',
                    populate: { path: 'lessons' }
                }
            });
        
        // Fallback: if no enrolled courses, return all published/available courses
        if (courses.length === 0) {
            courses = await Course.find({})
                .populate({
                    path: 'sections',
                    populate: {
                        path: 'units',
                        populate: { path: 'lessons' }
                    }
                });
        }

        res.json({ success: true, data: courses });
    } catch (err) { next(err); }
});

module.exports = router;

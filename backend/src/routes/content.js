const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Section = require('../models/Section');
const Unit = require('../models/Unit');
const Language = require('../models/Language');
const { auth } = require('../middleware/auth');

router.use(auth);

// Get full course hierarchy with language filtering
router.get('/hierarchy', async (req, res, next) => {
    try {
        const { lang } = req.query;
        let languageDoc = null;
        
        const langCode = lang || req.headers['accept-language'] || 'IZON';
        const cleanLangCode = langCode.includes(',') ? langCode.split(',')[0].trim() : langCode;
        
        languageDoc = await Language.findOne({ 
            $or: [
                { code: cleanLangCode.toUpperCase() },
                { name: new RegExp(`^${cleanLangCode}$`, 'i') }
            ]
        });
        if (!languageDoc) {
            languageDoc = await Language.findOne({ code: 'IZON' });
        }

        let query = {};
        if (languageDoc) {
            query.languageId = languageDoc._id;
        }

        // If user has enrolled courses, check which ones match the requested language
        if (req.user && req.user.enrolledCourses && req.user.enrolledCourses.length > 0) {
            const enrolledMatching = await Course.find({
                _id: { $in: req.user.enrolledCourses },
                ...(languageDoc ? { languageId: languageDoc._id } : {})
            });
            if (enrolledMatching.length > 0) {
                query._id = { $in: enrolledMatching.map(c => c._id) };
            }
        }

        let courses = await Course.find(query)
            .populate({
                path: 'sections',
                populate: {
                    path: 'units',
                    populate: { path: 'lessons' }
                }
            });
        
        // Fallback: if no courses found for query, return all courses for this language
        if (courses.length === 0 && languageDoc) {
            courses = await Course.find({ languageId: languageDoc._id })
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

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const practiceController = require('../controllers/practiceController');

const { auth } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

// All practice routes should be protected
router.use(auth);

router.get('/daily', cacheMiddleware(300, { authenticated: true }), practiceController.getDailyPractice);
router.post('/submit', practiceController.submitPracticeResult);
router.get('/stats', practiceController.getPracticeStats);
router.get('/forecast', cacheMiddleware(3600, { authenticated: true }), practiceController.getReviewForecast);

module.exports = router;

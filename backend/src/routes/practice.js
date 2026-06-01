const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const practiceController = require('../controllers/practiceController');

const { auth } = require('../middleware/auth');

// All practice routes should be protected
router.use(auth);

router.get('/daily', practiceController.getDailyPractice);
router.post('/submit', practiceController.submitPracticeResult);
router.get('/stats', practiceController.getPracticeStats);
router.get('/forecast', practiceController.getReviewForecast);

module.exports = router;

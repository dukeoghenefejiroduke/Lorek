const express = require('express');
const router = express.Router();
const Language = require('../models/Language');
const { cacheMiddleware } = require('../middleware/cache');

/**
 * Get all supported languages for the app
 * GET /api/languages
 */
router.get('/', cacheMiddleware(3600), async (req, res, next) => {
  try {
    const languages = await Language.getRegistry();
    
    res.json({
      success: true,
      data: languages,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

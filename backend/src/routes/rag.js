// backend/src/routes/rag.js
const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const { intensiveLimiter } = require('../middleware/rateLimit');

router.use(intensiveLimiter);

router.post('/ask', async (req, res) => {
  try {
    const { query, category } = req.body;
    
    // 1. Get embedding for the query
    // 2. Perform vector search (mocked for now)
    const context = await ragService.searchContext(query, category);
    
    // 3. Generate answer
    const answer = await ragService.generateAnswer(query, context);
    
    res.json({ answer, context });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

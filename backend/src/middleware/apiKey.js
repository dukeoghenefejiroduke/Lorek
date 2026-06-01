const { logger } = require('../config/logger');

// Store valid API keys (in production, these should be in database)
const validApiKeys = new Set([
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
].filter(Boolean));

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // Skip API key validation for authenticated routes
  if (req.user) {
    return next();
  }
  
  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
    });
  }
  
  // Validate API key
  if (!validApiKeys.has(apiKey) && apiKey !== process.env.MASTER_API_KEY) {
    logger.warn('Invalid API key attempt:', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
    });
    
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
  }
  
  next();
};

module.exports = { validateApiKey };
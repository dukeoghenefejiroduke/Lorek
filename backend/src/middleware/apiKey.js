const crypto = require('crypto');
const mongoose = require('mongoose');
const { logger } = require('../config/logger');

// Store valid static API keys from environment
const validApiKeys = new Set([
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
].filter(Boolean));

const validateApiKey = async (req, res, next) => {
  try {
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
    
    // 1. Check static env keys / master key
    if (validApiKeys.has(apiKey) || apiKey === process.env.MASTER_API_KEY) {
      return next();
    }
    
    // 2. Check user-generated API keys in MongoDB
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
      
    const User = mongoose.model('User');
    const user = await User.findOne({
      'security.apiKeys.key': hashedKey,
      'security.apiKeys.expiresAt': { $gt: new Date() }
    });
    
    if (user) {
      // Update lastUsed for this specific key asynchronously
      User.updateOne(
        { _id: user._id, 'security.apiKeys.key': hashedKey },
        { $set: { 'security.apiKeys.$.lastUsed': new Date() } }
      ).catch(e => logger.error('Failed to update API key lastUsed:', e));
      
      req.apiKeyUser = user;
      return next();
    }
    
    logger.warn('Invalid API key attempt:', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
    });
    
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
  } catch (err) {
    logger.error('API key validation error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during API key validation',
    });
  }
};

module.exports = { validateApiKey };

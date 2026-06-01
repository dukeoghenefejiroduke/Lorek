const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// Get all API keys for current user
router.get('/api-keys', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId || req.user?.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    
    const apiKeys = (user.security && user.security.apiKeys) ? user.security.apiKeys : [];
    
    // Return API keys without the actual key values (they're hashed)
    const keys = apiKeys.map(key => ({
      _id: key._id,
      name: key.name,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
      permissions: key.permissions,
    }));
    
    res.json({
      success: true,
      keys,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    next(error);
  }
});

// Generate new API key
router.post('/generate-api-key', auth, async (req, res) => {
  try {
    const { name = 'Default' } = req.body;
    const user = await User.findById(req.userId);
    
    // Generate API key
    const apiKey = 'izon_' + crypto.randomBytes(32).toString('hex');
    
    // Hash the API key for storage
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
    
    // Store hashed key with metadata
    user.security = user.security || {};
    user.security.apiKeys = user.security.apiKeys || [];
    
    user.security.apiKeys.push({
      key: hashedKey,
      name: name.trim(),
      permissions: ['read', 'translate'],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    });
    
    await user.save();
    
    // Return the actual key (only shown once)
    res.json({
      success: true,
      apiKey,
      message: 'API key generated successfully. Store it securely!',
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    next(error);
  }
});

// Revoke API key
router.delete('/api-keys/:keyId', auth, async (req, res) => {
  try {
    const { keyId } = req.params;
    const user = await User.findById(req.userId);
    
    // Remove the key
    user.security.apiKeys = user.security.apiKeys.filter(
      key => key._id.toString() !== keyId
    );
    
    await user.save();
    
    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    next(error);
  }
});

module.exports = router;
const redis = require('../config/redis');
const { logger } = require('../config/logger');

const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Skip cache for non-GET requests or if Redis is not connected
    if (req.method !== 'GET' || !redis.isConnected) {
      return next();
    }

    // Skip cache if user is authenticated (for personalized data)
    if (req.user) {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedResponse = await redis.get(key);
      
      if (cachedResponse) {
        // Serve cached response
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }

      // Store original send function
      const originalSend = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Cache the response
        redis.set(key, data, duration).catch(err => {
          logger.error('Failed to cache response:', err);
        });
        
        // Set cache header
        res.setHeader('X-Cache', 'MISS');
        
        // Call original send
        originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

module.exports = { cacheMiddleware };
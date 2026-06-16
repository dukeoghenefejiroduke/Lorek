const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

// Helper to create limiters with consistent defaults
const createLimiter = (options) => {
  return rateLimit({
    store: redis.client ? new RedisStore({
      client: redis.client,
      prefix: `rl:${options.name}:`,
      // Use the new ioredis-compatible way to handle RedisStore if needed
      // but assuming the current setup works with your redis.client
      sendCommand: (...args) => redis.client.call(...args),
    }) : undefined,
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: {
      success: false,
      error: options.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip health checks and monitoring
      const skipPaths = ['/health', '/live', '/ready', '/metrics'];
      if (skipPaths.includes(req.path)) return true;
      // Optional custom skip logic
      if (options.skip) return options.skip(req);
      return false;
    },
    ...options.extra
  });
};

// 1. Global API Limiter (Standard fallback)
const apiLimiter = createLimiter({
  name: 'api',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

// 2. Auth Limiter (Strict - for login/register)
const authLimiter = createLimiter({
  name: 'auth',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many authentication attempts, please try again later.',
  extra: {
    skipSuccessfulRequests: true
  }
});

// 3. Public Limiter (For public/unauthenticated routes)
const publicLimiter = createLimiter({
  name: 'public',
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many requests from this IP, please slow down.'
});

// 4. Content Limiter (For browsing lessons, vocabulary, community)
const contentLimiter = createLimiter({
  name: 'content',
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Browsing too fast? Please take a moment to absorb the knowledge.'
});

// 5. Search Limiter (Intensive CPU/DB usage)
const searchLimiter = createLimiter({
  name: 'search',
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Search rate limit exceeded. Please wait a minute.'
});

// 6. Intensive Limiter (For heavy operations like AI/RAG/Translation)
const intensiveLimiter = createLimiter({
  name: 'intensive',
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15,
  message: 'Intensive operation limit reached. These tasks take significant resources.'
});

// 7. Social Limiter (For messages, friend requests, notifications)
const socialLimiter = createLimiter({
  name: 'social',
  windowMs: 60 * 1000, // 1 minute
  max: 40,
  message: 'You are being very social! Please wait a moment.'
});

module.exports = {
  apiLimiter,
  authLimiter,
  publicLimiter,
  contentLimiter,
  searchLimiter,
  intensiveLimiter,
  socialLimiter,
};

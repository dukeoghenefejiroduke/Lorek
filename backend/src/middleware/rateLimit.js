const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

// General API rate limiter
const apiLimiter = rateLimit({
  store: redis.client ? new RedisStore({
    client: redis.client,
    prefix: 'url:api:',
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/live' || req.path === '/ready',
});

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
  store: redis.client ? new RedisStore({
    client: redis.client,
    prefix: 'rl:auth:',
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 login attempts per hour
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More generous rate limiter for public routes
const publicLimiter = rateLimit({
  store: redis.client ? new RedisStore({
    client: redis.client,
    prefix: 'rl:public:',
  }) : undefined,
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  publicLimiter,
};
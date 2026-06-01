const Redis = require('ioredis');
const { logger } = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true, // IMPORTANT: Since you call .connect() manually below
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis client connected');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis client error:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async keys(pattern) {
    if (!this.isConnected) return [];
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error:', error);
      return [];
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      // Try to parse JSON, but return raw value if it's just a string
      try {
        return JSON.parse(value);
      } catch (e) {
        return value; 
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Updated set method
   * Supports:
   * 1. set(key, value, ttl_in_seconds)
   * 2. set(key, value, { EX: seconds })
   */
  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;
    try {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
      
      if (typeof ttl === 'object' && ttl !== null) {
        // Handle { EX: seconds } or similar
        const args = [key, stringValue];
        if (ttl.EX) {
          args.push('EX', ttl.EX);
        } else if (ttl.PX) {
          args.push('PX', ttl.PX);
        }
        // Add other options if needed, or just pass them if ioredis supports it
        await this.client.set(...args);
      } else if (ttl) {
        // Syntax: set(key, value, 'EX', seconds)
        await this.client.set(key, stringValue, 'EX', ttl);
      } else {
        await this.client.set(key, stringValue);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  async setex(key, ttl, value) {
    return this.set(key, value, ttl);
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis del error:', error);
      return false;
    }
  }

  async flush() {
    if (!this.isConnected) return false;
    try {
      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Redis flush error:', error);
      return false;
    }
  }
}

module.exports = new RedisClient();

const { logger } = require('../config/logger');

// Global counters
global.requestCount = 0;
global.errorCount = 0;
global.totalResponseTime = 0;
global.averageResponseTime = 0;

// Request tracker middleware
const requestTracker = (req, res, next) => {
  global.requestCount++;
  
  // Track response time
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    global.totalResponseTime += duration;
    global.averageResponseTime = global.totalResponseTime / global.requestCount;
    
    // Track errors
    if (res.statusCode >= 400) {
      global.errorCount++;
    }
    
    // Log slow requests (over 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected:', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }
  });
  
  next();
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startUsage = process.cpuUsage();
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const cpuUsage = process.cpuUsage(startUsage);
    const memoryUsage = process.memoryUsage();
    
    const memoryDiff = {
      rss: memoryUsage.rss - startMemory.rss,
      heapTotal: memoryUsage.heapTotal - startMemory.heapTotal,
      heapUsed: memoryUsage.heapUsed - startMemory.heapUsed,
      external: memoryUsage.external - startMemory.external,
    };
    
    // Log if memory usage increased significantly
    if (memoryDiff.heapUsed > 10 * 1024 * 1024) { // 10MB
      logger.warn('High memory usage detected:', {
        url: req.originalUrl,
        memoryDiff: memoryDiff,
        cpuUser: cpuUsage.user,
        cpuSystem: cpuUsage.system,
      });
    }
  });
  
  next();
};

module.exports = {
  requestTracker,
  performanceMonitor,
};
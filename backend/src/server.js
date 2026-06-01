require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createStream } = require('rotating-file-stream');
const connectDB = require('./config/database');
const { logger, logStream } = require('./config/logger');
const redis = require('./config/redis');
const { auth } = require('./middleware/auth');
const { apiLimiter, authLimiter, publicLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestTracker, performanceMonitor } = require('./middleware/monitoring');
const { cacheMiddleware } = require('./middleware/cache');
const { validateApiKey } = require('./middleware/apiKey');
const languageContext = require('./middleware/languageContext');
const mongoose = require('mongoose');

// ============================================================================
// IMPORT ROUTES
// ============================================================================

const publicRouter = require('./routes/api'); // Public routes (no auth required)
const authRouter = require('./routes/auth'); // Authentication routes
const lessonsRouter = require('./routes/lessons'); // Lessons routes
const progressRouter = require('./routes/progress'); // Progress routes
const vocabularyRouter = require('./routes/vocabulary'); // Vocabulary routes
const adminRouter = require('./routes/admin'); // Admin routes 
const authApiKeysRoutes = require('./routes/auth-api-keys');
const translatorRoutes = require('./routes/translator');
const userRoutes = require('./routes/user');
const searchRoutes = require('./routes/search');
const referralRoutes = require('./routes/referral');
const leaderboardRoutes = require('./routes/leaderboard');
const gamesRoutes = require('./routes/games');
const cultureRoutes = require('./routes/culture');
const communityRoutes = require('./routes/community');
const notificationsRoutes = require('./routes/notifications');
const messagesRoutes = require('./routes/messages');
const practiceRoutes = require('./routes/practice');
const languageRoutes = require('./routes/language');
const premiumRoutes = require('./routes/premium');
const ragRoutes = require('./routes/rag');

const app = express();

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================

const ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = ENV === 'production';
const IS_DEVELOPMENT = ENV === 'development';
const IS_TEST = ENV === 'test';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

// Connect to MongoDB with advanced options
connectDB().then(() => {
  logger.info('✅ MongoDB connected successfully');
}).catch(err => {
  logger.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

// Connect to Redis for caching and rate limiting
redis.connect().then(() => {
  logger.info('✅ Redis connected successfully');
}).catch(err => {
  logger.warn('⚠️ Redis connection failed (continuing without cache):', err.message);
});

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet with custom configuration
app.use(helmet({
  contentSecurityPolicy: IS_PRODUCTION ? undefined : false,
  crossOriginEmbedderPolicy: IS_PRODUCTION,
  crossOriginOpenerPolicy: IS_PRODUCTION,
  crossOriginResourcePolicy: IS_PRODUCTION ? { policy: 'same-site' } : false,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: IS_PRODUCTION ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// CORS configuration
const corsOptions = {
  origin: IS_PRODUCTION 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://izonlanguage.com', 'https://app.izonlanguage.com']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'X-Refresh-Token', 'Accept-Language'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Request-ID'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options('/*splat', cors(corsOptions));

// ============================================================================
// PERFORMANCE MIDDLEWARE
// ============================================================================

// Compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Language Context
app.use(languageContext);

// ============================================================================
// LOGGING & MONITORING
// ============================================================================

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging
if (IS_PRODUCTION) {
  // Rotating log files in production
  const accessLogStream = createStream('access.log', {
    interval: '1d',
    path: path.join(__dirname, 'logs'),
    maxFiles: 30,
  });
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  // Console logging in development
  app.use(morgan('dev'));
}

// Custom request tracker for analytics
app.use(requestTracker);

// Performance monitoring
app.use(performanceMonitor);

// ============================================================================
// RATE LIMITING
// ============================================================================

// Global rate limiter
app.use(apiLimiter);

// Stricter rate limit for auth routes
app.use('/api/auth', authLimiter);

// Public routes rate limiter (more generous)
app.use('/api/public', publicLimiter);

// ============================================================================
// STATIC FILES
// ============================================================================

// Serve static files in production
if (IS_PRODUCTION) {
  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }));
}

// ============================================================================
// HEALTH CHECK & MONITORING ENDPOINTS
// ============================================================================

// Health check endpoint (no rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Izon Language API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV,
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  });
});

// Readiness probe for Kubernetes/Docker
app.get('/ready', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const redisState = redis.client?.status || 'disconnected';
  
  const isReady = dbState === 1 && redisState === 'ready';
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not ready',
    database: dbState === 1 ? 'connected' : 'disconnected',
    redis: redisState,
    timestamp: new Date().toISOString(),
  });
});

// Liveness probe
app.get('/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Metrics endpoint (protected)
app.get('/metrics', auth, async (req, res) => {
  try {
    const metrics = {
      requests: global.requestCount || 0,
      activeConnections: global.activeConnections || 0,
      responseTime: global.averageResponseTime || 0,
      errors: global.errorCount || 0,
      uptime: process.uptime(),
    };
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// API ROUTES
// ============================================================================

// API Root
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Learn Izon API! 🚀",
    status: "online",
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      public: '/api/public',
      auth: '/api/auth',
      lessons: '/api/lessons',
      vocabulary: '/api/vocabulary',
      progress: '/api/progress',
      admin: '/api/admin',
    },
    docs: IS_PRODUCTION ? 'https://docs.izonlanguage.com' : 'http://localhost:5000/api-docs',
    timestamp: new Date().toISOString(),
  });
});

// Public routes (with caching)
app.use('/api/public', cacheMiddleware(300), publicRouter); // 5 minutes cache

// Protected routes
app.use('/api/auth', authRouter);
app.use('/api/lessons', auth, lessonsRouter);
app.use('/api/progress', auth, progressRouter);
app.use('/api/vocabulary', vocabularyRouter);

// Admin routes (with additional authentication)
app.use('/api/admin', auth, adminRouter);


app.use('/api/auth', authApiKeysRoutes);

app.use('/api/translator', translatorRoutes); 

app.use('/api/user', userRoutes); 
app.use('/api/search', searchRoutes); 
app.use('/api/referral', referralRoutes); 
app.use('/api/notifications', notificationsRoutes); 
app.use('/api/leaderboard', leaderboardRoutes); 
app.use('/api/games', gamesRoutes); 
app.use('/api/culture',cultureRoutes);
app.use('/api/community', communityRoutes); 
app.use('/api/messages', messagesRoutes); 

app.use('/api/practice', practiceRoutes); 
app.use('/api/languages', languageRoutes);

app.use('/api/premium', premiumRoutes);
app.use('/api/rag', auth, ragRoutes);

// WebSocket for real-time features (optional)
if (IS_PRODUCTION) {
  const webSocketServer = require('./websocket');
  webSocketServer.initialize(app);
}

// ============================================================================
// AUTOMATION & SCHEDULED TASKS (Option A)
// ============================================================================

const cron = require('node-cron');

/**
 * Triggered daily at 8:00 AM
 * Broadcasts the Daily Proverb to all users
 */
cron.schedule('0 8 * * *', async () => {
  logger.info('⏰ Scheduled Task: Triggering Daily Proverb Broadcast...');
  try {
    // We call the logic we defined in the culture routes
    // Ensure you exported triggerDailyProverbNotification from that file
    if (cultureRoutes.triggerDailyProverbNotification) {
      await cultureRoutes.triggerDailyProverbNotification();
    } else {
      logger.warn('⚠️ triggerDailyProverbNotification not found in cultureRoutes');
    }
  } catch (err) {
    logger.error('❌ Scheduled Task Error:', err);
  }
}, {
  scheduled: true,
  timezone: "Africa/Lagos" // Set to your local timezone
});

// ============================================================================
// API DOCUMENTATION (Swagger)
// ============================================================================

if (IS_DEVELOPMENT) {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('./swagger.json');
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Izon API Documentation',
  }));
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler for undefined routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      
      // Close Redis connection
      if (redis.client) {
        await redis.client.quit();
        logger.info('Redis connection closed');
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = () => {
  let server;
  
  // Create HTTPS server in production
  if (IS_PRODUCTION && process.env.SSL_KEY && process.env.SSL_CERT) {
    const privateKey = fs.readFileSync(process.env.SSL_KEY, 'utf8');
    const certificate = fs.readFileSync(process.env.SSL_CERT, 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    
    server = https.createServer(credentials, app);
    logger.info('🔒 HTTPS server configured');
  } else {
    server = http.createServer(app);
  }
  
  // Start listening
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`
    🚀 Izon Language API Server
    ================================
    📡 Environment: ${ENV}
    🔌 Port: ${PORT}
    🌐 URL: http://0.0.0.0:${PORT}
    🔗 Public: http://0.0.0.0:${PORT}/api/public
    📚 API Docs: ${IS_DEVELOPMENT ? `http://localhost:${PORT}/api-docs` : 'https://docs.izonlanguage.com'}
    💾 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}
    ⚡ Redis: ${redis.client?.status || 'Not connected'}
    🕒 Started: ${new Date().toISOString()}
    ================================
    `);
  });
  
  // Track active connections
  global.activeConnections = 0;
  
  server.on('connection', (socket) => {
    global.activeConnections++;
    socket.on('close', () => {
      global.activeConnections--;
    });
  });
  
  return server;
};

// Start the server
const server = startServer();

// Export for testing
module.exports = { app, server };

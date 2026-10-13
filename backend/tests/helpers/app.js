const express = require('express');
const authRouter = require('../../src/routes/auth');
const lessonsRouter = require('../../src/routes/lessons');
const languageRoutes = require('../../src/routes/language');
const vocabularyRouter = require('../../src/routes/vocabulary');
const translatorRoutes = require('../../src/routes/translator');
const practiceRouter = require('../../src/routes/practice');
const progressRouter = require('../../src/routes/progress');
const gamesRouter = require('../../src/routes/games');
const leaderboardRouter = require('../../src/routes/leaderboard');
const communityRouter = require('../../src/routes/community');
const messagesRouter = require('../../src/routes/messages');
const referralRouter = require('../../src/routes/referral');
const premiumRouter = require('../../src/routes/premium');
const adminRouter = require('../../src/routes/admin');
const contentRouter = require('../../src/routes/content');
const ragRouter = require('../../src/routes/rag');
const { errorHandler, notFound } = require('../../src/middleware/errorHandler');

// Set test environment secret if not present
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_12345';
}

const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  
  // Mount routes under test
  app.use('/api/auth', authRouter);
  app.use('/api/lessons', lessonsRouter);
  app.use('/api/languages', languageRoutes);
  app.use('/api/vocabulary', vocabularyRouter);
  app.use('/api/translator', translatorRoutes);
  app.use('/api/practice', practiceRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/community', communityRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/referral', referralRouter);
  app.use('/api/premium', premiumRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/rag', ragRouter);
  
  // 404 & error handlers
  app.use(notFound);
  app.use(errorHandler);
  
  return app;
};

module.exports = { createTestApp };

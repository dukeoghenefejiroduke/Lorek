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
  
  // 404 & error handlers
  app.use(notFound);
  app.use(errorHandler);
  
  return app;
};

module.exports = { createTestApp };
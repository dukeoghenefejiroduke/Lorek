const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const PracticeSession = require('../src/models/PracticeSession');
const Vocabulary = require('../src/models/Vocabulary');

jest.mock('../src/models/User');
jest.mock('../src/models/PracticeSession');
jest.mock('../src/models/Vocabulary');
jest.mock('../src/controllers/srsController', () => ({
  updateMastery: jest.fn(),
  batchUpdateMastery: jest.fn(),
  getMasteryStats: jest.fn(),
  processMasteryUpdate: jest.fn().mockResolvedValue({
    mastery: { stage: 1, nextReview: new Date() },
    stage: 1,
    nextReview: new Date()
  }),
  calculateEnhancedSRS: jest.fn().mockResolvedValue({ mastery: {}, review: {} }),
}));
jest.mock('../src/services/notificationService', () => ({
  sendStreakReminder: jest.fn().mockResolvedValue(true),
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Practice & Progress API', () => {
  let validToken;

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
  });

  test('GET /api/practice/daily without token returns 401', async () => {
    const res = await request(app)
      .get('/api/practice/daily');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/progress/stats without token returns 401', async () => {
    const res = await request(app)
      .get('/api/progress/stats');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/progress/stats with valid token returns aggregated stats', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      status: 'active',
      vocabularyMastery: [
        { reviewCount: 5, correctCount: 4, masteryLevel: 'mastered' }
      ],
      progress: {
        streak: { current: 3 },
        totalPoints: 150,
        dailyProgress: 20,
        dailyGoal: 20
      }
    };

    const mockUserQuery = {
      select: jest.fn().mockResolvedValue(mockUser),
      then: (resolve) => resolve(mockUser),
    };
    User.findById.mockReturnValue(mockUserQuery);

    const res = await request(app)
      .get('/api/progress/stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalPractice).toBe(5);
    expect(res.body.data.correctAnswers).toBe(4);
    expect(res.body.data.streak).toBe(3);
    expect(res.body.data.points).toBe(150);
  });

  test('POST /api/practice/submit with valid input processes result', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      status: 'active',
      vocabularyMastery: [],
      progress: { streak: { current: 1 } },
      save: jest.fn().mockResolvedValue(true)
    };
    const mockUserQuery = {
      select: jest.fn().mockResolvedValue(mockUser),
      then: (resolve) => resolve(mockUser),
    };
    User.findById.mockReturnValue(mockUserQuery);

    const mockWord = {
      _id: '507f1f77bcf86cd799439013',
      word: 'Beni',
      izonWord: 'Beni',
      englishTranslation: 'Water',
      difficulty: 'easy'
    };
    const mockSession = {
      _id: '507f1f77bcf86cd799439014',
      userId: '507f1f77bcf86cd799439011',
      words: [{ wordId: '507f1f77bcf86cd799439013' }],
      completed: 0,
      settings: { wordsPerSession: 5 },
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn()
    };

    Vocabulary.findById.mockResolvedValue(mockWord);
    PracticeSession.findById.mockResolvedValue(mockSession);

    const res = await request(app)
      .post('/api/practice/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        sessionId: '507f1f77bcf86cd799439014',
        wordId: '507f1f77bcf86cd799439013',
        quality: 3,
        responseTime: 1500
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

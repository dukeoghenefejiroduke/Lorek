const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Lesson = require('../src/models/Lesson');
const PracticeSession = require('../src/models/PracticeSession');
const Vocabulary = require('../src/models/Vocabulary');

jest.mock('../src/models/User');
jest.mock('../src/models/Lesson');
jest.mock('../src/models/PracticeSession');
jest.mock('../src/models/Vocabulary');
jest.mock('../src/controllers/srsController', () => ({
  updateMastery: jest.fn(),
  batchUpdateMastery: jest.fn(),
  getMasteryStats: jest.fn(),
  processMasteryUpdate: jest.fn().mockResolvedValue({
    mastery: { stage: 2, nextReview: new Date() },
    stage: 2,
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

describe('End-to-End Learning Workflow', () => {
  let validToken;
  let mockUser;

  const mockQuery = (data) => ({
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(data),
    exec: jest.fn().mockResolvedValue(data),
    then: (resolve) => resolve(data),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'learner',
      status: 'active',
      vocabularyMastery: [
        { reviewCount: 3, correctCount: 3, masteryLevel: 'learning' }
      ],
      progress: {
        streak: { current: 4 },
        totalPoints: 200,
        dailyProgress: 10,
        dailyGoal: 20
      },
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockReturnValue(mockQuery(mockUser));
  });

  test('Complete Learning Journey: Auth -> Lessons -> Practice Submit -> Progress Stats', async () => {
    // Stage 1: Verify authentication & token validation via progress stats endpoint
    const statsResBefore = await request(app)
      .get('/api/progress/stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(statsResBefore.status).toBe(200);
    expect(statsResBefore.body.success).toBe(true);
    expect(statsResBefore.body.data.streak).toBe(4);

    // Stage 2: Retrieve lessons
    const mockLessons = [
      {
        _id: '507f1f77bcf86cd799439020',
        title: { english: 'Advanced Greetings' },
        status: 'published',
        toObject: function() { return this; }
      }
    ];
    Lesson.find.mockReturnValue(mockQuery(mockLessons));
    Lesson.countDocuments.mockResolvedValue(1);
    Lesson.distinct.mockResolvedValue(['Greetings']);

    const lessonsRes = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${validToken}`);

    expect(lessonsRes.status).toBe(200);
    expect(lessonsRes.body.success).toBe(true);

    // Stage 3: Submit practice answer
    const mockWord = {
      _id: '507f1f77bcf86cd799439013',
      word: 'Beni',
      language_id: '507f1f77bcf86cd799439020'
    };
    const mockSession = {
      _id: '507f1f77bcf86cd799439014',
      userId: '507f1f77bcf86cd799439011',
      words: [{ wordId: '507f1f77bcf86cd799439013', reviewedAt: null }],
      completed: 0,
      settings: { wordsPerSession: 5 },
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn()
    };

    Vocabulary.findById.mockResolvedValue(mockWord);
    PracticeSession.findById.mockResolvedValue(mockSession);
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const practiceRes = await request(app)
      .post('/api/practice/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        sessionId: '507f1f77bcf86cd799439014',
        wordId: '507f1f77bcf86cd799439013',
        quality: 3,
        responseTime: 1100,
        confidence: 4
      });

    expect(practiceRes.status).toBe(200);
    expect(practiceRes.body.success).toBe(true);

    // Stage 4: Retrieve updated progress stats
    const statsResAfter = await request(app)
      .get('/api/progress/stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(statsResAfter.status).toBe(200);
    expect(statsResAfter.body.success).toBe(true);
    expect(statsResAfter.body.data.points).toBe(200);
  });

  test('Unauthenticated learning request is rejected with 401', async () => {
    const res = await request(app).get('/api/lessons');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

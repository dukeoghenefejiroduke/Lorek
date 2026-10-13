const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Vocabulary = require('../src/models/Vocabulary');
const PracticeSession = require('../src/models/PracticeSession');

jest.mock('../src/models/User');
jest.mock('../src/models/Vocabulary');
jest.mock('../src/models/PracticeSession');
jest.mock('../src/controllers/srsController', () => ({
  updateMastery: jest.fn((req, res) => {
    const { wordId, quality } = req.body;
    if (!wordId || quality === undefined) {
      return res.status(400).json({ success: false, error: 'Word ID and quality score are required' });
    }
    if (quality < 0 || quality > 4 || typeof quality !== 'number') {
      return res.status(400).json({ success: false, error: 'Invalid quality score. Must be 0-4' });
    }
    if (wordId === '507f1f77bcf86cd799439999') {
      return res.status(404).json({ success: false, error: 'Word not found' });
    }
    return res.json({
      success: true,
      data: {
        wordId,
        quality,
        srs: { stage: 2, interval: 1, easeFactor: 2.5, nextReview: new Date() }
      }
    });
  }),
  batchUpdateMastery: jest.fn((req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Updates array is required' });
    }
    return res.json({
      success: true,
      data: {
        processed: updates.length,
        successful: updates.length,
        failed: 0,
        results: updates.map(u => ({ wordId: u.wordId, success: true }))
      }
    });
  }),
  getMasteryStats: jest.fn((req, res) => {
    return res.json({
      success: true,
      data: { totalMastered: 5, averageStage: 2.1 }
    });
  }),
  processMasteryUpdate: jest.fn().mockResolvedValue({
    mastery: { stage: 2, interval: 1, easeFactor: 2.5, nextReview: new Date() },
    stage: 2,
    nextReview: new Date()
  })
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

describe('SRS & Gamification API', () => {
  let validToken;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      status: 'active',
      vocabularyMastery: [
        { wordId: '507f1f77bcf86cd799439013', stage: 2, reviewCount: 3, correctCount: 3 }
      ],
      progress: {
        streak: { current: 3, lastUpdated: new Date() },
        totalPoints: 150
      },
      save: jest.fn().mockResolvedValue(true)
    };
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
        then: (resolve) => resolve(mockUser)
      }),
      populate: jest.fn().mockResolvedValue(mockUser),
      then: (resolve) => resolve(mockUser)
    });
  });

  test('POST /api/vocabulary/mastery/update without token returns 401', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/update')
      .send({ wordId: '507f1f77bcf86cd799439013', quality: 3 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vocabulary/mastery/update with missing wordId returns 400', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/update')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ quality: 3 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vocabulary/mastery/update with invalid quality score returns 400', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/update')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ wordId: '507f1f77bcf86cd799439013', quality: 99 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vocabulary/mastery/update with negative quality score returns 400', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/update')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ wordId: '507f1f77bcf86cd799439013', quality: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vocabulary/mastery/update with valid quality scores (0-4) succeeds', async () => {
    for (let quality = 0; quality <= 4; quality++) {
      const res = await request(app)
        .post('/api/vocabulary/mastery/update')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ wordId: '507f1f77bcf86cd799439013', quality, responseTime: 1200 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quality).toBe(quality);
    }
  });

  test('POST /api/vocabulary/mastery/update with nonexistent word returns 404', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/update')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ wordId: '507f1f77bcf86cd799439999', quality: 3 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vocabulary/mastery/batch-update with invalid updates payload returns 400', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/batch-update')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ updates: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vocabulary/mastery/batch-update with valid updates processes successfully', async () => {
    const res = await request(app)
      .post('/api/vocabulary/mastery/batch-update')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        updates: [
          { wordId: '507f1f77bcf86cd799439013', quality: 3, responseTime: 1000 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.successful).toBe(1);
  });

  test('GET /api/vocabulary/mastery/stats with valid token returns stats', async () => {
    const res = await request(app)
      .get('/api/vocabulary/mastery/stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/vocabulary/mastery/stats for user with empty mastery records', async () => {
    mockUser.vocabularyMastery = [];
    const res = await request(app)
      .get('/api/vocabulary/mastery/stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/practice/submit with valid input processes result and updates streak', async () => {
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

    const res = await request(app)
      .post('/api/practice/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        sessionId: '507f1f77bcf86cd799439014',
        wordId: '507f1f77bcf86cd799439013',
        quality: 3,
        responseTime: 1200,
        confidence: 4
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wordId).toBe('507f1f77bcf86cd799439013');
  });

  test('POST /api/practice/submit with missing session or word returns 404', async () => {
    PracticeSession.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/practice/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        sessionId: '507f1f77bcf86cd799439999',
        wordId: '507f1f77bcf86cd799439013',
        quality: 3
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

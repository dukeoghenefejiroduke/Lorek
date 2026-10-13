const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Vocabulary = require('../src/models/Vocabulary');
const GameSession = require('../src/models/GameSession');

jest.mock('../src/models/User');
jest.mock('../src/models/Vocabulary');
jest.mock('../src/models/GameSession');
jest.mock('../src/services/notificationService', () => ({
  sendAchievementUnlocked: jest.fn().mockResolvedValue(true),
  sendLeaderboardUpdate: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/services/xpService', () => ({
  addXP: jest.fn().mockResolvedValue(true),
  addExperience: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Games & Leaderboard API', () => {
  let validToken;
  let mockUser;

  const mockQuery = (data) => {
    const q = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(data),
      then: (resolve) => resolve(data),
    };
    return q;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'testuser',
      status: 'active',
      profile: { avatar: { url: 'http://example.com/avatar.jpg' } },
      progress: {
        totalPoints: 200,
        streak: { current: 5 },
        badges: ['badge1'],
        lessonStats: { totalCompleted: 3 },
        gameStats: {}
      },
      vocabularyMastery: [{ wordId: '507f1f77bcf86cd799439013', reviewCount: 5, correctCount: 4 }],
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockReturnValue(mockQuery(mockUser));
    User.findOne.mockReturnValue(mockQuery(mockUser));
  });

  // ============================================================================
  // AUTHENTICATION & SECURITY TESTS
  // ============================================================================

  test('GET /api/games/stats without token returns 401', async () => {
    const res = await request(app).get('/api/games/stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/games/start without token returns 401', async () => {
    const res = await request(app).post('/api/games/start').send({ gameType: 'quiz' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/leaderboard without token returns 401', async () => {
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/leaderboard/rank without token returns 401', async () => {
    const res = await request(app).get('/api/leaderboard/rank');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ============================================================================
  // GAMES API TESTS
  // ============================================================================

  test('POST /api/games/start with valid quiz type creates session and returns questions', async () => {
    const mockWords = [
      { _id: '507f1f77bcf86cd799439013', izonWord: 'Beni', englishTranslation: 'Water', category: 'nature', difficulty: 'easy' },
      { _id: '507f1f77bcf86cd799439014', izonWord: 'Toru', englishTranslation: 'Sun', category: 'nature', difficulty: 'easy' }
    ];
    Vocabulary.find.mockReturnValue(mockQuery(mockWords));

    const mockSavedSession = {
      _id: '507f1f77bcf86cd799439020',
      user: '507f1f77bcf86cd799439011',
      gameType: 'quiz',
      questions: [{ questionId: '507f1f77bcf86cd799439013', questionData: { question: 'What does "Beni" mean?', correctAnswer: 'Water', options: ['Water', 'Sun'] } }],
      maxScore: 10,
      startedAt: new Date(),
      save: jest.fn().mockResolvedValue(true)
    };
    GameSession.mockImplementation(() => mockSavedSession);

    const res = await request(app)
      .post('/api/games/start')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ gameType: 'quiz', questionCount: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe('507f1f77bcf86cd799439020');
  });

  test('POST /api/games/start with invalid gameType returns 400', async () => {
    const res = await request(app)
      .post('/api/games/start')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ gameType: 'invalid_game' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/games/submit with invalid sessionId format returns 400', async () => {
    const res = await request(app)
      .post('/api/games/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ sessionId: 'bad_id', answers: [], timeSpent: 10 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/games/submit with nonexistent session returns 404', async () => {
    GameSession.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/games/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ sessionId: '507f1f77bcf86cd799439020', answers: [], timeSpent: 10 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/games/stats returns user game statistics', async () => {
    const mockSessions = [
      { percentage: 80, score: 40, gameType: 'quiz', completed: true },
      { percentage: 60, score: 30, gameType: 'quiz', completed: true }
    ];
    GameSession.countDocuments.mockResolvedValue(2);
    GameSession.find.mockReturnValue(mockQuery(mockSessions));

    const res = await request(app)
      .get('/api/games/stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overall.totalGamesPlayed).toBe(2);
  });

  // ============================================================================
  // LEADERBOARD API TESTS
  // ============================================================================

  test('GET /api/leaderboard with valid category returns sorted leaderboard', async () => {
    const mockUsers = [
      {
        _id: '507f1f77bcf86cd799439011',
        username: 'alice',
        status: 'active',
        progress: { totalPoints: 300, streak: { current: 10 }, badges: ['b1'] }
      },
      {
        _id: '507f1f77bcf86cd799439012',
        username: 'bob',
        status: 'active',
        progress: { totalPoints: 150, streak: { current: 3 }, badges: [] }
      }
    ];

    User.find.mockReturnValue(mockQuery(mockUsers));
    User.countDocuments.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/leaderboard?category=points&period=weekly')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.leaderboard.length).toBe(2);
    expect(res.body.data.leaderboard[0].username).toBe('alice');
    expect(res.body.data.leaderboard[0].rank).toBe(1);
    expect(res.body.data.leaderboard[1].username).toBe('bob');
    expect(res.body.data.leaderboard[1].rank).toBe(2);
  });

  test('GET /api/leaderboard with empty users collection handles empty leaderboard gracefully', async () => {
    User.find.mockReturnValue(mockQuery([]));
    User.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/leaderboard?category=points')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.leaderboard).toEqual([]);
  });

  test('GET /api/leaderboard with invalid category returns 400', async () => {
    const res = await request(app)
      .get('/api/leaderboard?category=invalid_cat')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/leaderboard/rank returns user ranks across categories', async () => {
    User.countDocuments.mockResolvedValue(5);
    User.find.mockReturnValue(mockQuery([mockUser]));

    const res = await request(app)
      .get('/api/leaderboard/rank')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

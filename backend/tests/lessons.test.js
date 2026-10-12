const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Lesson = require('../src/models/Lesson');

jest.mock('../src/models/User');
jest.mock('../src/models/Lesson');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Lessons API', () => {
  let validToken;

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
  });

  test('GET /api/lessons without token returns 401', async () => {
    const res = await request(app)
      .get('/api/lessons');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/lessons with valid token returns lessons list', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      status: 'active',
    };

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const mockLessons = [
      { 
        _id: '507f1f77bcf86cd799439012', 
        title: { english: 'Basic Greetings' }, 
        status: 'published',
        toObject: function() { return this; }
      }
    ];

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockLessons),
      exec: jest.fn().mockResolvedValue(mockLessons),
      then: (resolve) => resolve(mockLessons),
    };
    Lesson.find.mockReturnValue(mockQuery);
    Lesson.countDocuments.mockResolvedValue(1);
    Lesson.distinct.mockResolvedValue(['Greetings']);

    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/lessons/:id with valid ID returns 404 when not found', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      status: 'active',
    };

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const mockFindByIdQuery = {
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(null),
    };
    Lesson.findById.mockReturnValue(mockFindByIdQuery);

    const validMongoId = '507f1f77bcf86cd799439012';
    const res = await request(app)
      .get(`/api/lessons/${validMongoId}`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

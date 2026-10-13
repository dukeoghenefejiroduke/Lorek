const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Lesson = require('../src/models/Lesson');
const Vocabulary = require('../src/models/Vocabulary');
const Progress = require('../src/models/Progress');

jest.mock('../src/models/User');
jest.mock('../src/models/Lesson');
jest.mock('../src/models/Vocabulary');
jest.mock('../src/models/Progress');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Admin API', () => {
  let adminToken;
  let regularToken;
  let adminUser;
  let regularUser;

  const mockQuery = (data) => ({
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(data),
    then: (resolve) => resolve(data),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adminToken = jwt.sign(
      { id: '507f1f77bcf86cd799439099' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
    regularToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );

    adminUser = {
      _id: '507f1f77bcf86cd799439099',
      username: 'adminuser',
      role: 'admin',
      status: 'active'
    };

    regularUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'regularuser',
      role: 'user',
      status: 'active'
    };
  });

  test('GET /api/admin/dashboard without token returns 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/admin/dashboard with regular user token returns 403', async () => {
    User.findById.mockReturnValue(mockQuery(regularUser));

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${regularToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/admin/dashboard with admin token returns dashboard stats', async () => {
    User.findById.mockReturnValue(mockQuery(adminUser));
    User.countDocuments.mockResolvedValue(10);
    Lesson.countDocuments.mockResolvedValue(5);
    Vocabulary.countDocuments.mockResolvedValue(50);
    Progress.countDocuments.mockResolvedValue(25);
    User.find.mockReturnValue(mockQuery([]));
    Lesson.find.mockReturnValue(mockQuery([]));
    User.aggregate.mockResolvedValue([]);
    Lesson.aggregate.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview.totalUsers).toBe(10);
  });
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Lesson = require('../src/models/Lesson');
const Vocabulary = require('../src/models/Vocabulary');
const Progress = require('../src/models/Progress');
const Conversation = require('../src/models/Conversation');

jest.mock('../src/models/User');
jest.mock('../src/models/Lesson');
jest.mock('../src/models/Vocabulary');
jest.mock('../src/models/Progress');
jest.mock('../src/models/Conversation');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Authorization & Private-Data Access Security Tests', () => {
  let regularToken;
  let adminToken;
  let regularUser;
  let adminUser;

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
    regularToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
    adminToken = jwt.sign(
      { id: '507f1f77bcf86cd799439099' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );

    regularUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'regularuser',
      role: 'user',
      status: 'active',
      save: jest.fn().mockResolvedValue(true)
    };

    adminUser = {
      _id: '507f1f77bcf86cd799439099',
      username: 'adminuser',
      role: 'admin',
      status: 'active',
      save: jest.fn().mockResolvedValue(true)
    };
  });

  test('Unauthenticated request to protected admin route returns 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Regular user attempting admin route (GET /api/admin/dashboard) returns 403', async () => {
    User.findById.mockReturnValue(mockQuery(regularUser));

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${regularToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Regular user attempting admin route (POST /api/lessons) returns 403', async () => {
    User.findById.mockReturnValue(mockQuery(regularUser));

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ title: { english: 'Test' } });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Admin user successfully accessing admin route (GET /api/admin/dashboard)', async () => {
    User.findById.mockReturnValue(mockQuery(adminUser));
    User.countDocuments.mockResolvedValue(5);
    Lesson.countDocuments.mockResolvedValue(2);
    Vocabulary.countDocuments.mockResolvedValue(20);
    Progress.countDocuments.mockResolvedValue(10);
    const mockModelQuery = (data) => ({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(data),
      then: (resolve) => resolve(data),
    });
    User.find.mockReturnValue(mockModelQuery([]));
    Lesson.find.mockReturnValue(mockModelQuery([]));
    User.aggregate.mockResolvedValue([]);
    Lesson.aggregate.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Unauthenticated request to user-specific private messages returns 401', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

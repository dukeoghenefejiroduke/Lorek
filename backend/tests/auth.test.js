const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const notificationService = require('../src/services/notificationService');
const emailService = require('../src/services/emailService');

jest.mock('../src/models/User');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/emailService');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/auth/register with valid input', async () => {
    User.findOne.mockResolvedValue(null);
    User.prototype.save.mockResolvedValue(true);
    User.prototype.generateEmailVerificationToken = jest.fn().mockReturnValue('mock_token');
    User.prototype.toPublicJSON = jest.fn().mockReturnValue({ username: 'testuser', email: 'test@example.com' });
    notificationService.sendWelcome.mockResolvedValue(true);
    emailService.sendVerificationEmail.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  test('POST /api/auth/register with invalid input (short username)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ab',
        email: 'invalid',
        password: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  test('POST /api/auth/login with valid credentials', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      status: 'active',
      security: { failedLoginAttempts: 0 },
      comparePassword: jest.fn().mockResolvedValue(true),
      generateAuthToken: jest.fn().mockReturnValue('mock_jwt_token'),
      generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
      toPublicJSON: jest.fn().mockReturnValue({ email: 'test@example.com' }),
      save: jest.fn().mockResolvedValue(true),
    };

    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('mock_jwt_token');
  });

  test('POST /api/auth/login with invalid credentials', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrong@example.com',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/lessons without token returns 401', async () => {
    const res = await request(app)
      .get('/api/lessons');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

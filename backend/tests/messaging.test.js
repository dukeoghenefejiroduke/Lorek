const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');

jest.mock('../src/models/User');
jest.mock('../src/models/Conversation');
jest.mock('../src/models/Message');
jest.mock('../src/services/notificationService', () => ({
  sendMessageNotification: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Messaging API', () => {
  let validToken;
  let mockUser;

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
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'testuser',
      status: 'active',
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockReturnValue(mockQuery(mockUser));
  });

  test('GET /api/messages/conversations without token returns 401', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/messages/conversation without token returns 401', async () => {
    const res = await request(app).post('/api/messages/conversation').send({ userId: '507f1f77bcf86cd799439012' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/messages/conversation with self userId returns 400', async () => {
    const res = await request(app)
      .post('/api/messages/conversation')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ userId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/messages/conversation with nonexistent target user returns 404', async () => {
    User.findById.mockReturnValueOnce(mockQuery(mockUser)).mockReturnValueOnce(mockQuery(null));

    const res = await request(app)
      .post('/api/messages/conversation')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ userId: '507f1f77bcf86cd799439999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/messages/conversation with valid target user creates or returns conversation', async () => {
    const targetUser = { _id: '507f1f77bcf86cd799439012', username: 'otheruser' };
    User.findById.mockReturnValueOnce(mockQuery(mockUser)).mockReturnValueOnce(mockQuery(targetUser));

    const mockConv = {
      _id: '507f1f77bcf86cd799439050',
      participants: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      populate: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };
    Conversation.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockConv),
      then: (resolve) => resolve(mockConv)
    });
    Conversation.mockImplementation(() => mockConv);

    const res = await request(app)
      .post('/api/messages/conversation')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ userId: '507f1f77bcf86cd799439012' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

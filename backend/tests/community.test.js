const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');

jest.mock('../src/models/User');
jest.mock('../src/models/Post');
jest.mock('../src/services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Community API', () => {
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
      friends: [],
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockReturnValue(mockQuery(mockUser));
  });

  test('GET /api/community/feed without token returns 401', async () => {
    const res = await request(app).get('/api/community/feed');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/community/posts without token returns 401', async () => {
    const res = await request(app).post('/api/community/posts').send({ content: 'Hello' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/community/feed with valid token returns feed posts', async () => {
    const mockPosts = [
      {
        _id: '507f1f77bcf86cd799439020',
        content: 'Learning Izon is fun!',
        likes: [],
        comments: [],
        toObject: function() { return { ...this }; }
      }
    ];

    Post.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockPosts),
      then: (resolve) => resolve(mockPosts)
    });
    Post.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/community/feed')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].content).toBe('Learning Izon is fun!');
  });

  test('POST /api/community/posts with valid content creates post successfully', async () => {
    const mockCreatedPost = {
      _id: '507f1f77bcf86cd799439030',
      content: 'New community post',
      user: { username: 'testuser' },
      populate: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };
    Post.mockImplementation(() => mockCreatedPost);

    const res = await request(app)
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'New community post', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('New community post');
  });

  test('POST /api/community/posts with empty content returns 400', async () => {
    const res = await request(app)
      .post('/api/community/posts')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/community/posts/:postId/like with nonexistent post returns 404', async () => {
    Post.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/community/posts/507f1f77bcf86cd799439999/like')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

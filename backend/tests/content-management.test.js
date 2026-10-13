const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Language = require('../src/models/Language');

jest.mock('../src/models/User');
jest.mock('../src/models/Course');
jest.mock('../src/models/Language');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Content Management API', () => {
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
      enrolledCourses: [],
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockReturnValue(mockQuery(mockUser));
  });

  test('GET /api/content/hierarchy without token returns 401', async () => {
    const res = await request(app).get('/api/content/hierarchy');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/content/hierarchy with valid token returns course hierarchy', async () => {
    const mockLanguage = { _id: '507f1f77bcf86cd799439020', code: 'IZON' };
    const mockCourses = [
      {
        _id: '507f1f77bcf86cd799439030',
        title: { english: 'Beginner Izon' },
        sections: []
      }
    ];

    Language.findOne.mockResolvedValue(mockLanguage);
    Course.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCourses),
      then: (resolve) => resolve(mockCourses)
    });

    const res = await request(app)
      .get('/api/content/hierarchy')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title.english).toBe('Beginner Izon');
  });
});

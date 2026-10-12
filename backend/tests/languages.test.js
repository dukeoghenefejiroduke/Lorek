const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const Language = require('../src/models/Language');
const User = require('../src/models/User');

jest.mock('../src/models/Language');
jest.mock('../src/models/User');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Languages API', () => {
  let validToken;

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test_jwt_secret_12345'
    );
  });

  test('GET /api/languages returns language registry', async () => {
    const mockLanguages = [
      { code: 'IZO', name: 'Izon', nativeName: 'Izon', isActive: true }
    ];
    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(mockLanguages),
      then: (resolve) => resolve(mockLanguages),
    };
    Language.find.mockReturnValue(mockQuery);

    const res = await request(app)
      .get('/api/languages');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockLanguages);
  });

  test('GET /api/languages/:code returns specific language', async () => {
    const mockLang = { code: 'IZO', name: 'Izon', isActive: true };
    Language.findOne.mockResolvedValue(mockLang);

    const res = await request(app)
      .get('/api/languages/IZO');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('IZO');
  });

  test('GET /api/languages/user/active without auth returns 401', async () => {
    const res = await request(app)
      .get('/api/languages/user/active');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/languages/user/active with valid auth returns active language', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      status: 'active',
      activeLanguage: { code: 'IZO', name: 'Izon' }
    };
    const mockUserQuery = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(mockUser),
      then: (resolve) => resolve(mockUser),
    };
    User.findById.mockReturnValue(mockUserQuery);

    const res = await request(app)
      .get('/api/languages/user/active')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

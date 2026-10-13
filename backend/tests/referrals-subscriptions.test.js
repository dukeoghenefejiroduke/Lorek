const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/app');
const User = require('../src/models/User');

jest.mock('../src/models/User');
jest.mock('../src/services/premiumService', () => ({
  getUserPlan: jest.fn().mockResolvedValue({ plan: 'free', features: [] }),
  getPricing: jest.fn().mockReturnValue({ plans: [{ id: 'pro', price: 9.99 }] }),
  hasFeature: jest.fn().mockResolvedValue(true),
  checkUsageLimit: jest.fn().mockResolvedValue({ used: 1, limit: 10 }),
  trackUsage: jest.fn().mockResolvedValue(true),
}));
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

describe('Referrals & Subscriptions API', () => {
  let validToken;
  let mockUser;

  const mockQuery = (data) => ({
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
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
      referral: {
        code: 'TES-123456',
        stats: { totalReferrals: 2, activeReferrals: 1, pointsEarned: 1000 },
        referredUsers: [],
        claimedRewards: []
      },
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockReturnValue(mockQuery(mockUser));
  });

  test('GET /api/referral/referral-stats without token returns 401', async () => {
    const res = await request(app).get('/api/referral/referral-stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/premium/status without token returns 401', async () => {
    const res = await request(app).get('/api/premium/status');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/referral/referral-stats with valid token returns stats', async () => {
    const res = await request(app)
      .get('/api/referral/referral-stats')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalReferrals).toBe(2);
  });

  test('GET /api/referral/referral-code returns referral code and link', async () => {
    const res = await request(app)
      .get('/api/referral/referral-code')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('TES-123456');
  });

  test('GET /api/premium/status returns user plan and features', async () => {
    const res = await request(app)
      .get('/api/premium/status')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan).toBe('free');
  });

  test('GET /api/premium/pricing returns pricing plans', async () => {
    const res = await request(app)
      .get('/api/premium/pricing')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans).toBeDefined();
  });

  test('GET /api/premium/feature/:featureName checks feature access', async () => {
    const res = await request(app)
      .get('/api/premium/feature/offline_mode')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hasAccess).toBe(true);
  });
});

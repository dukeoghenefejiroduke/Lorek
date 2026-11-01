const request = require('supertest');
const express = require('express');
const { apiLimiter, authLimiter, publicLimiter } = require('../src/middleware/rateLimit');

describe('Rate Limit Middleware & Key Generation', () => {
  test('apiLimiter applies rate limit headers correctly', async () => {
    const app = express();
    app.use(apiLimiter);
    app.get('/test', (req, res) => res.json({ success: true }));

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  test('publicLimiter handles IPv4 requests correctly', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use(publicLimiter);
    app.get('/ipv4', (req, res) => res.json({ success: true }));

    const res = await request(app)
      .get('/ipv4')
      .set('X-Forwarded-For', '192.168.1.100');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  test('publicLimiter handles IPv6 subnet grouping correctly', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use(publicLimiter);
    app.get('/ipv6', (req, res) => res.json({ success: true }));

    const res = await request(app)
      .get('/ipv6')
      .set('X-Forwarded-For', '2001:db8:85a3::8a2e:370:7334');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  test('publicLimiter handles missing IP addresses with anonymous fallback', async () => {
    const app = express();
    app.use((req, res, next) => {
      // Simulate missing IP and connection remote address
      req.ip = undefined;
      req.connection = { remoteAddress: undefined };
      next();
    });
    app.use(publicLimiter);
    app.get('/anonymous', (req, res) => res.json({ success: true }));

    const res = await request(app).get('/anonymous');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});

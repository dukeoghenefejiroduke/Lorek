const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const ragService = require('../src/services/ragService');

jest.mock('../src/services/ragService', () => ({
  searchContext: jest.fn().mockResolvedValue([{ text: 'Izon grammar rule' }]),
  generateAnswer: jest.fn().mockResolvedValue('Here is the explanation...'),
}));
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('RAG & Retrieval API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/rag/ask with valid query returns answer and context', async () => {
    const res = await request(app)
      .post('/api/rag/ask')
      .send({ query: 'How do you say hello in Izon?', category: 'greeting' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.context).toBeDefined();
    expect(ragService.searchContext).toHaveBeenCalledWith('How do you say hello in Izon?', 'greeting');
    expect(ragService.generateAnswer).toHaveBeenCalled();
  });
});

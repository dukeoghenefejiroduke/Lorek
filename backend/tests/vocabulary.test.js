const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const Vocabulary = require('../src/models/Vocabulary');
const Language = require('../src/models/Language');

jest.mock('../src/models/Vocabulary');
jest.mock('../src/models/Language');
jest.mock('../src/models/User');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Vocabulary API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/vocabulary returns vocabulary list', async () => {
    const mockVocab = [
      { _id: '507f1f77bcf86cd799439013', izonWord: 'Beni', englishTranslation: 'Water', category: 'nouns' }
    ];

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockVocab),
      exec: jest.fn().mockResolvedValue(mockVocab),
      then: (resolve) => resolve(mockVocab),
    };
    Vocabulary.find.mockReturnValue(mockQuery);
    Vocabulary.countDocuments.mockResolvedValue(1);
    Vocabulary.distinct.mockResolvedValue([]);

    const mockLangQuery = {
      select: jest.fn().mockResolvedValue([{ name: 'Izon', code: 'IZO' }]),
      then: (resolve) => resolve([{ name: 'Izon', code: 'IZO' }]),
    };
    Language.find.mockReturnValue(mockLangQuery);

    const res = await request(app)
      .get('/api/vocabulary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/vocabulary/search returns search results', async () => {
    const mockResults = [
      { _id: '507f1f77bcf86cd799439013', izonWord: 'Beni', englishTranslation: 'Water' }
    ];

    const mockSearchQuery = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockResults),
      exec: jest.fn().mockResolvedValue(mockResults),
      then: (resolve) => resolve(mockResults),
    };
    Vocabulary.find.mockReturnValue(mockSearchQuery);
    Vocabulary.countDocuments.mockResolvedValue(1);
    Vocabulary.distinct.mockResolvedValue([]);

    const mockLangQuery = {
      select: jest.fn().mockResolvedValue([{ name: 'Izon', code: 'IZO' }]),
      then: (resolve) => resolve([{ name: 'Izon', code: 'IZO' }]),
    };
    Language.find.mockReturnValue(mockLangQuery);

    const res = await request(app)
      .get('/api/vocabulary/search?q=Water');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

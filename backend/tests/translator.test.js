const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const TranslationEngineFactory = require('../src/translation/TranslationEngineFactory');

jest.mock('../src/translation/TranslationEngineFactory');
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(true),
}));

const app = createTestApp();

describe('Translator API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/translator/translate with missing text returns 400', async () => {
    const res = await request(app)
      .post('/api/translator/translate')
      .send({ to: 'izo' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/translator/translate with empty text returns 400', async () => {
    const res = await request(app)
      .post('/api/translator/translate')
      .send({ text: '   ', to: 'izo' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/translator/translate with missing target language (to) returns 400', async () => {
    const res = await request(app)
      .post('/api/translator/translate')
      .send({ text: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/translator/translate with unsupported language returns engine error', async () => {
    TranslationEngineFactory.getEngine.mockReturnValue(null);

    const res = await request(app)
      .post('/api/translator/translate')
      .send({ text: 'hello', to: 'unsupported-lang' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.translations['unsupported-lang'].error).toBe('Translation engine not supported');
  });

  test('POST /api/translator/translate with supported language translates successfully', async () => {
    const mockEngine = {
      translate: jest.fn().mockResolvedValue({
        translated: 'beni',
        confidence: 0.95,
        type: 'direct',
        provider: 'local-pack'
      })
    };
    TranslationEngineFactory.getEngine.mockReturnValue(mockEngine);

    const res = await request(app)
      .post('/api/translator/translate')
      .send({ text: 'water', to: 'izo' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.translations.izo.translated).toBe('beni');
  });
});

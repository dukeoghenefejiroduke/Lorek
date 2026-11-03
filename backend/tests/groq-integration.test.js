const axios = require('axios');
const ragService = require('../src/services/ragService');

jest.mock('axios');

describe('Groq RAG Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generateAnswer calls Groq API with correct payload and headers and returns content', async () => {
    process.env.GROQ_API_KEY = 'test-groq-key';

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: 'Hello in Izon is Bọ̀ọ̀ụ̀.'
            }
          }
        ]
      }
    });

    const answer = await ragService.generateAnswer('How do you say hello in Izon?', [{ text: 'Greeting context' }]);

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        model: 'openai/gpt-oss-20b',
        messages: expect.any(Array)
      }),
      {
        headers: { Authorization: 'Bearer test-groq-key' }
      }
    );
    expect(answer).toBe('Hello in Izon is Bọ̀ọ̀ụ̀.');
  });

  test('generateAnswer handles API error gracefully and returns null', async () => {
    process.env.GROQ_API_KEY = 'test-groq-key';

    axios.post.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const answer = await ragService.generateAnswer('Test query', []);

    expect(answer).toBeNull();
  });
});

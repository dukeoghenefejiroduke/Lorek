const { calculateContextRelevance, calculateLearningMetrics } = require('../src/controllers/srsController');

describe('SRS Scoring & Context Relevance Unit Tests', () => {
  const sampleWord = {
    word: 'mmiri',
    izonWord: 'mmiri',
    englishTranslation: 'water',
    category: 'nature',
    difficulty: 'beginner'
  };

  test('calculateContextRelevance returns neutral score (0.5) when context or word is missing', () => {
    expect(calculateContextRelevance(null, sampleWord)).toBe(0.5);
    expect(calculateContextRelevance('water context', null)).toBe(0.5);
    expect(calculateContextRelevance(null, null)).toBe(0.5);
  });

  test('calculateContextRelevance detects word/izonWord match in string context', () => {
    const score = calculateContextRelevance('Drinking mmiri on a hot day', sampleWord);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('calculateContextRelevance detects english translation match in string context', () => {
    const score = calculateContextRelevance('Cold water is refreshing', sampleWord);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('calculateContextRelevance detects category match in string context', () => {
    const score = calculateContextRelevance('This belongs to nature category', sampleWord);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('calculateContextRelevance handles object context', () => {
    const objContext = { text: 'Drinking mmiri', category: 'nature' };
    const score = calculateContextRelevance(objContext, sampleWord);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('calculateContextRelevance returns baseline for irrelevant context', () => {
    const score = calculateContextRelevance('unrelated text about space exploration', sampleWord);
    expect(score).toBe(0.5);
  });

  test('calculateContextRelevance respects score bounds [0.0, 1.0]', () => {
    const highMatchWord = { word: 'test', izonWord: 'test', englishTranslation: 'test', category: 'test' };
    const score = calculateContextRelevance('test test test test', highMatchWord);
    expect(score).toBeLessThanOrEqual(1.0);
    expect(score).toBeGreaterThanOrEqual(0.0);
  });

  test('calculateLearningMetrics successfully computes metrics including contextRelevance', () => {
    const current = { reviewCount: 1, reviewHistory: [{ quality: 4 }] };
    const metrics = calculateLearningMetrics({
      quality: 4,
      responseTime: 3,
      current,
      word: sampleWord,
      context: 'Drinking mmiri water in nature',
      mistakes: []
    });

    expect(metrics).toBeDefined();
    expect(metrics.quality).toBe(4);
    expect(metrics.accuracy).toBe(1.0);
    expect(metrics.contextRelevance).toBeGreaterThan(0.5);
    expect(metrics.wordComplexity).toBeDefined();
  });
});

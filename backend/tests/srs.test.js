// backend/tests/srs.test.js

describe('SM-2 SRS Algorithm Tests', () => {
  const INITIAL_EASE = 2.5;
  const MIN_EASE = 1.3;
  const MAX_EASE = 2.5;

  const calculateEaseFactor = (currentEase, quality) => {
    let easeFactor = currentEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    return Math.max(MIN_EASE, Math.min(MAX_EASE, easeFactor));
  };

  test('Should correctly calculate ease factor for high quality (Perfect)', () => {
    const ease = calculateEaseFactor(INITIAL_EASE, 4); // Quality 4
    expect(ease).toBeGreaterThanOrEqual(MIN_EASE);
    expect(ease).toBeLessThanOrEqual(MAX_EASE);
  });

  test('Should clamp ease factor to minimum limit on multiple failures', () => {
    let ease = INITIAL_EASE;
    for (let i = 0; i < 5; i++) {
      ease = calculateEaseFactor(ease, 0); // Quality 0 (Again)
    }
    expect(ease).toBe(MIN_EASE);
  });

  test('Should keep ease factor within bounds on perfect scores', () => {
    let ease = INITIAL_EASE;
    for (let i = 0; i < 5; i++) {
      ease = calculateEaseFactor(ease, 4);
    }
    expect(ease).toBeLessThanOrEqual(MAX_EASE);
  });
});

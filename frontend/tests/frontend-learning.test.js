import { normalizeText, validateAnswer } from '../src/utils/answerValidator';

describe('Frontend Learning Journey & Answer Validation Tests', () => {
  test('normalizeText handles unicode NFC normalization, lowercase, and punctuation', () => {
    expect(normalizeText('Mmíri')).toBe('mmíri');
    expect(normalizeText('  Ọmọ! ')).toBe('ọmọ');
  });

  test('validateAnswer handles alternative acceptable answers and case insensitivity', () => {
    const correct = 'water';
    const alternatives = ['liquid', 'drink'];
    expect(validateAnswer('WATER', correct, alternatives)).toBe(true);
    expect(validateAnswer('liquid', correct, alternatives)).toBe(true);
    expect(validateAnswer('juice', correct, alternatives)).toBe(false);
  });

  test('lesson completion threshold logic', () => {
    const calculateCompletionStatus = (correctCount, totalCount) => {
      if (!totalCount || totalCount <= 0) return { passed: false, percentage: 0 };
      const percentage = Math.round((correctCount / totalCount) * 100);
      return {
        passed: percentage >= 70,
        percentage
      };
    };

    expect(calculateCompletionStatus(8, 10)).toEqual({ passed: true, percentage: 80 });
    expect(calculateCompletionStatus(5, 10)).toEqual({ passed: false, percentage: 50 });
    expect(calculateCompletionStatus(0, 0)).toEqual({ passed: false, percentage: 0 });
  });

  test('streak calculation logic', () => {
    const updateStreakOnActivity = (currentStreak, lastActiveDate, today = new Date('2026-10-31')) => {
      if (!lastActiveDate) return 1;
      const last = new Date(lastActiveDate);
      const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return currentStreak; // Already active today
      if (diffDays === 1) return currentStreak + 1; // Consecutive day
      return 1; // Streak reset
    };

    expect(updateStreakOnActivity(5, '2026-10-30', new Date('2026-10-31'))).toBe(6);
    expect(updateStreakOnActivity(5, '2026-10-31', new Date('2026-10-31'))).toBe(5);
    expect(updateStreakOnActivity(5, '2026-10-25', new Date('2026-10-31'))).toBe(1);
  });
});

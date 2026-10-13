// frontend/tests/app-logic.test.js
import { normalizeText, validateAnswer } from '../src/utils/answerValidator';

describe('Answer Validator Utilities', () => {
  test('normalizeText handles empty, whitespace, and punctuation', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText('  Beni!  ')).toBe('beni');
    expect(normalizeText('Water, please.')).toBe('water please');
  });

  test('validateAnswer matches exact, normalized, and alternative answers', () => {
    expect(validateAnswer('Water', 'water')).toBe(true);
    expect(validateAnswer('  beni! ', 'Beni')).toBe(true);
    expect(validateAnswer('H2O', 'Water', ['H2O', 'Liquid'])).toBe(true);
    expect(validateAnswer('Milk', 'Water', ['Juice'])).toBe(false);
    expect(validateAnswer('', 'Water')).toBe(false);
  });
});

describe('Streak & Goal Logic', () => {
  const checkGoalCompletion = (user) => {
    const dailyGoal = user?.preferences?.dailyGoal || 10;
    const minutesToday = user?.progress?.lessonStats?.dailyProgress || 0;
    return minutesToday >= dailyGoal;
  };

  test('checkGoalCompletion checks daily goal vs progress', () => {
    const userMet = {
      preferences: { dailyGoal: 10 },
      progress: { lessonStats: { dailyProgress: 12 } }
    };
    const userUnmet = {
      preferences: { dailyGoal: 10 },
      progress: { lessonStats: { dailyProgress: 5 } }
    };
    const userDefault = {};

    expect(checkGoalCompletion(userMet)).toBe(true);
    expect(checkGoalCompletion(userUnmet)).toBe(false);
    expect(checkGoalCompletion(userDefault)).toBe(false);
  });
});

describe('Lesson Completion Calculations', () => {
  test('lesson completion score calculation', () => {
    const totalExercises = 10;
    const correctAnswers = 9;
    const score = Math.round((correctAnswers / totalExercises) * 100);
    expect(score).toBe(90);
  });

  test('prerequisite check logic', () => {
    const userCompletedLessons = ['lesson1'];
    const lessonPrereqs = ['lesson1'];
    const met = lessonPrereqs.every(p => userCompletedLessons.includes(p));
    expect(met).toBe(true);
  });
});

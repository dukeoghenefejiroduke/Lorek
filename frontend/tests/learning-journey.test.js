// frontend/tests/learning-journey.test.js

describe('Lessons Filtering & Search Logic (LessonsScreen Simulation)', () => {
  const sampleLessons = [
    { id: '1', level: 'beginner', title: { english: 'Greetings' }, description: { english: 'Learn basic hellos' } },
    { id: '2', level: 'intermediate', title: { english: 'Family' }, description: { english: 'Family members in Izon' } },
    { id: '3', level: 'beginner', title: 'Numbers', description: 'Count 1 to 10' },
  ];

  const filterLessons = (lessons, filter, searchQuery) => {
    const lessonsArray = Array.isArray(lessons) ? lessons : [];
    let filtered = [...lessonsArray];

    if (filter && filter !== 'all') {
      filtered = filtered.filter(lesson => lesson?.level === filter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lesson =>
        (lesson?.title?.english || lesson?.title || '').toLowerCase().includes(query) ||
        (lesson?.description?.english || lesson?.description || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  test('filters lessons correctly by level', () => {
    const beginnerLessons = filterLessons(sampleLessons, 'beginner', '');
    expect(beginnerLessons.length).toBe(2);
    expect(beginnerLessons[0].id).toBe('1');
    expect(beginnerLessons[1].id).toBe('3');

    const intermediateLessons = filterLessons(sampleLessons, 'intermediate', '');
    expect(intermediateLessons.length).toBe(1);
    expect(intermediateLessons[0].id).toBe('2');
  });

  test('filters lessons correctly by search query', () => {
    const searchResult = filterLessons(sampleLessons, 'all', 'family');
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].id).toBe('2');

    const searchResultTitle = filterLessons(sampleLessons, 'beginner', 'numbers');
    expect(searchResultTitle.length).toBe(1);
    expect(searchResultTitle[0].id).toBe('3');
  });

  test('handles malformed or non-array lesson inputs safely', () => {
    expect(filterLessons(null, 'all', '')).toEqual([]);
    expect(filterLessons(undefined, 'beginner', 'test')).toEqual([]);
    expect(filterLessons('not-an-array', 'all', '')).toEqual([]);
  });
});

describe('Practice & Daily Goal Progress Service Logic', () => {
  const calculateDailyGoalProgress = (currentProgress, earnedMinutes, dailyGoal = 10) => {
    const updated = Math.max(0, (currentProgress || 0) + (earnedMinutes || 0));
    return {
      progress: updated,
      goalMet: updated >= dailyGoal,
      percentage: Math.min(100, Math.round((updated / dailyGoal) * 100))
    };
  };

  test('calculates daily goal progress and completion correctly', () => {
    const res1 = calculateDailyGoalProgress(5, 5, 10);
    expect(res1).toEqual({ progress: 10, goalMet: true, percentage: 100 });

    const res2 = calculateDailyGoalProgress(2, 3, 10);
    expect(res2).toEqual({ progress: 5, goalMet: false, percentage: 50 });

    const res3 = calculateDailyGoalProgress(12, 5, 10);
    expect(res3).toEqual({ progress: 17, goalMet: true, percentage: 100 });
  });

  test('handles missing or null progress inputs safely', () => {
    const res = calculateDailyGoalProgress(null, null, 10);
    expect(res).toEqual({ progress: 0, goalMet: false, percentage: 0 });
  });
});

describe('Streak Calculation & Reset Logic', () => {
  const updateStreak = (currentStreak, lastActiveDate, today = new Date('2026-10-31')) => {
    if (!lastActiveDate) return 1;
    const last = new Date(lastActiveDate);
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return currentStreak; // Already active today
    if (diffDays === 1) return currentStreak + 1; // Consecutive day
    return 1; // Streak reset due to missed day(s)
  };

  test('maintains streak when active today', () => {
    expect(updateStreak(4, '2026-10-31', new Date('2026-10-31'))).toBe(4);
  });

  test('increments streak on consecutive day', () => {
    expect(updateStreak(4, '2026-10-30', new Date('2026-10-31'))).toBe(5);
  });

  test('resets streak if days missed', () => {
    expect(updateStreak(4, '2026-10-28', new Date('2026-10-31'))).toBe(1);
  });

  test('handles missing last active date', () => {
    expect(updateStreak(5, null)).toBe(1);
  });
});

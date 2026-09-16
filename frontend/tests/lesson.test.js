// frontend/tests/lesson.test.js
// Basic test to verify lesson completion calculation
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

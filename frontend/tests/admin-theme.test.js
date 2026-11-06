// frontend/tests/admin-theme.test.js

describe('Admin & Theme Logic', () => {
  test('Admin role verification', () => {
    const adminUser = { username: 'adminuser', role: 'admin' };
    const regularUser = { username: 'john', role: 'user' };
    const guestUser = null;

    const isAdmin = (user) => !!(user && user.role === 'admin');

    expect(isAdmin(adminUser)).toBe(true);
    expect(isAdmin(regularUser)).toBe(false);
    expect(isAdmin(guestUser)).toBe(false);
  });

  test('Theme switcher state calculation', () => {
    const toggleThemeState = (isDark) => !isDark;

    expect(toggleThemeState(false)).toBe(true);
    expect(toggleThemeState(true)).toBe(false);
  });

  test('Vocabulary creation payload formatting', () => {
    const vocabData = {
      izonWord: ' Adú ',
      english: ' Water ',
      category: 'nature',
      difficulty: 'beginner',
      partOfSpeech: 'noun',
      pronunciation: 'ah-DOO',
      tags: 'common, essential'
    };

    const formatPayload = (data, selectedLang, isPublished) => ({
      izonWord: data.izonWord.trim(),
      englishTranslation: data.english.trim(),
      category: data.category,
      difficulty: data.difficulty,
      lang: selectedLang,
      isPublished: isPublished,
      grammar: { partOfSpeech: data.partOfSpeech },
      pronunciation: { phonetic: data.pronunciation.trim() },
      tags: data.tags.split(',').map(t => t.trim())
    });

    const payload = formatPayload(vocabData, 'IZON', true);

    expect(payload.izonWord).toBe('Adú');
    expect(payload.englishTranslation).toBe('Water');
    expect(payload.lang).toBe('IZON');
    expect(payload.isPublished).toBe(true);
    expect(payload.grammar.partOfSpeech).toBe('noun');
    expect(payload.pronunciation.phonetic).toBe('ah-DOO');
    expect(payload.tags).toEqual(['common', 'essential']);
  });

  test('Course hierarchy structure formatting', () => {
    const rawHierarchy = [
      {
        _id: 'c1',
        title: { english: 'Beginner Course' },
        sections: [
          { _id: 's1', title: { english: 'Section 1: Greetings' } }
        ]
      }
    ];

    const processed = rawHierarchy.map(course => ({
      id: course._id,
      title: course.title.english,
      sectionCount: course.sections.length
    }));

    expect(processed[0].id).toBe('c1');
    expect(processed[0].title).toBe('Beginner Course');
    expect(processed[0].sectionCount).toBe(1);
  });
});

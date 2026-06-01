require('dotenv').config();
const mongoose = require('mongoose');
const Language = require('../models/Language');

const languages = [
  {
    code: 'IZON',
    name: 'Izon',
    nativeName: 'Ịzọn',
    description: 'Izon (Ijaw) is a language spoken by the Ijaw people in the Niger Delta region of Nigeria.',
    region: 'Niger Delta, Nigeria',
    icon: '🌊',
    color: '#4CAF50',
    difficulty: 'beginner',
    totalWords: 150,
    totalLessons: 12,
    totalSpeakers: 2000000,
    order: 1,
    features: {
      hasAudio: true,
      hasPronunciation: true,
      hasGrammar: true,
      hasCulture: true,
    },
  },
  {
    code: 'OGBIA',
    name: 'Ogbia',
    nativeName: 'Ọgbiạ',
    description: 'Ogbia is a dialect of the Izon language spoken in parts of Bayelsa State.',
    region: 'Bayelsa, Nigeria',
    icon: '🐟',
    color: '#2196F3',
    difficulty: 'intermediate',
    totalWords: 80,
    totalLessons: 8,
    totalSpeakers: 500000,
    order: 2,
    features: {
      hasAudio: false,
      hasPronunciation: true,
      hasGrammar: true,
      hasCulture: true,
    },
  },
  {
    code: 'KOLOKUMA',
    name: 'Kolokuma',
    nativeName: 'Kọlọkụma',
    description: 'Kolokuma is a major dialect of the Izon language.',
    region: 'Bayelsa, Nigeria',
    icon: '🏝️',
    color: '#FF9800',
    difficulty: 'intermediate',
    totalWords: 100,
    totalLessons: 10,
    totalSpeakers: 300000,
    order: 3,
    features: {
      hasAudio: false,
      hasPronunciation: true,
      hasGrammar: true,
      hasCulture: true,
    },
  },
  {
    code: 'EPIE',
    name: 'Epie',
    nativeName: 'Epie',
    description: 'Epie is an Edoid language spoken in Bayelsa State, often associated with the Izon cultural sphere.',
    region: 'Bayelsa, Nigeria',
    icon: '🌳',
    color: '#9C27B0',
    difficulty: 'beginner',
    totalWords: 50,
    totalLessons: 5,
    totalSpeakers: 200000,
    order: 4,
    features: {
      hasAudio: false,
      hasPronunciation: true,
      hasGrammar: true,
      hasCulture: true,
    },
  },
  {
    code: 'EN',
    name: 'English',
    nativeName: 'English',
    description: 'Global lingua franca and official language of Nigeria.',
    region: 'Worldwide',
    icon: '🌍',
    color: '#607D8B',
    difficulty: 'beginner',
    totalWords: 0,
    totalLessons: 0,
    totalSpeakers: 1500000000,
    order: 0,
    features: {
      hasAudio: true,
      hasPronunciation: true,
      hasGrammar: true,
      hasCulture: false,
    },
  },
];

async function seedLanguages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Clear existing languages
    await Language.deleteMany({});

    // Insert new languages
    const inserted = await Language.insertMany(languages);
    inserted.forEach(lang => {
    });

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedLanguages();
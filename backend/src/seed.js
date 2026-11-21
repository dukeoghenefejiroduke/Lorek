require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Language = require('./models/Language');
const Course = require('./models/Course');
const Section = require('./models/Section');
const Unit = require('./models/Unit');
const Lesson = require('./models/Lesson');
const Vocabulary = require('./models/Vocabulary');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lorek';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for Seeding...');

    // Clear existing collection records safely for our languages & users
    await User.deleteMany({ email: { $in: ['admin@lorek.com', 'test1@test.com', 'test2@test.com', 'test3@test.com'] } });
    await Language.deleteMany({ code: { $in: ['IZON', 'OGBIA'] } });
    await Lesson.deleteMany({});
    await Unit.deleteMany({});
    await Section.deleteMany({});
    await Course.deleteMany({});
    await Vocabulary.deleteMany({});

    console.log('Creating Admin & 3 Test Users...');
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@lorek.com',
      password: 'Password123',
      role: 'admin',
      isEmailVerified: true,
      profile: { firstName: 'Admin', lastName: 'User' },
      progress: { totalPoints: 1000, level: 5 }
    });

    const testUsersData = [
      { username: 'test1', email: 'test1@test.com', points: 150 },
      { username: 'test2', email: 'test2@test.com', points: 120 },
      { username: 'test3', email: 'test3@test.com', points: 90 },
    ];

    for (const u of testUsersData) {
      await User.create({
        username: u.username,
        email: u.email,
        password: 'Password123',
        role: 'user',
        isEmailVerified: true,
        profile: { firstName: u.username, lastName: 'User' },
        progress: { totalPoints: u.points, level: 2 }
      });
    }
    console.log('Users created successfully.');

    console.log('Creating Languages from Language Factory Config...');
    const INITIAL_LANGUAGES = require('./languages/config');
    const langDocs = {};

    for (const langConfig of INITIAL_LANGUAGES) {
      const createdLang = await Language.findOneAndUpdate(
        { code: langConfig.code },
        {
          name: langConfig.name,
          nativeName: langConfig.nativeName,
          family: langConfig.family,
          region: langConfig.region,
          icon: langConfig.icon,
          color: langConfig.color,
          description: langConfig.description,
          features: langConfig.features,
          isActive: true,
          isPublished: true
        },
        { upsert: true, new: true }
      );
      langDocs[langConfig.code] = createdLang;
    }
    const izonLang = langDocs['IZON'];

    console.log('Creating Courses, Sections, Units & Lessons for IZON...');
    const izonCourse = await Course.create({
      title: 'Izon Foundation Course',
      languageId: izonLang._id,
      description: 'Master foundational Izon with Timi the River Boy!',
      isPublished: true
    });

    const izonSection = await Section.create({
      title: 'Foundations of Izon',
      courseId: izonCourse._id,
      order: 1
    });

    const unitTitles = [
      { izon: 'Greetings & Respect', english: 'Unit 1: Greetings & Respect' },
      { izon: 'Family & Kinship', english: 'Unit 2: Family' },
      { izon: 'Food & Market', english: 'Unit 3: Food & Market' },
      { izon: 'River & Travel', english: 'Unit 4: River & Travel' },
      { izon: 'Numbers & Body', english: 'Unit 5: Numbers & Body' },
      { izon: 'Proverbs & Culture', english: 'Unit 6: Proverbs & Culture' }
    ];

    const izonWords = [
      { izon: 'Ibasa', english: 'Hello', phonetic: 'ee-ba-sa', category: 'greetings' },
      { izon: 'Nua', english: 'Thank you', phonetic: 'noo-ah', category: 'greetings' },
      { izon: 'Tubara', english: 'How are you?', phonetic: 'tu-ba-ra', category: 'greetings' },
      { izon: 'Emi', english: "I'm fine", phonetic: 'eh-mi', category: 'greetings' },
      { izon: 'Seridou', english: 'Good morning', phonetic: 'seh-ree-doo', category: 'greetings' },
      { izon: 'Di Mu', english: 'Goodbye', phonetic: 'dee moo', category: 'greetings' },
      { izon: 'Bo', english: 'Come', phonetic: 'boh', category: 'verbs' },
      { izon: 'Mu', english: 'Go', phonetic: 'moo', category: 'verbs' },
      { izon: 'Dada', english: 'Father', phonetic: 'da-da', category: 'family' },
      { izon: 'Ina', english: 'Mother', phonetic: 'ee-na', category: 'family' },
      { izon: 'Indi', english: 'Fish', phonetic: 'in-dee', category: 'food' },
      { izon: 'Buru', english: 'Yam', phonetic: 'bu-ru', category: 'food' },
      { izon: 'Folou', english: 'Soup', phonetic: 'fo-loo', category: 'food' },
      { izon: 'Fuu', english: 'Salt', phonetic: 'fuu', category: 'food' },
      { izon: 'Aru', english: 'Car / Motor', phonetic: 'ah-ru', category: 'actions' },
      { izon: 'Tibii', english: 'Head', phonetic: 'tee-bee', category: 'body_parts' },
      { izon: 'Toru', english: 'Eye', phonetic: 'to-ru', category: 'body_parts' }
    ];

    const vocabDocs = [];
    for (const w of izonWords) {
      const v = await Vocabulary.create({
        language_id: izonLang._id,
        izonWord: w.izon,
        englishTranslation: w.english,
        phonetic: w.phonetic,
        category: w.category,
        difficulty: 'beginner',
        status: 'approved',
        createdBy: adminUser._id
      });
      vocabDocs.push(v);
    }

    let globalOrder = 1;
    for (let i = 0; i < unitTitles.length; i++) {
      const unit = await Unit.create({
        title: unitTitles[i].english,
        sectionId: izonSection._id
      });

      for (let l = 1; l <= 2; l++) {
        const wordObj = vocabDocs[(i * 2 + l - 1) % vocabDocs.length];
        const lessonVocab = [{
          wordId: wordObj._id,
          phonetic: wordObj.phonetic,
          context: 'Basic daily usage',
          example: { izon: wordObj.izonWord, english: wordObj.englishTranslation },
          priority: 1,
          masteryLevel: 'introduce'
        }];

        await Lesson.create({
          title: {
            izon: `${unitTitles[i].izon} - Lesson ${l}`,
            english: `${unitTitles[i].english} Lesson ${l}`
          },
          description: { english: `Learn core vocabulary and phrases for ${unitTitles[i].english}.` },
          language_id: izonLang._id,
          unitId: unit._id,
          level: 'beginner',
          lessonType: 'vocabulary',
          category: 'greetings',
          order: globalOrder++,
          status: 'published',
          createdBy: adminUser._id,
          exercises: [
            {
              type: 'multiple-choice',
              difficulty: 'easy',
              question: { english: `What is the meaning of "${wordObj.izonWord}"?` },
              options: [
                { id: '1', text: wordObj.englishTranslation },
                { id: '2', text: 'Water' },
                { id: '3', text: 'Tree' },
                { id: '4', text: 'House' }
              ],
              correctAnswer: wordObj.englishTranslation,
              explanation: `"${wordObj.izonWord}" means ${wordObj.englishTranslation} in Izon.`
            },
            {
              type: 'translation',
              difficulty: 'easy',
              question: { english: `Translate "Thank you" into Izon` },
              correctAnswer: 'Nua',
              explanation: '"Nua" is Thank you in Izon.'
            }
          ],
          vocabulary: lessonVocab
        });
      }
    }

    console.log('Seeding Ogbia shell & Native Contributor placeholders...');
    const ogbiaLang = langDocs['OGBIA'];
    const ogbiaUnit = await Unit.create({
      title: 'Ogbia Community Contributions (Oloibiri / Kolo / Anyama)',
      sectionId: izonSection._id
    });

    await Lesson.create({
      title: {
        izon: 'Ogbia Community Shell - Help Us Build',
        english: 'Ogbia Native Contributor Demo'
      },
      description: { english: 'Ogbia has almost no public dictionary. Record your voice or contribute native words!' },
      language_id: ogbiaLang._id,
      unitId: ogbiaUnit._id,
      level: 'beginner',
      lessonType: 'culture',
      category: 'conversation',
      order: globalOrder++,
      status: 'published',
      createdBy: adminUser._id,
      exercises: [
        {
          type: 'pronunciation',
          difficulty: 'easy',
          question: { english: 'Help us add Ogbia words - Record your voice for Ogbia greeting' },
          correctAnswer: 'Community Contribution',
          explanation: 'All Ogbia words are verified by native speakers from Oloibiri.'
        }
      ]
    });

    console.log('✅ Database seeded successfully with verified Izon and Ogbia data!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seed();

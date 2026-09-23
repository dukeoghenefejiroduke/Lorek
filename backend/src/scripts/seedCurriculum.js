require('dotenv').config();

console.log('Starting seedCurriculum.js');

const mongoose = require('mongoose');

const Unit = require('../models/Unit');
const Lesson = require('../models/Lesson');
const Section = require('../models/Section');
const Course = require('../models/Course');
const Language = require('../models/Language');
const Module = require('../models/Module');
const Vocabulary = require('../models/Vocabulary');

// ============================================================
// CURRICULUM
// ============================================================

const curriculum = [
  // ==========================================================
  // UNIT 1
  // ==========================================================

  {
    unit: 'Unit 1 — Greetings & Introductions',

    lessons: [
      {
        title: 'Basic Greetings',
        type: 'vocabulary',
        category: 'greetings',

        content: {
          introduction: {
            english: 'Learn common greetings used when meeting someone in Izon.',
            izon: 'Izon greetings.'
          },

          // vocabulary: [
          //   {
          //     izon: 'Wari',
          //     english: 'Hello'
          //   },
          //   {
          //     izon: 'Sere',
          //     english: 'Goodbye'
          //   }
          // ],

          grammar: [],

          examples: [
            {
              izon: 'Wari',
              english: 'Hello'
            },
            {
              izon: 'Sere',
              english: 'Goodbye'
            }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',

            question: {
              english: 'How do you say Hello in Izon?',
              izon: 'Wari?'
            },

            options: [
              {
                id: 'a',
                english: 'Wari',
                izon: 'Wari',
                isCorrect: true
              },
              {
                id: 'b',
                english: 'Sere',
                izon: 'Sere',
                isCorrect: false
              }
            ],

            points: 10
          },

          {
            type: 'translation',
            difficulty: 'easy',

            question: {
              english: 'Translate: Hello',
              izon: 'Hello'
            },

            correctAnswer: {
              english: 'Wari',
              izon: 'Wari'
            },

            points: 15
          },

          {
            type: 'fill-blank',
            difficulty: 'easy',

            question: {
              english: 'Complete: ____ means Hello.',
              izon: 'Complete: ____ means Hello.'
            },

            correctAnswer: 'Wari',

            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Saying Your Name',
        type: 'grammar',
        category: 'greetings',

        content: {
          introduction: {
            english: 'Learn how to introduce yourself and say your name.',
            izon: '...'
          },

          vocabulary: [],

          grammar: [
            {
              title: {
                english: 'Self-Introduction'
              },

              explanation: {
                english:
                  'Learn the Izon structure used to introduce yourself.'
              }
            }
          ],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: "Asking Someone's Name",
        type: 'conversation',
        category: 'greetings',

        content: {
          introduction: {
            english:
              "Learn how to ask someone their name in Izon.",
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Basic Politeness',
        type: 'culture',
        category: 'greetings',

        content: {
          introduction: {
            english:
              'Learn useful polite expressions and respectful communication.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: [
            {
              english:
                'Politeness and respectful greetings are important when interacting with others.'
            }
          ]
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english:
              'Review the greetings and introductions from Unit 1.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      }
    ]
  },

  // ==========================================================
  // UNIT 2
  // ==========================================================

  {
    unit: 'Unit 2 — People & Family',

    lessons: [
      {
        title: 'Family Vocabulary',
        type: 'vocabulary',
        category: 'family',

        content: {
          introduction: {
            english:
              'Learn common words for family members.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'People & Relationships',
        type: 'vocabulary',
        category: 'family',

        content: {
          introduction: {
            english:
              'Learn words used to describe people and relationships.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Possession',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english:
              'Learn how possession is expressed in Izon.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Describing People',
        type: 'grammar',
        category: 'descriptions',

        content: {
          introduction: {
            english:
              'Learn how to describe people using simple expressions.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english:
              'Review people, relationships, possession and descriptions.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      }
    ]
  },

  // ==========================================================
  // UNIT 3
  // ==========================================================

  {
    unit: 'Unit 3 — Everyday Words',

    lessons: [
      {
        title: 'Common Objects',
        type: 'vocabulary',
        category: 'work',

        content: {
          introduction: {
            english:
              'Learn the names of common everyday objects.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Food & Drink',
        type: 'vocabulary',
        category: 'food',

        content: {
          introduction: {
            english:
              'Learn common words for food and drinks.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Places',
        type: 'vocabulary',
        category: 'travel',

        content: {
          introduction: {
            english:
              'Learn words for common places.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Basic Actions',
        type: 'grammar',
        category: 'work',

        content: {
          introduction: {
            english:
              'Learn basic expressions for everyday actions.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english:
              'Review everyday objects, food, places and actions.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      }
    ]
  },

  // ==========================================================
  // UNIT 4
  // ==========================================================

  {
    unit: 'Unit 4 — Basic Sentences',

    lessons: [
      {
        title: 'Simple Statements',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english:
              'Learn how to form simple statements.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Questions',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english:
              'Learn how to ask basic questions.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Negation',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english:
              'Learn how to make simple negative statements.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Everyday Conversations',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english:
              'Practice simple conversations used in everyday situations.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english:
              'Review basic sentences, questions and negation.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      }
    ]
  },

  // ==========================================================
  // UNIT 5
  // ==========================================================

  {
    unit: 'Unit 5 — Practical Conversation',

    lessons: [
      {
        title: 'Meeting Someone',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english:
              'Practice introducing yourself and meeting someone new.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'At Home',
        type: 'conversation',
        category: 'home',

        content: {
          introduction: {
            english:
              'Practice simple conversations used at home.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Asking for Something',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english:
              'Learn how to make simple requests.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Everyday Conversation',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english:
              'Practice common everyday conversations.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      },

      // --------------------------------------------------------

      {
        title: 'Final Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english:
              'Review the vocabulary, grammar and conversations learned throughout the beginner course.',
            izon: '...'
          },

          // vocabulary: [],

          grammar: [],

          examples: [],

          culturalNotes: []
        },

        exercises: []
      }
    ]
  }
];


// ============================================================
// HELPERS
// ============================================================

function createDefaultContent(lessonData) {
  return {
    introduction: {
      english: `Welcome to ${lessonData.title}.`,
      izon: '...'
    },

    grammar: [],

    culturalNotes: [],

    vocabulary: [],

    examples: [],

    ...(lessonData.content || {})
  };
}


// ============================================================
// SEED FUNCTION
// ============================================================

async function seedCurriculum() {
  try {
    // --------------------------------------------------------
    // CONNECT
    // --------------------------------------------------------

    console.log(
      'Connecting to:',
      process.env.MONGODB_URI ? '[MongoDB URI configured]' : '[MISSING URI]'
    );

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log('Connected to MongoDB');


    // --------------------------------------------------------
    // FIND LANGUAGE
    // --------------------------------------------------------

    const izon = await Language.findOne({
      code: 'IZON'
    });

    console.log(
      'Language found:',
      izon ? izon._id : 'None'
    );

    if (!izon) {
      throw new Error(
        'Izon language not found. Create the IZON language first.'
      );
    }


    // --------------------------------------------------------
    // ADMIN / CREATOR ID
    // --------------------------------------------------------

    const adminId = new mongoose.Types.ObjectId();

    console.log(
      'Seed creator ID:',
      adminId
    );


    // --------------------------------------------------------
    // FIND OR CREATE COURSE
    // --------------------------------------------------------

    let course = await Course.findOne({
      title: 'Izon Beginner Course'
    });

    console.log(
      'Course found:',
      course ? course._id : 'None'
    );

    if (!course) {
      course = await Course.create({
        title: 'Izon Beginner Course',
        languageId: izon._id
      });

      console.log(
        'Course created:',
        course._id
      );
    }


    // --------------------------------------------------------
    // FIND OR CREATE SECTION
    // --------------------------------------------------------

    let section = await Section.findOne({
      title: 'Beginner Track',
      courseId: course._id
    });

    if (!section) {
      section = await Section.create({
        title: 'Beginner Track',
        courseId: course._id
      });

      await Course.findByIdAndUpdate(
        course._id,
        {
          $addToSet: {
            sections: section._id
          }
        }
      );

      console.log(
        'Section created:',
        section._id
      );
    } else {
      console.log(
        'Section found:',
        section._id
      );
    }


    // ========================================================
    // OPTIONAL CLEANUP
    // ========================================================
    //
    // IMPORTANT:
    // Uncomment this section ONLY if you want to completely
    // replace the old seeded curriculum.
    //
    // This prevents duplicate Units/Lessons/Modules every time
    // you run the seed.
    //
    // ========================================================

    /*
    console.log('Removing existing curriculum...');

    const existingUnits = await Unit.find({
      sectionId: section._id
    });

    const existingUnitIds = existingUnits.map(
      unit => unit._id
    );

    const existingModules = await Module.find({
      lessons: { $exists: true }
    });

    if (existingUnitIds.length > 0) {
      await Lesson.deleteMany({
        _id: {
          $in: existingUnits.flatMap(
            unit => unit.lessons || []
          )
        }
      });

      await Unit.deleteMany({
        _id: {
          $in: existingUnitIds
        }
      });
    }

    for (const mod of existingModules) {
      const belongsToCurriculum = mod.lessons?.some(
        lessonId =>
          existingUnits.some(unit =>
            unit.lessons?.some(
              id => id.equals(lessonId)
            )
          )
      );

      if (belongsToCurriculum) {
        await Module.findByIdAndDelete(mod._id);
      }
    }

    await Section.findByIdAndUpdate(
      section._id,
      {
        $set: {
          units: []
        }
      }
    );

    console.log('Existing curriculum removed.');
    */


    // ========================================================
    // CREATE UNITS
    // ========================================================

    for (
      let unitIndex = 0;
      unitIndex < curriculum.length;
      unitIndex++
    ) {

      const unitData = curriculum[unitIndex];

      console.log('');
      console.log(
        `============================================`
      );
      console.log(
        `UNIT ${unitIndex + 1}: ${unitData.unit}`
      );
      console.log(
        `============================================`
      );


      // ------------------------------------------------------
      // CREATE UNIT
      // ------------------------------------------------------

      const unit = await Unit.create({
        title: unitData.unit,
        sectionId: section._id
      });

      await Section.findByIdAndUpdate(
        section._id,
        {
          $addToSet: {
            units: unit._id
          }
        }
      );

      console.log(
        'Unit created:',
        unit._id
      );


      // ------------------------------------------------------
      // CREATE MODULE
      // ------------------------------------------------------

      const mod = await Module.create({
        title: {
          izon: unitData.unit,
          english: unitData.unit
        },

        level: 'beginner',

        order: unitIndex + 1
      });

      console.log(
        'Module created:',
        mod._id
      );


      // ------------------------------------------------------
      // CREATE LESSONS
      // ------------------------------------------------------

      for (
        let lessonIndex = 0;
        lessonIndex < unitData.lessons.length;
        lessonIndex++
      ) {

        const lessonData =
          unitData.lessons[lessonIndex];


        const content =
          createDefaultContent(lessonData);


        const lesson = await Lesson.create({

          title: {
            izon: lessonData.title,
            english: lessonData.title
          },

          description: {
            english:
              `Learn about ${lessonData.title}.`
          },

          language_id: izon._id,

          level: 'beginner',

          lessonType: lessonData.type,

          category:
            lessonData.category || 'general',

          order: lessonIndex + 1,

          status: 'published',

          moduleId: mod._id,

          content,

          exercises:
            lessonData.exercises || [],

          createdBy: adminId
        });


        // ----------------------------------------------------
        // LINK LESSON TO UNIT
        // ----------------------------------------------------

        await Unit.findByIdAndUpdate(
          unit._id,
          {
            $addToSet: {
              lessons: lesson._id
            }
          }
        );


        // ----------------------------------------------------
        // LINK LESSON TO MODULE
        // ----------------------------------------------------

        await Module.findByIdAndUpdate(
          mod._id,
          {
            $addToSet: {
              lessons: lesson._id
            }
          }
        );


        console.log(
          `  Lesson ${lessonIndex + 1}: ${lessonData.title}`
        );

        console.log(
          `  Lesson ID: ${lesson._id}`
        );
      }


      console.log(
        `Finished: ${unitData.unit}`
      );
    }


    // ========================================================
    // SUMMARY
    // ========================================================

    const totalUnits = await Unit.countDocuments({
      sectionId: section._id
    });

    const totalLessons = await Lesson.countDocuments({
      language_id: izon._id
    });

    const totalModules = await Module.countDocuments({
      level: 'beginner'
    });


    console.log('');
    console.log(
      '============================================'
    );

    console.log(
      'CURRICULUM SEEDING COMPLETE'
    );

    console.log(
      '============================================'
    );

    console.log(
      `Course: ${course.title}`
    );

    console.log(
      `Section: ${section.title}`
    );

    console.log(
      `Units in section: ${totalUnits}`
    );

    console.log(
      `Beginner modules: ${totalModules}`
    );

    console.log(
      `Izon lessons: ${totalLessons}`
    );

    console.log(
      `Expected new lessons: 25`
    );

    console.log(
      '============================================'
    );


    // --------------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------------

    await mongoose.disconnect();

    console.log(
      'Disconnected from MongoDB.'
    );

    process.exit(0);

  } catch (error) {

    console.error('');
    console.error(
      '============================================'
    );

    console.error(
      'SEEDING ERROR'
    );

    console.error(
      '============================================'
    );

    console.error(error);

    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error(
        'MongoDB disconnect error:',
        disconnectError
      );
    }

    process.exit(1);
  }
}


// ============================================================
// RUN
// ============================================================

seedCurriculum();
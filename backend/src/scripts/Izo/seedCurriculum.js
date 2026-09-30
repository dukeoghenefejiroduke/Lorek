require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

console.log('Starting seedCurriculum.js');

const mongoose = require('mongoose');

const Unit = require('../../models/Unit');
const Lesson = require('../../models/Lesson');
const Section = require('../../models/Section');
const Course = require('../../models/Course');
const Language = require('../../models/Language');
const Module = require('../../models/Module');
const Vocabulary = require('../../models/Vocabulary');

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

          vocabulary: [
            { izon: 'Ibasa', english: 'Hello' },
            { izon: 'Seridou / Baidẹ', english: 'Good morning' },
            { izon: 'Dó', english: 'Good afternoon / Good evening' },
            { izon: 'Buburudẹ', english: 'Good evening' },
            { izon: 'Búnù dá sèri', english: 'Good night' },
            { izon: 'Di Mu / Baị', english: 'Goodbye' },
            { izon: 'Tubara?', english: 'How are you?' },
            { izon: 'Emi', english: "I'm fine" },
            { izon: 'Nua', english: 'Thank you / Welcome / Well done' },
            { izon: 'Ondutimi', english: 'Live long (blessing)' }
          ],

          grammar: [],

          examples: [
            { izon: 'Ibasa', english: 'Hello' },
            { izon: 'Seridou', english: 'Good morning' },
            { izon: 'Tubara?', english: 'How are you?' },
            { izon: 'Emi', english: "I'm fine" },
            { izon: 'Di Mu', english: 'Goodbye' }
          ],

          culturalNotes: [
            {
              english: 'In Izon culture, greetings are highly important. It is considered rude not to respond to a greeting. Elders are often greeted with special respect forms such as “Koide” (I bow/kneel).'
            }
          ]
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you say Hello in Izon?',
              izon: 'Ibasa?'
            },
            options: [
              { id: 'a', english: 'Ibasa', izon: 'Ibasa', isCorrect: true },
              { id: 'b', english: 'Di Mu', izon: 'Di Mu', isCorrect: false },
              { id: 'c', english: 'Nua', izon: 'Nua', isCorrect: false }
            ],
            points: 10
          },
          {
            type: 'translation',
            difficulty: 'easy',
            question: {
              english: 'Translate: Good morning',
              izon: 'Good morning'
            },
            correctAnswer: {
              english: 'Seridou',
              izon: 'Seridou'
            },
            points: 15
          },
          {
            type: 'fill-blank',
            difficulty: 'easy',
            question: {
              english: 'Complete: ____ means How are you?',
              izon: 'Complete: ____ means How are you?'
            },
            correctAnswer: 'Tubara',
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
            izon: 'Learn how to say your name in Izon.'
          },

          vocabulary: [
            { izon: 'Ịnẹ ịrẹ', english: 'My name' },
            { izon: 'Ịrẹ', english: 'Name' },
            { izon: 'Ẹniẹrẹbe', english: 'My name is...' }
          ],

          grammar: [
            {
              title: {
                english: 'Self-Introduction'
              },
              explanation: {
                english:
                  'To introduce yourself, say “Ẹniẹrẹbe + [your name]”. Example: Ẹniẹrẹbe Josephine = My name is Josephine.'
              }
            }
          ],

          examples: [
            { izon: 'Ẹniẹrẹbe Tamarau', english: 'My name is Tamarau' },
            { izon: 'Ẹniẹrẹbe Ebiowei', english: 'My name is Ebiowei' }
          ],

          culturalNotes: [
            {
              english: 'Izon names often carry deep meaning related to God (Tamarau), beauty (Ebi), or circumstances of birth.'
            }
          ]
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'easy',
            question: {
              english: 'Translate: My name is John',
              izon: 'My name is John'
            },
            correctAnswer: {
              english: 'Ẹniẹrẹbe John',
              izon: 'Ẹniẹrẹbe John'
            },
            points: 15
          },
          {
            type: 'fill-blank',
            difficulty: 'easy',
            question: {
              english: 'Complete: ____ means My name is...',
              izon: 'Complete: ____ means My name is...'
            },
            correctAnswer: 'Ẹniẹrẹbe',
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: "Asking Someone's Name",
        type: 'conversation',
        category: 'greetings',

        content: {
          introduction: {
            english: "Learn how to ask someone their name in Izon.",
            izon: 'Learn how to ask for someone\'s name.'
          },

          vocabulary: [
            { izon: 'Te ịrẹ?', english: 'What is your name?' },
            { izon: 'Ịnẹ ịrẹ te?', english: 'What is your name?' }
          ],

          grammar: [],

          examples: [
            { izon: 'Te ịrẹ?', english: 'What is your name?' },
            { izon: 'Ẹniẹrẹbe Ebiere. Te ịrẹ?', english: 'My name is Ebiere. What is your name?' }
          ],

          culturalNotes: [
            {
              english: 'When meeting someone for the first time, it is polite to ask their name after exchanging greetings.'
            }
          ]
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you ask “What is your name?”',
              izon: 'Te ịrẹ?'
            },
            options: [
              { id: 'a', english: 'Te ịrẹ?', izon: 'Te ịrẹ?', isCorrect: true },
              { id: 'b', english: 'Tubara?', izon: 'Tubara?', isCorrect: false },
              { id: 'c', english: 'Di Mu', izon: 'Di Mu', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Basic Politeness',
        type: 'culture',
        category: 'greetings',

        content: {
          introduction: {
            english: 'Learn useful polite expressions and respectful communication.',
            izon: 'Learn polite expressions.'
          },

          vocabulary: [
            { izon: 'Pasisei', english: 'Please' },
            { izon: 'Nua / Mbana', english: 'Thank you' },
            { izon: 'Dílà', english: 'Sorry' },
            { izon: 'Ibuomo', english: 'Excuse me' },
            { izon: 'Inyòo', english: 'Yes' },
            { izon: 'Aghain', english: 'No' },
            { izon: 'Koide', english: 'I bow / respect greeting to elders' }
          ],

          grammar: [],

          examples: [
            { izon: 'Pasisei, beni ni piri', english: 'Please give me water' },
            { izon: 'Nua', english: 'Thank you' },
            { izon: 'Dílà', english: 'Sorry' }
          ],

          culturalNotes: [
            {
              english: 'Politeness and respectful greetings are very important. When greeting elders, people often use “Koide” (I bow/kneel) and the elder replies “Seri” (rise). “Sorry” (Dílà) is also used to express sympathy, not only apology.'
            }
          ]
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you say Please in Izon?',
              izon: 'Pasisei?'
            },
            options: [
              { id: 'a', english: 'Pasisei', izon: 'Pasisei', isCorrect: true },
              { id: 'b', english: 'Nua', izon: 'Nua', isCorrect: false },
              { id: 'c', english: 'Dílà', izon: 'Dílà', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english: 'Review the greetings and introductions from Unit 1.',
            izon: 'Review Unit 1 greetings and introductions.'
          },

          vocabulary: [
            { izon: 'Ibasa', english: 'Hello' },
            { izon: 'Seridou', english: 'Good morning' },
            { izon: 'Tubara?', english: 'How are you?' },
            { izon: 'Ẹniẹrẹbe...', english: 'My name is...' },
            { izon: 'Te ịrẹ?', english: 'What is your name?' },
            { izon: 'Nua', english: 'Thank you' },
            { izon: 'Di Mu', english: 'Goodbye' }
          ],

          grammar: [],
          examples: [],
          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate: Hello, how are you? My name is Ebi.',
              izon: 'Hello, how are you? My name is Ebi.'
            },
            correctAnswer: {
              english: 'Ibasa, Tubara? Ẹniẹrẹbe Ebi.',
              izon: 'Ibasa, Tubara? Ẹniẹrẹbe Ebi.'
            },
            points: 20
          }
        ]
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
            english: 'Learn common words for family members.',
            izon: 'Learn family words.'
          },

          vocabulary: [
            { izon: 'Dada / Dau', english: 'Father' },
            { izon: 'Ina / Yin', english: 'Mother' },
            { izon: 'Tụbọụ', english: 'Child' },
            { izon: 'Bịna owei', english: 'Brother' },
            { izon: 'Bịna araụ', english: 'Sister' },
            { izon: 'Yei', english: 'Husband' },
            { izon: 'Ta', english: 'Wife' },
            { izon: 'Opu dau', english: 'Grandfather' },
            { izon: 'Opu yin', english: 'Grandmother' },
            { izon: 'Awọụama', english: 'Children' }
          ],

          grammar: [],

          examples: [
            { izon: 'E yin', english: 'My mother' },
            { izon: 'E dada', english: 'My father' },
            { izon: 'E tụbọụ', english: 'My child' }
          ],

          culturalNotes: [
            {
              english: 'Izon society places strong emphasis on extended family and respect for elders. Terms like “opu” (big) are used to show respect for grandparents.'
            }
          ]
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you say Father in Izon?',
              izon: 'Dada?'
            },
            options: [
              { id: 'a', english: 'Dada', izon: 'Dada', isCorrect: true },
              { id: 'b', english: 'Ina', izon: 'Ina', isCorrect: false },
              { id: 'c', english: 'Yei', izon: 'Yei', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'People & Relationships',
        type: 'vocabulary',
        category: 'family',

        content: {
          introduction: {
            english: 'Learn words used to describe people and relationships.',
            izon: 'Learn people and relationship words.'
          },

          vocabulary: [
            { izon: 'Kịmị', english: 'Person / Human being' },
            { izon: 'Owei', english: 'Man / Male' },
            { izon: 'Ere / Erema / Iyoro', english: 'Woman / Female' },
            { izon: 'Ebiowei', english: 'Handsome man' },
            { izon: 'Ebiere', english: 'Beautiful woman' },
            { izon: 'Binaotu', english: 'Relatives' },
            { izon: 'Agbaị-áràụ', english: 'Girlfriend' }
          ],

          grammar: [],

          examples: [
            { izon: 'Ebiowei', english: 'Handsome man' },
            { izon: 'Ebiere', english: 'Beautiful woman' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'fill-blank',
            difficulty: 'easy',
            question: {
              english: 'Complete: ____ means Woman.',
              izon: 'Complete: ____ means Woman.'
            },
            correctAnswer: 'Ere',
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Possession',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english: 'Learn how possession is expressed in Izon.',
            izon: 'Learn possession in Izon.'
          },

          vocabulary: [
            { izon: 'E / Ịnẹ', english: 'My' },
            { izon: 'Ị', english: 'Your (singular)' },
            { izon: 'U', english: 'His' },
            { izon: 'A', english: 'Her' },
            { izon: 'Wo', english: 'Our' },
            { izon: 'Oni', english: 'Their' }
          ],

          grammar: [
            {
              title: {
                english: 'Possessive Pronouns'
              },
              explanation: {
                english:
                  'Possession is shown by placing the possessive pronoun before the noun. Example: E yin = My mother, Ị dada = Your father.'
              }
            }
          ],

          examples: [
            { izon: 'E yin', english: 'My mother' },
            { izon: 'Ị dada', english: 'Your father' },
            { izon: 'U tụbọụ', english: 'His child' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'easy',
            question: {
              english: 'Translate: My father',
              izon: 'My father'
            },
            correctAnswer: {
              english: 'E dada',
              izon: 'E dada'
            },
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Describing People',
        type: 'grammar',
        category: 'descriptions',

        content: {
          introduction: {
            english: 'Learn how to describe people using simple expressions.',
            izon: 'Learn how to describe people.'
          },

          vocabulary: [
            { izon: 'Ebi', english: 'Good / Beautiful / Fine' },
            { izon: 'Opu', english: 'Big / Large' },
            { izon: 'Kọrọngbọọ́', english: 'Thin' },
            { izon: 'Dain', english: 'Tall / Long' }
          ],

          grammar: [
            {
              title: {
                english: 'Simple Descriptions'
              },
              explanation: {
                english:
                  'Adjectives usually follow the noun or are used predicatively. Example: Ebiere = Beautiful woman.'
              }
            }
          ],

          examples: [
            { izon: 'Ebi kịmị', english: 'Good person' },
            { izon: 'Opu owei', english: 'Big man' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'What does “Ebi” mean?',
              izon: 'Ebi?'
            },
            options: [
              { id: 'a', english: 'Good / Beautiful', izon: 'Ebi', isCorrect: true },
              { id: 'b', english: 'Big', izon: 'Opu', isCorrect: false },
              { id: 'c', english: 'Thin', izon: 'Kọrọngbọọ́', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english: 'Review people, relationships, possession and descriptions.',
            izon: 'Review Unit 2.'
          },

          vocabulary: [
            { izon: 'Dada', english: 'Father' },
            { izon: 'Ina', english: 'Mother' },
            { izon: 'Tụbọụ', english: 'Child' },
            { izon: 'E yin', english: 'My mother' },
            { izon: 'Ebi', english: 'Good / Beautiful' }
          ],

          grammar: [],
          examples: [],
          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate: My mother is beautiful',
              izon: 'My mother is beautiful'
            },
            correctAnswer: {
              english: 'E yin ebi',
              izon: 'E yin ebi'
            },
            points: 20
          }
        ]
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
            english: 'Learn the names of common everyday objects.',
            izon: 'Learn everyday objects.'
          },

          vocabulary: [
            { izon: 'Wari', english: 'House' },
            { izon: 'Aru', english: 'Car / Vehicle / Canoe' },
            { izon: 'Bẹlẹ', english: 'Pot' },
            { izon: 'Adẹịn', english: 'Knife' },
            { izon: 'Fún', english: 'Book' },
            { izon: 'Beni', english: 'Water' }
          ],

          grammar: [],

          examples: [
            { izon: 'E wari', english: 'My house' },
            { izon: 'Beni ni piri', english: 'Give me water' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you say House in Izon?',
              izon: 'Wari?'
            },
            options: [
              { id: 'a', english: 'Wari', izon: 'Wari', isCorrect: true },
              { id: 'b', english: 'Aru', izon: 'Aru', isCorrect: false },
              { id: 'c', english: 'Bẹlẹ', izon: 'Bẹlẹ', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Food & Drink',
        type: 'vocabulary',
        category: 'food',

        content: {
          introduction: {
            english: 'Learn common words for food and drinks.',
            izon: 'Learn food and drink words.'
          },

          vocabulary: [
            { izon: 'Fịeye / Fịyai', english: 'Food' },
            { izon: 'Indi / Ịndị', english: 'Fish' },
            { izon: 'Namaa', english: 'Meat' },
            { izon: 'Folou', english: 'Soup' },
            { izon: 'Buru', english: 'Yam' },
            { izon: 'Beribaa', english: 'Plantain' },
            { izon: 'Angaa', english: 'Egg' },
            { izon: 'Fuu', english: 'Salt' },
            { izon: 'Beni', english: 'Water' },
            { izon: 'Ofoni', english: 'Chicken / Fowl' }
          ],

          grammar: [],

          examples: [
            { izon: 'Indi fị', english: 'Eat fish' },
            { izon: 'Beni fị', english: 'Drink water' }
          ],

          culturalNotes: [
            {
              english: 'Fish is a staple in Izon diet because of the riverine environment of the Niger Delta.'
            }
          ]
        },

        exercises: [
          {
            type: 'fill-blank',
            difficulty: 'easy',
            question: {
              english: 'Complete: ____ means Fish.',
              izon: 'Complete: ____ means Fish.'
            },
            correctAnswer: 'Indi',
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Places',
        type: 'vocabulary',
        category: 'travel',

        content: {
          introduction: {
            english: 'Learn words for common places.',
            izon: 'Learn place words.'
          },

          vocabulary: [
            { izon: 'Ama', english: 'Town / Village' },
            { izon: 'Wari', english: 'House / Home' },
            { izon: 'Bou', english: 'Bush / Forest' },
            { izon: 'Abadị́', english: 'Ocean / Sea' },
            { izon: 'Ọgba', english: 'River' }
          ],

          grammar: [],

          examples: [
            { izon: 'E ama', english: 'My town' },
            { izon: 'Mu wari', english: 'Go home' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you say Town in Izon?',
              izon: 'Ama?'
            },
            options: [
              { id: 'a', english: 'Ama', izon: 'Ama', isCorrect: true },
              { id: 'b', english: 'Bou', izon: 'Bou', isCorrect: false },
              { id: 'c', english: 'Wari', izon: 'Wari', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Basic Actions',
        type: 'grammar',
        category: 'work',

        content: {
          introduction: {
            english: 'Learn basic expressions for everyday actions.',
            izon: 'Learn basic action verbs.'
          },

          vocabulary: [
            { izon: 'Bo', english: 'Come' },
            { izon: 'Mu', english: 'Go' },
            { izon: 'Fị', english: 'Eat / Die' },
            { izon: 'Piri', english: 'Give' },
            { izon: 'Dii', english: 'Look' },
            { izon: 'Tin', english: 'Call' },
            { izon: 'Bụnụ', english: 'Sleep' },
            { izon: 'Sei', english: 'Dance' }
          ],

          grammar: [
            {
              title: {
                english: 'Basic Verb Usage'
              },
              explanation: {
                english:
                  'Izon verbs do not change form for person or number. The same verb form is used for I, you, he, she, we, they. Example: U sei = He dances, Wo sei = We dance.'
              }
            }
          ],

          examples: [
            { izon: 'Bo', english: 'Come' },
            { izon: 'Mu dii', english: 'Go and look' },
            { izon: 'Beni ni piri', english: 'Give me water' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'easy',
            question: {
              english: 'Translate: Come',
              izon: 'Come'
            },
            correctAnswer: {
              english: 'Bo',
              izon: 'Bo'
            },
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english: 'Review everyday objects, food, places and actions.',
            izon: 'Review Unit 3.'
          },

          vocabulary: [
            { izon: 'Wari', english: 'House' },
            { izon: 'Indi', english: 'Fish' },
            { izon: 'Bo', english: 'Come' },
            { izon: 'Mu', english: 'Go' },
            { izon: 'Beni', english: 'Water' }
          ],

          grammar: [],
          examples: [],
          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate: Come and eat fish',
              izon: 'Come and eat fish'
            },
            correctAnswer: {
              english: 'Bo indi fị',
              izon: 'Bo indi fị'
            },
            points: 20
          }
        ]
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
            english: 'Learn how to form simple statements.',
            izon: 'Learn simple statements.'
          },

          vocabulary: [],

          grammar: [
            {
              title: {
                english: 'Subject + Verb Order'
              },
              explanation: {
                english:
                  'Basic sentence structure is Subject + Verb. Pronouns: U (he), A (she), Wo (we), Oni (they). The verb stays the same regardless of subject.'
              }
            }
          ],

          examples: [
            { izon: 'U sei mini ye', english: 'He dances' },
            { izon: 'A sei mini ye', english: 'She dances' },
            { izon: 'Wo sei mini ye', english: 'We dance' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'fill-blank',
            difficulty: 'easy',
            question: {
              english: 'Complete: U ____ mini ye (He dances)',
              izon: 'Complete: U ____ mini ye'
            },
            correctAnswer: 'sei',
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Questions',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english: 'Learn how to ask basic questions.',
            izon: 'Learn how to ask questions.'
          },

          vocabulary: [
            { izon: 'Te?', english: 'What?' },
            { izon: 'Tubara?', english: 'How are you?' },
            { izon: 'A emii?', english: 'Are you there? / How are you?' }
          ],

          grammar: [
            {
              title: {
                english: 'Question Formation'
              },
              explanation: {
                english:
                  'Questions are often formed by using question words (Te = what) or rising intonation. Many greetings themselves are questions.'
              }
            }
          ],

          examples: [
            { izon: 'Te ịrẹ?', english: 'What is your name?' },
            { izon: 'Tubara?', english: 'How are you?' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            question: {
              english: 'How do you say “What?” in Izon?',
              izon: 'Te?'
            },
            options: [
              { id: 'a', english: 'Te', izon: 'Te', isCorrect: true },
              { id: 'b', english: 'Bo', izon: 'Bo', isCorrect: false },
              { id: 'c', english: 'Mu', izon: 'Mu', isCorrect: false }
            ],
            points: 10
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Negation',
        type: 'grammar',
        category: 'grammar',

        content: {
          introduction: {
            english: 'Learn how to make simple negative statements.',
            izon: 'Learn negation.'
          },

          vocabulary: [
            { izon: 'Gha / Nagha', english: 'Not (negator)' }
          ],

          grammar: [
            {
              title: {
                english: 'Negation'
              },
              explanation: {
                english:
                  'Negation is often marked with “gha” or “nagha” attached to or after the verb. Example: Baịngha = did not run.'
              }
            }
          ],

          examples: [
            { izon: 'Baịngha', english: 'Did not run' },
            { izon: 'Aghain', english: 'No' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'fill-blank',
            difficulty: 'medium',
            question: {
              english: 'Complete: Baịn____ (did not run)',
              izon: 'Complete: Baịn____'
            },
            correctAnswer: 'gha',
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Everyday Conversations',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english: 'Practice simple conversations used in everyday situations.',
            izon: 'Practice everyday conversations.'
          },

          vocabulary: [],

          grammar: [],

          examples: [
            {
              izon: 'A: Ibasa. Tubara?\nB: Emi. Ịnẹ ịrẹ te?\nA: Ẹniẹrẹbe Ebi.',
              english: 'A: Hello. How are you?\nB: I\'m fine. What is your name?\nA: My name is Ebi.'
            }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate the conversation: Hello. How are you? I\'m fine.',
              izon: 'Hello. How are you? I\'m fine.'
            },
            correctAnswer: {
              english: 'Ibasa. Tubara? Emi.',
              izon: 'Ibasa. Tubara? Emi.'
            },
            points: 20
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Unit Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english: 'Review basic sentences, questions and negation.',
            izon: 'Review Unit 4.'
          },

          vocabulary: [],
          grammar: [],
          examples: [],
          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate: He dances. What is your name?',
              izon: 'He dances. What is your name?'
            },
            correctAnswer: {
              english: 'U sei. Te ịrẹ?',
              izon: 'U sei. Te ịrẹ?'
            },
            points: 20
          }
        ]
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
            english: 'Practice introducing yourself and meeting someone new.',
            izon: 'Practice meeting someone new.'
          },

          vocabulary: [],

          grammar: [],

          examples: [
            {
              izon: 'A: Ibasa. Ẹniẹrẹbe Tamarau. Te ịrẹ?\nB: Ẹniẹrẹbe Ebiowei. Nua.',
              english: 'A: Hello. My name is Tamarau. What is your name?\nB: My name is Ebiowei. Thank you.'
            }
          ],

          culturalNotes: [
            {
              english: 'When meeting someone for the first time, always exchange greetings before asking for names.'
            }
          ]
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate: Hello. My name is John. What is your name?',
              izon: 'Hello. My name is John. What is your name?'
            },
            correctAnswer: {
              english: 'Ibasa. Ẹniẹrẹbe John. Te ịrẹ?',
              izon: 'Ibasa. Ẹniẹrẹbe John. Te ịrẹ?'
            },
            points: 20
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'At Home',
        type: 'conversation',
        category: 'home',

        content: {
          introduction: {
            english: 'Practice simple conversations used at home.',
            izon: 'Practice home conversations.'
          },

          vocabulary: [
            { izon: 'Bo wari', english: 'Come home' },
            { izon: 'Mu wari', english: 'Go home' }
          ],

          grammar: [],

          examples: [
            {
              izon: 'A: Bo wari.\nB: Nua.',
              english: 'A: Come home.\nB: Thank you / Okay.'
            }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'fill-blank',
            difficulty: 'easy',
            question: {
              english: 'Complete: ____ wari (Go home)',
              izon: 'Complete: ____ wari'
            },
            correctAnswer: 'Mu',
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Asking for Something',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english: 'Learn how to make simple requests.',
            izon: 'Learn how to make requests.'
          },

          vocabulary: [
            { izon: 'Pasisei ... ni piri', english: 'Please give me...' }
          ],

          grammar: [],

          examples: [
            { izon: 'Pasisei beni ni piri', english: 'Please give me water' },
            { izon: 'Pasisei indi ni piri', english: 'Please give me fish' }
          ],

          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'easy',
            question: {
              english: 'Translate: Please give me water',
              izon: 'Please give me water'
            },
            correctAnswer: {
              english: 'Pasisei beni ni piri',
              izon: 'Pasisei beni ni piri'
            },
            points: 15
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Everyday Conversation',
        type: 'conversation',
        category: 'conversation',

        content: {
          introduction: {
            english: 'Practice common everyday conversations.',
            izon: 'Practice common conversations.'
          },

          vocabulary: [],

          grammar: [],

          examples: [
            {
              izon: 'A: Seridou. Tubara?\nB: Emi. Ịnẹ wari te?\nA: E wari ebi.',
              english: 'A: Good morning. How are you?\nB: I\'m fine. How is your house/family?\nA: My house is fine.'
            }
          ],

          culturalNotes: [
            {
              english: 'Asking about the family or house (“wari”) is a common way of showing care in Izon culture.'
            }
          ]
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'medium',
            question: {
              english: 'Translate: Good morning. How are you? I\'m fine.',
              izon: 'Good morning. How are you? I\'m fine.'
            },
            correctAnswer: {
              english: 'Seridou. Tubara? Emi.',
              izon: 'Seridou. Tubara? Emi.'
            },
            points: 20
          }
        ]
      },

      // --------------------------------------------------------

      {
        title: 'Final Review',
        type: 'review',
        category: 'review',

        content: {
          introduction: {
            english: 'Review the vocabulary, grammar and conversations learned throughout the beginner course.',
            izon: 'Final review of the beginner course.'
          },

          vocabulary: [
            { izon: 'Ibasa', english: 'Hello' },
            { izon: 'Seridou', english: 'Good morning' },
            { izon: 'Tubara?', english: 'How are you?' },
            { izon: 'Ẹniẹrẹbe...', english: 'My name is...' },
            { izon: 'Dada / Ina', english: 'Father / Mother' },
            { izon: 'Bo / Mu', english: 'Come / Go' },
            { izon: 'Indi / Beni', english: 'Fish / Water' },
            { izon: 'Nua', english: 'Thank you' },
            { izon: 'Di Mu', english: 'Goodbye' }
          ],

          grammar: [],
          examples: [],
          culturalNotes: []
        },

        exercises: [
          {
            type: 'translation',
            difficulty: 'hard',
            question: {
              english: 'Translate: Hello. My name is Ebi. Please give me water. Thank you. Goodbye.',
              izon: 'Hello. My name is Ebi. Please give me water. Thank you. Goodbye.'
            },
            correctAnswer: {
              english: 'Ibasa. Ẹniẹrẹbe Ebi. Pasisei beni ni piri. Nua. Di Mu.',
              izon: 'Ibasa. Ẹniẹrẹbe Ebi. Pasisei beni ni piri. Nua. Di Mu.'
            },
            points: 30
          }
        ]
      }
    ]
  }
];


// ============================================================
// HELPERS
// ============================================================

async function ensureVocabulary(vocabItem, izon, adminId) {
  let vocab = await Vocabulary.findOne({
    izonWord: vocabItem.izon,
    language_id: izon._id
  }).collation({ locale: 'en', strength: 2 });

  if (!vocab) {
    try {
      vocab = await Vocabulary.create({
        izonWord: vocabItem.izon,
        englishTranslation: vocabItem.english,
        language_id: izon._id,
        category: 'other',
        difficulty: 'beginner',
        createdBy: adminId
      });
      console.log(`Created vocabulary: ${vocab.izonWord} with ID: ${vocab._id}`);
    } catch (err) {
      if (err.code === 11000) {
        vocab = await Vocabulary.findOne({
          izonWord: vocabItem.izon,
          language_id: izon._id
        }).collation({ locale: 'en', strength: 2 });
      } else {
        throw err;
      }
    }
  } else {
    console.log(`Found vocabulary: ${vocab.izonWord} with ID: ${vocab._id}`);
  }
  return vocab._id;
}

function createDefaultContent(lessonData, vocabMap) {
  const rawVocabulary = lessonData.content?.vocabulary || [];
  
  const vocabulary = rawVocabulary.map(v => {
        const key = `${v.izon}-${v.english}`;
        const wordId = vocabMap.get(key);
        if (!wordId) {
            console.warn(`Word not found in map: ${key}`);
            return null;
        }
        return { wordId };
    }).filter(v => v !== null) || [];
  
  return {
    introduction: {
      english: `Welcome to ${lessonData.title}.`,
      izon: '...'
    },
    grammar: [],
    culturalNotes: [],
    examples: [],
    ...(lessonData.content || {}),
    vocabulary // Ensure this overrides the raw vocabulary from lessonData.content
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
      // PRE-PROCESS VOCABULARY
      // ------------------------------------------------------

      const vocabMap = new Map();
      for (const lessonData of unitData.lessons) {
        if (lessonData.content?.vocabulary) {
          for (const vocabItem of lessonData.content.vocabulary) {
            const vocabId = await ensureVocabulary(vocabItem, izon, adminId);
            vocabMap.set(`${vocabItem.izon}-${vocabItem.english}`, vocabId);
          }
        }
      }

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
          createDefaultContent(lessonData, vocabMap);


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

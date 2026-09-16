const IzonTranslationEngine = require('./backend/src/translation/packs/izo/IzonTranslationEngine');
const mongoose = require('mongoose');

async function verifyEngine() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/lorek");
  const engine = new IzonTranslationEngine('izo');
  
  const testInputs = [
    "I eat fish",
    "He does not sleep",
    "She walks",
    "They are cooking",
    "It is a beautiful day",
    "Lizard two",
    "Izon is good",
    "Where are you going?",
    "I see the man",
    "Do you want water?",
    "Food is ready",
    "Give me money",
    "The house is big",
    "I will come tomorrow",
    "He speaks Izon",
    "What is your name?",
    "The fish is small",
    "I want to sleep",
    "They are happy",
    "Go away"
  ];

  console.log("--- Translation Engine Verification ---");
  
  for (const input of testInputs) {
    // Mimic the flow in translator.js
    const analysis = await engine.analyzeSentence(input);
    const result = await engine.translate(input, { from: 'en', to: 'izon' });
    
    console.log(`Input: "${input}"`);
    console.log(`Analysis: ${JSON.stringify(analysis.unknownTokens)} unknown tokens`);
    console.log(`Translation: "${result.translated}" (Type: ${result.type}, Confidence: ${result.confidence})`);
    console.log("-----------------------------------");
  }
  
  process.exit();
}
verifyEngine();

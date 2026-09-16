const IzonTranslationEngine = require('./backend/src/translation/packs/izo/IzonTranslationEngine');

async function testTranslator() {
  const engine = new IzonTranslationEngine('izo');
  
  const context = {
    from: 'en',
    to: 'izon',
    geminiClient: null // Gemini disabled to test deterministic rules
  };

  const testInputs = [
    "I eat fish",
    "He eats fish",
    "I do not eat",
    "You do not sleep",
    "Are you eating?",
    "He walks",
    "We eat"
  ];
  
  console.log('Testing comprehensive rule-based translations...');
  
  for (const text of testInputs) {
    const result = await engine.translate(text, context);
    console.log(`Input: "${text}" => Output: "${result.translated}" (Type: ${result.type})`);
  }
}

testTranslator();

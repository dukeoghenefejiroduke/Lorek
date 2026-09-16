const IzonTranslationEngine = require('./src/translation/packs/izo/IzonTranslationEngine');
const fs = require('fs');
const izonLookup = require('./src/translation/packs/izo/IzonLookup.json');

async function runBatchTest() {
  try {
    const engine = new IzonTranslationEngine('izo');
    
    // Extract verified sentence pairs directly from IzonLookup.json
    const testPairs = izonLookup
      .filter(item => item.text && item.text.includes('=')) // Assuming format "Eng = Izon"
      .map(item => {
        const parts = item.text.split('=');
        return { input: parts[0].trim(), expected: parts[1].trim() };
      });

    console.log(`Extracted ${testPairs.length} verified pairs. Running batch test...`);

    const results = [];
    for (const pair of testPairs.slice(0, 100)) {
      const result = await engine.translate(pair.input, { from: 'en', to: 'izon' });
      results.push({
        input: pair.input,
        expected: pair.expected,
        actual: result.translated,
        type: result.type,
        confidence: result.confidence
      });
    }

    fs.writeFileSync('translation_evaluation.json', JSON.stringify(results, null, 2));
    console.log("Batch test completed. Results saved to translation_evaluation.json");
    
  } catch (error) {
    console.error("Batch test failed:", error);
  } finally {
    process.exit();
  }
}

runBatchTest();

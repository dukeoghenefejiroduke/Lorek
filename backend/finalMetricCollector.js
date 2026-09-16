const mongoose = require('mongoose');
const Vocabulary = require('./src/models/Vocabulary');
const KnowledgeBase = require('./src/models/KnowledgeBase');
const fs = require('fs');
const IzonTranslationEngine = require('./src/translation/packs/izo/IzonTranslationEngine');

async function finalizeAndAudit() {
  try {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/lorek", { serverSelectionTimeoutMS: 2000 });
    } catch (dbErr) {
        console.warn("⚠️ Database unavailable, proceeding with partial/local metrics only.");
    }
    
    let verifiedEntries = 0;
    let sentencePairs = 0;
    
    if (mongoose.connection.readyState === 1) {
        verifiedEntries = await Vocabulary.countDocuments({ isPublished: true, isActive: true });
        sentencePairs = await KnowledgeBase.countDocuments({ category: 'cultural' });
    }
    
    // 2. Run Engine Verification
    const engine = new IzonTranslationEngine('izo');
    const testSentences = ["I eat fish", "He walks", "We eat"];
    const results = [];
    for (const input of testSentences) {
        results.push(await engine.translate(input, { from: 'en', to: 'izon', geminiClient: null }));
    }

    const report = {
        metrics: {
            verifiedDictionaryEntries: verifiedEntries,
            sentencePairsLoaded: sentencePairs
        },
        engineVerification: results,
        systemCapabilities: {
            grammarRepresentation: "Rule-based via IzonGrammarRules.json (JSON pack)",
            unknownWordHandling: "Flagged in unknownTokens array, excluded from AI dictionary context",
            morphology: "Rule-based suffixing (e.g., negation -ghá)",
            homonymHandling: "Currently exact-match lookup; requires POS-aware disambiguation",
            retrievalScoring: "Vector similarity score from Atlas/RAG service",
            confidenceDetermination: "Heuristic (High: all tokens found; Medium: partial/none)"
        }
    };

    fs.writeFileSync('final_system_audit.json', JSON.stringify(report, null, 2));
    console.log("Final audit complete. Results saved to final_system_audit.json");
    
  } catch (error) {
    console.error("Audit failed (Ensure DB is running):", error.message);
  } finally {
    process.exit();
  }
}

finalizeAndAudit();

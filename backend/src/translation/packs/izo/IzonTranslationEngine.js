const TranslationEngine = require('../../TranslationEngine');
const Vocabulary = require('../../../models/Vocabulary');
const ragService = require('../../../services/ragService');
const fetch = require('node-fetch');

// Load local language pack resources
const englishReverseLookup = require('./EnglishReverseLookup.json');
const izonLookup = require('./IzonLookup.json');
const grammarRules = require('./IzonGrammarRules.json');

class IzonTranslationEngine extends TranslationEngine {
  constructor(languageId) {
    super(languageId);
  }

  getCapabilities() {
    return {
      translate: true,
      analyze: true,
      pronunciation: true,
      contextRetrieval: true,
      localLanguagePack: true
    };
  }

  async lookup(text, languageId) {
    const cleanText = text.toLowerCase().trim();
    
    // 1. Try local English Reverse Lookup
    if (englishReverseLookup[cleanText]) {
      const candidates = englishReverseLookup[cleanText];
      if (candidates && candidates.length > 0) {
        return {
          izonWord: candidates[0],
          grammar: { partOfSpeech: this.guessPOS(cleanText) },
          source: 'EnglishReverseLookup.json'
        };
      }
    }

    // 2. Try local Izon Direct Lookup
    const directMatch = izonLookup.find(item => item.izon_context?.toLowerCase() === cleanText);
    if (directMatch) {
      return {
        izonWord: cleanText,
        englishTranslation: directMatch.text,
        grammar: { partOfSpeech: 'phrase' },
        source: 'IzonLookup.json'
      };
    }

    // Return null (No match found) instead of attempting DB query
    return null;
  }

  guessPOS(word) {
    // Simple heuristic POS tagger based on English word
    const pronouns = ['i', 'me', 'you', 'he', 'him', 'she', 'her', 'we', 'us', 'they', 'them', 'it'];
    const conjunctions = ['and', 'but', 'or', 'because', 'although'];
    const prepositions = ['in', 'on', 'at', 'to', 'for', 'with', 'by', 'about'];
    
    if (pronouns.includes(word)) return 'pronoun';
    if (conjunctions.includes(word)) return 'conjunction';
    if (prepositions.includes(word)) return 'preposition';
    return 'noun'; // Default fallback
  }

  async retrieveContext(query) {
    // Bridges to RAG service or falls back to local corpus matching
    try {
      return await ragService.searchContext(query, 'language');
    } catch (e) {
      console.warn('RAG retrieval failed, falling back to local corpus search:', e.message);
      // Fallback: search local IzonLookup phrases containing query
      return izonLookup
        .filter(item => item.text?.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(item => ({ text: item.text, score: 0.8 }));
    }
  }

  async analyzeSentence(text) {
    const tokens = text.toLowerCase().replace(/[.,!?;:]/g, '').split(' ');
    const analysis = [];
    const unknownTokens = [];

    for (const token of tokens) {
      let entry = await this.lookup(token);
      
      // Virtual entry for pronouns to ensure they are parsed correctly
      if (!entry && this.guessPOS(token) === 'pronoun') {
        entry = {
          izonWord: token,
          grammar: { partOfSpeech: 'pronoun' },
          source: 'IzonGrammarRules.json (Pronoun)'
        };
      }

      if (entry) {
        analysis.push({
          token,
          lemma: entry.izonWord,
          pos: entry.grammar?.partOfSpeech || 'unknown',
          source: entry.source
        });
      } else {
        analysis.push({ token, lemma: null, pos: 'unknown', source: null });
        unknownTokens.push(token);
      }
    }

    return { tokens, analysis, unknownTokens };
  }

  async applyGrammarRules(translatedTokens) {
    const tokens = [...translatedTokens];
    const notIndex = tokens.findIndex(t => t.toLowerCase() === 'not');
    
    if (notIndex !== -1) {
      tokens.splice(notIndex, 1);
      tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}-ghá`;
    }
    
    return tokens;
  }

  async translate(text, context) {
    const analysis = await this.analyzeSentence(text);
    const evidence = await this.retrieveContext(text);

    // 1. Grammar Builder (SOV Enforcement & Pronoun Mapping)
    const deterministicOutput = this.preprocessEnglish(text, analysis.analysis);

    return {
      translated: deterministicOutput,
      type: 'grammar_builder_enforced',
      confidence: analysis.unknownTokens.length === 0 ? 'high' : 'medium',
      unknownTokens: analysis.unknownTokens,
      evidence: evidence
    };
  }

  preprocessEnglish(text, wordObjects) {
    const isNegative = text.toLowerCase().includes("not");
    const isQuestion = text.trim().endsWith("?");
    
    // Dynamic pronoun resolution from IzonGrammarRules.json
    const resolvedWordObjects = wordObjects.map(obj => {
      const token = obj.token.toLowerCase();
      // Match pronouns from grammar pack
      if (obj.pos === 'pronoun') {
        const pronounMap = {
          "i": grammarRules.pronouns?.personal_pronouns_long?.["1sg"]?.izon || "ari",
          "you": grammarRules.pronouns?.personal_pronouns_long?.["2sg"]?.izon || "ari",
          "he": grammarRules.pronouns?.personal_pronouns_long?.["3sg_m"]?.izon || "eri",
          "she": grammarRules.pronouns?.personal_pronouns_long?.["3sg_f"]?.izon || "arau",
          "we": grammarRules.pronouns?.personal_pronouns_long?.["1pl"]?.izon || "woni",
          "they": grammarRules.pronouns?.personal_pronouns_long?.["3pl"]?.izon || "omini"
        };
        if (pronounMap[token]) {
          return { ...obj, lemma: pronounMap[token] };
        }
      }
      return obj;
    });

    const subject = resolvedWordObjects.find(o => o.pos === 'pronoun' || o.pos === 'noun') || resolvedWordObjects[0];
    const verb = resolvedWordObjects.find(o => o.pos === 'verb');
    const numbers = resolvedWordObjects.filter(o => o.pos === 'number' || o.pos === 'numeral');
    const objects = resolvedWordObjects.filter(o => o !== subject && o !== verb && !numbers.includes(o));

    let izonParts = [];
    if (subject) izonParts.push(subject.lemma || subject.token);
    objects.forEach(obj => izonParts.push(obj.lemma || obj.token));
    numbers.forEach(num => izonParts.push(num.lemma || num.token));
    if (verb) {
      let v = verb.lemma || verb.token;
      if (isNegative) v = `${v} ghá`; 
      if (isQuestion) v = `${v} yee`;
      izonParts.push(v);
    }
    return izonParts.filter((v, i, a) => a.indexOf(v) === i).join(' ');
  }

  generateIPA(word) {
    const ipaMap = {
      "a": "ä", "ẹ": "ɛ", "e": "e", "i": "i", "ị": "ɪ", 
      "o": "o", "ọ": "ɔ", "u": "u", "ụ": "ʊ",
      "gb": "ɡ͡b", "kp": "k͡p", "ny": "ɲ", "gh": "ɣ",
      "b": "b", "d": "d", "f": "f", "g": "ɡ", "h": "h",
      "j": "d͡ʒ", "k": "k", "l": "l", "m": "m", "n": "n",
      "p": "p", "r": "ɾ", "s": "s", "t": "t", "v": "v",
      "w": "w", "y": "j", "z": "z"
    };
    
    let ipa = word.toLowerCase();
    
    for (const [sound, ipaSound] of Object.entries(ipaMap)) {
      if (sound.length > 1) {
        const regex = new RegExp(sound, 'gu');
        ipa = ipa.replace(regex, ipaSound);
      }
    }
    
    for (const [sound, ipaSound] of Object.entries(ipaMap)) {
      if (sound.length === 1) {
        const regex = new RegExp(sound, 'g');
        ipa = ipa.replace(regex, ipaSound);
      }
    }
    return `/${ipa}/`;
  }
}

module.exports = IzonTranslationEngine;

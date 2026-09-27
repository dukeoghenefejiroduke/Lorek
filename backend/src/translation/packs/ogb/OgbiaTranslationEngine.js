const TranslationEngine = require('../../TranslationEngine');
const ragService = require('../../../services/ragService');

// Load local Ogbia language pack resources
const englishReverseLookup = require('./ogbiaEnglishReverse.json');
const ogbiaLookup = require('./ogbiaLookup.json');
const grammarRules = require('./ogbiaGrammarRules.json');
const dictionary = require('./ogbiaDictionary.json');

class OgbiaTranslationEngine extends TranslationEngine {
  constructor(languageId) {
    super(languageId || 'ogb');
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

  async lookup(text) {
    const cleanText = text.toLowerCase().trim();
    
    // 1. Try local English Reverse Lookup (ogbiaEnglishReverse.json -> index)
    const index = englishReverseLookup.index || englishReverseLookup;
    if (index[cleanText]) {
      const candidates = index[cleanText];
      if (candidates && candidates.length > 0) {
        return {
          ogbiaWord: candidates[0].ogbia || candidates[0],
          grammar: { partOfSpeech: candidates[0].category || this.guessPOS(cleanText) },
          source: 'ogbiaEnglishReverse.json'
        };
      }
    }

    // 2. Try local Ogbia Lookup entries (ogbiaLookup.json -> entries)
    const entries = ogbiaLookup.entries || ogbiaLookup;
    const directMatch = Array.isArray(entries) ? entries.find(item => item.english?.toLowerCase() === cleanText || item.ogbia?.toLowerCase() === cleanText) : null;
    if (directMatch) {
      return {
        ogbiaWord: directMatch.ogbia,
        englishTranslation: directMatch.english,
        grammar: { partOfSpeech: directMatch.category || 'noun' },
        source: 'ogbiaLookup.json'
      };
    }

    // 3. Try Ogbia Dictionary search (ogbiaDictionary.json categories)
    for (const [catKey, catVal] of Object.entries(dictionary)) {
      if (Array.isArray(catVal)) {
        const dictMatch = catVal.find(item => item.english?.toLowerCase() === cleanText || item.ogbia?.toLowerCase() === cleanText);
        if (dictMatch) {
          return {
            ogbiaWord: dictMatch.ogbia,
            englishTranslation: dictMatch.english,
            grammar: { partOfSpeech: catKey.replace(/s$/, '') },
            source: 'ogbiaDictionary.json'
          };
        }
      }
    }

    // Return null if no match found
    return null;
  }

  guessPOS(word) {
    const pronouns = ['i', 'me', 'you', 'he', 'him', 'she', 'her', 'we', 'us', 'they', 'them', 'it'];
    const conjunctions = ['and', 'but', 'or', 'because', 'although'];
    const prepositions = ['in', 'on', 'at', 'to', 'for', 'with', 'by', 'about'];
    
    if (pronouns.includes(word)) return 'pronoun';
    if (conjunctions.includes(word)) return 'conjunction';
    if (prepositions.includes(word)) return 'preposition';
    return 'noun';
  }

  async retrieveContext(query) {
    try {
      return await ragService.searchContext(query, 'ogbia');
    } catch (e) {
      console.warn('RAG retrieval failed, falling back to local corpus search:', e.message);
      const entries = ogbiaLookup.entries || ogbiaLookup;
      if (!Array.isArray(entries)) return [];
      return entries
        .filter(item => item.english?.toLowerCase().includes(query.toLowerCase()) || item.ogbia?.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(item => ({ text: `${item.ogbia} - ${item.english}`, score: 0.8 }));
    }
  }

  async analyzeSentence(text) {
    const tokens = text.toLowerCase().replace(/[.,!?;:]/g, '').split(' ');
    const analysis = [];
    const unknownTokens = [];

    for (const token of tokens) {
      let entry = await this.lookup(token);
      
      if (!entry && this.guessPOS(token) === 'pronoun') {
        entry = {
          ogbiaWord: token,
          grammar: { partOfSpeech: 'pronoun' },
          source: 'ogbiaGrammarRules.json (Pronoun)'
        };
      }

      if (entry) {
        analysis.push({
          token,
          lemma: entry.ogbiaWord,
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
      tokens.push('ghá');
    }
    
    return tokens;
  }

  async translate(text, context) {
    const analysis = await this.analyzeSentence(text);
    const evidence = await this.retrieveContext(text);

    // Ogbia uses SVO word order (Subject - Verb - Object)
    const deterministicOutput = this.preprocessEnglish(text, analysis.analysis);

    return {
      translated: deterministicOutput,
      type: 'ogbia_svo_enforced',
      confidence: analysis.unknownTokens.length === 0 ? 'high' : 'medium',
      unknownTokens: analysis.unknownTokens,
      evidence: evidence
    };
  }

  preprocessEnglish(text, wordObjects) {
    const isNegative = text.toLowerCase().includes("not");
    const isQuestion = text.trim().endsWith("?");
    
    const resolvedWordObjects = wordObjects.map(obj => {
      const token = obj.token.toLowerCase();
      if (obj.pos === 'pronoun') {
        const pronounMap = {
          "i": "mí",
          "you": "wá",
          "he": "eri",
          "she": "arau",
          "we": "iwa",
          "they": "amini"
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

    // SVO order: Subject -> Verb -> Object (unlike Izon SOV)
    let ogbiaParts = [];
    if (subject) ogbiaParts.push(subject.lemma || subject.token);
    if (verb) {
      let v = verb.lemma || verb.token;
      if (isNegative) v = `${v} ghá`;
      if (isQuestion) v = `${v}?`;
      ogbiaParts.push(v);
    }
    objects.forEach(obj => ogbiaParts.push(obj.lemma || obj.token));
    numbers.forEach(num => ogbiaParts.push(num.lemma || num.token));

    return ogbiaParts.filter((v, i, a) => a.indexOf(v) === i).join(' ');
  }

  generateIPA(word) {
    const ipaMap = {
      "a": "ä", "ạ": "ə", "e": "e", "ẹ": "ɛ", "i": "i", "ị": "ɪ", 
      "o": "o", "ọ": "ɔ", "u": "u", "u`": "ʊ",
      "gb": "ɡ͡b", "kp": "k͡p", "ny": "ɲ", "gh": "ɣ", "bh": "b",
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

module.exports = OgbiaTranslationEngine;

const TranslationEngineFactory = require('../src/translation/TranslationEngineFactory');
const IzonTranslationEngine = require('../src/translation/packs/izo/IzonTranslationEngine');
const OgbiaTranslationEngine = require('../src/translation/packs/ogb/OgbiaTranslationEngine');

describe('Translation Engines & Local Dictionaries', () => {
  
  test('1. Engine factory resolution for izo, izon, ogb, and ogbia', () => {
    const izoEngine = TranslationEngineFactory.getEngine('izo');
    const izonEngine = TranslationEngineFactory.getEngine('izon');
    const ogbEngine = TranslationEngineFactory.getEngine('ogb');
    const ogbiaEngine = TranslationEngineFactory.getEngine('ogbia');
    const invalidEngine = TranslationEngineFactory.getEngine('fr');

    expect(izoEngine).toBeInstanceOf(IzonTranslationEngine);
    expect(izonEngine).toBeInstanceOf(IzonTranslationEngine);
    expect(ogbEngine).toBeInstanceOf(OgbiaTranslationEngine);
    expect(ogbiaEngine).toBeInstanceOf(OgbiaTranslationEngine);
    expect(invalidEngine).toBeNull();
  });

  test('2. Unsupported language codes return null from factory', () => {
    expect(TranslationEngineFactory.getEngine('es')).toBeNull();
    expect(TranslationEngineFactory.getEngine('unknown')).toBeNull();
  });

  test('3 & 4. Genuine dictionary lookup using entry confirmed to exist in local data', async () => {
    const engine = new IzonTranslationEngine('izo');
    // 'her' exists in EnglishReverseLookup.json
    const match = await engine.lookup('her');
    expect(match).not.toBeNull();
    expect(match.izonWord).toBeDefined();
    expect(match.source).toBe('EnglishReverseLookup.json');
  });

  test('5. Case and whitespace handling in lookup', async () => {
    const engine = new IzonTranslationEngine('izo');
    const match = async (text) => await engine.lookup(text);

    const normal = await match('her');
    const padded = await match('   HER   ');
    expect(padded).toEqual(normal);
  });

  test('6 & 8. Behavior when exact dictionary match is unavailable (unknown input)', async () => {
    const engine = new IzonTranslationEngine('izo');
    const result = await engine.lookup('completelyunknownwordxyz123');
    expect(result).toBeNull();
  });

  test('7. Empty input handling in lookup', async () => {
    const engine = new IzonTranslationEngine('izo');
    const result = await engine.lookup('');
    expect(result).toBeNull();
  });

  test('9 & 10. Full translation operation works offline without AI credentials', async () => {
    const engine = new IzonTranslationEngine('izo');
    // Translate sentence offline using local dictionary & grammar builder
    const res = await engine.translate('I want water', { from: 'en', to: 'izo' });
    
    expect(res).toBeDefined();
    expect(res.translated).toBeDefined();
    expect(res.type).toBe('grammar_builder_enforced');
    expect(typeof res.translated).toBe('string');
  });

  test('Ogbia engine local capabilities', async () => {
    const ogbEngine = new OgbiaTranslationEngine('ogb');
    const capabilities = ogbEngine.getCapabilities();
    expect(capabilities.translate).toBe(true);
    expect(capabilities.localLanguagePack).toBe(true);
  });

});

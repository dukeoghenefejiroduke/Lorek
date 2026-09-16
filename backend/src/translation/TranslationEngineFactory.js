const IzonTranslationEngine = require('./packs/izo/IzonTranslationEngine');

class TranslationEngineFactory {
  static getEngine(languageCode) {
    switch (languageCode.toLowerCase()) {
      case 'izo':
      case 'izon':
        return new IzonTranslationEngine('izo');
      default:
        return null;
    }
  }
}

module.exports = TranslationEngineFactory;

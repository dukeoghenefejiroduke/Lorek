const IzonTranslationEngine = require('./packs/izo/IzonTranslationEngine');
const OgbiaTranslationEngine = require('./packs/ogb/OgbiaTranslationEngine');

class TranslationEngineFactory {
  static getEngine(languageCode) {
    switch (languageCode.toLowerCase()) {
      case 'izo':
      case 'izon':
        return new IzonTranslationEngine('izo');
      case 'ogb':
      case 'ogbia':
        return new OgbiaTranslationEngine('ogb');
      default:
        return null;
    }
  }
}

module.exports = TranslationEngineFactory;

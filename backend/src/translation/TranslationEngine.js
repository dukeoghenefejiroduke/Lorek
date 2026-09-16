/**
 * Base TranslationEngine interface.
 * All language packs must implement these methods.
 */
class TranslationEngine {
  constructor(languageId) {
    this.languageId = languageId;
  }

  // Mandatory: Core translation method
  async translate(text, context) {
    throw new Error('translate() not implemented');
  }

  // Mandatory: Lexical lookup
  async lookup(text) {
    throw new Error('lookup() not implemented');
  }

  // Optional: Capability discovery
  getCapabilities() {
    return {
      translate: false,
      analyze: false,
      pronunciation: false,
      contextRetrieval: false
    };
  }

  // Optional: Health check
  async healthCheck() {
    return { status: 'ok' };
  }
}

module.exports = TranslationEngine;

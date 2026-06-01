const Language = require('../models/Language');

/**
 * Middleware to extract language context from Accept-Language header
 * and attach languageId and languageCode to the request.
 */
const languageContext = async (req, res, next) => {
  try {
    const langHeader = req.headers['accept-language'];
    let langCode = langHeader || 'IZON';

    // If it's a comma-separated list (like in browsers), take the first one
    if (langCode.includes(',')) {
      langCode = langCode.split(',')[0].trim();
    }

    // Find language in DB
    // We can optimize this by caching in redis if needed
    const language = await Language.findOne({ code: langCode.toUpperCase() });

    if (language) {
      req.languageId = language._id;
      req.languageCode = language.code;
    } else {
      // Fallback to default language if not found
      const defaultLang = await Language.findOne({ code: 'IZON' });
      if (defaultLang) {
        req.languageId = defaultLang._id;
        req.languageCode = defaultLang.code;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = languageContext;

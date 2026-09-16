/**
 * Centralized Answer Validation System
 * Supported features:
 * - Lowercase & whitespace normalization
 * - Punctuation & unicode normalization
 * - Configurable acceptable/alternative answers
 */

export const normalizeText = (text) => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFC') // Normalize Unicode characters
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Collapse double spaces to single space
};

export const validateAnswer = (userInput, correctAnswer, acceptableAnswers = []) => {
  if (!userInput) return false;
  
  const normalizedUser = normalizeText(userInput);
  const normalizedCorrect = normalizeText(correctAnswer);
  
  if (normalizedUser === normalizedCorrect) {
    return true;
  }
  
  // Support configuration of alternative translations
  if (acceptableAnswers && acceptableAnswers.length > 0) {
    return acceptableAnswers.some(ans => normalizeText(ans) === normalizedUser);
  }
  
  return false;
};
